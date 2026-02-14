'use strict';

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CALLBACK_BASE_URL = (process.env.CALLBACK_BASE_URL || 'https://oauth.platform.hanzo.ai').replace(/\/+$/, '');

// In-memory state store for CSRF + redirect tracking.
// In production with multiple replicas, swap for Redis.
const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// --- Provider configurations ---

const PROVIDERS = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl:     'https://github.com/login/oauth/access_token',
    userUrl:      'https://api.github.com/user',
    scopes:       'repo,user:email,admin:repo_hook',
    clientId:     () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
    // GitHub does not issue refresh tokens by default and tokens do not expire.
    parseTokenResponse(data) {
      return {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt:    data.expires_in
          ? Math.floor(Date.now() / 1000) + Number(data.expires_in)
          : 0,
      };
    },
    buildRefreshBody(refreshToken, clientId, clientSecret) {
      return new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     clientId,
        client_secret: clientSecret,
      });
    },
    tokenContentType: 'application/x-www-form-urlencoded',
    tokenAccept:      'application/json',
    revokeUrl:        'https://api.github.com/applications/{client_id}/token',
    async revoke(accessToken, _refreshToken, clientId, clientSecret) {
      // GitHub uses Basic auth with client credentials to revoke.
      const res = await fetch(
        `https://api.github.com/applications/${clientId}/token`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
            'Content-Type':  'application/json',
            'Accept':        'application/vnd.github+json',
          },
          body: JSON.stringify({ access_token: accessToken }),
        },
      );
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`GitHub revoke failed: ${res.status} ${text}`);
      }
    },
  },

  gitlab: {
    authorizeUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl:     'https://gitlab.com/oauth/token',
    userUrl:      'https://gitlab.com/api/v4/user',
    scopes:       'api read_user read_repository write_repository',
    clientId:     () => process.env.GITLAB_CLIENT_ID,
    clientSecret: () => process.env.GITLAB_CLIENT_SECRET,
    parseTokenResponse(data) {
      return {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt:    data.created_at && data.expires_in
          ? Number(data.created_at) + Number(data.expires_in)
          : data.expires_in
            ? Math.floor(Date.now() / 1000) + Number(data.expires_in)
            : 0,
      };
    },
    buildRefreshBody(refreshToken, clientId, clientSecret) {
      return new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     clientId,
        client_secret: clientSecret,
      });
    },
    tokenContentType: 'application/x-www-form-urlencoded',
    tokenAccept:      'application/json',
    async revoke(accessToken, _refreshToken, clientId, clientSecret) {
      const res = await fetch('https://gitlab.com/oauth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token:         accessToken,
          client_id:     clientId,
          client_secret: clientSecret,
        }),
      });
      if (!res.ok && res.status !== 200) {
        const text = await res.text();
        throw new Error(`GitLab revoke failed: ${res.status} ${text}`);
      }
    },
  },

  bitbucket: {
    authorizeUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl:     'https://bitbucket.org/site/oauth2/access_token',
    userUrl:      'https://api.bitbucket.org/2.0/user',
    scopes:       'account repository:admin pullrequest:write webhook',
    clientId:     () => process.env.BITBUCKET_CLIENT_ID,
    clientSecret: () => process.env.BITBUCKET_CLIENT_SECRET,
    parseTokenResponse(data) {
      return {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt:    data.expires_in
          ? Math.floor(Date.now() / 1000) + Number(data.expires_in)
          : 0,
      };
    },
    buildRefreshBody(refreshToken, clientId, clientSecret) {
      return new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      });
    },
    // Bitbucket uses Basic auth for token requests.
    tokenAuthHeader(clientId, clientSecret) {
      return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    },
    tokenContentType: 'application/x-www-form-urlencoded',
    tokenAccept:      'application/json',
    async revoke(accessToken, refreshToken, clientId, clientSecret) {
      // Bitbucket supports revoking via the token endpoint with token_type_hint.
      const body = new URLSearchParams({
        token:           accessToken,
        token_type_hint: 'access_token',
      });
      const res = await fetch('https://bitbucket.org/site/oauth2/revoke_token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body,
      });
      if (!res.ok && res.status !== 200) {
        const text = await res.text();
        throw new Error(`Bitbucket revoke failed: ${res.status} ${text}`);
      }
    },
  },
};

// --- Helpers ---

function getProvider(name) {
  const p = PROVIDERS[name];
  if (!p) return null;
  return p;
}

function generateState() {
  return crypto.randomBytes(24).toString('hex');
}

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (now - val.createdAt > STATE_TTL_MS) stateStore.delete(key);
  }
}

// Periodic cleanup every 5 minutes.
setInterval(cleanExpiredStates, 5 * 60 * 1000).unref();

async function exchangeCode(provider, code, redirectUri) {
  const clientId     = provider.clientId();
  const clientSecret = provider.clientSecret();

  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const headers = {
    'Content-Type': provider.tokenContentType,
    'Accept':       provider.tokenAccept || 'application/json',
  };

  if (provider.tokenAuthHeader) {
    headers['Authorization'] = provider.tokenAuthHeader(clientId, clientSecret);
  }

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    // GitHub may return form-encoded by default, but we request JSON.
    const text = await res.text();
    data = Object.fromEntries(new URLSearchParams(text));
  }

  if (data.error) {
    throw new Error(`Token error: ${data.error} - ${data.error_description || ''}`);
  }

  return provider.parseTokenResponse(data);
}

// --- Routes ---

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'oauth-proxy' });
});

// Initiate OAuth flow.
app.get('/:provider', (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);
  if (!provider) return res.status(404).json({ error: `unknown provider: ${providerName}` });

  const clientId = provider.clientId();
  if (!clientId) return res.status(500).json({ error: `${providerName} not configured` });

  const redirect = req.query.redirect;
  if (!redirect) return res.status(400).json({ error: 'redirect query parameter is required' });

  const state = generateState();
  stateStore.set(state, { redirect, provider: providerName, createdAt: Date.now() });

  const callbackUrl = `${CALLBACK_BASE_URL}/${providerName}/callback`;
  const scope = provider.scopes;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  callbackUrl,
    scope,
    state,
    response_type: 'code',
  });

  res.redirect(`${provider.authorizeUrl}?${params}`);
});

// OAuth callback.
app.get('/:provider/callback', async (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);
  if (!provider) return res.status(404).json({ error: `unknown provider: ${providerName}` });

  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `OAuth error from ${providerName}: ${error}` });
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'missing code or state parameter' });
  }

  const stored = stateStore.get(state);
  if (!stored) {
    return res.status(400).json({ error: 'invalid or expired state' });
  }
  stateStore.delete(state);

  if (stored.provider !== providerName) {
    return res.status(400).json({ error: 'state provider mismatch' });
  }

  try {
    const callbackUrl = `${CALLBACK_BASE_URL}/${providerName}/callback`;
    const tokens = await exchangeCode(provider, code, callbackUrl);

    const redirectUrl = new URL(stored.redirect);
    redirectUrl.searchParams.set('access_token',  tokens.accessToken);
    redirectUrl.searchParams.set('refresh_token',  tokens.refreshToken);
    redirectUrl.searchParams.set('expires_at',     String(tokens.expiresAt));
    redirectUrl.searchParams.set('provider',       providerName);

    res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error(`Token exchange error (${providerName}):`, err.message);
    res.status(502).json({ error: 'token exchange failed', detail: err.message });
  }
});

// Refresh token.
app.post('/:provider/refresh', async (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);
  if (!provider) return res.status(404).json({ error: `unknown provider: ${providerName}` });

  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

  const clientId     = provider.clientId();
  const clientSecret = provider.clientSecret();

  try {
    const body = provider.buildRefreshBody(refreshToken, clientId, clientSecret);
    const headers = {
      'Content-Type': provider.tokenContentType,
      'Accept':       provider.tokenAccept || 'application/json',
    };

    if (provider.tokenAuthHeader) {
      headers['Authorization'] = provider.tokenAuthHeader(clientId, clientSecret);
    }

    const tokenRes = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers,
      body,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Refresh failed: ${tokenRes.status} ${text}`);
    }

    const data = await tokenRes.json();
    if (data.error) {
      throw new Error(`Refresh error: ${data.error} - ${data.error_description || ''}`);
    }

    const tokens = provider.parseTokenResponse(data);
    res.json({
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt:    tokens.expiresAt,
    });
  } catch (err) {
    console.error(`Refresh error (${providerName}):`, err.message);
    res.status(502).json({ error: 'token refresh failed', detail: err.message });
  }
});

// Revoke token.
app.post('/:provider/revoke', async (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);
  if (!provider) return res.status(404).json({ error: `unknown provider: ${providerName}` });

  const { accessToken, refreshToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken is required' });

  const clientId     = provider.clientId();
  const clientSecret = provider.clientSecret();

  try {
    await provider.revoke(accessToken, refreshToken, clientId, clientSecret);
    res.json({ status: 'revoked' });
  } catch (err) {
    console.error(`Revoke error (${providerName}):`, err.message);
    res.status(502).json({ error: 'token revocation failed', detail: err.message });
  }
});

// --- Start ---

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`oauth-proxy listening on :${PORT}`);
  });
}

module.exports = app;

'use strict';

// Minimal self-checking test. No external test framework.
// Runs against the express app directly using supertest-style HTTP.

const http = require('http');
const app = require('./index.js');

let server;
let baseUrl;
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    failed++;
    console.error(`  FAIL: ${msg}`);
  } else {
    passed++;
    console.log(`  PASS: ${msg}`);
  }
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {},
    };

    let payload;
    if (body) {
      payload = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = null; }
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  server = app.listen(0);
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;

  console.log(`\nTest server on :${addr.port}\n`);

  // 1. Health check
  console.log('--- Health ---');
  {
    const r = await request('GET', '/health');
    assert(r.status === 200, 'health returns 200');
    assert(r.body && r.body.status === 'ok', 'health body is ok');
  }

  // 2. Unknown provider
  console.log('--- Unknown provider ---');
  {
    const r = await request('GET', '/bogus?redirect=http://localhost');
    assert(r.status === 404, 'unknown provider returns 404');
  }

  // 3. Missing redirect param
  console.log('--- Missing redirect ---');
  {
    // Set env so provider is "configured"
    process.env.GITHUB_CLIENT_ID = 'test-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-secret';
    const r = await request('GET', '/github');
    assert(r.status === 400, 'missing redirect returns 400');
    assert(r.body && r.body.error.includes('redirect'), 'error mentions redirect');
  }

  // 4. GitHub initiate flow - should redirect (302)
  console.log('--- GitHub initiate ---');
  {
    const r = await request('GET', '/github?redirect=http://localhost:9999/done');
    assert(r.status === 302, 'github initiate returns 302');
    const loc = r.headers.location || '';
    assert(loc.startsWith('https://github.com/login/oauth/authorize'), 'redirects to GitHub');
    assert(loc.includes('client_id=test-id'), 'includes client_id');
    assert(loc.includes('state='), 'includes state');
    assert(loc.includes('scope=repo'), 'includes scopes');
  }

  // 5. Callback with invalid state
  console.log('--- Callback invalid state ---');
  {
    const r = await request('GET', '/github/callback?code=abc&state=invalid');
    assert(r.status === 400, 'invalid state returns 400');
  }

  // 6. Callback missing code
  console.log('--- Callback missing code ---');
  {
    const r = await request('GET', '/github/callback?state=something');
    assert(r.status === 400, 'missing code returns 400');
  }

  // 7. Refresh missing body
  console.log('--- Refresh missing token ---');
  {
    const r = await request('POST', '/github/refresh', {});
    assert(r.status === 400, 'missing refreshToken returns 400');
  }

  // 8. Revoke missing body
  console.log('--- Revoke missing token ---');
  {
    const r = await request('POST', '/github/revoke', {});
    assert(r.status === 400, 'missing accessToken returns 400');
  }

  // 9. GitLab initiate flow
  console.log('--- GitLab initiate ---');
  {
    process.env.GITLAB_CLIENT_ID = 'gl-id';
    process.env.GITLAB_CLIENT_SECRET = 'gl-secret';
    const r = await request('GET', '/gitlab?redirect=http://localhost:9999/done');
    assert(r.status === 302, 'gitlab initiate returns 302');
    const loc = r.headers.location || '';
    assert(loc.startsWith('https://gitlab.com/oauth/authorize'), 'redirects to GitLab');
  }

  // 10. Bitbucket initiate flow
  console.log('--- Bitbucket initiate ---');
  {
    process.env.BITBUCKET_CLIENT_ID = 'bb-id';
    process.env.BITBUCKET_CLIENT_SECRET = 'bb-secret';
    const r = await request('GET', '/bitbucket?redirect=http://localhost:9999/done');
    assert(r.status === 302, 'bitbucket initiate returns 302');
    const loc = r.headers.location || '';
    assert(loc.startsWith('https://bitbucket.org/site/oauth2/authorize'), 'redirects to Bitbucket');
  }

  // 11. Provider not configured (no env vars)
  console.log('--- Provider not configured ---');
  {
    const origId = process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_ID;
    const r = await request('GET', '/github?redirect=http://localhost:9999/done');
    assert(r.status === 500, 'unconfigured provider returns 500');
    process.env.GITHUB_CLIENT_ID = origId;
  }

  // 12. OAuth error from provider
  console.log('--- OAuth error from provider ---');
  {
    const r = await request('GET', '/github/callback?error=access_denied');
    assert(r.status === 400, 'oauth error returns 400');
    assert(r.body && r.body.error.includes('access_denied'), 'error includes provider error');
  }

  // Summary
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  if (server) server.close();
  process.exit(1);
});

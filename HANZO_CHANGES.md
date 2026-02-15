# Hanzo PaaS - Changes from Agnost

## Overview
This is a fork of Agnost GitOps with all hardcoded `api.agnost.dev` references removed and made configurable via environment variables.

## Environment Variables

### Frontend (platform-ui)
- `VITE_IAM_ORIGIN` - Hanzo IAM origin (default: `https://hanzo.id`)
- `VITE_IAM_CLIENT_ID` - OAuth client ID (default: `hanzo-platform-client-id`)
- `VITE_IAM_SCOPE` - OAuth scope (default: `openid profile email`)
- `VITE_DOCS_URL` - Documentation URL (default: `https://docs.hanzo.ai/platform`)
- `VITE_CHANGELOG_URL` - Changelog URL (default: `https://github.com/hanzoai/platform/releases`)
- `VITE_ACME_DOMAIN` - ACME challenge domain (default: `hanzo.ai`)

### Backend (platform/monitor)
- `OAUTH_URL` - OAuth service URL (default: `https://hanzo.id/api/oauth`)
- `IAM_ENDPOINT` - Hanzo IAM endpoint (default: `https://hanzo.id`)
- `IAM_USERINFO_URL` - IAM userinfo endpoint (default: `https://hanzo.id/api/userinfo`)
- `GROUP_NAME` - DNS solver group name (default: `hanzo.ai`)
- `SOLVER_NAME` - DNS solver name (default: `hanzo`)

## Files Modified

1. `platform-ui/src/features/auth/Providers/Providers.tsx` - OAuth redirect URL
2. `platform-ui/src/features/auth/UserProviders/UserProviders.tsx` - User OAuth URL
3. `platform-ui/src/features/container/config/SourceConfig.tsx` - Git provider OAuth
4. `platform-ui/src/components/Error/Error.tsx` - Bug report endpoint
5. `platform-ui/src/components/Header/Feedback.tsx` - Feedback endpoint
6. `platform-ui/src/constants/constants.ts` - Docs and changelog URLs
7. `platform-ui/src/features/cluster/CustomDomain/DnsSettings.tsx` - ACME domain
8. `platform-ui/src/router/loader/AuthLoader.ts` - Redirect to hanzo.id for auth
9. `platform-ui/src/router/loader/HomeLoader.ts` - Landing page for unauthenticated users
10. `platform-ui/src/pages/home/Home.tsx` - Marketing landing page
11. `monitor/handler/monitorAccessTokens.js` - Token refresh endpoint
12. `platform/handlers/git.js` - Git provider revoke endpoint
13. `webhook/main.go` - DNS API URL
14. `k8s/webhook.yaml` - Webhook env vars
15. `k8s/platform.yaml` - Platform env vars

## Deployment

### Build Images
```bash
# Platform UI
cd platform-ui && docker build -t hanzoai/paas-ui:latest .

# Platform API
cd platform && docker build -t hanzoai/paas-api:latest .

# Monitor
cd monitor && docker build -t hanzoai/paas-monitor:latest .

# Sync
cd sync && docker build -t hanzoai/paas-sync:latest .

# Webhook
cd webhook && docker build -t hanzoai/paas-webhook:latest .
```

### Configure for Hanzo
Set the following environment variables:
```yaml
env:
  - name: OAUTH_URL
    value: "https://hanzo.id/api/oauth"
  - name: IAM_ENDPOINT
    value: "https://hanzo.id"
  - name: IAM_USERINFO_URL
    value: "https://hanzo.id/api/userinfo"
  - name: GROUP_NAME
    value: "hanzo.ai"
  - name: SOLVER_NAME
    value: "hanzo"
```

## Auth Flow

All authentication goes through hanzo.id as a unified IAM gateway:
1. User visits platform.hanzo.ai → sees landing page
2. Clicks "Sign in" → redirected to hanzo.id OAuth authorize
3. Authenticates via email, GitHub, Google, or wallet
4. hanzo.id exchanges code for tokens → redirects back to platform
5. Platform backend validates tokens via IAM userinfo endpoint

## Future Work

- [ ] Replace tRPC with JSON-RPC/GraphQL/ZAP
- [ ] Integrate MCP (Model Context Protocol)
- [ ] Merge with existing platform UI
- [ ] Add Hanzo branding to platform UI

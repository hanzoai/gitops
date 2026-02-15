# Hanzo PaaS - Changes from Agnost

## Overview
This is a fork of Agnost GitOps with all hardcoded `api.agnost.dev` references removed and made configurable via environment variables.

## Environment Variables

### Frontend (Studio)
- `VITE_OAUTH_URL` - OAuth provider URL (default: `{origin}/api/oauth`)
- `VITE_API_URL` - API URL for feedback/bug reports (default: `''`)
- `VITE_DOCS_URL` - Documentation URL (default: `https://docs.hanzo.ai/platform`)
- `VITE_CHANGELOG_URL` - Changelog URL (default: `https://github.com/hanzoai/platform/releases`)
- `VITE_ACME_DOMAIN` - ACME challenge domain (default: `hanzo.ai`)

### Backend (Platform/Monitor)
- `OAUTH_URL` - OAuth service URL (default: `https://api.agnost.dev/oauth`)
- `GROUP_NAME` - DNS solver group name (default: `hanzo.ai`)
- `SOLVER_NAME` - DNS solver name (default: `hanzo`)
- `DNS_API_URL` - DNS API URL for webhook (default: `https://api.agnost.dev`)

## Files Modified

1. `studio/src/features/auth/Providers/Providers.tsx` - OAuth redirect URL
2. `studio/src/features/auth/UserProviders/UserProviders.tsx` - User OAuth URL
3. `studio/src/features/container/config/SourceConfig.tsx` - Git provider OAuth
4. `studio/src/components/Error/Error.tsx` - Bug report endpoint
5. `studio/src/components/Header/Feedback.tsx` - Feedback endpoint
6. `studio/src/constants/constants.ts` - Docs and changelog URLs
7. `studio/src/features/cluster/CustomDomain/DnsSettings.tsx` - ACME domain
8. `monitor/handler/monitorAccessTokens.js` - Token refresh endpoint
9. `platform/handlers/git.js` - Git provider revoke endpoint
10. `webhook/main.go` - DNS API URL
11. `k8s/webhook.yaml` - Webhook env vars
12. `k8s/platform.yaml` - Platform env vars

## Deployment

### Build Images
```bash
# Studio
cd studio && docker build -t hanzoai/paas-ui:latest .

# Platform
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
  - name: GROUP_NAME
    value: "hanzo.ai"
  - name: SOLVER_NAME
    value: "hanzo"
```

## Integration with Hanzo IAM

The OAuth flow can be integrated with Hanzo IAM by:
1. Creating GitHub/GitLab/Bitbucket OAuth apps pointing to hanzo.id
2. Implementing `/api/oauth/{provider}` endpoints in IAM
3. Setting `OAUTH_URL=https://hanzo.id/api/oauth`

## Future Work

- [ ] Replace tRPC with JSON-RPC/GraphQL/ZAP
- [ ] Integrate MCP (Model Context Protocol)
- [ ] Merge with existing platform UI
- [ ] Add Hanzo branding to Studio UI

# =============================================================================
# Hanzo PaaS v2 — Production Dockerfile
# Multi-stage build for pnpm monorepo with Next.js 15 standalone output
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: base — shared Alpine + pnpm via corepack
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.6 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# Stage 2: deps — install ALL dependencies (dev + prod)
# Native addons (ssh2, cpu-features) require a C/C++ toolchain.
# ---------------------------------------------------------------------------
FROM base AS deps

RUN apk add --no-cache python3 make g++ libc-dev

# Copy only the manifests pnpm needs to resolve the workspace graph.
# This layer is cached until any package.json or the lockfile changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json                  ./apps/web/package.json
COPY packages/api/package.json              ./packages/api/package.json
COPY packages/db/package.json               ./packages/db/package.json
COPY packages/shared/package.json           ./packages/shared/package.json
COPY packages/orchestrator/package.json     ./packages/orchestrator/package.json
COPY packages/jobs/package.json             ./packages/jobs/package.json

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 3: build — compile TypeScript + produce Next.js standalone bundle
# ---------------------------------------------------------------------------
FROM base AS build

RUN apk add --no-cache python3 make g++ libc-dev

# Copy the fully-installed workspace from deps (preserves pnpm symlinks)
COPY --from=deps /app ./

# Overlay source code on top of the installed tree
COPY . .

# Ensure apps/web/public exists (standalone COPY in runner needs it)
RUN mkdir -p apps/web/public

ENV NEXT_TELEMETRY_DISABLED=1

# turbo respects the package dependency graph:
#   @paas/shared → @paas/db → @paas/api → @paas/orchestrator → @paas/jobs → @paas/web
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 4: runner — minimal production image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# With outputFileTracingRoot at monorepo root, standalone mirrors the full
# workspace path structure:
#   apps/web/.next/standalone/           → traced node_modules + server.js
#   apps/web/.next/standalone/apps/web/  → the app's server.js lives here
#
# Static assets and public/ are NOT included in standalone and must be
# copied separately.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static    ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public          ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]

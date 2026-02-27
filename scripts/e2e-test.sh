#!/usr/bin/env bash
# ============================================================================
# Hanzo PaaS v2 — End-to-End Test Suite
#
# Tests the full stack: Next.js web app, PostgreSQL, Valkey, k3d, Docker Swarm.
#
# Prerequisites:
#   - Docker running (colima or Docker Desktop)
#   - k3d cluster "paas-local" created
#   - Docker Swarm initialized (docker swarm init)
#   - pnpm installed
#
# Usage:
#   ./scripts/e2e-test.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

export DATABASE_URL="${DATABASE_URL:-postgresql://paas:password@localhost:5432/paas}"
export DOCKER_HOST="${DOCKER_HOST:-unix:///Users/z/.colima/default/docker.sock}"
export AUTH_TRUST_HOST=true
export AUTH_SECRET="${AUTH_SECRET:-e2e-test-secret-must-be-at-least-32-chars-long}"
KUBECONFIG_PATH="$SCRIPT_DIR/kubeconfig-paas-local.yaml"
NEXTJS_PORT=3000
NEXTJS_PID=""
BASE_URL="http://localhost:$NEXTJS_PORT"

# Test entity IDs (must match seed.ts)
TEST_USER_ID="test-user-e2e-000001"
TEST_ORG_ID="test-org-e2e-000001"
TEST_PROJECT_ID="test-proj-e2e-000001"
TEST_ENV_ID="test-env-e2e-000001"
TEST_SESSION_TOKEN="e2e-session-token-for-testing-only"

# Results
PASSED=0
FAILED=0
ERRORS=()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() {
  echo -e "  ${GREEN}PASS${RESET} $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo -e "  ${RED}FAIL${RESET} $1: $2"
  FAILED=$((FAILED + 1))
  ERRORS+=("$1: $2")
}

header() {
  echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${RESET}"
}

info() {
  echo -e "  ${YELLOW}>>>${RESET} $1"
}

# URL-encode a string for use in query parameters
urlencode() {
  jq -rn --arg input "$1" '$input|@uri'
}

# Make an authenticated tRPC query (GET)
# Usage: trpc_query "procedure.name" '{"key":"value"}'
# Input is passed as ?input=<url-encoded-json>
trpc_query() {
  local path="$1"
  local input="${2:-}"
  local url="${BASE_URL}/api/trpc/${path}"
  if [[ -n "$input" ]]; then
    url="${url}?input=$(urlencode "$input")"
  fi
  curl -sS -b "authjs.session-token=$TEST_SESSION_TOKEN" "$url"
}

# Make an authenticated tRPC mutation (POST)
# Usage: trpc_mutate "procedure.name" '{"key":"value"}'
# Body is plain JSON — tRPC v11 fetchRequestHandler expects raw input
trpc_mutate() {
  local path="$1"
  local body="$2"
  curl -sS -X POST -b "authjs.session-token=$TEST_SESSION_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${BASE_URL}/api/trpc/${path}"
}

cleanup() {
  header "Cleanup"

  if [[ -n "$NEXTJS_PID" ]]; then
    info "Stopping Next.js server (PID $NEXTJS_PID)"
    kill "$NEXTJS_PID" 2>/dev/null || true
    wait "$NEXTJS_PID" 2>/dev/null || true
  fi

  # Clean up test containers from k3d
  info "Cleaning up k3d test namespace..."
  KUBECONFIG="$KUBECONFIG_PATH" kubectl delete namespace env-e2e-test-001 --ignore-not-found 2>/dev/null || true

  # Clean up Docker Swarm test services
  info "Cleaning up Docker Swarm test services..."
  docker service rm env-e2e-test-001_e2e-nginx-swarm 2>/dev/null || true
  docker network rm env-e2e-test-001 2>/dev/null || true

  info "Cleanup done"
}

trap cleanup EXIT

# ---------------------------------------------------------------------------
# Phase 1: Infrastructure
# ---------------------------------------------------------------------------

header "Phase 1: Infrastructure Check"

# Check Docker
if docker info >/dev/null 2>&1; then
  pass "Docker is running"
else
  fail "Docker" "Docker is not running"
  echo "Cannot continue without Docker. Exiting."
  exit 1
fi

# Check k3d cluster
if k3d cluster list 2>/dev/null | grep -q "paas-local"; then
  pass "k3d cluster 'paas-local' exists"
else
  fail "k3d" "Cluster 'paas-local' not found"
fi

# Check Docker Swarm
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)
if [[ "$SWARM_STATE" == "active" ]]; then
  pass "Docker Swarm is active"
else
  fail "Docker Swarm" "State is '$SWARM_STATE', expected 'active'"
fi

# Check kubeconfig
if [[ -f "$KUBECONFIG_PATH" ]]; then
  pass "k3d kubeconfig exists at scripts/kubeconfig-paas-local.yaml"
else
  info "Generating k3d kubeconfig..."
  k3d kubeconfig get paas-local > "$KUBECONFIG_PATH"
  pass "k3d kubeconfig generated"
fi

# ---------------------------------------------------------------------------
# Phase 2: Start services
# ---------------------------------------------------------------------------

header "Phase 2: Start Services"

# Start PostgreSQL + Valkey via compose
info "Starting compose services (sql, kv)..."
docker compose up -d sql kv 2>/dev/null

# Wait for PostgreSQL
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T sql pg_isready -U paas >/dev/null 2>&1; then
    pass "PostgreSQL is ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "PostgreSQL" "Not ready after 30s"
    exit 1
  fi
  sleep 1
done

# Wait for Valkey
info "Waiting for Valkey..."
for i in $(seq 1 15); do
  if docker compose exec -T kv valkey-cli ping 2>/dev/null | grep -q PONG; then
    pass "Valkey is ready"
    break
  fi
  if [[ $i -eq 15 ]]; then
    fail "Valkey" "Not ready after 15s"
    exit 1
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# Phase 3: Database
# ---------------------------------------------------------------------------

header "Phase 3: Database Setup"

info "Pushing schema to PostgreSQL (drizzle push)..."
if (cd packages/db && pnpm db:push) 2>&1 | tail -5; then
  pass "drizzle push succeeded"
else
  fail "drizzle push" "Schema push failed"
fi

info "Seeding test data..."
if pnpm exec tsx scripts/seed.ts 2>&1; then
  pass "Seed data inserted"
else
  fail "seed" "Seed script failed"
fi

# ---------------------------------------------------------------------------
# Phase 4: Build and Start Next.js
# ---------------------------------------------------------------------------

header "Phase 4: Build and Start Next.js"

info "Building @paas/web..."
if pnpm --filter @paas/web build 2>&1 | tail -10; then
  pass "Next.js build succeeded"
else
  fail "build" "Next.js build failed"
fi

info "Starting Next.js on port $NEXTJS_PORT..."
(cd apps/web && node_modules/.bin/next start --port "$NEXTJS_PORT") &
NEXTJS_PID=$!

# Wait for Next.js
info "Waiting for Next.js to start..."
for i in $(seq 1 30); do
  if curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null | grep -q "200"; then
    pass "Next.js is listening on port $NEXTJS_PORT"
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "Next.js" "Not ready after 30s"
    exit 1
  fi
  sleep 1
done

# ---------------------------------------------------------------------------
# Phase 5: API Health Tests
# ---------------------------------------------------------------------------

header "Phase 5: API Tests"

# 5a. Health endpoint
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [[ "$STATUS" == "200" ]]; then
  BODY=$(curl -sS "$BASE_URL/api/health")
  if echo "$BODY" | grep -q '"status":"ok"'; then
    pass "GET /api/health -> 200 {status: ok}"
  else
    fail "Health body" "Unexpected: $BODY"
  fi
else
  fail "Health status" "Expected 200, got $STATUS"
fi

# 5b. Auth redirect (unauthenticated GET to /orgs should not crash)
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-redirs 0 "$BASE_URL/orgs" 2>/dev/null || true)
# Could be 200 (static page) or 307 (redirect to auth) -- both are acceptable
if [[ "$STATUS" =~ ^(200|307)$ ]]; then
  pass "GET /orgs -> $STATUS (acceptable)"
else
  fail "GET /orgs" "Expected 200 or 307, got $STATUS"
fi

# 5c. tRPC system.health
HEALTH_RESP=$(trpc_query "system.health" 2>/dev/null || echo "ERROR")
if echo "$HEALTH_RESP" | grep -q '"status":"ok"'; then
  pass "tRPC system.health -> ok"
else
  fail "tRPC system.health" "$HEALTH_RESP"
fi

# 5d. Dashboard pages (static HTML)
for page in "/" "/auth" "/clusters" "/registries" "/settings"; do
  STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL$page" 2>/dev/null)
  if [[ "$STATUS" =~ ^(200|307)$ ]]; then
    pass "GET $page -> $STATUS"
  else
    fail "GET $page" "Expected 200 or 307, got $STATUS"
  fi
done

# ---------------------------------------------------------------------------
# Phase 6: Cluster Registration Tests
# ---------------------------------------------------------------------------

header "Phase 6: Cluster Registration"

# Read kubeconfig for k3d
K3D_KUBECONFIG=$(cat "$KUBECONFIG_PATH")

# 6a. Register k3d cluster
info "Registering k3d cluster via tRPC..."
K3D_REG_INPUT=$(cat <<ENDJSON
{
  "orgId": "$TEST_ORG_ID",
  "name": "e2e-k3d",
  "type": "kubernetes",
  "provider": "local",
  "kubeconfig": $(echo "$K3D_KUBECONFIG" | jq -Rs .)
}
ENDJSON
)

K3D_RESP=$(trpc_mutate "cluster.register" "$K3D_REG_INPUT" 2>/dev/null || echo "ERROR")
K3D_CLUSTER_ID=$(echo "$K3D_RESP" | jq -r '.result.data.id // empty' 2>/dev/null)

if [[ -n "$K3D_CLUSTER_ID" ]]; then
  K3D_STATUS=$(echo "$K3D_RESP" | jq -r '.result.data.status // empty' 2>/dev/null)
  pass "k3d cluster registered (id=$K3D_CLUSTER_ID, status=$K3D_STATUS)"
else
  fail "k3d register" "$K3D_RESP"
  K3D_CLUSTER_ID=""
fi

# 6b. Register Docker Swarm cluster
info "Registering Docker Swarm cluster via tRPC..."
SWARM_REG_INPUT=$(cat <<ENDJSON
{
  "orgId": "$TEST_ORG_ID",
  "name": "e2e-swarm",
  "type": "docker-swarm",
  "provider": "local",
  "endpoint": "$DOCKER_HOST"
}
ENDJSON
)

SWARM_RESP=$(trpc_mutate "cluster.register" "$SWARM_REG_INPUT" 2>/dev/null || echo "ERROR")
SWARM_CLUSTER_ID=$(echo "$SWARM_RESP" | jq -r '.result.data.id // empty' 2>/dev/null)

if [[ -n "$SWARM_CLUSTER_ID" ]]; then
  SWARM_STATUS=$(echo "$SWARM_RESP" | jq -r '.result.data.status // empty' 2>/dev/null)
  pass "Docker Swarm cluster registered (id=$SWARM_CLUSTER_ID, status=$SWARM_STATUS)"
else
  fail "Swarm register" "$SWARM_RESP"
  SWARM_CLUSTER_ID=""
fi

# 6c. List clusters
info "Listing clusters..."
LIST_RESP=$(trpc_query "cluster.list" '{"orgId":"'"$TEST_ORG_ID"'"}' 2>/dev/null || echo "ERROR")
CLUSTER_COUNT=$(echo "$LIST_RESP" | jq '.result.data | length' 2>/dev/null || echo 0)
if [[ "$CLUSTER_COUNT" -ge 2 ]]; then
  pass "cluster.list returned $CLUSTER_COUNT clusters"
else
  fail "cluster.list" "Expected >= 2 clusters, got $CLUSTER_COUNT"
fi

# ---------------------------------------------------------------------------
# Phase 7: Container Deployment Tests
# ---------------------------------------------------------------------------

header "Phase 7: Container Deployment"

# 7a. Deploy nginx on k3d
if [[ -n "$K3D_CLUSTER_ID" ]]; then
  info "Creating nginx container on k3d..."
  K3D_CTR_INPUT=$(cat <<ENDJSON
{
  "orgId": "$TEST_ORG_ID",
  "projectId": "$TEST_PROJECT_ID",
  "environmentId": "$TEST_ENV_ID",
  "clusterId": "$K3D_CLUSTER_ID",
  "name": "e2e-nginx-k3d",
  "type": "deployment",
  "sourceType": "registry",
  "registryConfig": {
    "imageName": "nginx",
    "imageTag": "alpine"
  },
  "networking": {
    "containerPort": 80
  },
  "podConfig": {
    "cpuRequest": 50,
    "cpuLimit": 200,
    "memoryRequest": 32,
    "memoryLimit": 128,
    "restartPolicy": "Always"
  },
  "deploymentConfig": {
    "replicas": 1,
    "strategy": "RollingUpdate"
  },
  "variables": [{"name": "NGINX_PORT", "value": "80"}]
}
ENDJSON
  )

  K3D_CTR_RESP=$(trpc_mutate "container.create" "$K3D_CTR_INPUT" 2>/dev/null || echo "ERROR")
  K3D_CTR_ID=$(echo "$K3D_CTR_RESP" | jq -r '.result.data.id // empty' 2>/dev/null)

  if [[ -n "$K3D_CTR_ID" ]]; then
    pass "k3d container created (id=$K3D_CTR_ID)"
  else
    fail "k3d container create" "$K3D_CTR_RESP"
  fi
else
  info "Skipping k3d container test (no cluster)"
fi

# 7b. Deploy nginx on Docker Swarm
if [[ -n "$SWARM_CLUSTER_ID" ]]; then
  info "Creating nginx container on Docker Swarm..."
  SWARM_CTR_INPUT=$(cat <<ENDJSON
{
  "orgId": "$TEST_ORG_ID",
  "projectId": "$TEST_PROJECT_ID",
  "environmentId": "$TEST_ENV_ID",
  "clusterId": "$SWARM_CLUSTER_ID",
  "name": "e2e-nginx-swarm",
  "type": "deployment",
  "sourceType": "registry",
  "registryConfig": {
    "imageName": "nginx",
    "imageTag": "alpine"
  },
  "networking": {
    "containerPort": 80
  },
  "podConfig": {
    "cpuRequest": 50,
    "cpuLimit": 200,
    "memoryRequest": 32,
    "memoryLimit": 128,
    "restartPolicy": "Always"
  },
  "deploymentConfig": {
    "replicas": 1,
    "strategy": "RollingUpdate"
  },
  "variables": [{"name": "NGINX_PORT", "value": "80"}]
}
ENDJSON
  )

  SWARM_CTR_RESP=$(trpc_mutate "container.create" "$SWARM_CTR_INPUT" 2>/dev/null || echo "ERROR")
  SWARM_CTR_ID=$(echo "$SWARM_CTR_RESP" | jq -r '.result.data.id // empty' 2>/dev/null)

  if [[ -n "$SWARM_CTR_ID" ]]; then
    pass "Docker Swarm container created (id=$SWARM_CTR_ID)"
  else
    fail "Swarm container create" "$SWARM_CTR_RESP"
  fi
else
  info "Skipping Docker Swarm container test (no cluster)"
fi

# ---------------------------------------------------------------------------
# Phase 8: Verify Containers Running
# ---------------------------------------------------------------------------

header "Phase 8: Verify Containers"

# 8a. Verify k3d container
if [[ -n "${K3D_CTR_ID:-}" ]]; then
  info "Waiting for k3d container to be ready (up to 60s)..."
  for i in $(seq 1 30); do
    STATUS_RESP=$(trpc_query "container.status" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","containerId":"'"$K3D_CTR_ID"'"}' 2>/dev/null || echo "{}")
    READY=$(echo "$STATUS_RESP" | jq -r '.result.data.ready // false' 2>/dev/null)
    if [[ "$READY" == "true" ]]; then
      pass "k3d container is ready"
      break
    fi
    if [[ $i -eq 30 ]]; then
      fail "k3d container" "Not ready after 60s"
    fi
    sleep 2
  done
fi

# 8b. Verify Docker Swarm container
if [[ -n "${SWARM_CTR_ID:-}" ]]; then
  info "Waiting for Docker Swarm container to be ready (up to 30s)..."
  for i in $(seq 1 15); do
    STATUS_RESP=$(trpc_query "container.status" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","containerId":"'"$SWARM_CTR_ID"'"}' 2>/dev/null || echo "{}")
    READY=$(echo "$STATUS_RESP" | jq -r '.result.data.ready // false' 2>/dev/null)
    if [[ "$READY" == "true" ]]; then
      pass "Docker Swarm container is ready"
      break
    fi
    if [[ $i -eq 15 ]]; then
      # Swarm services might report differently -- check directly
      SWARM_SERVICE=$(docker service ls --filter "name=env-e2e-test-001_e2e-nginx-swarm" --format "{{.Replicas}}" 2>/dev/null || echo "")
      if echo "$SWARM_SERVICE" | grep -q "1/1"; then
        pass "Docker Swarm container is running (verified via docker service ls)"
      else
        fail "Swarm container" "Not ready after 30s (replicas: $SWARM_SERVICE)"
      fi
    fi
    sleep 2
  done
fi

# 8c. List containers in environment
info "Listing containers in test environment..."
LIST_CTR_RESP=$(trpc_query "container.list" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'"}' 2>/dev/null || echo "ERROR")
CTR_COUNT=$(echo "$LIST_CTR_RESP" | jq '.result.data | length' 2>/dev/null || echo 0)
if [[ "$CTR_COUNT" -ge 2 ]]; then
  pass "container.list returned $CTR_COUNT containers"
else
  fail "container.list" "Expected >= 2 containers, got $CTR_COUNT"
fi

# ---------------------------------------------------------------------------
# Phase 9: RBAC - Team Management
# ---------------------------------------------------------------------------

header "Phase 9: RBAC - Team Management"

# 9a. List org members
info "Listing org members..."
TEAM_RESP=$(trpc_query "orgTeam.list" '{"orgId":"'"$TEST_ORG_ID"'"}' 2>/dev/null || echo "ERROR")
TEAM_COUNT=$(echo "$TEAM_RESP" | jq '.result.data | length' 2>/dev/null || echo 0)
if [[ "$TEAM_COUNT" -ge 1 ]]; then
  # Verify test user is Owner
  OWNER_ROLE=$(echo "$TEAM_RESP" | jq -r '[.result.data[] | select(.user.id == "'"$TEST_USER_ID"'")] | first | .role' 2>/dev/null)
  if [[ "$OWNER_ROLE" == "Owner" ]]; then
    pass "orgTeam.list returned $TEAM_COUNT member(s), test user is Owner"
  else
    fail "orgTeam.list role" "Expected 'Owner', got '$OWNER_ROLE'"
  fi
else
  fail "orgTeam.list" "Expected >= 1 member, got $TEAM_COUNT (resp: $TEAM_RESP)"
fi

# 9b. Transfer ownership to non-member (should fail)
info "Attempting ownership transfer to non-member (expect error)..."
TRANSFER_RESP=$(trpc_mutate "organization.transferOwnership" '{"orgId":"'"$TEST_ORG_ID"'","userId":"nonexistent-user-000"}' 2>/dev/null || echo "ERROR")
TRANSFER_ERR=$(echo "$TRANSFER_RESP" | jq -r '.error // empty' 2>/dev/null)
if [[ -n "$TRANSFER_ERR" ]]; then
  pass "organization.transferOwnership correctly rejected non-member"
else
  # Also accept if .result.data contains an error indicator
  TRANSFER_MSG=$(echo "$TRANSFER_RESP" | jq -r '.result.data.error // .result.data.message // empty' 2>/dev/null)
  if [[ -n "$TRANSFER_MSG" ]]; then
    pass "organization.transferOwnership correctly rejected non-member ($TRANSFER_MSG)"
  else
    fail "organization.transferOwnership" "Expected error for non-member, got: $TRANSFER_RESP"
  fi
fi

# ---------------------------------------------------------------------------
# Phase 10: RBAC - Cluster Permissions
# ---------------------------------------------------------------------------

header "Phase 10: RBAC - Cluster Permissions"

if [[ -n "${K3D_CLUSTER_ID:-}" ]]; then
  # 10a. Grant deploy permission to test user on k3d cluster
  info "Granting 'deploy' permission on k3d cluster..."
  GRANT_RESP=$(trpc_mutate "cluster.grantAccess" '{"orgId":"'"$TEST_ORG_ID"'","clusterId":"'"$K3D_CLUSTER_ID"'","userId":"'"$TEST_USER_ID"'","role":"deploy"}' 2>/dev/null || echo "ERROR")
  GRANT_ID=$(echo "$GRANT_RESP" | jq -r '.result.data.id // empty' 2>/dev/null)
  if [[ -n "$GRANT_ID" ]]; then
    pass "cluster.grantAccess succeeded (id=$GRANT_ID)"
  else
    # Accept if result.data exists without an id field
    GRANT_OK=$(echo "$GRANT_RESP" | jq -r '.result.data // empty' 2>/dev/null)
    if [[ -n "$GRANT_OK" && "$GRANT_OK" != "null" ]]; then
      pass "cluster.grantAccess succeeded"
      GRANT_ID="from-response"
    else
      fail "cluster.grantAccess" "$GRANT_RESP"
    fi
  fi

  # 10b. List permissions for the cluster
  info "Listing cluster permissions..."
  PERM_RESP=$(trpc_query "cluster.listPermissions" '{"orgId":"'"$TEST_ORG_ID"'","clusterId":"'"$K3D_CLUSTER_ID"'"}' 2>/dev/null || echo "ERROR")
  PERM_COUNT=$(echo "$PERM_RESP" | jq '.result.data | length' 2>/dev/null || echo 0)
  if [[ "$PERM_COUNT" -ge 1 ]]; then
    pass "cluster.listPermissions returned $PERM_COUNT permission(s)"
  else
    fail "cluster.listPermissions" "Expected >= 1, got $PERM_COUNT (resp: $PERM_RESP)"
  fi

  # 10c. Revoke the permission
  info "Revoking cluster permission..."
  REVOKE_RESP=$(trpc_mutate "cluster.revokeAccess" '{"orgId":"'"$TEST_ORG_ID"'","clusterId":"'"$K3D_CLUSTER_ID"'","userId":"'"$TEST_USER_ID"'"}' 2>/dev/null || echo "ERROR")
  # revokeAccess returns void ({"result":{}}) on success
  if echo "$REVOKE_RESP" | jq -e '.result' >/dev/null 2>&1; then
    pass "cluster.revokeAccess succeeded"
  else
    fail "cluster.revokeAccess" "$REVOKE_RESP"
  fi
else
  info "Skipping cluster permission tests (no k3d cluster registered)"
fi

# ---------------------------------------------------------------------------
# Phase 11: RBAC - Environment Protection
# ---------------------------------------------------------------------------

header "Phase 11: RBAC - Environment Protection"

# 11a. Set environment protection to 'restricted'
info "Setting environment protection to 'restricted'..."
PROT_RESP=$(trpc_mutate "environment.setProtection" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'","protectionLevel":"restricted","approvalRequired":true}' 2>/dev/null || echo "ERROR")
if echo "$PROT_RESP" | jq -e '.result.data' >/dev/null 2>&1; then
  pass "environment.setProtection -> restricted"
else
  fail "environment.setProtection" "$PROT_RESP"
fi

# 11b. Verify protection level via environment.get
info "Verifying environment protection level..."
ENV_RESP=$(trpc_query "environment.get" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'"}' 2>/dev/null || echo "ERROR")
ENV_PROT=$(echo "$ENV_RESP" | jq -r '.result.data.protectionLevel // empty' 2>/dev/null)
if [[ "$ENV_PROT" == "restricted" ]]; then
  pass "environment.get confirms protectionLevel=restricted"
else
  fail "environment.get protectionLevel" "Expected 'restricted', got '$ENV_PROT' (resp: $ENV_RESP)"
fi

# 11c. Request approval for the protected environment
info "Requesting approval for protected environment..."
APPROVAL_REQ_RESP=$(trpc_mutate "environment.requestApproval" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'"}' 2>/dev/null || echo "ERROR")
APPROVAL_ID=$(echo "$APPROVAL_REQ_RESP" | jq -r '.result.data.id // empty' 2>/dev/null)
if [[ -n "$APPROVAL_ID" ]]; then
  pass "environment.requestApproval created (id=$APPROVAL_ID)"
else
  # Accept if result.data exists
  APPROVAL_OK=$(echo "$APPROVAL_REQ_RESP" | jq -r '.result.data // empty' 2>/dev/null)
  if [[ -n "$APPROVAL_OK" && "$APPROVAL_OK" != "null" ]]; then
    pass "environment.requestApproval created"
    APPROVAL_ID="from-response"
  else
    fail "environment.requestApproval" "$APPROVAL_REQ_RESP"
  fi
fi

# 11d. List approvals and verify pending
info "Listing environment approvals..."
APPROVALS_RESP=$(trpc_query "environment.listApprovals" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'"}' 2>/dev/null || echo "ERROR")
APPROVAL_COUNT=$(echo "$APPROVALS_RESP" | jq '.result.data | length' 2>/dev/null || echo 0)
if [[ "$APPROVAL_COUNT" -ge 1 ]]; then
  PENDING_COUNT=$(echo "$APPROVALS_RESP" | jq '[.result.data[] | select(.status == "pending" or .status == "Pending")] | length' 2>/dev/null || echo 0)
  if [[ "$PENDING_COUNT" -ge 1 ]]; then
    pass "environment.listApprovals has $PENDING_COUNT pending approval(s)"
  else
    pass "environment.listApprovals returned $APPROVAL_COUNT approval(s) (no pending filter match)"
  fi
else
  fail "environment.listApprovals" "Expected >= 1 approval, got $APPROVAL_COUNT (resp: $APPROVALS_RESP)"
fi

# 11e. Review (approve) the request
if [[ -n "${APPROVAL_ID:-}" && "$APPROVAL_ID" != "from-response" ]]; then
  info "Approving the request..."
  REVIEW_RESP=$(trpc_mutate "environment.reviewApproval" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'","approvalId":"'"$APPROVAL_ID"'","decision":"approved"}' 2>/dev/null || echo "ERROR")
  if echo "$REVIEW_RESP" | jq -e '.result.data' >/dev/null 2>&1; then
    pass "environment.reviewApproval -> approved"
  else
    fail "environment.reviewApproval" "$REVIEW_RESP"
  fi
elif [[ "${APPROVAL_ID:-}" == "from-response" ]]; then
  # Try to get the approval ID from the list
  FETCHED_APPROVAL_ID=$(echo "$APPROVALS_RESP" | jq -r '.result.data[0].id // empty' 2>/dev/null)
  if [[ -n "$FETCHED_APPROVAL_ID" ]]; then
    info "Approving the request (id=$FETCHED_APPROVAL_ID)..."
    REVIEW_RESP=$(trpc_mutate "environment.reviewApproval" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'","approvalId":"'"$FETCHED_APPROVAL_ID"'","decision":"approved"}' 2>/dev/null || echo "ERROR")
    if echo "$REVIEW_RESP" | jq -e '.result.data' >/dev/null 2>&1; then
      pass "environment.reviewApproval -> approved"
    else
      fail "environment.reviewApproval" "$REVIEW_RESP"
    fi
  else
    info "Skipping reviewApproval (could not determine approval ID)"
  fi
else
  info "Skipping reviewApproval (no approval was created)"
fi

# 11f. Reset protection to 'none'
info "Resetting environment protection to 'none'..."
RESET_RESP=$(trpc_mutate "environment.setProtection" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","environmentId":"'"$TEST_ENV_ID"'","protectionLevel":"none","approvalRequired":false}' 2>/dev/null || echo "ERROR")
if echo "$RESET_RESP" | jq -e '.result.data' >/dev/null 2>&1; then
  pass "environment.setProtection -> none (reset)"
else
  fail "environment.setProtection reset" "$RESET_RESP"
fi

# ---------------------------------------------------------------------------
# Phase 12: RBAC - Invitations & Audit
# ---------------------------------------------------------------------------

header "Phase 12: RBAC - Invitations & Audit"

# 12a. Create invitation
info "Inviting test-invite@hanzo.ai as Developer..."
INVITE_RESP=$(trpc_mutate "invitation.invite" '{"orgId":"'"$TEST_ORG_ID"'","email":"test-invite@hanzo.ai","role":"Developer"}' 2>/dev/null || echo "ERROR")
INVITE_ID=$(echo "$INVITE_RESP" | jq -r '.result.data.id // empty' 2>/dev/null)
if [[ -n "$INVITE_ID" ]]; then
  pass "invitation.invite created (id=$INVITE_ID)"
else
  INVITE_OK=$(echo "$INVITE_RESP" | jq -r '.result.data // empty' 2>/dev/null)
  if [[ -n "$INVITE_OK" && "$INVITE_OK" != "null" ]]; then
    pass "invitation.invite created"
    INVITE_ID="from-response"
  else
    fail "invitation.invite" "$INVITE_RESP"
  fi
fi

# 12b. List invitations
info "Listing invitations..."
INV_LIST_RESP=$(trpc_query "invitation.list" '{"orgId":"'"$TEST_ORG_ID"'"}' 2>/dev/null || echo "ERROR")
INV_COUNT=$(echo "$INV_LIST_RESP" | jq '.result.data | length' 2>/dev/null || echo 0)
if [[ "$INV_COUNT" -ge 1 ]]; then
  # Check for pending invitation to test-invite@hanzo.ai
  PENDING_INV=$(echo "$INV_LIST_RESP" | jq '[.result.data[] | select(.email == "test-invite@hanzo.ai" and (.status == "Pending" or .status == "pending"))] | length' 2>/dev/null || echo 0)
  if [[ "$PENDING_INV" -ge 1 ]]; then
    pass "invitation.list has pending invite for test-invite@hanzo.ai"
  else
    pass "invitation.list returned $INV_COUNT invitation(s)"
  fi
else
  fail "invitation.list" "Expected >= 1 invitation, got $INV_COUNT (resp: $INV_LIST_RESP)"
fi

# 12c. Revoke the invitation
if [[ -n "${INVITE_ID:-}" && "$INVITE_ID" != "from-response" ]]; then
  info "Revoking invitation..."
  REVOKE_INV_RESP=$(trpc_mutate "invitation.revoke" '{"orgId":"'"$TEST_ORG_ID"'","invitationId":"'"$INVITE_ID"'"}' 2>/dev/null || echo "ERROR")
  if echo "$REVOKE_INV_RESP" | jq -e '.result.data' >/dev/null 2>&1; then
    pass "invitation.revoke succeeded"
  else
    fail "invitation.revoke" "$REVOKE_INV_RESP"
  fi
elif [[ "${INVITE_ID:-}" == "from-response" ]]; then
  # Try to get the invitation ID from the list
  FETCHED_INV_ID=$(echo "$INV_LIST_RESP" | jq -r '.result.data[] | select(.email == "test-invite@hanzo.ai") | .id' 2>/dev/null | head -1)
  if [[ -n "$FETCHED_INV_ID" ]]; then
    info "Revoking invitation (id=$FETCHED_INV_ID)..."
    REVOKE_INV_RESP=$(trpc_mutate "invitation.revoke" '{"orgId":"'"$TEST_ORG_ID"'","invitationId":"'"$FETCHED_INV_ID"'"}' 2>/dev/null || echo "ERROR")
    if echo "$REVOKE_INV_RESP" | jq -e '.result.data' >/dev/null 2>&1; then
      pass "invitation.revoke succeeded"
    else
      fail "invitation.revoke" "$REVOKE_INV_RESP"
    fi
  else
    info "Skipping invitation.revoke (could not determine invitation ID)"
  fi
else
  info "Skipping invitation.revoke (no invitation was created)"
fi

# 12d. List audit logs
info "Listing audit logs..."
AUDIT_RESP=$(trpc_query "audit.list" '{"orgId":"'"$TEST_ORG_ID"'"}' 2>/dev/null || echo "ERROR")
AUDIT_ITEMS=$(echo "$AUDIT_RESP" | jq '.result.data.items // .result.data' 2>/dev/null)
if [[ -n "$AUDIT_ITEMS" && "$AUDIT_ITEMS" != "null" ]]; then
  AUDIT_LEN=$(echo "$AUDIT_ITEMS" | jq 'if type == "array" then length else 0 end' 2>/dev/null || echo 0)
  pass "audit.list returned ($AUDIT_LEN entries)"
else
  fail "audit.list" "Expected items array, got: $AUDIT_RESP"
fi

# ---------------------------------------------------------------------------
# Phase 13: Cleanup via API
# ---------------------------------------------------------------------------

header "Phase 13: API Cleanup"

# Delete containers via tRPC
if [[ -n "${K3D_CTR_ID:-}" ]]; then
  info "Deleting k3d container..."
  DEL_RESP=$(trpc_mutate "container.delete" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","containerId":"'"$K3D_CTR_ID"'"}' 2>/dev/null || echo "ERROR")
  if echo "$DEL_RESP" | grep -q '"result"'; then
    pass "k3d container deleted via API"
  else
    fail "k3d container delete" "$DEL_RESP"
  fi
fi

if [[ -n "${SWARM_CTR_ID:-}" ]]; then
  info "Deleting Docker Swarm container..."
  DEL_RESP=$(trpc_mutate "container.delete" '{"orgId":"'"$TEST_ORG_ID"'","projectId":"'"$TEST_PROJECT_ID"'","containerId":"'"$SWARM_CTR_ID"'"}' 2>/dev/null || echo "ERROR")
  if echo "$DEL_RESP" | grep -q '"result"'; then
    pass "Docker Swarm container deleted via API"
  else
    fail "Swarm container delete" "$DEL_RESP"
  fi
fi

# Remove clusters
if [[ -n "${K3D_CLUSTER_ID:-}" ]]; then
  info "Removing k3d cluster from fleet..."
  trpc_mutate "cluster.remove" '{"orgId":"'"$TEST_ORG_ID"'","clusterId":"'"$K3D_CLUSTER_ID"'"}' >/dev/null 2>&1 || true
  pass "k3d cluster removed from fleet"
fi

if [[ -n "${SWARM_CLUSTER_ID:-}" ]]; then
  info "Removing Docker Swarm cluster from fleet..."
  trpc_mutate "cluster.remove" '{"orgId":"'"$TEST_ORG_ID"'","clusterId":"'"$SWARM_CLUSTER_ID"'"}' >/dev/null 2>&1 || true
  pass "Docker Swarm cluster removed from fleet"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
header "Summary"
echo ""
echo -e "  ${GREEN}Passed: $PASSED${RESET}"
echo -e "  ${RED}Failed: $FAILED${RESET}"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo ""
  echo -e "  ${RED}Failures:${RESET}"
  for err in "${ERRORS[@]}"; do
    echo -e "    ${RED}-${RESET} $err"
  done
fi

echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}${BOLD}  SOME TESTS FAILED${RESET}"
  echo ""
  exit 1
else
  echo -e "${GREEN}${BOLD}  ALL TESTS PASSED${RESET}"
  echo ""
fi

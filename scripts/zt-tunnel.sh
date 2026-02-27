#!/usr/bin/env bash
# ============================================================================
# Hanzo PaaS v2 — ZeroTrust Tunnel Setup
#
# Creates a tunnel from the local development machine to the Hanzo PaaS
# running on hanzo-k8s (do-sfo3-hanzo-k8s).
#
# Architecture:
#   Local machine (port 3000) <---> cloudflared quick-tunnel <---> internet
#   Local machine <---> kubectl port-forward <---> hanzo-k8s services
#
# The tunnel exposes:
#   - Local PaaS (Next.js) at a temporary *.trycloudflare.com URL
#   - Remote hanzo-k8s services via port-forwarding
#
# For production ZeroTrust (OpenZiti + zrok):
#   The hanzo-zt namespace on hanzo-k8s runs:
#     - hanzo-zt-controller (OpenZiti controller at zt-api.hanzo.ai)
#     - hanzo-zt-router (OpenZiti edge router)
#     - hanzo-zt-console (ZiTi console at ztc.hanzo.ai)
#     - zrok-controller (zrok overlay at zrok.hanzo.ai)
#     - hanzo-zt-mcp-gateway (MCP tools over ZT mesh)
#
# Usage:
#   ./scripts/zt-tunnel.sh [mode]
#
# Modes:
#   dev       - Port-forward remote services locally (default)
#   expose    - Expose local PaaS via cloudflared quick-tunnel
#   full      - Both: port-forward remote + expose local
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

K8S_CONTEXT="do-sfo3-hanzo-k8s"
ZT_NAMESPACE="hanzo-zt"
HANZO_NAMESPACE="hanzo"

MODE="${1:-dev}"

PIDS=()

cleanup() {
  echo ""
  echo "Shutting down tunnel..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "Done."
}

trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Mode: dev — port-forward hanzo-k8s services locally
# ---------------------------------------------------------------------------

start_port_forwards() {
  echo "Starting port-forwards from hanzo-k8s..."
  echo ""

  # ZT Controller API (OpenZiti management)
  echo "  zt-api   : localhost:11280 -> hanzo-zt-controller:1280"
  kubectl --context "$K8S_CONTEXT" port-forward -n "$ZT_NAMESPACE" \
    svc/hanzo-zt-controller 11280:1280 &
  PIDS+=($!)

  # ZT Console (OpenZiti admin UI)
  echo "  zt-console: localhost:11443 -> hanzo-zt-console:80"
  kubectl --context "$K8S_CONTEXT" port-forward -n "$ZT_NAMESPACE" \
    svc/hanzo-zt-console 11443:80 &
  PIDS+=($!)

  # zrok Controller
  echo "  zrok     : localhost:18080 -> zrok-controller:18080"
  kubectl --context "$K8S_CONTEXT" port-forward -n "$ZT_NAMESPACE" \
    svc/zrok-controller 18080:18080 &
  PIDS+=($!)

  # ZT Router (for edge connections)
  echo "  zt-router: localhost:13022 -> hanzo-zt-router:3022"
  kubectl --context "$K8S_CONTEXT" port-forward -n "$ZT_NAMESPACE" \
    svc/hanzo-zt-router 13022:3022 &
  PIDS+=($!)

  echo ""
  echo "Port-forwards active. Services available at:"
  echo "  ZT Controller API  : https://localhost:11280"
  echo "  ZT Console         : http://localhost:11443"
  echo "  zrok Controller    : http://localhost:18080"
  echo "  ZT Router          : localhost:13022"
  echo ""
}

# ---------------------------------------------------------------------------
# Mode: expose — expose local PaaS via cloudflared quick-tunnel
# ---------------------------------------------------------------------------

start_cloudflare_tunnel() {
  local local_port="${PAAS_PORT:-3000}"

  echo "Starting cloudflared quick-tunnel for localhost:$local_port..."
  echo ""

  cloudflared tunnel --url "http://localhost:$local_port" &
  PIDS+=($!)

  # Wait a moment for cloudflared to print the URL
  sleep 3
  echo ""
  echo "Your local PaaS is now accessible via the *.trycloudflare.com URL above."
  echo "Share this URL with teammates for testing."
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

echo "============================================"
echo "  Hanzo PaaS — ZeroTrust Tunnel"
echo "  Mode: $MODE"
echo "============================================"
echo ""

case "$MODE" in
  dev)
    start_port_forwards
    ;;
  expose)
    start_cloudflare_tunnel
    ;;
  full)
    start_port_forwards
    start_cloudflare_tunnel
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: $0 [dev|expose|full]"
    exit 1
    ;;
esac

echo "Press Ctrl+C to stop."
echo ""

# Keep running until interrupted
wait

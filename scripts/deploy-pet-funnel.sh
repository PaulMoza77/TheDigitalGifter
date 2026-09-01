#!/usr/bin/env bash
# Safe production deploy: pet-funnel Edge only (Apple Pay contact-save fix).
# Does NOT touch pet-provider-status, Stripe webhooks, or frontend.
# Requires: SUPABASE_ACCESS_TOKEN with deploy rights for kjlsocejpmnzhhduyumy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

echo "Safe deploy: pet-funnel only → $PROJECT_REF"
npx --yes supabase functions deploy pet-funnel \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

EDGE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/pet-funnel"
echo "Deployed. Probe: POST $EDGE_URL (expects JSON API, not HTML)."
# Lightweight reachability check — OPTIONS/GET may 405; any non-HTML response is fine.
CODE="$(curl -sS -m 20 -o /tmp/pet-funnel-probe.txt -w '%{http_code}' \
  -X POST "$EDGE_URL" \
  -H 'Content-Type: application/json' \
  -d '{}' || true)"
BODY_HEAD="$(head -c 120 /tmp/pet-funnel-probe.txt 2>/dev/null || true)"
echo "Probe HTTP $CODE body[:120]=$BODY_HEAD"
if echo "$BODY_HEAD" | grep -qi '<html'; then
  echo "ERROR: pet-funnel returned HTML — deploy may have missed the function."
  exit 1
fi
echo "pet-funnel safe deploy complete."

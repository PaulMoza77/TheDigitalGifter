#!/usr/bin/env bash
# Safe production Edge deploy for Meta purchase attribution:
#   1) pet-funnel   — checkout metadata + InitiateCheckout CAPI (fbc/fbp)
#   2) stripe-webhook — Purchase CAPI + v2/v3 purchase attribution (shared fulfill)
# Does NOT touch pet-provider-status or frontend.
# Requires: SUPABASE_ACCESS_TOKEN with deploy rights for kjlsocejpmnzhhduyumy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

deploy_fn() {
  local name="$1"
  echo "Deploying ${name} → ${PROJECT_REF}"
  npx --yes supabase functions deploy "${name}" \
    --project-ref "${PROJECT_REF}" \
    --no-verify-jwt
}

echo "Safe Edge deploy: pet-funnel + stripe-webhook → $PROJECT_REF"
deploy_fn pet-funnel
deploy_fn stripe-webhook

# Also apply RO/IT geo exclusion migration + pet-analytics-sync when credentials allow.
# Non-fatal if DB password/Management API path is unavailable; VPS ingest already excludes RO/IT.
if [[ -x "${ROOT}/scripts/deploy-exclude-internal-geos.sh" ]]; then
  echo "Applying RO/IT funnel geo exclusion (migration + pet-analytics-sync)…"
  if ! bash "${ROOT}/scripts/deploy-exclude-internal-geos.sh"; then
    echo "WARN: geo exclusion SQL/edge apply failed — pet-funnel deploy itself succeeded."
    echo "Re-run scripts/deploy-exclude-internal-geos.sh once SUPABASE_DB_PASSWORD or Management API access works."
  fi
fi

EDGE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/pet-funnel"
echo "Deployed. Probe: POST $EDGE_URL (expects JSON API, not HTML)."
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

WH_URL="https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook"
WH_CODE="$(curl -sS -m 20 -o /tmp/stripe-webhook-probe.txt -w '%{http_code}' \
  -X POST "$WH_URL" \
  -H 'Content-Type: application/json' \
  -d '{"type":"probe"}' || true)"
WH_HEAD="$(head -c 120 /tmp/stripe-webhook-probe.txt 2>/dev/null || true)"
echo "stripe-webhook probe HTTP $WH_CODE body[:120]=$WH_HEAD"
if echo "$WH_HEAD" | grep -qi '<html'; then
  echo "ERROR: stripe-webhook returned HTML — deploy may have missed the function."
  exit 1
fi

echo "pet-funnel + stripe-webhook safe deploy complete."

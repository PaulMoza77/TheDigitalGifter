#!/usr/bin/env bash
# Apply Pet Funnel V4 New Sales Campaign analytics migration + deploy related Edge functions.
# Target project MUST be kjlsocejpmnzhhduyumy (TheDigitalGifter).
# Requires: SUPABASE_ACCESS_TOKEN
# Optional: SUPABASE_DB_PASSWORD / DATABASE_URL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIGRATION="supabase/migrations/20260910120000_pet_v4_sales_campaign_analytics.sql"
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing apply to unexpected project ref '$PROJECT_REF'."
  exit 2
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

if [[ ! -f "$MIGRATION" ]]; then
  echo "Missing $MIGRATION"
  exit 1
fi

if grep -Eiq 'drop table|truncate |delete from pet_v[123]_funnel|delete from pet_orders' "$MIGRATION"; then
  echo "BLOCKED: migration contains destructive SQL patterns."
  exit 2
fi

echo "Target project: $PROJECT_REF"
echo "Migration: $MIGRATION"

APPLIED=0

apply_via_management_api() {
  echo "Applying SQL via Management API database/query…"
  local payload code
  payload="$(node -e '
    const fs = require("fs");
    const q = fs.readFileSync(process.argv[1], "utf8");
    process.stdout.write(JSON.stringify({ query: q }));
  ' "$MIGRATION")"
  code="$(curl -sS -o /tmp/pet-v4-sql.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" || true)"
  echo "Management API HTTP $code"
  head -c 500 /tmp/pet-v4-sql.json 2>/dev/null || true
  echo
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    return 0
  fi
  return 1
}

if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  echo "Applying via DATABASE_URL…"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
  APPLIED=1
fi

if [[ "$APPLIED" != "1" && -n "${SUPABASE_DB_PASSWORD:-}" ]] && command -v psql >/dev/null 2>&1; then
  for HOST in \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-1-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-central-1.pooler.supabase.com" \
    "db.${PROJECT_REF}.supabase.co"
  do
    CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
    echo "Trying pooler host $HOST…"
    if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
      echo "Connected via $HOST — applying migration…"
      PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -f "$MIGRATION"
      APPLIED=1
      break
    fi
  done
fi

if [[ "$APPLIED" != "1" ]]; then
  if apply_via_management_api; then
    APPLIED=1
  fi
fi

if [[ "$APPLIED" != "1" ]]; then
  echo "FAILED: could not apply V4 analytics migration."
  exit 1
fi

echo "Migration applied. Deploying Edge functions…"
npx --yes supabase functions deploy pet-funnel \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt
npx --yes supabase functions deploy stripe-webhook \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt
npx --yes supabase functions deploy pet-analytics-sync \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "Verifying admin_pet_v4_analytics exists…"
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  code="$(curl -sS -o /tmp/pet-v4-rpc-probe.json -w '%{http_code}' \
    -X POST "${SUPABASE_URL%/}/rest/v1/rpc/admin_pet_v4_analytics" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"p_from":"2026-09-09T00:00:00Z","p_to":"2026-09-12T00:00:00Z","p_campaign_id":"120253729468900170"}' || true)"
  echo "RPC probe HTTP $code"
  head -c 300 /tmp/pet-v4-rpc-probe.json 2>/dev/null || true
  echo
  if [[ "$code" == "404" ]]; then
    echo "FAILED: admin_pet_v4_analytics still missing after apply."
    exit 1
  fi
fi

echo "Pet Funnel V4 analytics apply complete."

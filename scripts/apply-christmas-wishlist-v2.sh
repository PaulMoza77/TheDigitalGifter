#!/usr/bin/env bash
# Apply Christmas Wishlist V2 migration + deploy christmas-wishlist-funnel.
# Target project MUST be kjlsocejpmnzhhduyumy (TheDigitalGifter).
# Requires: SUPABASE_ACCESS_TOKEN
# Optional: SUPABASE_DB_PASSWORD / DATABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIGRATION="supabase/migrations/20260909140000_christmas_wishlist_v2_reservations.sql"
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

# Guardrails: additive only
if grep -Eiq 'drop table|truncate |delete from christmas_wishlist' "$MIGRATION"; then
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
  code="$(curl -sS -o /tmp/wishlist-v2-sql.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" || true)"
  echo "Management API HTTP $code"
  head -c 400 /tmp/wishlist-v2-sql.json 2>/dev/null || true
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
  echo "BLOCKED: could not apply migration (need working ACCESS_TOKEN privileges on TDG project and/or DB password)."
  exit 2
fi

echo "Migration applied."

echo "Deploying christmas-wishlist-funnel…"
npx --yes supabase functions deploy christmas-wishlist-funnel \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Verifying schema via REST…"
  c1="$(curl -sS -o /tmp/wl-v2-items.json -w '%{http_code}' \
    "${SUPABASE_URL%/}/rest/v1/christmas_wishlist_items?select=id,image_url,quantity,reservation_status&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" || true)"
  c2="$(curl -sS -o /tmp/wl-v2-lists.json -w '%{http_code}' \
    "${SUPABASE_URL%/}/rest/v1/christmas_wishlists?select=id,audience&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" || true)"
  echo "items_probe=$c1 wishlists_probe=$c2"
  if [[ "$c1" != "200" || "$c2" != "200" ]]; then
    echo "ERROR: schema verify failed after migration"
    head -c 200 /tmp/wl-v2-items.json; echo
    head -c 200 /tmp/wl-v2-lists.json; echo
    exit 2
  fi
  echo "SCHEMA_VERIFY_OK"
else
  echo "WARN: SUPABASE_URL/SERVICE_ROLE_KEY unset — skipped REST schema verify"
fi

echo "WISHLIST_V2_SUPABASE_OK project=$PROJECT_REF"

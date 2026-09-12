#!/usr/bin/env bash
# Apply pet multi-currency presentment constraint migration.
# Target project MUST be kjlsocejpmnzhhduyumy (TheDigitalGifter).
# Requires: SUPABASE_ACCESS_TOKEN
# Optional: SUPABASE_DB_PASSWORD / DATABASE_URL
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIGRATION="supabase/migrations/20260912120000_pet_multi_currency.sql"
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing apply to unexpected project ref '$PROJECT_REF'."
  exit 2
fi

if [[ ! -f "$MIGRATION" ]]; then
  echo "Missing $MIGRATION"
  exit 1
fi

if grep -Eiq 'drop table|truncate |delete from ' "$MIGRATION"; then
  echo "BLOCKED: migration contains destructive SQL patterns."
  exit 2
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

echo "Target project: $PROJECT_REF"
echo "Migration: $MIGRATION (currency check expand only)"

APPLIED=0

apply_via_management_api() {
  echo "Applying SQL via Management API database/query…"
  local payload
  payload="$(node -e '
    const fs = require("fs");
    const q = fs.readFileSync(process.argv[1], "utf8");
    process.stdout.write(JSON.stringify({ query: q }));
  ' "$MIGRATION")"
  local code
  code="$(curl -sS -o /tmp/pet-multi-currency-sql.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" || true)"
  echo "Management API HTTP $code"
  head -c 400 /tmp/pet-multi-currency-sql.json 2>/dev/null || true
  echo
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    return 0
  fi
  return 1
}

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Applying via DATABASE_URL…"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
  APPLIED=1
elif [[ -n "${SUPABASE_DB_PASSWORD:-}" ]] && command -v psql >/dev/null 2>&1; then
  echo "Trying pooler hosts with SUPABASE_DB_PASSWORD…"
  for HOST in \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-central-1.pooler.supabase.com" \
    "db.${PROJECT_REF}.supabase.co"
  do
    CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
    if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
      echo "Connected via $HOST"
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
  echo "FAILED: could not apply multi-currency migration."
  exit 1
fi

echo "Verifying currency constraints…"
VERIFY_PAYLOAD="$(node -e '
  const q = `
    select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conname in ('\''pet_orders_currency_chk'\'', '\''pet_offers_currency_chk'\'')
    order by 1;
  `;
  process.stdout.write(JSON.stringify({ query: q }));
')"
VERIFY_CODE="$(curl -sS -o /tmp/pet-multi-currency-verify.json -w '%{http_code}' \
  -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$VERIFY_PAYLOAD" || true)"
echo "verify_http=$VERIFY_CODE"
head -c 800 /tmp/pet-multi-currency-verify.json; echo

if ! grep -q "ron" /tmp/pet-multi-currency-verify.json; then
  echo "FAILED: verified constraints do not include ron/eur presentment currencies."
  exit 1
fi

echo "pet multi-currency migration applied and verified."

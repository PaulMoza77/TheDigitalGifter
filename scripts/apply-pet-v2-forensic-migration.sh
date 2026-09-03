#!/usr/bin/env bash
# Apply TDG Pet V2 forensic observability migration to production.
# Target project MUST be kjlsocejpmnzhhduyumy (TheDigitalGifter).
# Prefers SUPABASE_DB_PASSWORD (psql); falls back to Management API with SUPABASE_ACCESS_TOKEN.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MIGRATION="supabase/migrations/20260903140000_pet_v2_forensic_observability.sql"
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing apply to unexpected project ref '$PROJECT_REF'."
  exit 2
fi

if [[ ! -f "$MIGRATION" ]]; then
  echo "Missing $MIGRATION"
  exit 1
fi

# Non-destructive observability-only migration guardrails (file inspection).
if grep -Eiq 'drop table|truncate |delete from pet_v2_funnel_events|delete from pet_orders' "$MIGRATION"; then
  echo "BLOCKED: migration contains destructive SQL patterns."
  exit 2
fi
echo "Target project: $PROJECT_REF (production TheDigitalGifter)"
echo "Migration: $MIGRATION (constraint expand + diagnostics RPC; no destructive cleanup)"

APPLIED=0

apply_via_management_api() {
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    return 1
  fi
  echo "Applying SQL via Management API database/query…"
  local payload
  payload="$(node -e '
    const fs = require("fs");
    const q = fs.readFileSync(process.argv[1], "utf8");
    process.stdout.write(JSON.stringify({ query: q }));
  ' "$MIGRATION")"
  local code
  code="$(curl -sS -o /tmp/supabase-forensic-sql.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" || true)"
  echo "Management API HTTP $code"
  head -c 300 /tmp/supabase-forensic-sql.json 2>/dev/null || true
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
fi

if [[ "$APPLIED" != "1" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  for HOST in \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-1-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-west-2.pooler.supabase.com" \
    "aws-0-eu-central-1.pooler.supabase.com" \
    "db.${PROJECT_REF}.supabase.co"
  do
    CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
    echo "Trying pooler host $HOST…"
    if command -v psql >/dev/null 2>&1; then
      if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
        echo "Connected via $HOST — applying forensic migration…"
        PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -f "$MIGRATION"
        APPLIED=1
        break
      fi
    fi
  done
fi

if [[ "$APPLIED" != "1" ]]; then
  if apply_via_management_api; then
    APPLIED=1
  fi
fi

if [[ "$APPLIED" != "1" ]]; then
  echo "BLOCKED: need SUPABASE_DB_PASSWORD (or DATABASE_URL) and/or SUPABASE_ACCESS_TOKEN."
  echo "Until applied, v2_teaser_viewed / v2_checkout_session_* / payment diagnostic events fail name_chk."
  exit 2
fi

echo "Migration applied to $PROJECT_REF."

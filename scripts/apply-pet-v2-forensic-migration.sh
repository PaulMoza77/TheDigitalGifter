#!/usr/bin/env bash
# Apply TDG-PET-FUNNEL-FORENSIC-005 observability migration.
# Requires SUPABASE_DB_PASSWORD (or DATABASE_URL) for the production project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MIGRATION="supabase/migrations/20260903140000_pet_v2_forensic_observability.sql"
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

if [[ ! -f "$MIGRATION" ]]; then
  echo "Missing $MIGRATION"
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Applying via DATABASE_URL…"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
  exit 0
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "BLOCKED: set SUPABASE_DB_PASSWORD or DATABASE_URL to apply $MIGRATION"
  echo "Until applied, v2_teaser_viewed / v2_checkout_session_* / payment diagnostic events fail name_chk."
  exit 2
fi

HOSTS=(
  "aws-0-eu-west-1.pooler.supabase.com"
  "aws-0-us-east-1.pooler.supabase.com"
  "db.${PROJECT_REF}.supabase.co"
)
for HOST in "${HOSTS[@]}"; do
  CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
  if command -v psql >/dev/null 2>&1; then
    if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
      echo "Connected via $HOST — applying forensic migration…"
      PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -f "$MIGRATION"
      exit 0
    fi
  fi
done

echo "ERROR: could not connect with SUPABASE_DB_PASSWORD"
exit 1

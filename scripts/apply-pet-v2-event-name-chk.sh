#!/usr/bin/env bash
# Apply pet_v2_funnel_events name CHECK expansion (checkout/teaser events).
# Requires: SUPABASE_DB_PASSWORD (and optional SUPABASE_PROJECT_REF).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
MIGRATION="supabase/migrations/20260902120000_pet_v2_funnel_events_name_chk.sql"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "BLOCKED: SUPABASE_DB_PASSWORD is required to apply ${MIGRATION}"
  exit 2
fi

if [[ ! -f "${MIGRATION}" ]]; then
  echo "BLOCKED: missing ${MIGRATION}"
  exit 2
fi

if [[ "${PROJECT_REF}" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing migrate unexpected project ref '${PROJECT_REF}'."
  exit 2
fi

echo "Applying ${MIGRATION} to ${PROJECT_REF}…"

APPLIED=0
for HOST in \
  "aws-0-eu-west-1.pooler.supabase.com" \
  "aws-1-eu-west-1.pooler.supabase.com" \
  "aws-0-eu-west-2.pooler.supabase.com" \
  "aws-1-eu-west-2.pooler.supabase.com" \
  "aws-0-eu-central-1.pooler.supabase.com" \
  "aws-1-eu-central-1.pooler.supabase.com"
do
  CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
  echo "Trying pooler host ${HOST}…"
  if command -v psql >/dev/null 2>&1; then
    if PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql "${CAND}" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
      echo "Connected via ${HOST} — applying SQL directly…"
      PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql "${CAND}" -v ON_ERROR_STOP=1 -f "${MIGRATION}"
      APPLIED=1
      break
    fi
  fi
  if npx --yes supabase db push --db-url "${CAND}" --include-all 2>&1 | tee /tmp/pet-v2-chk-push.log; then
    echo "Applied via supabase db push @ ${HOST}"
    APPLIED=1
    break
  fi
done

if [[ "${APPLIED}" != "1" ]]; then
  echo "Pooler path failed; trying supabase link + db push…"
  npx --yes supabase link --project-ref "${PROJECT_REF}" --password "${SUPABASE_DB_PASSWORD}" || true
  npx --yes supabase db push --linked --include-all
  APPLIED=1
fi

echo "OK: pet_v2_funnel_events_name_chk expanded"

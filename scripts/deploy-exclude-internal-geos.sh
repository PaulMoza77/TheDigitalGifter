#!/usr/bin/env bash
# Safe production apply for RO/IT funnel exclusion:
#   1) SQL migration 20260902120000_pet_funnel_exclude_internal_geos.sql
#   2) Edge function pet-analytics-sync (GA4 skip Romania/Italy)
# Does NOT deploy frontend / VPS (use scripts/deploy-vps.sh for that).
# Requires: SUPABASE_ACCESS_TOKEN
# Optional: SUPABASE_DB_PASSWORD (preferred for migration apply)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
MIGRATION="supabase/migrations/20260902120000_pet_funnel_exclude_internal_geos.sql"

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing deploy to unexpected project ref '$PROJECT_REF'."
  exit 2
fi

if [[ ! -f "$MIGRATION" ]]; then
  echo "BLOCKED: missing $MIGRATION"
  exit 2
fi

apply_sql_file() {
  local file="$1"
  echo "Applying SQL via Management API database/query…"
  # Split on blank-line-separated statements is fragile for PL/pgSQL; send whole file.
  local payload
  payload="$(node -e '
    const fs = require("fs");
    const q = fs.readFileSync(process.argv[1], "utf8");
    process.stdout.write(JSON.stringify({ query: q }));
  ' "$file")"
  local code
  code="$(curl -sS -o /tmp/supabase-sql-apply.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" || true)"
  echo "Management API HTTP $code"
  head -c 400 /tmp/supabase-sql-apply.json 2>/dev/null || true
  echo
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    return 1
  fi
  return 0
}

echo "Target project: $PROJECT_REF"
APPLIED=0

if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  for HOST in \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-1-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-west-2.pooler.supabase.com" \
    "aws-1-eu-west-2.pooler.supabase.com" \
    "aws-0-eu-central-1.pooler.supabase.com"
  do
    CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
    echo "Trying pooler host $HOST…"
    if command -v psql >/dev/null 2>&1; then
      if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
        echo "Connected via $HOST — applying geo-exclusion migration…"
        PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -f "$MIGRATION"
        APPLIED=1
        break
      fi
    fi
    if npx --yes supabase db push --db-url "$CAND" --include-all 2>&1 | tee /tmp/geo-db-push.log; then
      APPLIED=1
      break
    fi
  done
  if [[ "$APPLIED" != "1" ]]; then
    echo "Pooler path failed; trying supabase link + db push…"
    npx --yes supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" || true
    if npx --yes supabase db push --linked --include-all 2>&1 | tee /tmp/geo-db-push-linked.log; then
      APPLIED=1
    fi
  fi
fi

if [[ "$APPLIED" != "1" ]]; then
  echo "Falling back to Supabase Management API SQL apply…"
  if apply_sql_file "$MIGRATION"; then
    APPLIED=1
  fi
fi

if [[ "$APPLIED" != "1" ]]; then
  echo "ERROR: could not apply migration $MIGRATION"
  exit 1
fi
echo "Migration applied."

echo "Deploying pet-analytics-sync → $PROJECT_REF"
npx --yes supabase functions deploy pet-analytics-sync \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

# Probe helper RPC created by the migration
echo "Probing pet_funnel_country_is_internal…"
PROBE_URL="https://${PROJECT_REF}.supabase.co/rest/v1/rpc/pet_funnel_country_is_internal"
# Needs service role; if absent, skip probe (CI may only have access token).
if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  CODE="$(curl -sS -o /tmp/geo-probe.json -w '%{http_code}' \
    -X POST "$PROBE_URL" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"p_country":"Romania"}' || true)"
  BODY="$(cat /tmp/geo-probe.json 2>/dev/null || true)"
  echo "Probe HTTP $CODE body=$BODY"
  if [[ "$CODE" != "200" || "$BODY" != "true" ]]; then
    echo "ERROR: geo helper RPC probe failed"
    exit 1
  fi
else
  echo "SUPABASE_SERVICE_ROLE_KEY unset — skipped RPC probe (migration apply already succeeded)."
fi

echo "GEO_EXCLUDE_DEPLOY_OK project=$PROJECT_REF"

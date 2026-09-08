#!/usr/bin/env bash
# Apply Christmas countdown schema + deploy christmas-admin Edge function.
# Frontend/VPS origin is deployed separately via scripts/deploy-vps.sh (push to main).
# Requires: SUPABASE_ACCESS_TOKEN
# Optional: SUPABASE_DB_PASSWORD
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
MIGRATION="supabase/migrations/20260908120000_christmas_countdown.sql"

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing deploy to unexpected project ref '$PROJECT_REF'."
  exit 2
fi

apply_sql_file() {
  local file="$1"
  echo "Applying SQL via Management API database/query…"
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

echo "Applying $MIGRATION"
APPLIED=0
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  for HOST in \
    "aws-0-eu-central-1.pooler.supabase.com" \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-1-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-west-2.pooler.supabase.com"
  do
    echo "Trying db push via $HOST…"
    if npx --yes supabase db push --db-url "postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:6543/postgres" --include-all; then
      APPLIED=1
      break
    fi
  done
fi
if [[ "$APPLIED" != "1" ]]; then
  apply_sql_file "$MIGRATION" || {
    echo "BLOCKED: could not apply $MIGRATION"
    exit 2
  }
fi

echo "Deploying christmas-admin → ${PROJECT_REF}"
npx --yes supabase functions deploy christmas-admin \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt

EDGE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/christmas-admin"
CODE="$(curl -sS -m 20 -o /tmp/christmas-admin-probe.txt -w '%{http_code}' \
  -X POST "$EDGE_URL" \
  -H 'Content-Type: application/json' \
  -d '{"action":"dashboard"}' || true)"
BODY_HEAD="$(head -c 180 /tmp/christmas-admin-probe.txt 2>/dev/null || true)"
echo "Probe HTTP $CODE body[:180]=$BODY_HEAD"
if echo "$BODY_HEAD" | grep -qi '<html'; then
  echo "ERROR: christmas-admin returned HTML."
  exit 1
fi
if [[ "$CODE" != "401" && "$CODE" != "403" && "$CODE" != "200" ]]; then
  echo "WARN: unexpected probe status $CODE (expected 401/403 without admin JWT)."
fi

echo "christmas-admin deploy complete."

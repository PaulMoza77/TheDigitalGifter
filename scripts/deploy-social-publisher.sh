#!/usr/bin/env bash
# Production deploy for the existing social-publisher Edge function.
# 1) Apply the Meta login migration.
# 2) Set only missing non-secret Meta config, never printing values.
# 3) Deploy the function.
# Refuses another project. Does not set META_APP_SECRET.
# Does not set SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS.
# If the migration fails, the function is not deployed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIGRATION="supabase/migrations/20260923180000_meta_login_publishing.sql"
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
PUBLIC_BASE="https://www.thedigitalgifter.com"
OAUTH_REDIRECT="${PUBLIC_BASE}/api/meta-oauth/callback"
FALLBACK_APP_ID="${META_APP_ID:-1771898293934621}"
FALLBACK_CONFIGURATION_ID="${META_CONFIGURATION_ID:-1117038350677281}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing deploy to unexpected project ref."
  exit 2
fi

if [[ ! -f "$MIGRATION" ]]; then
  echo "Missing migration file."
  exit 1
fi

if grep -Eiq 'drop table|truncate ' "$MIGRATION"; then
  echo "BLOCKED: migration contains destructive SQL patterns."
  exit 2
fi

redact_file() {
  local file="$1"
  if [[ ! -s "$file" ]]; then
    return 0
  fi
  sed -E \
    -e 's/(access_token|client_secret|fb_exchange_token|input_token|refresh_token)=[^&[:space:]"]+/\1=[redacted]/gi' \
    -e 's/Bearer[[:space:]]+[A-Za-z0-9._~+/-]+=*/Bearer [redacted]/g' \
    -e 's/EAA[A-Za-z0-9]+/EAA[redacted]/g' \
    "$file" | head -c 240 || true
  echo
}

apply_via_management_api() {
  echo "Applying SQL via Management API database/query…"
  local payload code
  payload="$(node -e '
    const fs = require("fs");
    const q = fs.readFileSync(process.argv[1], "utf8");
    process.stdout.write(JSON.stringify({ query: q }));
  ' "$MIGRATION")"
  code="$(curl -sS -o /tmp/social-publisher-sql.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" || true)"
  echo "Management API HTTP ${code}"
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    return 0
  fi
  echo "Migration error (sanitized):"
  redact_file /tmp/social-publisher-sql.json
  return 1
}

APPLIED=0

if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
  echo "Applying via DATABASE_URL…"
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION" >/tmp/social-publisher-psql.txt 2>&1; then
    APPLIED=1
  else
    echo "DATABASE_URL apply failed (output withheld)."
  fi
fi

if [[ "$APPLIED" != "1" && -n "${SUPABASE_DB_PASSWORD:-}" ]] && command -v psql >/dev/null 2>&1; then
  for HOST in \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-1-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-central-1.pooler.supabase.com" \
    "db.${PROJECT_REF}.supabase.co"
  do
    CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
    echo "Trying pooler host ${HOST}…"
    if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
      echo "Connected via ${HOST} — applying migration…"
      if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -f "$MIGRATION" >/tmp/social-publisher-psql.txt 2>&1; then
        APPLIED=1
        break
      fi
      echo "psql apply failed on ${HOST} (output withheld)."
    fi
  done
fi

if [[ "$APPLIED" != "1" ]]; then
  if apply_via_management_api; then
    APPLIED=1
  fi
fi

if [[ "$APPLIED" != "1" ]]; then
  echo "BLOCKED: migration failed. social-publisher was not deployed."
  exit 1
fi

echo "Migration applied to ${PROJECT_REF}."

secret_names_file="$(mktemp)"
cleanup() {
  rm -f "$secret_names_file" /tmp/social-publisher-secrets-set.env
}
trap cleanup EXIT

echo "Reading Edge secret names…"
if ! npx --yes supabase secrets list --project-ref "$PROJECT_REF" > /tmp/social-publisher-secrets-list.txt 2>/tmp/social-publisher-secrets-list.err; then
  echo "SECRET_LIST_FAILED"
  echo "BLOCKED: cannot read Edge secret names, so no secret was changed. Function was not deployed."
  rm -f /tmp/social-publisher-secrets-list.txt /tmp/social-publisher-secrets-list.err
  exit 1
fi

if ! node - /tmp/social-publisher-secrets-list.txt > "$secret_names_file" <<'NODE'
const fs = require("fs");
const raw = fs.readFileSync(process.argv[2], "utf8").trim();
const names = new Set();
if (raw.startsWith("[") || raw.startsWith("{")) {
  const data = JSON.parse(raw);
  const rows = Array.isArray(data) ? data : data.secrets || data.data || [];
  for (const row of rows) {
    if (row && row.name) names.add(String(row.name));
  }
} else {
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]+)\s*\|/);
    if (match && match[1] !== "NAME") names.add(match[1]);
  }
}
if (!names.size) {
  const looksEmpty = raw === "[]" || raw.length === 0 || /NAME\s*\|/.test(raw);
  if (!looksEmpty) {
    console.error("SECRET_LIST_UNPARSED");
    process.exit(3);
  }
}
process.stdout.write([...names].join("\n"));
if (names.size) process.stdout.write("\n");
NODE
then
  echo "SECRET_LIST_UNPARSED"
  echo "BLOCKED: Edge secret names could not be read safely. Function was not deployed."
  rm -f /tmp/social-publisher-secrets-list.txt /tmp/social-publisher-secrets-list.err
  exit 1
fi
rm -f /tmp/social-publisher-secrets-list.txt /tmp/social-publisher-secrets-list.err

has_secret() {
  grep -qx "$1" "$secret_names_file"
}

report_presence() {
  local name="$1"
  if has_secret "$name"; then
    echo "PRESENT: ${name}"
  else
    echo "ABSENT: ${name}"
  fi
}

set_from_env_file() {
  local file="$1"
  npx --yes supabase secrets set --env-file "$file" --project-ref "$PROJECT_REF" >/tmp/social-publisher-secrets-set.out
  rm -f /tmp/social-publisher-secrets-set.out
}

umask 077
public_env="$(mktemp)"
printf 'META_OAUTH_REDIRECT_URL=%s\nSOCIAL_PUBLISHER_PUBLIC_BASE_URL=%s\n' "$OAUTH_REDIRECT" "$PUBLIC_BASE" > "$public_env"
set_from_env_file "$public_env"
rm -f "$public_env"
echo "SET_PUBLIC: META_OAUTH_REDIRECT_URL"
echo "SET_PUBLIC: SOCIAL_PUBLISHER_PUBLIC_BASE_URL"

if has_secret META_APP_ID; then
  echo "PRESENT: META_APP_ID"
else
  app_env="$(mktemp)"
  printf 'META_APP_ID=%s\n' "$FALLBACK_APP_ID" > "$app_env"
  set_from_env_file "$app_env"
  rm -f "$app_env"
  echo "SET_IF_ABSENT: META_APP_ID"
fi

if has_secret META_CONFIGURATION_ID; then
  echo "PRESENT: META_CONFIGURATION_ID"
else
  cfg_env="$(mktemp)"
  printf 'META_CONFIGURATION_ID=%s\n' "$FALLBACK_CONFIGURATION_ID" > "$cfg_env"
  set_from_env_file "$cfg_env"
  rm -f "$cfg_env"
  echo "SET_IF_ABSENT: META_CONFIGURATION_ID"
fi

report_presence META_APP_SECRET

if has_secret SOCIAL_TOKEN_ENCRYPTION_KEY || has_secret PET_TOKEN_ENCRYPTION_KEY; then
  report_presence SOCIAL_TOKEN_ENCRYPTION_KEY
  report_presence PET_TOKEN_ENCRYPTION_KEY
else
  key_env="$(mktemp)"
  printf 'SOCIAL_TOKEN_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)" > "$key_env"
  set_from_env_file "$key_env"
  rm -f "$key_env"
  echo "SET_IF_ABSENT: SOCIAL_TOKEN_ENCRYPTION_KEY"
fi

if has_secret SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS; then
  echo "PRESENT: SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS (left unchanged)"
else
  echo "ABSENT: SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS (left off)"
fi

echo "Deploying social-publisher → ${PROJECT_REF}"
npx --yes supabase functions deploy social-publisher \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt

EDGE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/social-publisher"
CODE="$(curl -sS -m 25 -o /tmp/social-publisher-probe.txt -w '%{http_code}' \
  -X POST "$EDGE_URL" \
  -H 'Content-Type: application/json' \
  -d '{"action":"meta_oauth_callback"}' || true)"
echo "Probe HTTP ${CODE}"
if grep -qi '<html' /tmp/social-publisher-probe.txt 2>/dev/null; then
  echo "ERROR: social-publisher returned HTML."
  exit 1
fi
if [[ "$CODE" == "503" ]] || grep -qi 'BOOT_ERROR' /tmp/social-publisher-probe.txt 2>/dev/null; then
  echo "ERROR: social-publisher failed to start."
  exit 1
fi
rm -f /tmp/social-publisher-probe.txt

echo "social-publisher deploy complete. Live posting was not enabled."

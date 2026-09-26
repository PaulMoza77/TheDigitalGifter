#!/usr/bin/env bash
# Production deploy for the existing social-publisher Edge function.
# 1) Apply Meta + YouTube migrations.
# 2) Set public OAuth redirects and optional YouTube/Meta client config when provided.
# 3) Deploy the function.
# Refuses another project.
# Sets META_APP_SECRET only when it is already present in this environment (VPS/GitHub).
# Never prints secret values. Does not set SOCIAL_PUBLISHER_ALLOW_LIVE_POSTS.
# If a migration fails, the function is not deployed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIGRATIONS=(
  "supabase/migrations/20260923180000_meta_login_publishing.sql"
  "supabase/migrations/20260923190000_youtube_oauth_publishing.sql"
  "supabase/migrations/20260923193000_social_provider_configs.sql"
  "supabase/migrations/20260925160000_youtube_live_sessions.sql"
  "supabase/migrations/20260925190000_publisher_social_bridge.sql"
)
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
PUBLIC_BASE="https://www.thedigitalgifter.com"
OAUTH_REDIRECT="${PUBLIC_BASE}/api/meta-oauth/callback"
YOUTUBE_OAUTH_REDIRECT="${YOUTUBE_REDIRECT_URI:-${PUBLIC_BASE}/api/admin/social/youtube/callback}"
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

for MIGRATION in "${MIGRATIONS[@]}"; do
  if [[ ! -f "$MIGRATION" ]]; then
    echo "Missing migration file: $MIGRATION"
    exit 1
  fi
  if grep -Eiq 'drop table|truncate ' "$MIGRATION"; then
    echo "BLOCKED: migration contains destructive SQL patterns: $MIGRATION"
    exit 2
  fi
done

redact_file() {
  local file="$1"
  if [[ ! -s "$file" ]]; then
    return 0
  fi
  sed -E \
    -e 's/(access_token|client_secret|fb_exchange_token|input_token|refresh_token)=[^&[:space:]"]+/\1=[redacted]/gi' \
    -e 's/Bearer[[:space:]]+[A-Za-z0-9._~+/-]+=*/Bearer [redacted]/g' \
    -e 's/EAA[A-Za-z0-9]+/EAA[redacted]/g' \
    -e 's/GOCSPX-[A-Za-z0-9_-]+/GOCSPX-[redacted]/g' \
    "$file" | head -c 240 || true
  echo
}

apply_via_management_api() {
  local migration_file="$1"
  echo "Applying SQL via Management API database/query…"
  local payload code
  payload="$(node -e '
    const fs = require("fs");
    const q = fs.readFileSync(process.argv[1], "utf8");
    process.stdout.write(JSON.stringify({ query: q }));
  ' "$migration_file")"
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

apply_one_migration() {
  local migration_file="$1"
  local APPLIED=0
  echo "Applying ${migration_file}…"

  if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration_file" >/tmp/social-publisher-psql.txt 2>&1; then
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
        echo "Connected via ${HOST} · applying migration…"
        if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -f "$migration_file" >/tmp/social-publisher-psql.txt 2>&1; then
          APPLIED=1
          break
        fi
        echo "psql apply failed on ${HOST} (output withheld)."
      fi
    done
  fi

  if [[ "$APPLIED" != "1" ]]; then
    if apply_via_management_api "$migration_file"; then
      APPLIED=1
    fi
  fi

  if [[ "$APPLIED" != "1" ]]; then
    echo "BLOCKED: migration failed. social-publisher was not deployed."
    exit 1
  fi
  echo "Migration applied: ${migration_file}"
}

for MIGRATION in "${MIGRATIONS[@]}"; do
  apply_one_migration "$MIGRATION"
done

echo "Migrations applied to ${PROJECT_REF}."

secret_names_file="$(mktemp)"
cleanup() {
  rm -f "$secret_names_file" /tmp/social-publisher-secrets-set.env \
    /tmp/social-publisher-upsert-meta.json /tmp/social-publisher-upsert-youtube.json \
    /tmp/social-publisher-upsert.json /tmp/social-publisher-probe.txt
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
{
  printf 'META_OAUTH_REDIRECT_URL=%s\n' "$OAUTH_REDIRECT"
  printf 'SOCIAL_PUBLISHER_PUBLIC_BASE_URL=%s\n' "$PUBLIC_BASE"
  printf 'YOUTUBE_REDIRECT_URI=%s\n' "$YOUTUBE_OAUTH_REDIRECT"
} > "$public_env"
set_from_env_file "$public_env"
rm -f "$public_env"
echo "SET_PUBLIC: META_OAUTH_REDIRECT_URL"
echo "SET_PUBLIC: SOCIAL_PUBLISHER_PUBLIC_BASE_URL"
echo "SET_PUBLIC: YOUTUBE_REDIRECT_URI"

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

if [[ -n "${META_APP_SECRET:-}" ]]; then
  meta_secret_env="$(mktemp)"
  printf 'META_APP_SECRET=%s\n' "$META_APP_SECRET" > "$meta_secret_env"
  set_from_env_file "$meta_secret_env"
  rm -f "$meta_secret_env"
  echo "SET: META_APP_SECRET"
else
  report_presence META_APP_SECRET
fi

if [[ -n "${YOUTUBE_CLIENT_ID:-}" ]]; then
  yt_env="$(mktemp)"
  printf 'YOUTUBE_CLIENT_ID=%s\n' "$YOUTUBE_CLIENT_ID" > "$yt_env"
  set_from_env_file "$yt_env"
  rm -f "$yt_env"
  echo "SET: YOUTUBE_CLIENT_ID"
else
  report_presence YOUTUBE_CLIENT_ID
fi

if [[ -n "${YOUTUBE_CLIENT_SECRET:-}" ]]; then
  yt_secret_env="$(mktemp)"
  printf 'YOUTUBE_CLIENT_SECRET=%s\n' "$YOUTUBE_CLIENT_SECRET" > "$yt_secret_env"
  set_from_env_file "$yt_secret_env"
  rm -f "$yt_secret_env"
  echo "SET: YOUTUBE_CLIENT_SECRET"
else
  report_presence YOUTUBE_CLIENT_SECRET
fi

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
  -d '{"action":"youtube_oauth_callback"}' || true)"
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

upsert_provider_config() {
  local provider="$1"
  local payload_file="$2"
  if [[ ! -s "$payload_file" ]]; then
    echo "SKIP_UPSERT: ${provider} (payload absent)"
    return 0
  fi
  if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    echo "SKIP_UPSERT: ${provider} (service role absent)"
    return 0
  fi
  local code
  code="$(curl -sS -m 30 -o /tmp/social-publisher-upsert.json -w '%{http_code}' \
    -X POST "$EDGE_URL" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    --data-binary @"$payload_file" || true)"
  echo "UPSERT_${provider} HTTP ${code}"
  rm -f /tmp/social-publisher-upsert.json
}

if [[ -n "${META_APP_SECRET:-}" ]]; then
  umask 077
  node -e '
    const payload = {
      action: "upsert_meta_provider_config",
      client_id: process.env.META_APP_ID || process.argv[1],
      client_secret: process.env.META_APP_SECRET || "",
      configuration_id: process.env.META_CONFIGURATION_ID || process.argv[2],
      redirect_uri: process.env.META_OAUTH_REDIRECT_URL || "https://www.thedigitalgifter.com/api/meta-oauth/callback",
    };
    if (!payload.client_id || !payload.client_secret || !payload.configuration_id) process.exit(0);
    require("fs").writeFileSync("/tmp/social-publisher-upsert-meta.json", JSON.stringify(payload));
  ' "$FALLBACK_APP_ID" "$FALLBACK_CONFIGURATION_ID"
  upsert_provider_config meta /tmp/social-publisher-upsert-meta.json
  rm -f /tmp/social-publisher-upsert-meta.json
fi

if [[ -n "${YOUTUBE_CLIENT_ID:-}" && -n "${YOUTUBE_CLIENT_SECRET:-}" ]]; then
  umask 077
  node -e '
    const payload = {
      action: "upsert_youtube_provider_config",
      client_id: process.env.YOUTUBE_CLIENT_ID || "",
      client_secret: process.env.YOUTUBE_CLIENT_SECRET || "",
      redirect_uri: process.env.YOUTUBE_REDIRECT_URI || "https://www.thedigitalgifter.com/api/admin/social/youtube/callback",
    };
    if (!payload.client_id || !payload.client_secret) process.exit(0);
    require("fs").writeFileSync("/tmp/social-publisher-upsert-youtube.json", JSON.stringify(payload));
  '
  upsert_provider_config youtube /tmp/social-publisher-upsert-youtube.json
  rm -f /tmp/social-publisher-upsert-youtube.json
fi

echo "social-publisher deploy complete. Live posting was not enabled."

#!/usr/bin/env bash
# Apply Christmas Gift Tree foundation + funnel migrations to TheDigitalGifter Supabase.
# Target project MUST be kjlsocejpmnzhhduyumy.
# Prefers SUPABASE_DB_PASSWORD (psql); falls back to Management API with SUPABASE_ACCESS_TOKEN.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

MIGRATIONS=(
  "supabase/migrations/20260904210000_christmas_gift_tree.sql"
  "supabase/migrations/20260905150000_christmas_gift_tree_funnel.sql"
  "supabase/migrations/20260905180000_christmas_gift_tree_hardening.sql"
)

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing apply to unexpected project ref '$PROJECT_REF'."
  exit 2
fi

for MIGRATION in "${MIGRATIONS[@]}"; do
  if [[ ! -f "$MIGRATION" ]]; then
    echo "Missing $MIGRATION"
    exit 1
  fi
  if grep -Eiq 'drop table|truncate |delete from christmas_' "$MIGRATION"; then
    echo "BLOCKED: $MIGRATION contains destructive SQL patterns."
    exit 2
  fi
done

echo "Target project: $PROJECT_REF (TheDigitalGifter)"
echo "Migrations: ${MIGRATIONS[*]}"

apply_file() {
  local file="$1"
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "Applying $file via DATABASE_URL…"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
    return 0
  fi
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    for HOST in \
      "aws-0-eu-west-1.pooler.supabase.com" \
      "aws-1-eu-west-1.pooler.supabase.com" \
      "aws-0-eu-central-1.pooler.supabase.com" \
      "db.${PROJECT_REF}.supabase.co"
    do
      local CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
      echo "Trying pooler host $HOST for $file…"
      if command -v psql >/dev/null 2>&1; then
        if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
          PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 -f "$file"
          return 0
        fi
      fi
    done
  fi
  if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    echo "Applying $file via Management API database/query…"
    local payload
    payload="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.stringify({query: fs.readFileSync(process.argv[1],"utf8")}))' "$file")"
    local code
    code="$(curl -sS -o /tmp/gift-tree-sql.json -w '%{http_code}' \
      -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
      -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$payload" || true)"
    echo "Management API HTTP $code"
    head -c 400 /tmp/gift-tree-sql.json 2>/dev/null || true
    echo
    if [[ "$code" == "200" || "$code" == "201" ]]; then
      return 0
    fi
  fi
  return 1
}

for MIGRATION in "${MIGRATIONS[@]}"; do
  if ! apply_file "$MIGRATION"; then
    echo "BLOCKED: need SUPABASE_DB_PASSWORD (or DATABASE_URL) and/or SUPABASE_ACCESS_TOKEN to apply $MIGRATION."
    exit 3
  fi
done

echo "OK: Christmas Gift Tree migrations applied."

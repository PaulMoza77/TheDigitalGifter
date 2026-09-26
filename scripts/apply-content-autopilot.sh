#!/usr/bin/env bash
# Apply Content Autopilot migrations to production Supabase (kjlsocejpmnzhhduyumy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
MIGRATIONS=(
  "supabase/migrations/20260926140000_content_autopilot.sql"
  "supabase/migrations/20260926150000_content_autopilot_hardening.sql"
)

if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: unexpected project ref '$PROJECT_REF'"
  exit 2
fi

apply_one() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing $file"
    exit 1
  fi
  if grep -Eiq 'drop table|truncate ' "$file"; then
    echo "BLOCKED: destructive SQL in $file"
    exit 2
  fi
  echo "Applying $file"
  if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
    return 0
  fi
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    echo "BLOCKED: need DATABASE_URL+psql or SUPABASE_ACCESS_TOKEN"
    return 1
  fi
  local payload code
  payload="$(node -e 'process.stdout.write(JSON.stringify({ query: require("fs").readFileSync(process.argv[1], "utf8") }))' "$file")"
  code="$(curl -sS -o /tmp/content-autopilot-sql.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" || true)"
  echo "Management API HTTP $code"
  head -c 400 /tmp/content-autopilot-sql.json 2>/dev/null || true
  echo
  [[ "$code" == "200" || "$code" == "201" ]]
}

for mig in "${MIGRATIONS[@]}"; do
  apply_one "$mig"
done

echo "Content Autopilot migrations applied."

#!/usr/bin/env bash
# Activate Christmas Gift Tree funnel on production Supabase (kjlsocejpmnzhhduyumy).
# Requires: SUPABASE_ACCESS_TOKEN (Production env). Optional: SUPABASE_DB_PASSWORD.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing unexpected project ref '$PROJECT_REF'."
  exit 2
fi

echo "Target project: $PROJECT_REF"
echo "Git SHA: $(git rev-parse HEAD)"

npx --yes supabase --version

echo "Linking project…"
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  npx --yes supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" || true
else
  # Access-token linked push works for this project (proven by deploy-christmas-v2).
  npx --yes supabase link --project-ref "$PROJECT_REF" || true
fi

echo "Pushing pending migrations (includes gift-tree foundation + funnel)…"
set +e
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  for HOST in \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-1-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-central-1.pooler.supabase.com"
  do
    CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
    echo "Trying db push via $HOST…"
    if npx --yes supabase db push --db-url "$CAND" --include-all --yes 2>&1 | tee /tmp/gift-tree-db-push.log; then
      PUSH_OK=1
      break
    fi
  done
fi

if [[ "${PUSH_OK:-0}" != "1" ]]; then
  echo "Falling back to linked/project-ref db push…"
  npx --yes supabase db push --linked --include-all --yes 2>&1 | tee /tmp/gift-tree-db-push.log
  PUSH_RC=${PIPESTATUS[0]}
  if [[ "$PUSH_RC" != "0" ]]; then
    npx --yes supabase db push --project-ref "$PROJECT_REF" --include-all --yes 2>&1 | tee -a /tmp/gift-tree-db-push.log
    PUSH_RC=${PIPESTATUS[0]}
  fi
else
  PUSH_RC=0
fi
set -e

if [[ "${PUSH_RC:-1}" != "0" ]]; then
  echo "WARN: db push reported non-zero; attempting Management API SQL apply for gift-tree SQL files…"
  for SQL in \
    supabase/migrations/20260904210000_christmas_gift_tree.sql \
    supabase/migrations/20260905150000_christmas_gift_tree_funnel.sql
  do
    echo "Management API apply: $SQL"
    payload="$(node -e 'const fs=require("fs"); process.stdout.write(JSON.stringify({query: fs.readFileSync(process.argv[1],"utf8")}))' "$SQL")"
    code="$(curl -sS -o /tmp/gift-tree-sql.json -w '%{http_code}' \
      -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
      -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$payload" || true)"
    echo "HTTP $code for $SQL"
    head -c 400 /tmp/gift-tree-sql.json || true
    echo
    if [[ "$code" != "200" && "$code" != "201" ]]; then
      echo "BLOCKED: could not apply $SQL"
      exit 3
    fi
  done
fi

deploy_fn() {
  local name="$1"
  echo "Deploying Edge function: $name"
  npx --yes supabase functions deploy "$name" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
}

# Only gift-tree-adjacent runtimes from PR #91
deploy_fn christmas-checkout
deploy_fn christmas-tree-funnel
# stripe-webhook only if fulfill path lives there in this repo layout
if [[ -d supabase/functions/stripe-webhook ]]; then
  deploy_fn stripe-webhook
fi

echo "Activation deploy complete for $PROJECT_REF @ $(git rev-parse HEAD)"

# activation-trigger: 20260905T164001Z

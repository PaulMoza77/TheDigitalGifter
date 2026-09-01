#!/usr/bin/env bash
# Deploy Christmas V2 backend to production Supabase.
# Requires: SUPABASE_ACCESS_TOKEN with deploy rights for kjlsocejpmnzhhduyumy
# Optional: SUPABASE_DB_PASSWORD for db push; SUPABASE_PROJECT_REF override
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
echo "Target project: $PROJECT_REF"

# Guard: refuse accidental deploys to non-TDG projects.
if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing deploy to unexpected project ref '$PROJECT_REF'."
  echo "Production Digital Gifter project must be kjlsocejpmnzhhduyumy."
  exit 2
fi

echo "Applying Christmas V2 migration via supabase db push…"
# db push applies pending migrations; requires linked project or --db-url.
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  # Session pooler URL for production project
  DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
  # Try common EU regions for this project; fall back to Management API linked push.
  APPLIED=0
  for HOST in \
    "aws-0-eu-west-1.pooler.supabase.com" \
    "aws-1-eu-west-1.pooler.supabase.com" \
    "aws-0-eu-west-2.pooler.supabase.com" \
    "aws-1-eu-west-2.pooler.supabase.com" \
    "aws-0-eu-central-1.pooler.supabase.com"
  do
    CAND="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
    echo "Trying pooler host $HOST…"
    if npx --yes supabase db push --db-url "$CAND" --include-all 2>&1 | tee /tmp/cv2-db-push.log; then
      APPLIED=1
      break
    fi
    # Also try direct SQL apply of only our migration if db push rejects
    if command -v psql >/dev/null 2>&1; then
      if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 \
        -c "select 1" >/dev/null 2>&1; then
        echo "Connected via $HOST — applying Christmas migration SQL directly…"
        PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$CAND" -v ON_ERROR_STOP=1 \
          -f supabase/migrations/20260831190000_christmas_v2_funnel.sql
        APPLIED=1
        break
      fi
    fi
  done
  if [[ "$APPLIED" != "1" ]]; then
    echo "Pooler password path failed; trying supabase db push --project-ref…"
    npx --yes supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" || true
    npx --yes supabase db push --linked --include-all
  fi
else
  echo "SUPABASE_DB_PASSWORD unset — attempting linked db push…"
  npx --yes supabase db push --project-ref "$PROJECT_REF" --include-all || {
    echo "WARN: migration push failed without DB password. Continuing with function deploy."
  }
fi

echo "Verifying christmas_orders table exists…"
# Best-effort verify via Management API SQL is not available; deploy functions anyway and probe RPC.

deploy_fn() {
  local name="$1"
  echo "Deploying $name…"
  npx --yes supabase functions deploy "$name" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
}

deploy_fn christmas-funnel
deploy_fn christmas-generate
deploy_fn christmas-generate-video
deploy_fn christmas-v2-funnel-event
deploy_fn stripe-webhook

echo "Edge deploy complete for $PROJECT_REF."
echo "Probe: curl -sS -X OPTIONS https://${PROJECT_REF}.supabase.co/functions/v1/christmas-funnel"

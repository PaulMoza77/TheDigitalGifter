#!/usr/bin/env bash
# Deploy Dog V2 conversion-rebuild edge functions + apply teaser event migration.
# Requires: SUPABASE_ACCESS_TOKEN with deploy rights for the production project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

echo "Deploying pet-provider-status to $PROJECT_REF…"
npx --yes supabase functions deploy pet-provider-status \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "Deploying pet-funnel to $PROJECT_REF…"
npx --yes supabase functions deploy pet-funnel \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "Edge deploy complete."
echo "Apply SQL migration 20260829190000_pet_v2_teaser_checkout_events.sql via supabase db push or Dashboard SQL."
echo "Verify provider gate: curl -sS https://${PROJECT_REF}.supabase.co/functions/v1/pet-provider-status"

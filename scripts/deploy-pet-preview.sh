#!/usr/bin/env bash
# Deploy pet-v2-preview edge function after identity fix.
# Requires: SUPABASE_ACCESS_TOKEN with deploy rights for kjlsocejpmnzhhduyumy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  echo "Add a Supabase personal access token with deploy rights for project kjlsocejpmnzhhduyumy,"
  echo "then re-run: npm run deploy:pet-preview"
  exit 2
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"

echo "Deploying pet-v2-preview to $PROJECT_REF…"
npx --yes supabase functions deploy pet-v2-preview \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "Verifying identityBuild marker on live edge…"
EDGE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/pet-v2-preview"
# Anon key optional for GET if verify_jwt=false
VERIFY="$(curl -sS -m 30 "$EDGE_URL" || true)"
echo "$VERIFY"
if ! echo "$VERIFY" | grep -q 'pet-preview-identity-'; then
  echo "WARN: identityBuild not visible yet (CDN/propagation). Re-check GET $EDGE_URL"
else
  echo "identityBuild confirmed on live edge."
fi

echo
echo "Optional: PET_PREVIEW_SMOKE=1 node scripts/pet-preview-live-smoke.mjs"
echo "Chow Chow must remain a Chow Chow with no closed helmet."

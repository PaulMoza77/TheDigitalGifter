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

echo "Deployed. Optional secrets to confirm on the project:"
echo "  REPLICATE_API_TOKEN (required for live preview)"
echo "  OPENAI_API_KEY (optional; Replicate vision is used as fallback)"
echo "  PET_SPECIES_VALIDATION=false to disable species gate"
echo "  PET_PREVIEW_IMAGE_MODEL to override Kontext Pro"
echo
echo "Smoke: POST /functions/v1/pet-v2-preview with a dog photo on /pet/dog-v2"
echo "       and a cat photo on /pet/cat-v3. Chow Chow must remain a Chow Chow."

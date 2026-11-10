#!/bin/sh
set -eu
: "${SUPABASE_URL:?Missing SUPABASE_URL}"
: "${SUPPORT_WORKER_SECRET:?Missing SUPPORT_WORKER_SECRET}"
curl --fail --silent --show-error --max-time 55 \
  -H "Authorization: Bearer ${SUPPORT_WORKER_SECRET}" \
  -H 'Content-Type: application/json' \
  --data '{"action":"drain"}' \
  "${SUPABASE_URL}/functions/v1/support-conversation"

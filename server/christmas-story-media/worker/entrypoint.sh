#!/bin/sh
set -eu
QUEUE="${CS_MEDIA_QUEUE_DIR:-/data/queue}"
OUT="${CS_MEDIA_OUT_DIR:-/data/out}"
TMP="${CS_MEDIA_TMP_DIR:-/data/tmp}"
mkdir -p "$QUEUE" "$OUT" "$TMP"

# Graceful shutdown: stop claiming; let current job finish via Node signal handlers.
trap 'echo "{\"event\":\"shutdown_signal\"}"; exit 0' TERM INT

# Sanitize env in logs — never print tokens.
echo "{\"event\":\"worker_start\",\"workerId\":\"${CS_FILM_WORKER_ID:-unset}\",\"queue\":\"$QUEUE\",\"storage\":\"${CS_STORAGE_MODE:-local_private}\"}"

cd /app
exec node --experimental-strip-types scripts/film-worker.mjs "$@"

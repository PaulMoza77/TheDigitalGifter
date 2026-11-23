#!/bin/sh
set -eu
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
command -v node >/dev/null
test -d "${CS_MEDIA_QUEUE_DIR:-/data/queue}"
test -d "${CS_MEDIA_OUT_DIR:-/data/out}"
# Ready if queue dir is writable
touch "${CS_MEDIA_QUEUE_DIR:-/data/queue}/.health"
rm -f "${CS_MEDIA_QUEUE_DIR:-/data/queue}/.health"
exit 0

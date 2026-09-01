#!/usr/bin/env bash
# Deploy static dist/ to VPS via rsync over SSH.
# Secrets (GitHub Production environment):
#   VPS_HOST, VPS_USER, VPS_SSH_PRIVATE_KEY
# Optional: VPS_DEPLOY_PATH (default /var/www/thedigitalgifter)
# Optional: VPS_SSH_PORT (default 22)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${VPS_HOST:-}"
USER="${VPS_USER:-root}"
KEY="${VPS_SSH_PRIVATE_KEY:-}"
PATH_ON_SERVER="${VPS_DEPLOY_PATH:-/var/www/thedigitalgifter}"
PORT="${VPS_SSH_PORT:-22}"

if [[ -z "$HOST" || -z "$KEY" ]]; then
  echo "BLOCKED: set VPS_HOST and VPS_SSH_PRIVATE_KEY."
  exit 2
fi

node scripts/prepare-static-deploy.mjs

KEY_FILE="$(mktemp)"
trap 'rm -f "$KEY_FILE"' EXIT
printf '%s\n' "$KEY" > "$KEY_FILE"
chmod 600 "$KEY_FILE"

RSYNC_SSH="ssh -i $KEY_FILE -p $PORT -o StrictHostKeyChecking=accept-new"

echo "Syncing dist/ → ${USER}@${HOST}:${PATH_ON_SERVER}/"
rsync -az --delete -e "$RSYNC_SSH" dist/ "${USER}@${HOST}:${PATH_ON_SERVER}/"

echo "VPS static deploy complete."
echo "Ensure nginx serves ${PATH_ON_SERVER} with try_files \$uri /index.html;"

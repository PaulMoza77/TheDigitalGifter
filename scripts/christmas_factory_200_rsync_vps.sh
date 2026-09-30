#!/usr/bin/env bash
# Copy completed factory-200 masters/posters to VPS media (not Docker image).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"
mozas_prepare_ssh
mozas_verify_remote_identity
SRC="${ROOT}/generated/christmas-factory-200"
REMOTE="/opt/mozas/projects/thedigitalgifter/repo/generated/christmas-factory-200"
mozas_ssh "mkdir -p ${REMOTE}/masters ${REMOTE}/posters ${REMOTE}/stills"
mozas_rsync --exclude 'qc/' --exclude '*.tmp' "${SRC}/" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE}/"
echo "FACTORY_200_RSYNC_OK"

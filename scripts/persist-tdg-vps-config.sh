#!/usr/bin/env bash
# Persist TDG + offsite backup secrets onto the Mozas VPS from this machine.
# Reads MOZAS_BACKUP_S3_* and SUPABASE_SERVICE_ROLE_KEY from the environment.
# Never prints secret values. Does not change public DNS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"

mozas_prepare_ssh
mozas_verify_remote_identity

need=(
  SUPABASE_SERVICE_ROLE_KEY
  MOZAS_BACKUP_S3_ENDPOINT
  MOZAS_BACKUP_S3_BUCKET
  MOZAS_BACKUP_S3_ACCESS_KEY
  MOZAS_BACKUP_S3_SECRET_KEY
)
for k in "${need[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    echo "BLOCKED: ${k} is missing" >&2
    exit 2
  fi
done

BLOB="$(mktemp)"
trap 'rm -f "${BLOB}"; rm -rf "${MOZAS_SSH_DIR:-}"' EXIT
umask 077
python3 - <<'PY' >"${BLOB}"
import os
keys = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "MOZAS_BACKUP_S3_ENDPOINT",
    "MOZAS_BACKUP_S3_BUCKET",
    "MOZAS_BACKUP_S3_ACCESS_KEY",
    "MOZAS_BACKUP_S3_SECRET_KEY",
]
for k in keys:
    v = os.environ.get(k, "")
    if not v:
        continue
    # Values are assigned unquoted in the remote `source`; reject newlines.
    if "\n" in v or "\r" in v:
        raise SystemExit(f"refusing {k} with newline")
    print(f"{k}={v}")
PY

REMOTE_REPO="/opt/mozas/projects/thedigitalgifter/repo"
REMOTE_BLOB="/tmp/tdg-persist.env"
mozas_ssh "mkdir -p ${REMOTE_REPO}/deploy/scripts ${REMOTE_REPO}/deploy/lib ${REMOTE_REPO}/deploy/caddy"
mozas_rsync "${ROOT}/deploy/scripts/" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_REPO}/deploy/scripts/"
mozas_rsync "${ROOT}/deploy/lib/" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_REPO}/deploy/lib/"
mozas_rsync "${ROOT}/deploy/caddy/" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_REPO}/deploy/caddy/"
mozas_rsync "${BLOB}" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_BLOB}"
rm -f "${BLOB}"

mozas_ssh bash -s <<REMOTE
set -euo pipefail
install -m 0755 ${REMOTE_REPO}/deploy/scripts/merge-tdg-app-env.sh /opt/mozas/bin/mozas-merge-tdg-app-env
install -m 0755 ${REMOTE_REPO}/deploy/scripts/merge-mozas-backup-env.sh /opt/mozas/bin/mozas-merge-backup-env
install -m 0755 ${REMOTE_REPO}/deploy/scripts/ensure-offsite-restic.sh /opt/mozas/bin/mozas-ensure-offsite-restic
install -m 0755 ${REMOTE_REPO}/deploy/scripts/mozas-restore-offsite-test.sh /opt/mozas/bin/mozas-restore-offsite-test
install -m 0755 ${REMOTE_REPO}/deploy/scripts/apply-tdg-caddy.sh /opt/mozas/bin/mozas-apply-tdg-caddy
install -m 0755 ${REMOTE_REPO}/deploy/scripts/apply-tdg-caddy-https.sh /opt/mozas/bin/mozas-apply-tdg-caddy-https
install -m 0755 ${REMOTE_REPO}/deploy/scripts/mozas-ensure-tdg-caddy.sh /opt/mozas/bin/mozas-ensure-tdg-caddy
chmod 600 ${REMOTE_BLOB}
set -a
# shellcheck disable=SC1090
source ${REMOTE_BLOB}
set +a
/opt/mozas/bin/mozas-merge-tdg-app-env
/opt/mozas/bin/mozas-merge-backup-env
shred -u ${REMOTE_BLOB} 2>/dev/null || rm -f ${REMOTE_BLOB}
TDG_DIR=/opt/mozas/projects/thedigitalgifter
TDG_RELEASE="\$(grep -E '^TDG_RELEASE=' \${TDG_DIR}/secrets/app.env | head -1 | cut -d= -f2-)"
export TDG_RELEASE
docker compose \\
  --project-directory \${TDG_DIR}/repo \\
  -f \${TDG_DIR}/docker-compose.yml \\
  --env-file \${TDG_DIR}/secrets/app.env \\
  --profile with-app \\
  up -d --no-build --force-recreate --wait
curl -fsS --resolve tdg-verify.mozas-prod-01:80:127.0.0.1 http://tdg-verify.mozas-prod-01/healthz
echo
curl -fsS http://127.0.0.1/healthz
echo
REMOTE

echo "PERSIST_OK"

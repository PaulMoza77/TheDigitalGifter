#!/usr/bin/env bash
# Run local + offsite restic backup and isolated restore drills on Mozas.
# Does not replace production files. Does not change DNS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"

mozas_prepare_ssh
mozas_verify_remote_identity

mozas_ssh 'set -euo pipefail
  /opt/mozas/bin/mozas-ensure-offsite-restic
  sudo -n systemctl start mozas-backup.service
  for i in $(seq 1 90); do
    if [[ -f /opt/mozas/log/backup-last.json ]]; then
      if python3 -c "import json; d=json.load(open(\"/opt/mozas/log/backup-last.json\")); raise SystemExit(0 if d.get(\"offsite\") else 1)"; then
        echo "backup_offsite=true"
        cat /opt/mozas/log/backup-last.json
        echo
        break
      fi
    fi
    if [[ "$i" -eq 90 ]]; then
      echo "backup did not report offsite=true" >&2
      sudo -n journalctl -u mozas-backup.service -n 80 --no-pager || true
      exit 1
    fi
    sleep 5
  done
  set -a
  # shellcheck disable=SC1090
  source /opt/mozas/secrets/backup.env
  set +a
  PASS="$(mktemp)"
  printf "%s" "${RESTIC_PASSWORD}" >"${PASS}"
  chmod 600 "${PASS}"
  LOCAL_TARGET="${HOME}/restore-drill-local"
  rm -rf "${LOCAL_TARGET}"
  mkdir -p "${LOCAL_TARGET}"
  sudo -n restic -r "${RESTIC_REPOSITORY}" --password-file "${PASS}" restore latest \
    --target "${LOCAL_TARGET}" \
    --tag mozas-vps \
    --include /opt/mozas/projects/thedigitalgifter/secrets/app.env \
    --include /opt/mozas/proxy/Caddyfile
  test -f "${LOCAL_TARGET}/opt/mozas/projects/thedigitalgifter/secrets/app.env"
  echo "local_restore_test=passed"
  export MOZAS_RESTORE_OFFSITE_TARGET="${HOME}/restore-drill-offsite"
  /opt/mozas/bin/mozas-restore-offsite-test
  rm -f "${PASS}"
'

echo "BACKUP_DRILL_OK"

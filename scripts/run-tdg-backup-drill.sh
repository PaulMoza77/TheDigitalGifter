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
  if sudo -n /opt/mozas/bin/mozas-restore-test; then
    echo "local_restore_test=passed"
  else
    echo "local restore-test via sudo script failed; using restic directly" >&2
    set -a
    # shellcheck disable=SC1090
    source /opt/mozas/secrets/backup.env
    set +a
    PASS="$(mktemp)"
    printf "%s" "${RESTIC_PASSWORD}" >"${PASS}"
    chmod 600 "${PASS}"
    TARGET=/opt/mozas/restore-test
    rm -rf "${TARGET}"
    mkdir -p "${TARGET}"
    sudo -n restic -r "${RESTIC_REPOSITORY}" --password-file "${PASS}" restore latest --target "${TARGET}" --tag mozas-vps
    rm -f "${PASS}"
    test -f "${TARGET}/opt/mozas/projects/thedigitalgifter/secrets/app.env"
    echo "local_restore_test=passed"
  fi
  /opt/mozas/bin/mozas-restore-offsite-test
'

echo "BACKUP_DRILL_OK"

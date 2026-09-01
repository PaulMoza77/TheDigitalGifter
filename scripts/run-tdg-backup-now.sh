#!/usr/bin/env bash
# Trigger a fresh local + R2 restic backup of the current Mozas config.
# Does not restore, does not change DNS, does not print secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"

mozas_prepare_ssh
mozas_verify_remote_identity

mozas_ssh bash -s <<'REMOTE'
set -euo pipefail
/opt/mozas/bin/mozas-ensure-offsite-restic
before=""
if [[ -f /opt/mozas/log/backup-last.json ]]; then
  before="$(python3 -c 'import json;print(json.load(open("/opt/mozas/log/backup-last.json")).get("timestamp",""))')"
fi
echo "backup_before_ts=${before}"
sudo -n systemctl start mozas-backup.service
for i in $(seq 1 90); do
  if [[ -f /opt/mozas/log/backup-last.json ]]; then
    if BEFORE="${before}" python3 - <<'PY'
import json
import os
from pathlib import Path
d = json.loads(Path("/opt/mozas/log/backup-last.json").read_text())
ts = str(d.get("timestamp") or "")
off = bool(d.get("offsite"))
before = os.environ.get("BEFORE", "")
print("backup_probe_ts=" + ts)
print("backup_probe_offsite=" + str(off).lower())
raise SystemExit(0 if off and ts and ts != before else 1)
PY
    then
      python3 - <<'PY'
import json
from pathlib import Path
d = json.loads(Path("/opt/mozas/log/backup-last.json").read_text())
print("backup_timestamp=" + str(d.get("timestamp")))
print("backup_offsite=" + str(d.get("offsite")).lower())
print("backup_local=" + str(bool(d.get("local"))).lower())
print("backup_ok=" + str(d.get("ok")))
PY
      exit 0
    fi
  fi
  if [[ "$i" -eq 90 ]]; then
    echo "backup did not report a new offsite=true snapshot" >&2
    sudo -n journalctl -u mozas-backup.service -n 60 --no-pager || true
    exit 1
  fi
  sleep 5
done
REMOTE

echo "BACKUP_NOW_OK"

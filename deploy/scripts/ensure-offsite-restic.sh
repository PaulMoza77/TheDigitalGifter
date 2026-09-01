#!/usr/bin/env bash
# Initialize the offsite restic repository when missing, then list snapshots.
# Never prints credentials. Does not replace production files.
set -euo pipefail

BACKUP_ENV="${MOZAS_BACKUP_ENV:-/opt/mozas/secrets/backup.env}"
# shellcheck disable=SC1090
set -a
source "${BACKUP_ENV}"
set +a

[[ -n "${MOZAS_BACKUP_S3_ENDPOINT:-}" ]] || { echo "offsite endpoint empty" >&2; exit 3; }
[[ -n "${MOZAS_BACKUP_S3_BUCKET:-}" ]] || { echo "offsite bucket empty" >&2; exit 3; }
[[ -n "${MOZAS_BACKUP_S3_ACCESS_KEY:-}" ]] || { echo "offsite access key empty" >&2; exit 3; }
[[ -n "${MOZAS_BACKUP_S3_SECRET_KEY:-}" ]] || { echo "offsite secret key empty" >&2; exit 3; }
[[ -n "${RESTIC_PASSWORD:-}" ]] || { echo "RESTIC_PASSWORD empty" >&2; exit 3; }

export AWS_ACCESS_KEY_ID="${MOZAS_BACKUP_S3_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${MOZAS_BACKUP_S3_SECRET_KEY}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
REPO2="s3:${MOZAS_BACKUP_S3_ENDPOINT}/${MOZAS_BACKUP_S3_BUCKET}"
PASS="$(mktemp)"
trap 'rm -f "${PASS}"' EXIT
printf '%s' "${RESTIC_PASSWORD}" >"${PASS}"
chmod 600 "${PASS}"

if restic -r "${REPO2}" --password-file "${PASS}" snapshots >/tmp/restic-offsite-snapshots.txt 2>/tmp/restic-offsite-init.err; then
  echo "offsite_restic=existing"
else
  if grep -qiE 'Is there a repository at the following location|does not exist|no repository' /tmp/restic-offsite-init.err; then
    restic -r "${REPO2}" --password-file "${PASS}" init >/tmp/restic-offsite-init.out
    echo "offsite_restic=initialized"
  else
    echo "offsite restic probe failed" >&2
    exit 1
  fi
fi
count="$(restic -r "${REPO2}" --password-file "${PASS}" snapshots --json 2>/dev/null | python3 -c '
import json,sys
try:
    data=json.load(sys.stdin)
    print(len(data) if isinstance(data, list) else 0)
except Exception:
    print(0)
')"
echo "offsite_snapshot_count=${count}"

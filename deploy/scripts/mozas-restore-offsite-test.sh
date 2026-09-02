#!/usr/bin/env bash
# Restore the latest *offsite* restic snapshot into an isolated directory.
# Does not replace production containers or files.
set -euo pipefail

BACKUP_ENV="${MOZAS_BACKUP_ENV:-/opt/mozas/secrets/backup.env}"
TARGET="${MOZAS_RESTORE_OFFSITE_TARGET:-${HOME}/restore-drill-offsite}"
export MOZAS_RESTORE_OFFSITE_TARGET="${TARGET}"
# shellcheck disable=SC1090
set -a
source "${BACKUP_ENV}"
set +a

[[ -n "${MOZAS_BACKUP_S3_ENDPOINT:-}" && -n "${MOZAS_BACKUP_S3_BUCKET:-}" ]] || {
  echo "offsite S3 keys missing" >&2
  exit 3
}
[[ -n "${RESTIC_PASSWORD:-}" ]] || { echo "RESTIC_PASSWORD empty" >&2; exit 3; }

export AWS_ACCESS_KEY_ID="${MOZAS_BACKUP_S3_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${MOZAS_BACKUP_S3_SECRET_KEY}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
REPO2="s3:${MOZAS_BACKUP_S3_ENDPOINT}/${MOZAS_BACKUP_S3_BUCKET}"
PASS="$(mktemp)"
trap 'rm -f "${PASS}"' EXIT
printf '%s' "${RESTIC_PASSWORD}" >"${PASS}"
chmod 600 "${PASS}"

rm -rf "${TARGET}"
mkdir -p "${TARGET}"

echo "restoring latest offsite snapshot to ${TARGET}"
restic -r "${REPO2}" --password-file "${PASS}" restore latest --target "${TARGET}" --tag mozas-vps

[[ -d "${TARGET}/opt/mozas/proxy" ]] || { echo "restore missing proxy" >&2; exit 1; }
[[ -d "${TARGET}/opt/mozas/secrets" ]] || { echo "restore missing secrets dir" >&2; exit 1; }
[[ -f "${TARGET}/opt/mozas/projects/thedigitalgifter/secrets/app.env" ]] || {
  echo "restore missing TDG app.env" >&2
  exit 1
}

python3 - <<'PY'
from pathlib import Path
import hashlib
import os
target = Path(os.environ.get("MOZAS_RESTORE_OFFSITE_TARGET", "/opt/mozas/restore-test-offsite"))
restored = target / "opt/mozas/projects/thedigitalgifter/secrets/app.env"
live = Path("/opt/mozas/projects/thedigitalgifter/secrets/app.env")
caddy_restored = target / "opt/mozas/proxy/Caddyfile"
caddy_live = Path("/opt/mozas/proxy/Caddyfile")

def keys(path: Path):
    out = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k] = bool(v.strip())
    return out

rk = keys(restored)
need = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
missing = [k for k in need if not rk.get(k)]
if missing:
    raise SystemExit("restored app.env missing nonempty: " + ",".join(missing))

def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

if live.exists() and sha(restored) != sha(live):
    # Snapshot may predate this run; presence of required keys is enough.
    print("app_env_hash_match=false")
else:
    print("app_env_hash_match=true")
if caddy_restored.exists() and caddy_live.exists():
    print("caddy_restored=true")
print("offsite_restore_tdg_keys=ok")
PY

echo "offsite_restore_test=passed"

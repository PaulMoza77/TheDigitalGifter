#!/usr/bin/env bash
# Merge offsite S3/R2 keys into /opt/mozas/secrets/backup.env.
# Normalizes endpoint so restic copy uses s3:https://host/bucket once.
# Never prints secret values.
set -euo pipefail

BACKUP_ENV="${MOZAS_BACKUP_ENV:-/opt/mozas/secrets/backup.env}"
SECRETS_DIR="$(dirname "${BACKUP_ENV}")"
umask 077
mkdir -p "${SECRETS_DIR}"
if [[ ! -f "${BACKUP_ENV}" ]]; then
  touch "${BACKUP_ENV}"
fi
WORK="$(mktemp "${SECRETS_DIR}/backup.env.XXXXXX")"
cp "${BACKUP_ENV}" "${WORK}"

normalize_endpoint() {
  python3 - <<'PY'
import os
from urllib.parse import urlparse
endpoint = (os.environ.get("MOZAS_BACKUP_S3_ENDPOINT") or "").strip()
bucket = (os.environ.get("MOZAS_BACKUP_S3_BUCKET") or "").strip()
if not endpoint or not bucket:
    raise SystemExit(0)
if "://" in endpoint and not endpoint.lower().startswith("https://"):
    raise SystemExit("endpoint must use https")
raw = endpoint
if endpoint.lower().startswith("https://"):
    u = urlparse(endpoint)
    host = u.netloc
    path_parts = [p for p in u.path.split("/") if p]
else:
    parts = [p for p in endpoint.replace("https://", "").split("/") if p]
    host = parts[0] if parts else ""
    path_parts = parts[1:]
if not host:
    raise SystemExit("endpoint host is empty")
if path_parts and path_parts[-1] == bucket:
    path_parts = path_parts[:-1]
if path_parts:
    raise SystemExit("endpoint path must be empty or end with the bucket name")
normalized = f"https://{host}" if raw.lower().startswith("https://") else host
print(normalized)
print(bucket)
PY
}

merge_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  [[ -n "${value}" ]] || return 0
  local tmp
  tmp="$(mktemp)"
  awk -v k="${key}" -v v="${value}" '
    BEGIN { done=0 }
    index($0, k "=")==1 { print k "=" v; done=1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "${file}" >"${tmp}"
  cat "${tmp}" >"${file}"
  rm -f "${tmp}"
}

if [[ -n "${MOZAS_BACKUP_S3_ENDPOINT:-}" && -n "${MOZAS_BACKUP_S3_BUCKET:-}" ]]; then
  norm="$(normalize_endpoint)"
  MOZAS_BACKUP_S3_ENDPOINT="$(printf '%s\n' "${norm}" | sed -n '1p')"
  MOZAS_BACKUP_S3_BUCKET="$(printf '%s\n' "${norm}" | sed -n '2p')"
fi

merge_key "${WORK}" MOZAS_BACKUP_S3_ENDPOINT "${MOZAS_BACKUP_S3_ENDPOINT:-}"
merge_key "${WORK}" MOZAS_BACKUP_S3_BUCKET "${MOZAS_BACKUP_S3_BUCKET:-}"
merge_key "${WORK}" MOZAS_BACKUP_S3_ACCESS_KEY "${MOZAS_BACKUP_S3_ACCESS_KEY:-}"
merge_key "${WORK}" MOZAS_BACKUP_S3_SECRET_KEY "${MOZAS_BACKUP_S3_SECRET_KEY:-}"
merge_key "${WORK}" AWS_DEFAULT_REGION "${AWS_DEFAULT_REGION:-auto}"

chmod 0640 "${WORK}" || true
mv -f "${WORK}" "${BACKUP_ENV}"

echo "backup_env=${BACKUP_ENV}"
echo "backup_env_mode=$(stat -c %a "${BACKUP_ENV}")"
echo "backup_env_owner=$(stat -c %U:%G "${BACKUP_ENV}")"
missing=0
for k in MOZAS_BACKUP_S3_ENDPOINT MOZAS_BACKUP_S3_BUCKET MOZAS_BACKUP_S3_ACCESS_KEY MOZAS_BACKUP_S3_SECRET_KEY RESTIC_REPOSITORY RESTIC_PASSWORD; do
  val=$(grep -E "^${k}=" "${BACKUP_ENV}" | head -1 | cut -d= -f2- || true)
  if [[ -n "${val}" ]]; then
    echo "KEY_NONEMPTY: ${k}"
  else
    echo "KEY_EMPTY: ${k}"
    missing=1
  fi
done
if [[ "${missing}" -eq 1 ]]; then
  echo "backup_secrets_status=incomplete"
  exit 3
fi
echo "backup_secrets_status=ready"

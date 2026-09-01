#!/usr/bin/env bash
# Safely copy RESTIC_PASSWORD off the VPS into a founder-controlled local file.
# Never prints the password. Never writes under the git repo or /opt/cursor/artifacts.
#
# Usage:
#   RESTIC_PASSWORD_EXPORT_PATH="$HOME/tdg-restic-password.txt" bash scripts/export-restic-password-offsite.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"

OUT="${RESTIC_PASSWORD_EXPORT_PATH:-}"
if [[ -z "${OUT}" ]]; then
  echo "BLOCKED: set RESTIC_PASSWORD_EXPORT_PATH to an absolute path outside the repo/artifacts." >&2
  echo "Example: RESTIC_PASSWORD_EXPORT_PATH=\"\$HOME/tdg-restic-password.txt\" bash scripts/export-restic-password-offsite.sh" >&2
  exit 2
fi
case "${OUT}" in
  /workspace/*|/opt/cursor/artifacts/*|*/TheDigitalGifter/*)
    echo "BLOCKED: refusing to write RESTIC_PASSWORD into the repo or walkthrough artifacts." >&2
    exit 2
    ;;
esac
if [[ "${OUT}" != /* ]]; then
  echo "BLOCKED: RESTIC_PASSWORD_EXPORT_PATH must be absolute." >&2
  exit 2
fi

mozas_prepare_ssh
mozas_verify_remote_identity

umask 077
mkdir -p "$(dirname "${OUT}")"
tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

# Pull only the password line value; do not echo it.
mozas_ssh 'python3 - <<'"'"'PY'"'"'
from pathlib import Path
for line in Path("/opt/mozas/secrets/backup.env").read_text().splitlines():
    if line.startswith("RESTIC_PASSWORD="):
        print(line.split("=",1)[1], end="")
        break
else:
    raise SystemExit("RESTIC_PASSWORD missing on VPS")
PY' >"${tmp}"

if [[ ! -s "${tmp}" ]]; then
  echo "BLOCKED: empty password export" >&2
  exit 1
fi

# Atomic install as 0600
install -m 0600 "${tmp}" "${OUT}"
# Do not print path contents; only confirm destination exists + mode.
mode="$(stat -c %a "${OUT}")"
owner="$(stat -c %U:%G "${OUT}")"
bytes="$(wc -c <"${OUT}" | tr -d ' ')"
echo "restic_password_exported=yes"
echo "path_set=yes"
echo "mode=${mode}"
echo "owner=${owner}"
echo "bytes=${bytes}"
echo "NEXT: store this file in your password manager, then shred the local copy:"
echo "  shred -u \"\$RESTIC_PASSWORD_EXPORT_PATH\""

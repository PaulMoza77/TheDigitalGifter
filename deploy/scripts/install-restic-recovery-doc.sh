#!/usr/bin/env bash
# Install operator instructions for recovering RESTIC_PASSWORD off-VPS (no secret values).
set -euo pipefail
DEST="${1:-/opt/mozas/secrets/RESTIC_PASSWORD_RECOVERY.txt}"
umask 077
cat >"${DEST}" <<'EOF'
Mozas / TDG — RESTIC_PASSWORD off-VPS recovery
==============================================

The restic repository password lives ONLY in:
  /opt/mozas/secrets/backup.env   (key: RESTIC_PASSWORD)

It is required to restore local (/opt/mozas/backups/restic) and R2 offsite copies.

Safe export (from a trusted laptop with MOZAS_SSH_*):
  RESTIC_PASSWORD_EXPORT_PATH="$HOME/tdg-restic-password.txt" \
    bash scripts/export-restic-password-offsite.sh

Then:
  1) Paste into the founder password manager (1Password / Bitwarden).
  2) shred -u "$HOME/tdg-restic-password.txt"
  3) Never commit the password. Never put it in GitHub Actions logs or PR text.

Daily offsite backup:
  systemctl status mozas-backup.timer
  cat /opt/mozas/log/backup-last.json   # expect "offsite": true

Isolated restore drill:
  bash scripts/run-tdg-backup-drill.sh
EOF
chmod 0640 "${DEST}" || true
echo "restic_recovery_doc=${DEST}"

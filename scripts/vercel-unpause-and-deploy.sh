#!/usr/bin/env bash
# FORBIDDEN for TDG production.
# Production origin is Mozas VPS via scripts/deploy-production.sh (Cloud Agent SSH).
# This script previously published to Vercel and must not be used.
set -euo pipefail

echo "BLOCKED: Vercel deploy is forbidden for TDG production."
echo "Use: bash scripts/deploy-production.sh"
echo "Credentials: Cursor Cloud Agent MOZAS_SSH_* secrets (not Vercel, not GitHub Actions)."
echo "If SSH fails, debug the VPS path. Do not switch deployment providers."
exit 2

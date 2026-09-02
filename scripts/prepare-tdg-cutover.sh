#!/usr/bin/env bash
# Pre-flight for a founder-driven DNS cutover. Does not change DNS. Does not apply HTTPS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "===== DNS readiness (no IPs printed) ====="
set +e
node "${ROOT}/scripts/check-tdg-dns-ready.mjs"
dns_rc=$?
set -e

echo "===== HTTPS pre ====="
TDG_HTTPS_PHASE=pre node "${ROOT}/scripts/verify-tdg-https.mjs"

echo "===== Origin (accepts HTTP 200 or HTTP→HTTPS) ====="
node "${ROOT}/scripts/verify-tdg-vps-origin.mjs"

if [[ "${dns_rc}" -eq 0 ]]; then
  echo "CUTOVER_PREPARED dns=ready"
  echo "When you confirm DNS, run: TDG_HTTPS_APPLY=yes bash scripts/apply-tdg-https.sh"
else
  echo "CUTOVER_PREPARED dns=waiting"
  echo "Point apex + www A at MOZAS_SSH_HOST (prefer no AAAA / grey-cloud). Keep MX."
  echo "Do not apply HTTPS until both names are on the VPS and you confirm."
fi

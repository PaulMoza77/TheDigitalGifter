#!/usr/bin/env bash
# Roll TDG on the Mozas VPS back to the previous verified image.
# Does not change public DNS. Vercel remains the public origin until cutover.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"
mozas_prepare_ssh
mozas_verify_remote_identity
mozas_ssh /opt/mozas/bin/mozas-rollback-thedigitalgifter
themozas="$(mozas_ssh 'curl -fsS http://127.0.0.1/healthz')"
[[ "${themozas}" == "ok" ]] || { echo "TheMozas health failed after TDG rollback"; exit 1; }
echo "TDG_VPS_ROLLBACK_OK destination=mozas/thedigitalgifter:previous"
echo "Public DNS rollback (after cutover) is separate: restore records from docs/audits/tdg-dns-before-cutover.txt"

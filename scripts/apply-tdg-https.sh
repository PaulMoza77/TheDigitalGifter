#!/usr/bin/env bash
# Apply HTTPS Caddy for thedigitalgifter.com after you have pointed DNS at the VPS.
# Does not call Cloudflare. Does not change DNS.
# Runs real HTTPS verification for both domains after apply.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"

if [[ "${TDG_HTTPS_APPLY:-}" != "yes" ]]; then
  echo "BLOCKED: set TDG_HTTPS_APPLY=yes after DNS already points at the VPS."
  echo "Example: TDG_HTTPS_APPLY=yes bash scripts/apply-tdg-https.sh"
  exit 2
fi

mozas_prepare_ssh
mozas_verify_remote_identity

# Sync latest HTTPS Caddyfile + scripts before apply.
REMOTE_REPO="/opt/mozas/projects/thedigitalgifter/repo"
mozas_ssh "mkdir -p ${REMOTE_REPO}/deploy/caddy ${REMOTE_REPO}/deploy/scripts ${REMOTE_REPO}/deploy/lib"
mozas_rsync "${ROOT}/deploy/caddy/" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_REPO}/deploy/caddy/"
mozas_rsync "${ROOT}/deploy/scripts/" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_REPO}/deploy/scripts/"
mozas_rsync "${ROOT}/deploy/lib/" "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_REPO}/deploy/lib/"
mozas_ssh "set -euo pipefail
  install -m 0755 ${REMOTE_REPO}/deploy/scripts/apply-tdg-caddy.sh /opt/mozas/bin/mozas-apply-tdg-caddy
  install -m 0755 ${REMOTE_REPO}/deploy/scripts/apply-tdg-caddy-https.sh /opt/mozas/bin/mozas-apply-tdg-caddy-https
  install -m 0755 ${REMOTE_REPO}/deploy/scripts/mozas-ensure-tdg-caddy.sh /opt/mozas/bin/mozas-ensure-tdg-caddy
"

themozas_pre="$(mozas_ssh 'curl -fsS http://127.0.0.1/healthz')"
if [[ "${themozas_pre}" != "ok" ]]; then
  echo "TheMozas /healthz before HTTPS apply: unexpected"
  exit 1
fi

mozas_ssh bash -s <<REMOTE
set -euo pipefail
export TDG_HTTPS_APPLY=yes
export TDG_HTTPS_ALLOW_PROXIED=${TDG_HTTPS_ALLOW_PROXIED:-}
export MOZAS_ORIGIN_IP=${MOZAS_SSH_HOST}
# First activation: run public/local HTTPS probes (do not skip).
unset TDG_HTTPS_SKIP_PUBLIC_VERIFY || true
/opt/mozas/bin/mozas-apply-tdg-caddy-https
REMOTE

themozas_post="$(mozas_ssh 'curl -fsS http://127.0.0.1/healthz')"
if [[ "${themozas_post}" != "ok" ]]; then
  echo "DEPLOY_FAILED: TheMozas /healthz regress after HTTPS apply"
  exit 1
fi
echo "themozas_post_health=ok"

echo "Running post-cutover HTTPS verification for both domains..."
TDG_HTTPS_PHASE=post MOZAS_SSH_HOST="${MOZAS_SSH_HOST}" node "${ROOT}/scripts/verify-tdg-https.mjs"

echo "TDG_HTTPS_APPLY_OK"
echo "Verify: curl -sSI https://www.thedigitalgifter.com/healthz | head"

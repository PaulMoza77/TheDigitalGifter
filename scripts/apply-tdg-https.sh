#!/usr/bin/env bash
# Apply HTTPS Caddy for thedigitalgifter.com after you have pointed DNS at the VPS.
# Does not call Cloudflare. Does not change DNS.
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

themozas_pre="$(mozas_ssh 'curl -fsS http://127.0.0.1/healthz')"
if [[ "${themozas_pre}" != "ok" ]]; then
  echo "TheMozas /healthz before HTTPS apply: unexpected"
  exit 1
fi

mozas_ssh "TDG_HTTPS_APPLY=yes TDG_HTTPS_ALLOW_PROXIED=${TDG_HTTPS_ALLOW_PROXIED:-} MOZAS_ORIGIN_IP=${MOZAS_SSH_HOST} /opt/mozas/bin/mozas-apply-tdg-caddy-https"

themozas_post="$(mozas_ssh 'curl -fsS http://127.0.0.1/healthz')"
if [[ "${themozas_post}" != "ok" ]]; then
  echo "DEPLOY_FAILED: TheMozas /healthz regress after HTTPS apply"
  exit 1
fi
echo "themozas_post_health=ok"
echo "TDG_HTTPS_APPLY_OK"
echo "Verify: curl -sSI https://www.thedigitalgifter.com/ | head"

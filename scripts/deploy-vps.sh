#!/usr/bin/env bash
# Deploy TheDigitalGifter application source to the authorized Mozas VPS and
# start the Docker origin. Never reports success on skip or failure.
#
# Required: MOZAS_SSH_HOST, MOZAS_SSH_PRIVATE_KEY
# MOZAS_SSH_USER must be mozas on this host (other values are ignored).
# VITE_* are read from the VPS secrets file, not from this machine.
# Do not use VPS_* variables.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"

mozas_prepare_ssh
mozas_verify_remote_identity

echo "Identity ok: ${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST} (${MOZAS_EXPECTED_HOSTNAME})"

themozas_pre="$(mozas_ssh 'curl -fsS http://127.0.0.1/healthz')"
if [[ "${themozas_pre}" != "ok" ]]; then
  echo "TheMozas /healthz before deploy: unexpected"
  exit 1
fi
echo "themozas_pre_health=ok"

COMMIT="$(git -C "${ROOT}" rev-parse HEAD)"
SHORT="$(git -C "${ROOT}" rev-parse --short HEAD)"
printf '%s\n' "${COMMIT}" >"${ROOT}/.tdg-commit"

REMOTE_REPO="/opt/mozas/projects/thedigitalgifter/repo"
mozas_ssh "mkdir -p ${REMOTE_REPO} /opt/mozas/projects/thedigitalgifter/releases /opt/mozas/bin"

echo "Syncing application source → ${REMOTE_REPO} (secrets directory is not touched)"
mozas_rsync \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'secrets/' \
  "${ROOT}/" \
  "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}:${REMOTE_REPO}/"

mozas_ssh "set -euo pipefail
  cp /opt/mozas/projects/thedigitalgifter/repo/deploy/docker-compose.yml /opt/mozas/projects/thedigitalgifter/docker-compose.yml
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/mozas-deploy-thedigitalgifter.sh /opt/mozas/bin/mozas-deploy-thedigitalgifter
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/mozas-rollback-thedigitalgifter.sh /opt/mozas/bin/mozas-rollback-thedigitalgifter
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/apply-tdg-caddy.sh /opt/mozas/bin/mozas-apply-tdg-caddy
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/apply-tdg-caddy-https.sh /opt/mozas/bin/mozas-apply-tdg-caddy-https
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/merge-tdg-app-env.sh /opt/mozas/bin/mozas-merge-tdg-app-env
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/merge-mozas-backup-env.sh /opt/mozas/bin/mozas-merge-backup-env
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/ensure-offsite-restic.sh /opt/mozas/bin/mozas-ensure-offsite-restic
  install -m 0755 /opt/mozas/projects/thedigitalgifter/repo/deploy/scripts/mozas-restore-offsite-test.sh /opt/mozas/bin/mozas-restore-offsite-test
  test -f /opt/mozas/projects/thedigitalgifter/secrets/app.env
  test ! -e /opt/mozas/projects/thedigitalgifter/repo/secrets
"

echo "Applying TDG Caddy routes (TheMozas default :80 preserved)"
mozas_ssh "/opt/mozas/bin/mozas-apply-tdg-caddy"

echo "Building and starting TDG release ${SHORT}"
if ! mozas_ssh "TDG_RELEASE=${SHORT} /opt/mozas/bin/mozas-deploy-thedigitalgifter"; then
  echo "DEPLOY_FAILED: remote TDG start did not become healthy"
  exit 1
fi

themozas_post="$(mozas_ssh 'curl -fsS http://127.0.0.1/healthz')"
if [[ "${themozas_post}" != "ok" ]]; then
  echo "DEPLOY_FAILED: TheMozas /healthz regress after TDG deploy"
  exit 1
fi
echo "themozas_post_health=ok"

mozas_ssh 'set -euo pipefail
  body=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    body="$(curl -sS --resolve tdg-verify.mozas-prod-01:80:127.0.0.1 http://tdg-verify.mozas-prod-01/healthz || true)"
    if [[ "${body}" == "ok" ]]; then
      break
    fi
    sleep 2
  done
  test "${body}" = ok
  echo tdg_health_ok=yes
  api_code="$(curl -sS -o /tmp/tdg-api-miss.body -w "%{http_code}" --resolve tdg-verify.mozas-prod-01:80:127.0.0.1 http://tdg-verify.mozas-prod-01/api/does-not-exist)"
  test "${api_code}" = 404
  if grep -qi "<html" /tmp/tdg-api-miss.body; then
    echo "api_miss_returned_html"
    exit 1
  fi
  echo tdg_api_miss_not_spa=yes
'

rm -f "${ROOT}/.tdg-commit"
echo "TDG_VPS_DEPLOY_OK commit=${COMMIT} release=${SHORT}"
echo "Verify: curl --resolve tdg-verify.mozas-prod-01:80:\$MOZAS_SSH_HOST http://tdg-verify.mozas-prod-01/"
echo "Rollback image: /opt/mozas/bin/mozas-rollback-thedigitalgifter"
echo "Public DNS was not changed."

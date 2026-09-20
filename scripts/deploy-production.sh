#!/usr/bin/env bash
# =============================================================================
# Canonical TDG production deployment (ONLY valid path)
#
#   CURSOR CLOUD AGENT → DIRECT SSH → PRODUCTION VPS → BUILD/RESTART → HEALTHCHECK
#
# Required Cloud Agent secrets (names only):
#   MOZAS_SSH_HOST, MOZAS_SSH_PRIVATE_KEY, MOZAS_SSH_USER
#
# Forbidden:
#   - Vercel
#   - GitHub Actions
#   - Any alternate hosting provider when SSH fails
#
# If this script fails: debug SSH / VPS / Docker. Do not switch providers.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo "BLOCKED: TDG production deploy via GitHub Actions is forbidden."
  echo "Production deployment MUST run from a Cursor Cloud Agent using"
  echo "Cloud Agent secrets and scripts/deploy-production.sh over SSH."
  exit 2
fi

if [[ -n "${VERCEL:-}" || -n "${VERCEL_ENV:-}" ]]; then
  echo "BLOCKED: TDG production deploy via Vercel is forbidden."
  echo "Production origin is the Mozas VPS. Use scripts/deploy-production.sh."
  exit 2
fi

for name in MOZAS_SSH_HOST MOZAS_SSH_PRIVATE_KEY; do
  if [[ -z "${!name:-}" ]]; then
    echo "BLOCKED: ${name} is missing from Cloud Agent secrets."
    echo "Add it in Cursor Cloud Agent secrets. Do not use GitHub Actions secrets."
    echo "Do not switch deployment providers."
    exit 2
  fi
done

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync missing — installing for Cloud Agent → VPS sync (not switching providers)"
  if command -v apt-get >/dev/null 2>&1; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq rsync
  fi
  if ! command -v rsync >/dev/null 2>&1; then
    echo "BLOCKED: rsync is required for SSH/VPS deploy and could not be installed."
    echo "Debug the Cloud Agent environment / VPS path. Do not switch deployment providers."
    exit 2
  fi
fi

if ! command -v ssh >/dev/null 2>&1 || ! command -v ssh-keyscan >/dev/null 2>&1; then
  echo "BLOCKED: OpenSSH client (ssh/ssh-keyscan) is required for VPS deploy."
  echo "Debug the Cloud Agent environment / VPS path. Do not switch deployment providers."
  exit 2
fi

COMMIT="$(git -C "${ROOT}" rev-parse HEAD)"
SHORT="$(git -C "${ROOT}" rev-parse --short HEAD)"

echo "=== TDG production deploy (Cloud Agent → SSH → VPS) ==="
echo "intended_commit=${COMMIT}"
echo "vercel_used=NO"
echo "github_actions_used=NO"

echo "--- SSH + VPS build/restart ---"
# Core sync/build/restart lives in deploy-vps.sh (Mozas identity + Docker compose).
bash "${ROOT}/scripts/deploy-vps.sh"

echo "--- Public healthchecks ---"
# shellcheck source=mozas-ssh.sh
source "${ROOT}/scripts/mozas-ssh.sh"
mozas_prepare_ssh
mozas_verify_remote_identity

health_body=""
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  health_body="$(mozas_ssh 'curl -fsS --resolve tdg-verify.mozas-prod-01:80:127.0.0.1 http://tdg-verify.mozas-prod-01/healthz' || true)"
  if [[ "${health_body}" == "ok" ]]; then
    break
  fi
  sleep 2
done
if [[ "${health_body}" != "ok" ]]; then
  echo "DEPLOY_FAILED: /healthz did not return ok"
  echo "Debug the SSH/VPS deployment. Do not switch deployment providers."
  exit 1
fi
echo "healthcheck=/healthz PASS"

christmas_code=""
christmas_ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  christmas_code="$(curl -sS -o /tmp/tdg-christmas-deploy.body -w "%{http_code}" \
    --max-time 30 \
    "https://www.thedigitalgifter.com/christmas" || true)"
  if [[ "${christmas_code}" == "200" ]] && grep -qiE 'christmas|digital.?gifter|<!DOCTYPE html' /tmp/tdg-christmas-deploy.body; then
    christmas_ok=1
    break
  fi
  sleep 3
done
if [[ "${christmas_ok}" -ne 1 ]]; then
  echo "DEPLOY_FAILED: https://www.thedigitalgifter.com/christmas did not return a healthy page (http=${christmas_code:-none})"
  echo "Debug the SSH/VPS deployment. Do not switch deployment providers."
  exit 1
fi
echo "healthcheck=/christmas PASS"

remote_sha="$(mozas_ssh 'tr -d "[:space:]" </opt/mozas/projects/thedigitalgifter/releases/verified.sha' || true)"
if [[ -z "${remote_sha}" ]]; then
  echo "DEPLOY_FAILED: missing remote verified.sha after deploy"
  exit 1
fi
if [[ "${remote_sha}" != "${COMMIT}" && "${remote_sha}" != "${SHORT}" ]]; then
  echo "DEPLOY_FAILED: remote verified.sha=${remote_sha} does not match intended commit=${COMMIT}"
  echo "Debug the SSH/VPS deployment. Do not switch deployment providers."
  exit 1
fi
echo "deployed_commit_match=PASS (${remote_sha})"

echo ""
echo "=== TDG production deploy proof ==="
echo "SSH: PASS"
echo "VPS deploy: PASS"
echo "build: PASS"
echo "restart: PASS"
echo "healthcheck: PASS"
echo "/christmas: PASS"
echo "deployed commit: ${COMMIT}"
echo "Vercel used: NO"
echo "GitHub Actions used: NO"
echo "TDG_PRODUCTION_DEPLOY_OK commit=${COMMIT} release=${SHORT}"

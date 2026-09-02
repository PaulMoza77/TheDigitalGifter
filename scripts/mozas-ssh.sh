#!/usr/bin/env bash
# Shared Mozas VPS SSH identity. Never prints key material.
# Host comes only from MOZAS_SSH_HOST. User is always mozas; hostname must be mozas-prod-01.
set -euo pipefail

MOZAS_EXPECTED_PORT="22"
MOZAS_EXPECTED_USER="mozas"
MOZAS_EXPECTED_HOSTNAME="mozas-prod-01"
MOZAS_EXPECTED_FINGERPRINT="SHA256:cygpYZwFgfu0Us7v2ekcfQdUwSzCAwc6XRFHrPWy+B4"

mozas_die() { printf 'BLOCKED: %s\n' "$*" >&2; exit 2; }

mozas_require_identity_env() {
  local host="${MOZAS_SSH_HOST:-}"
  local key="${MOZAS_SSH_PRIVATE_KEY:-}"
  [[ -n "${host}" ]] || mozas_die "MOZAS_SSH_HOST is missing"
  [[ -n "${key}" ]] || mozas_die "MOZAS_SSH_PRIVATE_KEY is missing"
  MOZAS_EXPECTED_HOST="${host}"
  # MOZAS_SSH_USER=user (or any non-mozas value) is invalid on this host.
  MOZAS_SSH_USER="${MOZAS_EXPECTED_USER}"
}

mozas_prepare_ssh() {
  mozas_require_identity_env
  MOZAS_SSH_DIR="$(mktemp -d /tmp/mozas-ssh-XXXXXX)"
  chmod 700 "${MOZAS_SSH_DIR}"
  MOZAS_SSH_KEY_FILE="${MOZAS_SSH_DIR}/id"
  MOZAS_SSH_KNOWN_HOSTS="${MOZAS_SSH_DIR}/known_hosts"
  umask 077
  printf '%s\n' "${MOZAS_SSH_PRIVATE_KEY}" >"${MOZAS_SSH_KEY_FILE}"
  chmod 600 "${MOZAS_SSH_KEY_FILE}"
  ssh-keyscan -T 10 -t ed25519 -p "${MOZAS_EXPECTED_PORT}" "${MOZAS_EXPECTED_HOST}" 2>/dev/null \
    | grep ssh-ed25519 >"${MOZAS_SSH_KNOWN_HOSTS}" \
    || mozas_die "could not fetch ED25519 host key from ${MOZAS_EXPECTED_HOST}"
  local fp
  fp="$(ssh-keygen -lf "${MOZAS_SSH_KNOWN_HOSTS}" -E sha256 | awk '{print $2}')"
  [[ "${fp}" == "${MOZAS_EXPECTED_FINGERPRINT}" ]] || mozas_die "ED25519 fingerprint mismatch"
  chmod 600 "${MOZAS_SSH_KNOWN_HOSTS}"
  trap 'rm -rf "${MOZAS_SSH_DIR}"' EXIT
}

mozas_ssh() {
  ssh -i "${MOZAS_SSH_KEY_FILE}" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="${MOZAS_SSH_KNOWN_HOSTS}" \
    -o GlobalKnownHostsFile=/dev/null \
    -o PreferredAuthentications=publickey \
    -o PasswordAuthentication=no \
    -o KbdInteractiveAuthentication=no \
    -p "${MOZAS_EXPECTED_PORT}" \
    -o ConnectTimeout=20 \
    "${MOZAS_EXPECTED_USER}@${MOZAS_EXPECTED_HOST}" \
    "$@"
}

mozas_rsync() {
  rsync -az --delete \
    -e "ssh -i ${MOZAS_SSH_KEY_FILE} -p ${MOZAS_EXPECTED_PORT} -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${MOZAS_SSH_KNOWN_HOSTS} -o GlobalKnownHostsFile=/dev/null -o PreferredAuthentications=publickey" \
    "$@"
}

mozas_verify_remote_identity() {
  local remote
  remote="$(mozas_ssh 'printf %s "$(hostname)"')"
  [[ "${remote}" == "${MOZAS_EXPECTED_HOSTNAME}" ]] || mozas_die "remote hostname is not ${MOZAS_EXPECTED_HOSTNAME}"
}

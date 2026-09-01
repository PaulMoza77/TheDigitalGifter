#!/usr/bin/env bash
# Install TDG host routing on the shared Caddy proxy without removing TheMozas routes.
# Does not enable public thedigitalgifter.com HTTPS until DNS cutover.
set -euo pipefail

PROXY_DIR="${MOZAS_PROXY_DIR:-/opt/mozas/proxy}"
SRC_HTTP="${1:-}"
if [[ -z "${SRC_HTTP}" ]]; then
  if [[ -f /opt/mozas/projects/thedigitalgifter/repo/deploy/caddy/Caddyfile.http ]]; then
    SRC_HTTP=/opt/mozas/projects/thedigitalgifter/repo/deploy/caddy/Caddyfile.http
  else
    echo "missing Caddyfile.http" >&2
    exit 1
  fi
fi

[[ -f "${PROXY_DIR}/Caddyfile" ]] || { echo "missing ${PROXY_DIR}/Caddyfile" >&2; exit 1; }
if ! grep -q 'themozas:8080' "${SRC_HTTP}"; then
  echo "refusing Caddyfile that does not keep TheMozas upstream" >&2
  exit 1
fi
if ! grep -q 'tdg-verify.mozas-prod-01' "${SRC_HTTP}"; then
  echo "refusing Caddyfile without TDG verify host" >&2
  exit 1
fi

cp -a "${PROXY_DIR}/Caddyfile" "${PROXY_DIR}/Caddyfile.bak-tdg"
cp "${SRC_HTTP}" "${PROXY_DIR}/Caddyfile"

# Reload in place. Do not recreate the published 80/443 mapping.
if docker exec mozas-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null; then
  docker exec mozas-caddy caddy reload --config /etc/caddy/Caddyfile
else
  echo "Caddyfile failed validation — restoring previous file" >&2
  cp -a "${PROXY_DIR}/Caddyfile.bak-tdg" "${PROXY_DIR}/Caddyfile"
  exit 1
fi
echo "tdg_caddy_applied=yes"

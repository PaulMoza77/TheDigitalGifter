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

# Admin API is disabled (admin off). Validate, then restart the existing container
# so the bind-mounted Caddyfile is picked up without changing published ports.
if ! docker exec mozas-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null; then
  echo "Caddyfile failed validation — restoring previous file" >&2
  cp -a "${PROXY_DIR}/Caddyfile.bak-tdg" "${PROXY_DIR}/Caddyfile"
  exit 1
fi
docker restart mozas-caddy >/dev/null
# Wait until TheMozas health is reachable again through :80
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1/healthz >/dev/null 2>&1; then
    echo "tdg_caddy_applied=yes"
    exit 0
  fi
  sleep 1
done
echo "Caddy restarted but :80 healthz did not recover" >&2
exit 1

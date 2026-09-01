#!/usr/bin/env bash
# Install TDG HTTP host routing on the shared Caddy proxy without removing TheMozas routes.
# Refuses to downgrade an active HTTPS TDG configuration unless FORCE_TDG_CADDY_HTTP=yes.
set -euo pipefail

PROXY_DIR="${MOZAS_PROXY_DIR:-/opt/mozas/proxy}"
MODE_FILE="${PROXY_DIR}/tdg-caddy.mode"
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

if [[ "${FORCE_TDG_CADDY_HTTP:-}" != "yes" ]]; then
  if [[ -f "${MODE_FILE}" ]] && grep -qiE '^https$' "${MODE_FILE}"; then
    echo "refusing to overwrite HTTPS Caddy with HTTP file (mode marker=https). Use mozas-ensure-tdg-caddy or FORCE_TDG_CADDY_HTTP=yes." >&2
    exit 3
  fi
  if grep -qE '^[[:space:]]*thedigitalgifter\.com,[[:space:]]*www\.thedigitalgifter\.com[[:space:]]*\{' "${PROXY_DIR}/Caddyfile" \
    || grep -qE '^[[:space:]]*www\.thedigitalgifter\.com,[[:space:]]*thedigitalgifter\.com[[:space:]]*\{' "${PROXY_DIR}/Caddyfile"; then
    echo "refusing to overwrite active named HTTPS TDG site with HTTP file. Use mozas-ensure-tdg-caddy." >&2
    exit 3
  fi
fi

if ! grep -q 'themozas:8080' "${SRC_HTTP}"; then
  echo "refusing Caddyfile that does not keep TheMozas upstream" >&2
  exit 1
fi
if ! grep -q 'tdg-verify.mozas-prod-01' "${SRC_HTTP}"; then
  echo "refusing Caddyfile without TDG verify host" >&2
  exit 1
fi
if ! grep -q 'thedigitalgifter.com' "${SRC_HTTP}"; then
  echo "refusing Caddyfile without thedigitalgifter.com host" >&2
  exit 1
fi
if ! grep -q 'www.thedigitalgifter.com' "${SRC_HTTP}"; then
  echo "refusing Caddyfile without www.thedigitalgifter.com host" >&2
  exit 1
fi

cp -a "${PROXY_DIR}/Caddyfile" "${PROXY_DIR}/Caddyfile.bak-tdg"
cp "${SRC_HTTP}" "${PROXY_DIR}/Caddyfile"

if ! docker exec mozas-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null; then
  echo "Caddyfile failed validation — restoring previous file" >&2
  cp -a "${PROXY_DIR}/Caddyfile.bak-tdg" "${PROXY_DIR}/Caddyfile"
  exit 1
fi
docker restart mozas-caddy >/dev/null
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1/healthz >/dev/null 2>&1; then
    printf 'http\n' >"${MODE_FILE}"
    chmod 0644 "${MODE_FILE}" || true
    echo "tdg_caddy_applied=yes"
    echo "tdg_caddy_mode=http"
    exit 0
  fi
  sleep 1
done
echo "Caddy restarted but :80 healthz did not recover" >&2
exit 1

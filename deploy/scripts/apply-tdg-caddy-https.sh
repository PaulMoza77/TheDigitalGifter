#!/usr/bin/env bash
# Apply HTTPS Caddy routes for thedigitalgifter.com AFTER public DNS points here.
# Keeps TheMozas upstream. Does not change DNS.
# Require TDG_HTTPS_APPLY=yes. Optional: TDG_HTTPS_ALLOW_PROXIED=yes if Cloudflare orange-cloud.
set -euo pipefail

if [[ "${TDG_HTTPS_APPLY:-}" != "yes" ]]; then
  echo "BLOCKED: set TDG_HTTPS_APPLY=yes after DNS for thedigitalgifter.com points at this VPS." >&2
  exit 2
fi

PROXY_DIR="${MOZAS_PROXY_DIR:-/opt/mozas/proxy}"
SRC_HTTPS="${1:-}"
if [[ -z "${SRC_HTTPS}" ]]; then
  if [[ -f /opt/mozas/projects/thedigitalgifter/repo/deploy/caddy/Caddyfile.https.ready ]]; then
    SRC_HTTPS=/opt/mozas/projects/thedigitalgifter/repo/deploy/caddy/Caddyfile.https.ready
  else
    echo "missing Caddyfile.https.ready" >&2
    exit 1
  fi
fi

[[ -f "${SRC_HTTPS}" ]] || { echo "missing ${SRC_HTTPS}" >&2; exit 1; }
if ! grep -q 'themozas:8080' "${SRC_HTTPS}"; then
  echo "refusing HTTPS Caddyfile that does not keep TheMozas upstream" >&2
  exit 1
fi
if ! grep -q 'thedigitalgifter.com' "${SRC_HTTPS}"; then
  echo "refusing HTTPS Caddyfile without thedigitalgifter.com" >&2
  exit 1
fi
if ! grep -q 'tdg-verify.mozas-prod-01' "${SRC_HTTPS}"; then
  echo "refusing HTTPS Caddyfile without TDG verify host" >&2
  exit 1
fi

ORIGIN_IP="${MOZAS_ORIGIN_IP:-}"
if [[ -z "${ORIGIN_IP}" ]]; then
  ORIGIN_IP="$(curl -4 -fsS --max-time 5 https://ifconfig.me || true)"
fi
if [[ "${TDG_HTTPS_ALLOW_PROXIED:-}" != "yes" && -n "${ORIGIN_IP}" ]]; then
  resolved="$(getent ahostsv4 thedigitalgifter.com | awk '{print $1; exit}' || true)"
  if [[ -z "${resolved}" || "${resolved}" != "${ORIGIN_IP}" ]]; then
    echo "BLOCKED: thedigitalgifter.com does not resolve to this VPS (${ORIGIN_IP:-unknown})." >&2
    echo "Point DNS first, or set TDG_HTTPS_ALLOW_PROXIED=yes for Cloudflare orange-cloud." >&2
    exit 2
  fi
fi

cp -a "${PROXY_DIR}/Caddyfile" "${PROXY_DIR}/Caddyfile.bak-tdg-https"
cp "${SRC_HTTPS}" "${PROXY_DIR}/Caddyfile"

if ! docker exec mozas-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null; then
  echo "HTTPS Caddyfile failed validation — restoring previous file" >&2
  cp -a "${PROXY_DIR}/Caddyfile.bak-tdg-https" "${PROXY_DIR}/Caddyfile"
  exit 1
fi
docker restart mozas-caddy >/dev/null
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -fsS http://127.0.0.1/healthz >/dev/null 2>&1; then
    echo "tdg_https_caddy_applied=yes"
    exit 0
  fi
  sleep 1
done
echo "Caddy restarted but :80 healthz did not recover" >&2
exit 1

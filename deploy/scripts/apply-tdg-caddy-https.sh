#!/usr/bin/env bash
# Apply HTTPS Caddy routes for thedigitalgifter.com AFTER public DNS points here.
# Keeps TheMozas upstream. Does not change DNS.
# Require TDG_HTTPS_APPLY=yes.
# Optional: TDG_HTTPS_ALLOW_PROXIED=yes, TDG_HTTPS_SKIP_PUBLIC_VERIFY=yes (deploy re-apply).
set -euo pipefail

if [[ "${TDG_HTTPS_APPLY:-}" != "yes" ]]; then
  echo "BLOCKED: set TDG_HTTPS_APPLY=yes after DNS for thedigitalgifter.com points at this VPS." >&2
  exit 2
fi

PROXY_DIR="${MOZAS_PROXY_DIR:-/opt/mozas/proxy}"
MODE_FILE="${PROXY_DIR}/tdg-caddy.mode"
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
if ! grep -qE '^[[:space:]]*thedigitalgifter\.com,[[:space:]]*www\.thedigitalgifter\.com[[:space:]]*\{' "${SRC_HTTPS}" \
  && ! grep -qE '^[[:space:]]*www\.thedigitalgifter\.com,[[:space:]]*thedigitalgifter\.com[[:space:]]*\{' "${SRC_HTTPS}"; then
  echo "refusing HTTPS Caddyfile without named TDG site block" >&2
  exit 1
fi

ORIGIN_IP="${MOZAS_ORIGIN_IP:-}"
if [[ -z "${ORIGIN_IP}" ]]; then
  ORIGIN_IP="$(curl -4 -fsS --max-time 5 https://ifconfig.me || true)"
fi
if [[ "${TDG_HTTPS_ALLOW_PROXIED:-}" != "yes" && "${TDG_HTTPS_SKIP_PUBLIC_VERIFY:-}" != "yes" && -n "${ORIGIN_IP}" ]]; then
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
    break
  fi
  sleep 1
done
if ! curl -fsS http://127.0.0.1/healthz >/dev/null 2>&1; then
  echo "Caddy restarted but :80 healthz did not recover — restoring previous file" >&2
  cp -a "${PROXY_DIR}/Caddyfile.bak-tdg-https" "${PROXY_DIR}/Caddyfile"
  docker restart mozas-caddy >/dev/null || true
  exit 1
fi

printf 'https\n' >"${MODE_FILE}"
chmod 0644 "${MODE_FILE}" || true
echo "tdg_https_caddy_applied=yes"
echo "tdg_caddy_mode=https"

# Local TLS probe via --resolve (works even before public DNS if certs already issued,
# and exercises Caddy after cutover). Not a substitute for public verification.
ORIGIN_IP="${ORIGIN_IP:-127.0.0.1}"
verify_local_https() {
  local host="$1"
  local code
  code="$(curl -sS -o /tmp/tdg-https-body -w "%{http_code}" --max-time 25 \
    --resolve "${host}:443:${ORIGIN_IP}" "https://${host}/healthz" || true)"
  if [[ "${code}" != "200" ]]; then
    echo "local_https_${host}=http_${code:-000}"
    return 1
  fi
  local body
  body="$(tr -d '[:space:]' </tmp/tdg-https-body || true)"
  if [[ "${body}" != "ok" ]]; then
    echo "local_https_${host}=bad_body"
    return 1
  fi
  echo "local_https_${host}=ok"
  return 0
}

verify_local_redirect() {
  local host="$1"
  local headers location code
  headers="$(curl -sS -D - -o /dev/null --max-time 15 \
    --resolve "${host}:80:${ORIGIN_IP}" "http://${host}/" || true)"
  code="$(printf '%s\n' "${headers}" | awk 'BEGIN{s=0} /^HTTP\//{s=$2} END{print s}')"
  location="$(printf '%s\n' "${headers}" | awk 'BEGIN{IGNORECASE=1} /^Location:/{sub(/\r$/,""); $1=""; sub(/^ /,""); print; exit}')"
  echo "local_http_redirect_${host}=${code} ${location}"
  if [[ ! "${code}" =~ ^30[0-9]$ ]]; then
    return 1
  fi
  case "${location}" in
    "https://${host}"|"https://${host}/"|"https://${host}/"*) return 0 ;;
    *) return 1 ;;
  esac
}

if [[ "${TDG_HTTPS_SKIP_PUBLIC_VERIFY:-}" != "yes" ]]; then
  # ACME can take a minute on first issue after DNS cutover.
  ok=0
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    ok=1
    verify_local_https thedigitalgifter.com || ok=0
    verify_local_https www.thedigitalgifter.com || ok=0
    verify_local_redirect thedigitalgifter.com || ok=0
    verify_local_redirect www.thedigitalgifter.com || ok=0
    if [[ "${ok}" -eq 1 ]]; then
      break
    fi
    sleep 5
  done
  if [[ "${ok}" -ne 1 ]]; then
    echo "WARNING: local HTTPS / redirect probe incomplete (ACME may still be issuing). mode=https persisted." >&2
    echo "tdg_https_local_verify=partial"
  else
    echo "tdg_https_local_verify=ok"
  fi
else
  echo "tdg_https_local_verify=skipped"
fi

#!/usr/bin/env bash
# Shared assertions for the Mozas edge Caddyfile.
# ABORT if required multi-tenant routes are missing from a candidate file.
set -euo pipefail

assert_shared_edge_caddy_hosts() {
  local file="${1:?caddyfile}"
  local mode="${2:?http|https}"

  [[ -f "${file}" ]] || { echo "missing caddyfile ${file}" >&2; return 1; }

  grep -q 'themozas:8080' "${file}" || { echo "ABORT: Caddyfile missing TheMozas upstream themozas:8080" >&2; return 1; }
  grep -q 'themozas.com' "${file}" || { echo "ABORT: Caddyfile missing themozas.com" >&2; return 1; }
  grep -q 'thedigitalgifter:8080' "${file}" || { echo "ABORT: Caddyfile missing TDG upstream thedigitalgifter:8080" >&2; return 1; }
  grep -q 'thedigitalgifter.com' "${file}" || { echo "ABORT: Caddyfile missing thedigitalgifter.com" >&2; return 1; }
  grep -q 'tdg-verify.mozas-prod-01' "${file}" || { echo "ABORT: Caddyfile missing TDG verify host" >&2; return 1; }
  grep -q 'casahub.eu' "${file}" || { echo "ABORT: Caddyfile missing casahub.eu" >&2; return 1; }
  grep -q 'www.casahub.eu' "${file}" || { echo "ABORT: Caddyfile missing www.casahub.eu" >&2; return 1; }
  grep -q 'casahub-web:3000' "${file}" || { echo "ABORT: Caddyfile missing CasaHub upstream casahub-web:3000" >&2; return 1; }

  if [[ "${mode}" == "https" ]]; then
    grep -qE '^[[:space:]]*casahub\.eu,[[:space:]]*www\.casahub\.eu[[:space:]]*\{' "${file}" \
      || grep -qE '^[[:space:]]*www\.casahub\.eu,[[:space:]]*casahub\.eu[[:space:]]*\{' "${file}" \
      || { echo "ABORT: HTTPS Caddyfile missing named CasaHub site block" >&2; return 1; }
    grep -q 'mcp.themozas.com' "${file}" || { echo "ABORT: HTTPS Caddyfile missing mcp.themozas.com" >&2; return 1; }
    grep -q 'mozas-mcp-bridge:8787' "${file}" || { echo "ABORT: HTTPS Caddyfile missing MCP upstream mozas-mcp-bridge:8787" >&2; return 1; }
  fi

  echo "shared_edge_caddy_hosts_ok=yes mode=${mode}"
}

smoke_shared_edge_caddy() {
  local origin_ip="${1:-127.0.0.1}"
  local fail=0
  local code

  smoke_https() {
    local host="$1"
    local path="${2:-/}"
    local expect="${3:-200}"
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
      --resolve "${host}:443:${origin_ip}" "https://${host}${path}" || true)"
    echo "smoke_https_${host}${path}=${code}"
    [[ "${code}" == "${expect}" ]]
  }

  smoke_https "casahub.eu" "/" "200" || fail=1
  smoke_https "www.casahub.eu" "/" "200" || fail=1
  smoke_https "themozas.com" "/healthz" "200" || fail=1
  smoke_https "www.thedigitalgifter.com" "/healthz" "200" || fail=1
  smoke_https "mcp.themozas.com" "/healthz" "200" || fail=1

  if [[ "${fail}" -ne 0 ]]; then
    echo "ABORT: shared edge smoke tests failed" >&2
    return 1
  fi
  echo "shared_edge_caddy_smoke=ok"
}

install_caddyfile_atomic() {
  local src="${1:?src}"
  local dest="${2:?dest}"
  local backup="${3:?backup}"
  local candidate

  candidate="$(mktemp "${dest}.candidate.XXXXXX")"
  cp "${src}" "${candidate}"
  cp -a "${dest}" "${backup}"
  mv -f "${candidate}" "${dest}"
  echo "caddyfile_atomic_install=yes backup=${backup}"
}

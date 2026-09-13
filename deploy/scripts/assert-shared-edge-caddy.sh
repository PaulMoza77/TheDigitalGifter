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

# Host Caddyfile is root:root 0600 on Mozas; mozas can write it via a root
# container with a rw bind of /opt/mozas/proxy (the live Caddy mount is ro).
caddyfile_root_sh() {
  local proxy_dir="${1:?proxy dir}"
  local src="${2:-}"
  local script="${3:?sh}"
  if [[ -n "${src}" ]]; then
    docker run --rm --user 0 --entrypoint /bin/sh \
      -v "${proxy_dir}:/proxy" \
      -v "${src}:/incoming/Caddyfile:ro" \
      mozas/proxy:caddy-2.9 \
      -c "${script}"
  else
    docker run --rm --user 0 --entrypoint /bin/sh \
      -v "${proxy_dir}:/proxy" \
      mozas/proxy:caddy-2.9 \
      -c "${script}"
  fi
}

read_live_caddyfile() {
  docker exec mozas-caddy cat /etc/caddy/Caddyfile
}

install_caddyfile_atomic() {
  local src="${1:?src}"
  local dest="${2:?dest}"
  local backup="${3:?backup}"
  local dest_dir dest_base bak_base
  dest_dir="$(dirname "${dest}")"
  dest_base="$(basename "${dest}")"
  bak_base="$(basename "${backup}")"

  caddyfile_root_sh "${dest_dir}" "${src}" \
    "cp -a /proxy/${dest_base} /proxy/${bak_base} && cat /incoming/Caddyfile > /proxy/${dest_base} && chmod 644 /proxy/${dest_base}"
  echo "caddyfile_atomic_install=yes backup=${backup}"
}

restore_caddyfile_from_backup() {
  local dest="${1:?dest}"
  local backup="${2:?backup}"
  local dest_dir dest_base bak_base
  dest_dir="$(dirname "${dest}")"
  dest_base="$(basename "${dest}")"
  bak_base="$(basename "${backup}")"
  caddyfile_root_sh "${dest_dir}" "" \
    "cp -a /proxy/${bak_base} /proxy/${dest_base}"
}

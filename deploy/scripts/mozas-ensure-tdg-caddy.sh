#!/usr/bin/env bash
# Re-apply TDG Caddy routes without downgrading an active HTTPS configuration.
# Writes /opt/mozas/proxy/tdg-caddy.mode = http|https
# Uses Python on the VPS (Node is not installed on mozas-prod-01).
set -euo pipefail

PROXY_DIR="${MOZAS_PROXY_DIR:-/opt/mozas/proxy}"
REPO_CADDY="${TDG_CADDY_DIR:-/opt/mozas/projects/thedigitalgifter/repo/deploy/caddy}"
MODE_FILE="${PROXY_DIR}/tdg-caddy.mode"
ACTIVE="${PROXY_DIR}/Caddyfile"

[[ -f "${ACTIVE}" ]] || { echo "missing ${ACTIVE}" >&2; exit 1; }
[[ -d "${REPO_CADDY}" ]] || { echo "missing ${REPO_CADDY}" >&2; exit 1; }

mode="$(
  MODE_FILE="${MODE_FILE}" ACTIVE="${ACTIVE}" python3 - <<'PY'
import os, re
from pathlib import Path
active = Path(os.environ["ACTIVE"]).read_text()
marker_path = Path(os.environ["MODE_FILE"])
marker = marker_path.read_text().strip().lower() if marker_path.exists() else ""
if marker in ("http", "https"):
    print(marker)
    raise SystemExit(0)
named = bool(re.search(r"(?m)^\s*thedigitalgifter\.com,\s*www\.thedigitalgifter\.com\s*\{", active)) \
    or bool(re.search(r"(?m)^\s*www\.thedigitalgifter\.com,\s*thedigitalgifter\.com\s*\{", active))
print("https" if named else "http")
PY
)"

if [[ "${mode}" != "http" && "${mode}" != "https" ]]; then
  echo "unable to detect caddy mode" >&2
  exit 1
fi

if [[ "${mode}" == "https" ]]; then
  SRC="${REPO_CADDY}/Caddyfile.https.ready"
  APPLY=/opt/mozas/bin/mozas-apply-tdg-caddy-https
else
  SRC="${REPO_CADDY}/Caddyfile.http"
  APPLY=/opt/mozas/bin/mozas-apply-tdg-caddy
fi

[[ -f "${SRC}" ]] || { echo "missing ${SRC}" >&2; exit 1; }
[[ -x "${APPLY}" ]] || { echo "missing ${APPLY}" >&2; exit 1; }

MODE="${mode}" SRC="${SRC}" python3 - <<'PY'
import os, re, sys
from pathlib import Path
text = Path(os.environ["SRC"]).read_text()
mode = os.environ["MODE"]
if "themozas:8080" not in text:
    sys.exit("Caddyfile must keep TheMozas upstream")
if "tdg-verify.mozas-prod-01" not in text:
    sys.exit("Caddyfile must keep TDG verify host")
if "thedigitalgifter.com" not in text:
    sys.exit("Caddyfile must include thedigitalgifter.com")
named = bool(re.search(r"(?m)^\s*thedigitalgifter\.com,\s*www\.thedigitalgifter\.com\s*\{", text)) \
    or bool(re.search(r"(?m)^\s*www\.thedigitalgifter\.com,\s*thedigitalgifter\.com\s*\{", text))
if mode == "https":
    if not named:
        sys.exit("HTTPS Caddyfile must use a named site block for TDG")
    if "Strict-Transport-Security" not in text:
        sys.exit("HTTPS Caddyfile must set HSTS")
if mode == "http" and named:
    sys.exit("HTTP Caddyfile must not enable named HTTPS site blocks")
print("tdg_caddy_source_ok=yes")
PY

echo "tdg_caddy_mode=${mode}"
echo "tdg_caddy_source=${SRC}"

if [[ "${mode}" == "https" ]]; then
  # Re-applying an already-HTTPS site: allow proxied DNS and skip public DNS gate.
  TDG_HTTPS_APPLY=yes TDG_HTTPS_ALLOW_PROXIED="${TDG_HTTPS_ALLOW_PROXIED:-yes}" \
    TDG_HTTPS_SKIP_PUBLIC_VERIFY="${TDG_HTTPS_SKIP_PUBLIC_VERIFY:-yes}" \
    MOZAS_ORIGIN_IP="${MOZAS_ORIGIN_IP:-}" \
    "${APPLY}" "${SRC}"
else
  "${APPLY}" "${SRC}"
fi

printf '%s\n' "${mode}" >"${MODE_FILE}"
chmod 0644 "${MODE_FILE}" || true
echo "tdg_caddy_mode_persisted=${mode}"

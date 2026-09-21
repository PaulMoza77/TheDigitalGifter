#!/bin/bash
# status | start | stop | install | uninstall for the Mac Clip Factory importer.
# Does not change system sleep settings. The worker runs only while this user is logged in
# and the Mac is awake.
set -euo pipefail

LABEL="com.thedigitalgifter.clip-factory-import"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPORT="${HOME}/Library/Application Support/TheDigitalGifter"
CONFIG="${SUPPORT}/clip-factory-import.json"
LOG_DIR="${HOME}/Library/Logs/TheDigitalGifter"
KEYCHAIN_SERVICE="com.thedigitalgifter.clip-factory-import"

usage() {
  cat <<EOF
Usage: $(basename "$0") status|start|stop|install|uninstall

The importer does not run while this Mac is asleep or powered off.
Jobs stay waiting until the Mac is awake and this user is logged in.
EOF
}

loaded() {
  launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1
}

write_plist() {
  local node
  node="$(command -v node)"
  [[ -n "$node" ]] || { echo "node is not installed" >&2; exit 1; }
  mkdir -p "${HOME}/Library/LaunchAgents" "$LOG_DIR"
  cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${ROOT}/scripts/clip-factory-import-launch.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
</dict>
</plist>
EOF
  chmod 644 "$PLIST"
}

cmd_status() {
  if loaded; then
    launchctl print "${DOMAIN}/${LABEL}" | awk '/state =|pid =|last exit code/ { print }'
  else
    echo "stopped"
  fi
  if [[ -f "${LOG_DIR}/clip-factory-import.log" ]]; then
    echo "--- log ---"
    tail -n 20 "${LOG_DIR}/clip-factory-import.log"
  fi
}

cmd_start() {
  [[ -f "$PLIST" ]] || { echo "not installed" >&2; exit 1; }
  if ! loaded; then
    launchctl bootstrap "$DOMAIN" "$PLIST"
  fi
  launchctl enable "${DOMAIN}/${LABEL}" >/dev/null 2>&1 || true
  launchctl kickstart -k "${DOMAIN}/${LABEL}"
  echo "started"
}

cmd_stop() {
  if loaded; then
    launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1 || launchctl bootout "${DOMAIN}/${LABEL}" >/dev/null 2>&1 || true
  fi
  echo "stopped"
}

cmd_install() {
  mkdir -p "$SUPPORT/bin" "$LOG_DIR"
  chmod 755 "${ROOT}/scripts/clip-factory-import-launch.sh" "${ROOT}/scripts/clip-factory-import-worker.mjs"
  if ! security find-generic-password -s "$KEYCHAIN_SERVICE" -a worker-token >/dev/null 2>&1; then
    token="$(openssl rand -base64 32 | tr -d '\n')"
    security add-generic-password -s "$KEYCHAIN_SERVICE" -a worker-token -w "$token" -U
    unset token
    echo "worker token stored in Keychain"
  else
    echo "worker token already in Keychain"
  fi
  if [[ ! -f "$CONFIG" ]]; then
    cat >"$CONFIG" <<EOF
{
  "apiBase": "https://www.thedigitalgifter.com",
  "deviceId": "mac-mini-moza",
  "ytDlpBin": "${SUPPORT}/bin/yt-dlp",
  "ffmpegBin": "/opt/homebrew/bin/ffmpeg",
  "ffprobeBin": "/opt/homebrew/bin/ffprobe"
}
EOF
    chmod 600 "$CONFIG"
  fi
  if [[ ! -x "${SUPPORT}/bin/yt-dlp" ]]; then
    echo "yt-dlp is missing at ${SUPPORT}/bin/yt-dlp" >&2
    exit 1
  fi
  write_plist
  cmd_stop || true
  cmd_start
}

cmd_uninstall() {
  cmd_stop || true
  rm -f "$PLIST"
  echo "uninstalled (Keychain token left in place)"
}

case "${1:-}" in
  status) cmd_status ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  *) usage; exit 1 ;;
esac

#!/bin/bash
# LaunchAgent entry. Rotates the local log, then runs the importer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${HOME}/Library/Logs/TheDigitalGifter"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/clip-factory-import.log"
if [[ -f "$LOG" ]]; then
  size="$(stat -f%z "$LOG" || echo 0)"
  if [[ "${size}" -gt 5000000 ]]; then
    rm -f "${LOG}.3"
    [[ -f "${LOG}.2" ]] && mv "${LOG}.2" "${LOG}.3"
    [[ -f "${LOG}.1" ]] && mv "${LOG}.1" "${LOG}.2"
    mv "$LOG" "${LOG}.1"
  fi
fi
exec >>"$LOG" 2>&1
cd "$ROOT"
exec /usr/local/bin/node "${ROOT}/scripts/clip-factory-import-worker.mjs"

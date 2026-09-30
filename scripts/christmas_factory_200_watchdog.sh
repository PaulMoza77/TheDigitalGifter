#!/usr/bin/env bash
# Keep the factory process alive. Never cancels Higgsfield jobs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMUX_CONF="/exec-daemon/tmux.portal.conf"
while true; do
  n=$(ls "${ROOT}/generated/christmas-factory-200/masters/"*.mp4 2>/dev/null | wc -l | tr -d ' ')
  echo "$(date -u +%H:%M:%S) masters=${n}"
  if [[ -f "${ROOT}/generated/christmas-factory-200/FACTORY_FROZEN" ]]; then
    echo FACTORY_FROZEN
    sleep 90
    continue
  fi
  if ! pgrep -f "python3 ${ROOT}/scripts/christmas_factory_200.py" >/dev/null 2>&1 && \
     ! pgrep -f "python3 scripts/christmas_factory_200.py" >/dev/null 2>&1; then
    echo RESTART_FACTORY
    tmux -f "$TMUX_CONF" has-session -t "=cf200-factory" 2>/dev/null || \
      tmux -f "$TMUX_CONF" new-session -d -s cf200-factory -c "$ROOT" -- "${SHELL:-bash}" -l
    tmux -f "$TMUX_CONF" send-keys -t cf200-factory:0.0 C-c
    sleep 1
    tmux -f "$TMUX_CONF" send-keys -t "cf200-factory:0.0" "bash ${ROOT}/scripts/christmas_factory_200_start.sh" C-m
  fi
  if [ "${n}" -ge 250 ]; then
    echo TARGET_REACHED
    sleep 180
    continue
  fi
  sleep 90
done

#!/usr/bin/env bash
# Start / resume the Christmas factory-200 ops runner. Does not cancel Higgsfield jobs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TDG_ROOT="$ROOT"
# shellcheck disable=SC1091
if [[ -z "${HF_CREDENTIALS:-}" ]]; then
  export HF_CREDENTIALS="$(bash "${ROOT}/scripts/_load_hf_credentials.sh" 2>/dev/null || true)"
fi
export TDG_FACTORY_VIDEO_CONCURRENCY="${TDG_FACTORY_VIDEO_CONCURRENCY:-8}"
export TDG_FACTORY_IMAGE_WORKERS="${TDG_FACTORY_IMAGE_WORKERS:-2}"
cd "$ROOT"
if [[ -f "${ROOT}/generated/christmas-factory-200/FACTORY_FROZEN" ]]; then
  echo "FACTORY_FROZEN — refusing to start paid generation"
  exit 0
fi
exec python3 "${ROOT}/scripts/christmas_factory_200.py"

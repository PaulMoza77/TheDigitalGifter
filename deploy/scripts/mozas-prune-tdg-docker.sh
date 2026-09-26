#!/usr/bin/env bash
# Remove stale mozas/thedigitalgifter image tags after a healthy deploy.
# Keeps rollback pins: latest, previous, verified release, and the new RELEASE tag.
# Set TDG_DOCKER_PRUNE=0 to skip. Set TDG_DOCKER_PRUNE_BUILDER=0 to skip build cache trim.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f /opt/mozas/bin/lib.sh ]]; then
  # shellcheck source=/dev/null
  source /opt/mozas/bin/lib.sh
else
  MOZAS_ROOT="${MOZAS_ROOT:-/opt/mozas}"
  log() { printf '[mozas] %s\n' "$*"; }
fi

TDG_DIR="${MOZAS_ROOT}/projects/thedigitalgifter"
TDG_RELEASES="${TDG_DIR}/releases"
IMAGE_REPO="mozas/thedigitalgifter"

RELEASE_TAG="${1:-}"
if [[ "${TDG_DOCKER_PRUNE:-1}" == "0" ]]; then
  log "TDG docker prune disabled (TDG_DOCKER_PRUNE=0)"
  exit 0
fi

declare -A KEEP=()
KEEP["latest"]=1
KEEP["previous"]=1

if [[ -n "${RELEASE_TAG}" ]]; then
  KEEP["${RELEASE_TAG}"]=1
fi

if [[ -f "${TDG_RELEASES}/verified.tag" ]]; then
  verified="$(tr -d '[:space:]' <"${TDG_RELEASES}/verified.tag")"
  if [[ -n "${verified}" ]]; then
    KEEP["${verified}"]=1
  fi
fi

if [[ -n "${TDG_DOCKER_KEEP_EXTRA_TAGS:-}" ]]; then
  # Space-separated extra tags to retain (operator override).
  for extra in ${TDG_DOCKER_KEEP_EXTRA_TAGS}; do
    [[ -n "${extra}" ]] && KEEP["${extra}"]=1
  done
fi

removed=0
while IFS= read -r tag; do
  [[ -n "${tag}" ]] || continue
  if [[ -n "${KEEP[${tag}]+x}" ]]; then
    continue
  fi
  if docker image rm -f "${IMAGE_REPO}:${tag}" >/dev/null 2>&1; then
    removed=$((removed + 1))
    log "pruned ${IMAGE_REPO}:${tag}"
  fi
done < <(docker images "${IMAGE_REPO}" --format '{{.Tag}}' | sort -u)

if [[ "${TDG_DOCKER_PRUNE_BUILDER:-1}" != "0" ]]; then
  max_age="${TDG_DOCKER_BUILDER_PRUNE_MAX_AGE_HOURS:-168}"
  if docker builder prune -f --filter "until=${max_age}h" >/tmp/tdg-builder-prune.log 2>&1; then
    log "builder cache pruned (older than ${max_age}h)"
  else
    log "builder cache prune skipped or partial (see /tmp/tdg-builder-prune.log)"
  fi
fi

docker image prune -f >/dev/null 2>&1 || true

df_line="$(df -h / | awk 'NR==2 {print $5 " used, " $4 " free"}')"
log "TDG docker prune done removed_tags=${removed} disk=${df_line}"

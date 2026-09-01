#!/usr/bin/env bash
# Restore the previously tagged TheDigitalGifter image. Does not change DNS or secrets.
set -euo pipefail

if [[ -f /opt/mozas/bin/lib.sh ]]; then
  # shellcheck source=/dev/null
  source /opt/mozas/bin/lib.sh
else
  MOZAS_ROOT="${MOZAS_ROOT:-/opt/mozas}"
  log() { printf '[mozas] %s\n' "$*"; }
  die() { printf '[mozas] ERROR: %s\n' "$*" >&2; exit 1; }
fi

TDG_DIR="${MOZAS_ROOT}/projects/thedigitalgifter"
TDG_REPO="${TDG_DIR}/repo"
TDG_SECRETS="${TDG_DIR}/secrets/app.env"
TDG_COMPOSE="${TDG_DIR}/docker-compose.yml"
[[ -f "${TDG_COMPOSE}" ]] || TDG_COMPOSE="${TDG_REPO}/deploy/docker-compose.yml"

docker image inspect mozas/thedigitalgifter:previous >/dev/null 2>&1 \
  || die "no mozas/thedigitalgifter:previous image — nothing to roll back to"

docker tag mozas/thedigitalgifter:previous mozas/thedigitalgifter:latest
export TDG_RELEASE=previous
TDG_RELEASE=previous docker compose \
  --project-directory "${TDG_REPO}" \
  -f "${TDG_COMPOSE}" \
  --env-file "${TDG_SECRETS}" \
  --profile with-app \
  up -d --no-build --wait \
  || die "TDG rollback failed to become healthy"

printf 'previous\n' >"${TDG_DIR}/releases/current.tag"
log "rolled back to mozas/thedigitalgifter:previous"

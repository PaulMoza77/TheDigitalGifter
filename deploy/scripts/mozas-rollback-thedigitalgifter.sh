#!/usr/bin/env bash
# Restore the previously verified TheDigitalGifter image and release metadata.
# Does not change DNS or secrets.
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
TDG_RELEASES="${TDG_DIR}/releases"
TDG_COMPOSE="${TDG_DIR}/docker-compose.yml"
[[ -f "${TDG_COMPOSE}" ]] || TDG_COMPOSE="${TDG_REPO}/deploy/docker-compose.yml"
mkdir -p "${TDG_RELEASES}"

docker image inspect mozas/thedigitalgifter:previous >/dev/null 2>&1 \
  || die "no mozas/thedigitalgifter:previous image — nothing to roll back to"

# Prefer the last verified pin when present (coherent metadata + image tag).
TARGET_TAG="previous"
TARGET_SHA="unknown"
if [[ -f "${TDG_RELEASES}/verified.tag" ]]; then
  # When failing mid-deploy, verified.* still points at the last healthy release.
  # previous image should match that release; if verified.tag is a concrete sha/tag
  # and that image exists, use it.
  CANDIDATE="$(tr -d '[:space:]' <"${TDG_RELEASES}/verified.tag")"
  if [[ -n "${CANDIDATE}" && "${CANDIDATE}" != "previous" ]]; then
    if docker image inspect "mozas/thedigitalgifter:${CANDIDATE}" >/dev/null 2>&1; then
      TARGET_TAG="${CANDIDATE}"
    fi
  fi
fi
if [[ -f "${TDG_RELEASES}/verified.sha" ]]; then
  TARGET_SHA="$(tr -d '[:space:]' <"${TDG_RELEASES}/verified.sha")"
fi

# Ensure :previous remains the rollback source of record for operators.
if [[ "${TARGET_TAG}" != "previous" ]]; then
  docker tag "mozas/thedigitalgifter:${TARGET_TAG}" mozas/thedigitalgifter:previous || true
fi
docker tag mozas/thedigitalgifter:previous mozas/thedigitalgifter:latest

# Keep app.env TDG_RELEASE aligned with the restored image tag.
if grep -qE '^TDG_RELEASE=' "${TDG_SECRETS}"; then
  tmp="$(mktemp)"
  awk -v v="${TARGET_TAG}" '
    index($0, "TDG_RELEASE=")==1 { print "TDG_RELEASE=" v; next }
    { print }
  ' "${TDG_SECRETS}" >"${tmp}"
  cat "${tmp}" >"${TDG_SECRETS}"
  rm -f "${tmp}"
else
  printf 'TDG_RELEASE=%s\n' "${TARGET_TAG}" >>"${TDG_SECRETS}"
fi
chmod 0640 "${TDG_SECRETS}" || true

export TDG_RELEASE="${TARGET_TAG}"
TDG_RELEASE="${TARGET_TAG}" docker compose \
  --project-directory "${TDG_REPO}" \
  -f "${TDG_COMPOSE}" \
  --env-file "${TDG_SECRETS}" \
  --profile with-app \
  up -d --no-build --wait \
  || die "TDG rollback failed to become healthy"

printf '%s\n' "${TARGET_TAG}" >"${TDG_RELEASES}/current.tag"
printf '%s\n' "${TARGET_SHA}" >"${TDG_RELEASES}/current.sha"
# verified.* stays the healthy pin we restored to
printf '%s\n' "${TARGET_TAG}" >"${TDG_RELEASES}/verified.tag"
printf '%s\n' "${TARGET_SHA}" >"${TDG_RELEASES}/verified.sha"
cat >>"${TDG_RELEASES}/history.log" <<EOF
$(date -u +%FT%TZ) rollback release=${TARGET_TAG} commit=${TARGET_SHA}
EOF

# Preserve TheMozas after rollback
curl -fsS http://127.0.0.1/healthz >/dev/null || die "TheMozas health failed after TDG rollback"

log "rolled back to mozas/thedigitalgifter:${TARGET_TAG} (previous image retained)"

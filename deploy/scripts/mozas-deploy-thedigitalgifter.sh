#!/usr/bin/env bash
# Build and start TheDigitalGifter from the synced repo + permanent VPS secrets.
# Does not change DNS. Does not overwrite secrets/app.env except the TDG_RELEASE line.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
if [[ ! -f "${TDG_COMPOSE}" && -f "${TDG_REPO}/deploy/docker-compose.yml" ]]; then
  TDG_COMPOSE="${TDG_REPO}/deploy/docker-compose.yml"
fi

[[ -f "${TDG_SECRETS}" ]] || die "missing permanent secrets ${TDG_SECRETS}"
[[ -f "${TDG_REPO}/Dockerfile" ]] || die "missing ${TDG_REPO}/Dockerfile"
[[ -f "${TDG_COMPOSE}" ]] || die "missing TDG compose file"
mkdir -p "${TDG_RELEASES}"

for k in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
  val="$(grep -E "^${k}=" "${TDG_SECRETS}" | head -1 | cut -d= -f2- || true)"
  [[ -n "${val}" ]] || die "empty ${k} in ${TDG_SECRETS}"
done

COMMIT="unknown"
if [[ -f "${TDG_REPO}/.tdg-commit" ]]; then
  COMMIT="$(tr -d '[:space:]' <"${TDG_REPO}/.tdg-commit")"
elif [[ -d "${TDG_REPO}/.git" ]]; then
  COMMIT="$(git -C "${TDG_REPO}" rev-parse --short HEAD || echo unknown)"
fi
RELEASE="${TDG_RELEASE:-${COMMIT}-$(date -u +%Y%m%dT%H%M%SZ)}"

if docker image inspect mozas/thedigitalgifter:latest >/dev/null 2>&1; then
  docker tag mozas/thedigitalgifter:latest mozas/thedigitalgifter:previous
  log "tagged current TDG latest as previous"
fi

# Update only the release pin. Never rewrite other secret values.
if grep -qE '^TDG_RELEASE=' "${TDG_SECRETS}"; then
  tmp="$(mktemp)"
  awk -v v="${RELEASE}" '
    index($0, "TDG_RELEASE=")==1 { print "TDG_RELEASE=" v; next }
    { print }
  ' "${TDG_SECRETS}" >"${tmp}"
  cat "${tmp}" >"${TDG_SECRETS}"
  rm -f "${tmp}"
else
  printf 'TDG_RELEASE=%s\n' "${RELEASE}" >>"${TDG_SECRETS}"
fi
chmod 0640 "${TDG_SECRETS}" || true

export TDG_RELEASE="${RELEASE}"
printf '%s\n' "${RELEASE}" >"${TDG_RELEASES}/current.tag"
printf '%s\n' "${COMMIT}" >"${TDG_RELEASES}/current.sha"
cat >>"${TDG_RELEASES}/history.log" <<EOF
$(date -u +%FT%TZ) release=${RELEASE} commit=${COMMIT}
EOF

log "building TDG release=${RELEASE} commit=${COMMIT} (secrets not printed)"
if ! docker compose \
  --project-directory "${TDG_REPO}" \
  -f "${TDG_COMPOSE}" \
  --env-file "${TDG_SECRETS}" \
  --profile with-app \
  build; then
  die "TDG image build failed"
fi

docker tag "mozas/thedigitalgifter:${RELEASE}" mozas/thedigitalgifter:latest || true

if ! docker compose \
  --project-directory "${TDG_REPO}" \
  -f "${TDG_COMPOSE}" \
  --env-file "${TDG_SECRETS}" \
  --profile with-app \
  up -d --remove-orphans --wait; then
  log "new TDG release failed health wait — attempting rollback"
  if [[ -x /opt/mozas/bin/mozas-rollback-thedigitalgifter ]]; then
    /opt/mozas/bin/mozas-rollback-thedigitalgifter || true
  fi
  die "TDG deploy failed"
fi

log "TDG deploy ok release=${RELEASE} commit=${COMMIT}"

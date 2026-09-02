#!/usr/bin/env bash
# Merge supplied env keys into TDG app.env on THIS machine (the VPS).
# Never prints values. Preserves keys not present in the environment.
set -euo pipefail

APP_ENV="${TDG_APP_ENV:-/opt/mozas/projects/thedigitalgifter/secrets/app.env}"
SECRETS_DIR="$(dirname "${APP_ENV}")"

umask 077
mkdir -p "${SECRETS_DIR}"
touch "${APP_ENV}"
if [[ "${SECRETS_DIR}" == "/opt/mozas/projects/thedigitalgifter/secrets" ]]; then
  chmod 0750 "${SECRETS_DIR}"
fi

merge_key() {
  local key="$1"
  local value="$2"
  [[ -n "${value}" ]] || return 0
  local tmp
  tmp="$(mktemp)"
  awk -v k="${key}" -v v="${value}" '
    BEGIN { done=0 }
    index($0, k "=")==1 { print k "=" v; done=1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "${APP_ENV}" >"${tmp}"
  cat "${tmp}" >"${APP_ENV}"
  rm -f "${tmp}"
}

merge_key VITE_SUPABASE_URL "${VITE_SUPABASE_URL:-}"
merge_key VITE_SUPABASE_ANON_KEY "${VITE_SUPABASE_ANON_KEY:-}"
merge_key VITE_APP_URL "${VITE_APP_URL:-}"
merge_key VITE_ADMIN_EMAILS "${VITE_ADMIN_EMAILS:-}"
merge_key SUPABASE_URL "${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
merge_key SUPABASE_SERVICE_ROLE_KEY "${SUPABASE_SERVICE_ROLE_KEY:-}"

if ! grep -qE '^TDG_RELEASE=' "${APP_ENV}"; then
  printf 'TDG_RELEASE=latest\n' >>"${APP_ENV}"
fi

for k in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
  if ! grep -qE "^${k}=" "${APP_ENV}"; then
    printf '%s=\n' "${k}" >>"${APP_ENV}"
  fi
done

chmod 0640 "${APP_ENV}" || true
if id mozas >/dev/null 2>&1 && [[ "${SECRETS_DIR}" == "/opt/mozas/projects/thedigitalgifter/secrets" ]]; then
  if [[ "$(id -u)" -eq 0 ]]; then
    chown root:mozas "${APP_ENV}" "${SECRETS_DIR}" 2>/dev/null || chown mozas:mozas "${APP_ENV}" || true
  else
    chown mozas:mozas "${APP_ENV}" 2>/dev/null || true
  fi
fi

echo "tdg_app_env=${APP_ENV}"
echo "tdg_app_env_mode=$(stat -c %a "${APP_ENV}")"
echo "tdg_app_env_owner=$(stat -c %U:%G "${APP_ENV}")"
missing=0
for k in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  val=$(grep -E "^${k}=" "${APP_ENV}" | head -1 | cut -d= -f2- || true)
  if [[ -n "${val}" ]]; then
    echo "KEY_NONEMPTY: ${k}"
  else
    echo "KEY_EMPTY: ${k}"
    if [[ "${k}" == "SUPABASE_SERVICE_ROLE_KEY" ]]; then
      missing=1
    elif [[ "${k}" == "VITE_SUPABASE_URL" || "${k}" == "VITE_SUPABASE_ANON_KEY" ]]; then
      missing=1
    fi
  fi
done
if grep -qE '^SUPABASE_URL=.' "${APP_ENV}"; then
  echo "KEY_NONEMPTY: SUPABASE_URL"
else
  echo "KEY_EMPTY: SUPABASE_URL"
fi
if [[ "${missing}" -eq 1 ]]; then
  echo "tdg_secrets_status=incomplete"
  exit 3
fi
echo "tdg_secrets_status=ready"

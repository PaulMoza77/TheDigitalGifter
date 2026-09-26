#!/usr/bin/env bash
# Deploy the public /generator backend only:
#   migration 20260926120000_public_generator_higgsfield.sql
#   edge function generate-nano-banana
# Does not deploy the frontend. Does not print secret values.
# Requires SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
# HF_CREDENTIALS may be passed in, or read from the Mozas VPS app.env over SSH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-kjlsocejpmnzhhduyumy}"
if [[ "$PROJECT_REF" != "kjlsocejpmnzhhduyumy" ]]; then
  echo "BLOCKED: refusing deploy to unexpected project ref."
  exit 2
fi
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "BLOCKED: SUPABASE_ACCESS_TOKEN is not set."
  exit 2
fi
if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "BLOCKED: SUPABASE_DB_PASSWORD is not set."
  exit 2
fi

load_hf_from_vps() {
  # shellcheck source=mozas-ssh.sh
  source "${ROOT}/scripts/mozas-ssh.sh"
  mozas_prepare_ssh
  mozas_verify_remote_identity
  local script_b64
  script_b64="$(
    python3 - <<'PY'
import base64
script = r'''
from pathlib import Path
val = ""
for line in Path("/opt/mozas/projects/thedigitalgifter/secrets/app.env").read_text().splitlines():
    if line.startswith("HF_CREDENTIALS="):
        raw = line.split("=", 1)[1].strip()
        if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {'"', "'"}:
            raw = raw[1:-1]
        val = raw
print(val, end="")
'''
print(base64.b64encode(script.encode()).decode())
PY
  )"
  HF_CREDENTIALS="$(mozas_ssh "python3 -c 'import base64; exec(base64.b64decode(\"${script_b64}\"))'")"
  export HF_CREDENTIALS
}

if [[ -z "${HF_CREDENTIALS:-}" ]]; then
  if [[ -n "${MOZAS_SSH_HOST:-}" && -n "${MOZAS_SSH_PRIVATE_KEY:-}" ]]; then
    echo "Loading Higgsfield credentials from VPS app.env (value not printed)."
    load_hf_from_vps
  fi
fi
if [[ -z "${HF_CREDENTIALS:-}" || "${HF_CREDENTIALS}" != *:* ]]; then
  echo "BLOCKED: HF_CREDENTIALS missing or not KEY_ID:KEY_SECRET. Refusing to deploy a fail-closed generator."
  exit 2
fi

echo "Setting Higgsfield secret on ${PROJECT_REF} (value not printed)."
set +e
npx --yes supabase secrets set "HF_CREDENTIALS=${HF_CREDENTIALS}" --project-ref "$PROJECT_REF" >/tmp/hf-secret-set.txt 2>&1
secret_status=$?
set -e
if grep -F -q -- "${HF_CREDENTIALS}" /tmp/hf-secret-set.txt; then
  echo "BLOCKED: secret command output contained the credential. Not printing it."
  rm -f /tmp/hf-secret-set.txt
  exit 2
fi
if [[ "$secret_status" -ne 0 ]]; then
  echo "BLOCKED: supabase secrets set failed."
  # Show only lines that do not look like the credential.
  grep -v ":" /tmp/hf-secret-set.txt | head -20 || true
  rm -f /tmp/hf-secret-set.txt
  exit 1
fi
rm -f /tmp/hf-secret-set.txt
echo "Higgsfield secret set."

MIGRATION="supabase/migrations/20260926120000_public_generator_higgsfield.sql"
echo "Applying public generator migration."
APPLIED=0
for HOST in \
  aws-0-eu-west-1.pooler.supabase.com \
  aws-1-eu-west-1.pooler.supabase.com \
  aws-0-eu-west-2.pooler.supabase.com \
  aws-1-eu-west-2.pooler.supabase.com \
  aws-0-eu-central-1.pooler.supabase.com
do
  echo "Trying pooler host ${HOST}"
  if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
    "host=${HOST} port=5432 dbname=postgres user=postgres.${PROJECT_REF} sslmode=require" \
    -v ON_ERROR_STOP=1 \
    -c "select 1" >/tmp/pg-ping.txt 2>/tmp/pg-ping.err; then
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
      "host=${HOST} port=5432 dbname=postgres user=postgres.${PROJECT_REF} sslmode=require" \
      -v ON_ERROR_STOP=1 \
      -f "$MIGRATION"
    APPLIED=1
    break
  fi
done
rm -f /tmp/pg-ping.txt /tmp/pg-ping.err
if [[ "$APPLIED" != "1" ]]; then
  echo "BLOCKED: could not apply migration on the TDG database."
  exit 1
fi
echo "Migration applied."

echo "Deploying generate-nano-banana"
npx --yes supabase functions deploy generate-nano-banana \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

FN_URL="https://${PROJECT_REF}.supabase.co/functions/v1/generate-nano-banana"
probe_args=(-sS -m 30 -o /tmp/gen-probe.txt -w "%{http_code}" -X POST "$FN_URL" -H "Content-Type: application/json" -d "{}")
if [[ -n "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  probe_args+=(-H "apikey: ${VITE_SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}")
fi
CODE="$(curl "${probe_args[@]}" || true)"
HEAD="$(head -c 180 /tmp/gen-probe.txt 2>/dev/null || true)"
echo "generate-nano-banana probe HTTP ${CODE}"
if echo "$HEAD" | grep -qi '<html\|BOOT_ERROR\|REPLICATE'; then
  echo "ERROR: function probe failed after deploy."
  exit 1
fi
if [[ "$CODE" != "400" && "$CODE" != "401" && "$CODE" != "405" ]]; then
  echo "ERROR: unexpected probe status ${CODE}"
  exit 1
fi
echo "PUBLIC_GENERATOR_BACKEND_OK"

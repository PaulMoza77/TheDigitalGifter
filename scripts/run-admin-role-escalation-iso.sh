#!/usr/bin/env bash
# Run isolated admin-escalation proofs against a disposable local Postgres DB.
# Never points at production Supabase.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${TDG_ISO_DB:-tdg_admin_escalation_iso}"
PGUSER="${PGUSER:-postgres}"

psql_as() {
  if id -u postgres >/dev/null 2>&1 && [ "$(id -un)" != "postgres" ]; then
    if sudo -n -u postgres psql -d postgres -c 'select 1' >/dev/null 2>&1; then
      sudo -n -u postgres psql "$@"
      return
    fi
  fi
  psql -U "$PGUSER" "$@"
}

echo "[iso] recreating database ${DB_NAME}"
psql_as -v ON_ERROR_STOP=1 -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='${DB_NAME}' and pid <> pg_backend_pid();" >/dev/null 2>&1 || true
psql_as -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists ${DB_NAME};"
psql_as -v ON_ERROR_STOP=1 -d postgres -c "create database ${DB_NAME};"

echo "[iso] running proofs"
cd "$ROOT"
psql_as -v ON_ERROR_STOP=1 -d "$DB_NAME" -f scripts/admin-role-escalation-iso-proof.sql
echo "[iso] OK"

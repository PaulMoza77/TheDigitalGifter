#!/usr/bin/env python3
"""Apply Memories SQL against Contabo via Mozas postgres-meta (/pg/query).

Reads SUPABASE_SERVICE_ROLE_KEY from TDG app.env. Never prints secrets.
"""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
import urllib.request

APP_ENV = pathlib.Path("/opt/mozas/projects/thedigitalgifter/secrets/app.env")
PG_QUERY = "http://127.0.0.1:19000/pg/query"


def load_service_key() -> str:
    for line in APP_ENV.read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("missing SUPABASE_SERVICE_ROLE_KEY")


def query(key: str, sql: str, timeout: int = 120) -> tuple[int, str]:
    req = urllib.request.Request(
        PG_QUERY,
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: apply-memories-migration-via-pgmeta.py <sql-file> [--reload]")
        return 2
    sql_path = pathlib.Path(sys.argv[1])
    sql = sql_path.read_text()
    # postgres-meta often auto-commits; strip outer transaction wrappers.
    stripped = sql.strip()
    if stripped.lower().startswith("begin;"):
        stripped = stripped[6:].lstrip()
    if stripped.lower().endswith("commit;"):
        stripped = stripped[: -len("commit;")].rstrip()
        if stripped.endswith("\ncommit;"):
            stripped = stripped[: -len("\ncommit;")].rstrip()
    # Drop trailing rollback comments section is fine.
    key = load_service_key()
    status, body = query(key, stripped)
    print(f"apply_http={status}")
    print(body[:3000])
    if status != 200:
        return 1

    status, body = query(key, "notify pgrst, 'reload schema';")
    print(f"reload_http={status} body={body[:200]}")

    status, body = query(
        key,
        """
        select proname
        from pg_proc
        where proname in (
          'record_memories_funnel_event',
          'fulfill_memories_subscription_payment'
        )
        order by 1;
        """,
    )
    print(f"funcs_http={status} body={body}")

    status, body = query(
        key,
        """
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name like 'memories_%'
        order by 1;
        """,
    )
    print(f"tables_http={status} body={body}")
    return 0 if status == 200 and "record_memories_funnel_event" in body else 1


if __name__ == "__main__":
    raise SystemExit(main())

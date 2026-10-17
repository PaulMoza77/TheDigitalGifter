#!/usr/bin/env python3
"""Fail-closed SUPABASE_URL guard for Mozas self-hosted TDG production.

Rejects legacy *.supabase.co hosts and VITE/server URL mismatch when the
merge target is the VPS app.env (or TDG_SUPABASE_URL_GUARD=self-hosted-prod).

Does not apply to local development or Cloud CLI migration scripts, which
never call merge-tdg-app-env.sh. Never prints secret or URL values.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from urllib.parse import urlparse

ALLOWED_SELF_HOSTED = os.environ.get(
    "TDG_ALLOWED_SUPABASE_URL", "https://supabase.thedigitalgifter.com"
).rstrip("/")
VPS_APP_ENV = "/opt/mozas/projects/thedigitalgifter/secrets/app.env"
CLOUD_HOST_RE = re.compile(r"(^|\.)supabase\.co$", re.IGNORECASE)


def normalize_url(value: str) -> str:
    return str(value or "").strip().strip("'").strip('"').rstrip("/")


def host_of(value: str) -> str:
    raw = normalize_url(value)
    if not raw:
        return ""
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    return (parsed.hostname or "").lower()


def classify(value: str) -> str:
    host = host_of(value)
    if not host:
        return "empty"
    if host == "supabase.thedigitalgifter.com":
        return "self-hosted-custom"
    if CLOUD_HOST_RE.search(host):
        return "legacy-cloud"
    return "other"


def read_env_file(path: str) -> dict[str, str]:
    kv: dict[str, str] = {}
    if not path or not os.path.isfile(path):
        return kv
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            kv[key] = val
    return kv


def guard_enabled(app_env: str, proposed: list[str]) -> bool:
    flag = str(os.environ.get("TDG_SUPABASE_URL_GUARD", "")).strip().lower()
    if flag in {"off", "0", "false", "no"}:
        return False
    if flag in {"on", "1", "true", "yes", "self-hosted-prod"}:
        return True
    if os.path.abspath(os.path.expanduser(app_env or "")) == VPS_APP_ENV:
        return True
    return any(classify(v) == "self-hosted-custom" for v in proposed)


def proposed_urls(app_env: str, incoming_vite: str, incoming_server: str) -> tuple[str, str]:
    existing = read_env_file(app_env)
    vite = normalize_url(incoming_vite) or normalize_url(existing.get("VITE_SUPABASE_URL", ""))
    server = (
        normalize_url(incoming_server)
        or normalize_url(incoming_vite)
        or normalize_url(existing.get("SUPABASE_URL", ""))
        or normalize_url(existing.get("VITE_SUPABASE_URL", ""))
    )
    return vite, server


def evaluate(app_env: str, incoming_vite: str, incoming_server: str) -> str | None:
    """Return a BLOCKED reason code, or None if allowed."""
    vite, server = proposed_urls(app_env, incoming_vite, incoming_server)
    proposed = [vite, server]
    if not guard_enabled(app_env, proposed + [incoming_vite, incoming_server]):
        return None

    allowed = normalize_url(ALLOWED_SELF_HOSTED)
    for label, value in (("VITE_SUPABASE_URL", vite), ("SUPABASE_URL", server)):
        kind = classify(value)
        if kind == "empty":
            continue
        if kind == "legacy-cloud":
            return f"legacy-cloud:{label}"
    if vite and server and vite != server:
        return "vite-server-mismatch"
    for label, value in (("VITE_SUPABASE_URL", vite), ("SUPABASE_URL", server)):
        if value and value != allowed:
            return f"unallowed-host:{label}"
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="TDG self-hosted SUPABASE_URL guard")
    parser.add_argument("--app-env", default=os.environ.get("TDG_APP_ENV", VPS_APP_ENV))
    parser.add_argument("--vite", default=os.environ.get("VITE_SUPABASE_URL", ""))
    parser.add_argument("--server", default=os.environ.get("SUPABASE_URL", ""))
    args = parser.parse_args(argv)
    reason = evaluate(args.app_env, args.vite, args.server)
    if reason:
        print(f"BLOCKED: tdg_supabase_url_guard={reason}", file=sys.stderr)
        print("tdg_supabase_url_guard=blocked", file=sys.stderr)
        return 2
    print("tdg_supabase_url_guard=ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())

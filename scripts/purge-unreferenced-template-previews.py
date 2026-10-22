#!/usr/bin/env python3
"""Delete unused template preview files from Supabase Storage.

Keeps every object referenced by public.templates preview/thumbnail/video URLs.
Never touches library, clip-factory, pet, or christmas buckets.

Requires:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_DB_PASSWORD

Usage:
  python3 scripts/purge-unreferenced-template-previews.py --dry-run
  python3 scripts/purge-unreferenced-template-previews.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

import pg8000

PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "kjlsocejpmnzhhduyumy")
ALLOWED_PREFIXES = ("previews/", "ai-previews/")
BUCKET = "templates"


def connect():
    password = os.environ.get("SUPABASE_DB_PASSWORD") or ""
    if not password:
        raise SystemExit("SUPABASE_DB_PASSWORD is required")
    return pg8000.connect(
        user=f"postgres.{PROJECT_REF}",
        password=password,
        host="aws-0-eu-west-1.pooler.supabase.com",
        port=5432,
        database="postgres",
        timeout=40,
        ssl_context=True,
    )


def unreferenced_paths(cur) -> list[tuple[str, int]]:
    cur.execute(
        """
        with refs as (
          select regexp_replace(u, '^.*/templates/', '') as path
          from (
            select unnest(array[
              preview_url, previewurl, preview_image_url, thumbnail_url, thumbnailurl, video_url
            ]) as u
            from public.templates
          ) s
          where u like '%/templates/%'
        )
        select o.name, coalesce((o.metadata->>'size')::bigint, 0)::bigint
        from storage.objects o
        left join refs r on r.path = o.name
        where o.bucket_id = 'templates'
          and r.path is null
        order by o.name
        """
    )
    rows = [(str(name), int(size)) for name, size in cur.fetchall()]
    cur.execute(
        """
        select coalesce(preview_url,'') || ' ' || coalesce(previewurl,'') || ' ' ||
               coalesce(preview_image_url,'') || ' ' || coalesce(thumbnail_url,'') || ' ' ||
               coalesce(thumbnailurl,'') || ' ' || coalesce(video_url,'')
        from public.templates
        """
    )
    blob = "\n".join(row[0] for row in cur.fetchall())
    safe: list[tuple[str, int]] = []
    for name, size in rows:
        if not name.startswith(ALLOWED_PREFIXES) or ".." in name or name.startswith("/"):
            continue
        if name in blob or f"/templates/{name}" in blob:
            continue
        safe.append((name, size))
    return safe


def storage_remove(url: str, key: str, paths: list[str]) -> tuple[int, str]:
    req = urllib.request.Request(
        f"{url.rstrip('/')}/storage/v1/object/{BUCKET}",
        data=json.dumps(paths).encode(),
        method="DELETE",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90, context=ssl.create_default_context()) as resp:
            return resp.status, resp.read().decode()[:400]
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()[:800]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        print("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 2
    conn = connect()
    cur = conn.cursor()
    rows = unreferenced_paths(cur)
    total = sum(size for _, size in rows)
    print(f"unreferenced_template_previews {len(rows)} objects {total/1024/1024:.1f} MB apply={args.apply}")
    if not args.apply:
        conn.close()
        return 0
    for i in range(0, len(rows), 80):
        chunk = [name for name, _ in rows[i : i + 80]]
        code, body = storage_remove(url, key, chunk)
        print(f"batch {i}-{i+len(chunk)-1} {code} {body[:160]}")
        if code not in (200, 204):
            conn.close()
            return 1
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

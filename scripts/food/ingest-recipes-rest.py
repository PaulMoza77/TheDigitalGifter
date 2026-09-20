#!/usr/bin/env python3
"""Upsert tdg-recipes.json into christmas_recipes via PostgREST. Never prints secrets."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

_HERE = Path(__file__).resolve()
ROOT = _HERE.parents[2] if len(_HERE.parents) >= 3 else Path.cwd()
CATALOG = ROOT / "src/features/christmas/planner/food/catalog/tdg-recipes.json"


def row(recipe: dict) -> dict:
    return {
        "slug": recipe["slug"],
        "title": recipe["title"][:120],
        "description": recipe["description"],
        "ingredients": recipe["ingredients"],
        "steps": recipe["steps"],
        "servings": recipe["servings"],
        "prep_minutes": recipe["prepMinutes"],
        "cook_minutes": recipe["cookMinutes"],
        "category": recipe["category"],
        "tags": recipe.get("tags") or [],
        "entitlement_key": recipe.get("entitlementKey") or "recipes",
        "teaser": bool(recipe.get("teaser")),
        "published": True,
        "cuisine_country": recipe.get("country"),
        "cuisine_region": recipe.get("region") or None,
        "course": recipe.get("course"),
        "difficulty": recipe.get("difficulty"),
        "dietary": recipe.get("dietary") or [],
        "allergens": recipe.get("allergens") or [],
        "notes": recipe.get("notes") or "",
        "cost_band": recipe.get("costBand"),
        "cuisine": recipe.get("cuisine"),
    }


def post(url: str, key: str, payload: list[dict]) -> None:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status not in (200, 201, 204):
                raise SystemExit(f"INGEST_HTTP_{resp.status}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:800]
        raise SystemExit(f"INGEST_HTTP_{exc.code} {body}") from exc


def main() -> None:
    url = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        raise SystemExit("INGEST_MISSING_ENV")
    catalog_path = Path(os.environ.get("TDG_RECIPE_CATALOG", CATALOG))
    recipes = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(recipes, list) or not recipes:
        raise SystemExit("INGEST_EMPTY_CATALOG")
    endpoint = f"{url}/rest/v1/christmas_recipes?on_conflict=slug"
    size = int(os.environ.get("TDG_INGEST_CHUNK", "25"))
    upserted = 0
    for i in range(0, len(recipes), size):
        chunk = [row(r) for r in recipes[i : i + size]]
        post(endpoint, key, chunk)
        upserted += len(chunk)
        print(f"INGEST_CHUNK {i // size} {len(chunk)}", flush=True)
    print(f"INGEST_OK count={upserted}", flush=True)


if __name__ == "__main__":
    sys.exit(main())

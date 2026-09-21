#!/usr/bin/env python3
"""Paid video gate for Reel Director productions.

Fails closed unless the manifest status is APPROVED.
This file does not call Kling, Higgsfield, Seedance, or any paid video API.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: generate.py <generation_manifest.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.is_absolute():
        path = ROOT / path
    data = json.loads(path.read_text())
    status = data.get("status")
    if status != "APPROVED":
        print(
            f"BLOCKED: {data.get('project')} status={status}. "
            "WAITING FOR APPROVAL TO GENERATE. No paid video called.",
            file=sys.stderr,
        )
        return 2
    print(
        "BLOCKED: generate.py has no provider client in this planning step. "
        "Do not call paid video from this revision.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

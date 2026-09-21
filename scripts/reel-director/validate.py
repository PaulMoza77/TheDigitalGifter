#!/usr/bin/env python3
"""Validate a Reel Director generation manifest. No provider calls."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = (
    "project",
    "status",
    "pipeline",
    "characters",
    "reference_assets",
    "shots",
    "audio",
    "assembly",
    "cost_estimate",
)
ALLOWED_STATUS = {
    "DRAFT",
    "READY_FOR_APPROVAL",
    "APPROVED",
    "GENERATING",
    "ASSEMBLED",
    "QA",
    "LIBRARY",
    "BLOCKED",
}


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: validate.py <generation_manifest.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.is_absolute():
        path = ROOT / path
    data = json.loads(path.read_text())
    missing = [k for k in REQUIRED if k not in data]
    if missing:
        raise SystemExit(f"missing keys: {missing}")
    if data["status"] not in ALLOWED_STATUS:
        raise SystemExit(f"invalid status: {data['status']}")
    if not data["shots"]:
        raise SystemExit("shots empty")
    paid = 0
    for shot in data["shots"]:
        for key in ("id", "duration_s", "reference_asset", "video"):
            if key not in shot:
                raise SystemExit(f"shot missing {key}: {shot.get('id')}")
        video = shot["video"]
        if video.get("generate"):
            paid += 1
            for key in ("provider", "model", "duration_s", "estimated_usd"):
                if key not in video:
                    raise SystemExit(f"{shot['id']} video missing {key}")
        ref = ROOT / shot["reference_asset"]
        if not ref.exists():
            raise SystemExit(f"{shot['id']} missing reference {ref}")
    cost = data["cost_estimate"]
    for key in ("video_usd", "audio_usd", "total_usd"):
        if key not in cost:
            raise SystemExit(f"cost_estimate missing {key}")
    print(
        f"OK {data['project']} status={data['status']} shots={len(data['shots'])} "
        f"paid_video_jobs={paid} total_usd={cost['total_usd']}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

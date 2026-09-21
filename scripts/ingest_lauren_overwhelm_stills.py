#!/usr/bin/env python3
"""Ingest Lauren Christmas Overwhelm stills and crop to 1080x1920 generation sources."""

from __future__ import annotations

import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
ASSETS = Path("/home/ubuntu/.cursor/projects/workspace/assets")
STILLS = ROOT / "public" / "assets" / "christmas" / "lauren-overwhelm" / "stills"
SOURCE = ROOT / "public" / "assets" / "christmas" / "lauren-overwhelm" / "source"
MANIFEST = ROOT / "public" / "assets" / "christmas" / "lauren-overwhelm" / "ingest_stills.json"

# Story order (not attachment order): intro → mental load → receipt → peak → discovery → payoff.
STILLS_SPEC = [
    {
        "id": "lauren_01_intro",
        "src": "8DFDB6FB-1386-445D-BA56-002D9FDCA39F_L0_001.jpg",
        "filename": "lauren_01_intro_kitchen_worried.jpg",
        "gen": "lauren_01_intro_1080x1920.png",
        "title": "Photo · Lauren intro, kitchen worry",
        "description": "Lauren leans on the kitchen island, mildly overloaded, family wrapping gifts behind her.",
        "scene": 1,
    },
    {
        "id": "lauren_02_phone",
        "src": "F24A5584-7353-4176-B2FE-62D36EF93106_L0_001.jpg",
        "filename": "lauren_02_phone_mental_load.jpg",
        "gen": "lauren_02_phone_1080x1920.png",
        "title": "Photo · Lauren mental load, phone",
        "description": "Lauren checks her phone in the kitchen with a worried look as Christmas prep continues.",
        "scene": 2,
    },
    {
        "id": "lauren_03_receipt",
        "src": "8853D787-3F22-4834-B292-0D729E88DAC7_L0_001.jpg",
        "filename": "lauren_03_receipt_tasks.jpg",
        "gen": "lauren_03_receipt_1080x1920.png",
        "title": "Photo · Lauren receipt and to-do list",
        "description": "Lauren studies a long receipt beside a Christmas to-do list and wrapping paper.",
        "scene": 3,
    },
    {
        "id": "lauren_04_peak",
        "src": "DDA156BC-C915-48E2-8357-80ABF0F42D6B_L0_001.jpg",
        "filename": "lauren_04_peak_stress_living_room.jpg",
        "gen": "lauren_04_peak_1080x1920.png",
        "title": "Photo · Lauren peak stress",
        "description": "Lauren stands in a messy living room with both hands in her hair, wrapping chaos around her.",
        "scene": 4,
    },
    {
        "id": "lauren_05_discovery",
        "src": "16039ED0-9235-4A9D-AF28-15DC449A6D8C_L0_001.jpg",
        "filename": "lauren_05_discovery_phone.jpg",
        "gen": "lauren_05_discovery_1080x1920.png",
        "title": "Photo · Lauren discovers the planner",
        "description": "Lauren looks at her phone with a small surprised smile in the decorated kitchen.",
        "scene": 5,
    },
    {
        "id": "lauren_06_payoff",
        "src": "3AF1D226-79B6-4144-A017-34773800EEBC_L0_001.jpg",
        "filename": "lauren_06_payoff_relaxed.jpg",
        "gen": "lauren_06_payoff_1080x1920.png",
        "title": "Photo · Lauren relaxed Christmas",
        "description": "Lauren sits calmly with cocoa and a laptop, smiling as her family enjoys Christmas.",
        "scene": 6,
    },
]


def probe_image(path: Path) -> tuple[int, int]:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
            str(path),
        ]
    )
    w, h = raw.decode().strip().split(",")
    return int(w), int(h)


def crop_to_1080x1920(src: Path, dest: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    w, h = probe_image(src)
    # Source stills are 1024x1536 (2:3). Scale to 1920 tall then center-crop 9:16.
    vf = "scale=-2:1920,crop=1080:1920:(in_w-1080)/2:0,setsar=1"
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-vf", vf, "-frames:v", "1", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    ow, oh = probe_image(dest)
    if ow != 1080 or oh != 1920:
        raise RuntimeError(f"{dest.name} is {ow}x{oh}, expected 1080x1920")
    return {"source_wh": [w, h], "output_wh": [ow, oh], "bytes": dest.stat().st_size}


def main() -> int:
    STILLS.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    rows = []
    missing = []
    for spec in STILLS_SPEC:
        src = ASSETS / spec["src"]
        if not src.exists():
            missing.append(str(src))
            continue
        original = STILLS / spec["filename"]
        shutil.copy2(src, original)
        gen = SOURCE / spec["gen"]
        crop = crop_to_1080x1920(src, gen)
        print(f"OK scene {spec['scene']} {spec['id']} {crop['source_wh']} -> 1080x1920", flush=True)
        rows.append(
            {
                **spec,
                "original": str(original.relative_to(ROOT)),
                "generation_still": str(gen.relative_to(ROOT)),
                "original_bytes": original.stat().st_size,
                **crop,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    if missing:
        raise SystemExit("missing supplied images:\n" + "\n".join(missing))
    if len(rows) != 6:
        raise SystemExit(f"expected 6 stills, got {len(rows)}")
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        json.dumps(
            {
                "status": "INGESTED",
                "project": "Lauren — Christmas Overwhelm Story 01",
                "count": len(rows),
                "order_verified": [r["id"] for r in rows],
                "assets": rows,
            },
            indent=2,
        )
        + "\n"
    )
    print("INGESTED 6 stills in story order", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

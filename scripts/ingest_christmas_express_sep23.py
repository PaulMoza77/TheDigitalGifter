#!/usr/bin/env python3
"""Ingest Sep 23 Christmas Express stills into Library + 9:16 generation sources.

Preserves original JPEGs. Creates 1080x1920 PNG crops for Higgsfield Kling 3.0 Pro I2V.
Does not overwrite existing Library files.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
ASSETS = Path(
    os.environ.get("TDG_INGEST_ASSETS")
    or "/home/ubuntu/.cursor/projects/workspace/assets"
)
STILLS = ROOT / "public" / "assets" / "christmas" / "library-stills"
SOURCE = ROOT / "source" / "batch-christmas-express"
MANIFEST = ROOT / "public" / "assets" / "christmas" / "library-stills" / "ingest_christmas_express_sep23.json"

TAGS = [
    "christmas",
    "reel-source",
    "cinematic",
    "christmas-express",
    "polar-express",
    "train",
    "AI-generated",
]

STILLS_SPEC = [
    {
        "id": "photo-cx-night-viaduct",
        "src_glob": "46BA21A4-F71D-4891-97BC-2AE631A8FA28_L0_001.jpg",
        "filename": "christmas_express_night_moon_viaduct.jpg",
        "gen": "01_night_moon_viaduct_1080x1920.png",
        "title": "Photo · Christmas Express night viaduct",
        "description": "Polar Express 1225 on a lit stone viaduct at night under a full moon.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-cx-sunset-viaduct",
        "src_glob": "11394852-75DB-4668-824B-7837B90971CC_L0_001.jpg",
        "filename": "christmas_express_sunset_viaduct.jpg",
        "gen": "02_sunset_viaduct_1080x1920.png",
        "title": "Photo · Christmas Express sunset viaduct",
        "description": "Polar Express 1225 crossing a decorated alpine viaduct at sunset.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-cx-station",
        "src_glob": "8C34D012-1401-4D1C-8280-D97C0361AFF5_L0_001.jpg",
        "filename": "christmas_express_north_pole_station.jpg",
        "gen": "03_north_pole_station_1080x1920.png",
        "title": "Photo · North Pole Express station",
        "description": "Child waving with a golden retriever as Polar Express 1225 arrives at the station.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-cx-aurora-viaduct",
        "src_glob": "3FF778C0-C44A-4E93-8626-7AA735DEE4FE_L0_001.jpg",
        "filename": "christmas_express_aurora_viaduct.jpg",
        "gen": "04_aurora_viaduct_1080x1920.png",
        "title": "Photo · Christmas Express aurora viaduct",
        "description": "Polar Express 1225 on a snowy viaduct under aurora and starlight.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-cx-santa-gifts",
        "src_glob": "DA51D6B5-4CD3-4FB1-854B-7FABB0B130CF_L0_001.jpg",
        "filename": "christmas_express_santa_gift_train.jpg",
        "gen": "05_santa_gift_train_1080x1920.png",
        "title": "Photo · Christmas Express Santa gift train",
        "description": "Santa leaning from Polar Express 1225 with gift-filled open cars on a viaduct.",
        "crop": {"x": 0.50, "y": 0.46},
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
            "json",
            str(path),
        ]
    )
    stream = (json.loads(raw).get("streams") or [{}])[0]
    return int(stream.get("width") or 0), int(stream.get("height") or 0)


def crop_to_1080x1920(src: Path, dest: Path, x_frac: float, y_frac: float) -> dict:
    w, h = probe_image(src)
    if w < 8 or h < 8:
        raise RuntimeError(f"unreadable still {src}")
    target = 9 / 16
    if w / h > target:
        crop_h = h
        crop_w = int(round(h * target))
        x = int(round((w - crop_w) * x_frac))
        y = 0
    else:
        crop_w = w
        crop_h = int(round(w / target))
        x = 0
        y = int(round((h - crop_h) * y_frac))
    x = max(0, min(x, w - crop_w))
    y = max(0, min(y, h - crop_h))
    dest.parent.mkdir(parents=True, exist_ok=True)
    vf = f"crop={crop_w}:{crop_h}:{x}:{y},scale=1080:1920:flags=lanczos,setsar=1"
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-vf", vf, "-frames:v", "1", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    ow, oh = probe_image(dest)
    if ow != 1080 or oh != 1920:
        raise RuntimeError(f"{dest.name} is {ow}x{oh}, expected 1080x1920")
    return {
        "source_wh": [w, h],
        "crop": [crop_w, crop_h, x, y],
        "output_wh": [ow, oh],
        "bytes": dest.stat().st_size,
    }


def main() -> int:
    STILLS.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    rows = []
    for spec in STILLS_SPEC:
        src = ASSETS / spec["src_glob"]
        if not src.exists():
            raise SystemExit(f"missing supplied image {src}")
        original = STILLS / spec["filename"]
        if original.exists():
            print(f"KEEP existing original {original.name}", flush=True)
        else:
            shutil.copy2(src, original)
            print(f"COPY original {src.name} -> {original.name}", flush=True)
        gen = SOURCE / spec["gen"]
        crop = crop_to_1080x1920(src, gen, spec["crop"]["x"], spec["crop"]["y"])
        print(f"CROP {spec['id']} {crop['source_wh']} -> 1080x1920 via {crop['crop']}", flush=True)
        rows.append(
            {
                "id": spec["id"],
                "title": spec["title"],
                "description": spec["description"],
                "tags": TAGS,
                "original": str(original.relative_to(ROOT)),
                "generation_still": str(gen.relative_to(ROOT)),
                "original_bytes": original.stat().st_size,
                "upload_id": spec["src_glob"],
                **crop,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    MANIFEST.write_text(json.dumps({"status": "INGESTED", "count": len(rows), "assets": rows}, indent=2) + "\n")
    print(f"INGESTED {len(rows)} stills", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

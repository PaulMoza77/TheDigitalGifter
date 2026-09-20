#!/usr/bin/env python3
"""Ingest Sep 20 cinematic Christmas stills into Library + 9:16 generation sources.

Preserves original high-resolution JPEGs. Does not overwrite existing Library files.
Creates 1080x1920 PNG crops for Higgsfield Kling 3.0 Pro I2V.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
ASSETS = Path(
    os.environ.get("TDG_INGEST_ASSETS")
    or "/home/ubuntu/.cursor/projects/workspace/assets"
)
STILLS = ROOT / "public" / "assets" / "christmas" / "library-stills"
SOURCE = ROOT / "source" / "batch-sep20"
MANIFEST = ROOT / "public" / "assets" / "christmas" / "library-stills" / "ingest_sep20.json"

TAGS = [
    "christmas",
    "reel-source",
    "cinematic",
    "viral",
    "recognizable-scene",
    "AI-generated",
]

STILLS_SPEC = [
    {
        "id": "photo-polar-express-viaduct",
        "src_glob": "01a0be06-a195-7e19-a1eb-2c3dcf7a0012.jpg",
        "filename": "polar_express_alpine_viaduct.jpg",
        "gen": "01_polar_express_alpine_viaduct_1080x1920.png",
        "title": "Photo · Polar Express alpine viaduct",
        "description": "Steam locomotive with wreath and red carriages on a lit stone viaduct at sunset.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-coca-cola-truck",
        "src_glob": "01a0be06-a1b1-77d1-aa85-f299d8fae5e3.jpg",
        "filename": "coca_cola_christmas_truck_times_square.jpg",
        "gen": "02_coca_cola_christmas_truck_1080x1920.png",
        "title": "Photo · Coca-Cola Christmas truck",
        "description": "Lit Coca-Cola holiday truck with Santa mural in Times Square snowfall.",
        "crop": {"x": 0.46, "y": 0.42},
    },
    {
        "id": "photo-home-alone-house",
        "src_glob": "01a0be06-a1ca-73d9-968f-193d7e62391a.jpg",
        "filename": "home_alone_style_christmas_house.jpg",
        "gen": "03_home_alone_style_house_1080x1920.png",
        "title": "Photo · Home Alone-style Christmas house",
        "description": "Brick colonial house 671 with warm windows, wreath, and Christmas lights in snow.",
        "crop": {"x": 0.40, "y": 0.38},
    },
    {
        "id": "photo-rockefeller-rink",
        "src_glob": "01a0be06-a1e5-79dd-bea9-dc9ba0c372cb.jpg",
        "filename": "rockefeller_center_ice_rink.jpg",
        "gen": "04_rockefeller_center_ice_rink_1080x1920.png",
        "title": "Photo · Rockefeller Center ice rink",
        "description": "Rockefeller Christmas tree, Prometheus fountain, and skaters in falling snow.",
        "crop": {"x": 0.52, "y": 0.42},
    },
    {
        "id": "photo-plaza-hotel-carriage",
        "src_glob": "01a0be06-a1fb-72e7-922a-e3d81ba2af19.jpg",
        "filename": "plaza_hotel_fifth_avenue.jpg",
        "gen": "05_plaza_hotel_fifth_avenue_1080x1920.png",
        "title": "Photo · The Plaza Hotel Fifth Avenue",
        "description": "White horse carriage at The Plaza canopy on snowy Fifth Avenue.",
        "crop": {"x": 0.58, "y": 0.40},
    },
    {
        "id": "photo-santa-over-london",
        "src_glob": "01a0be06-a217-76cf-8c8d-d32b3df4e634.jpg",
        "filename": "santa_sleigh_over_london.jpg",
        "gen": "06_santa_sleigh_over_london_1080x1920.png",
        "title": "Photo · Santa flying over London",
        "description": "Santa’s sleigh and reindeer over Big Ben, Parliament, and the Thames under a full moon.",
        "crop": {"x": 0.18, "y": 0.28},
    },
    {
        "id": "photo-santa-workshop-north-pole",
        "src_glob": "01a0be06-a22e-7b2c-ad4d-41b07e70e217.jpg",
        "filename": "santa_workshop_north_pole.jpg",
        "gen": "07_santa_workshop_north_pole_1080x1920.png",
        "title": "Photo · Santa’s Workshop North Pole",
        "description": "Santa checking the Nice List at the workshop door with elves, reindeer, and aurora.",
        "crop": {"x": 0.48, "y": 0.40},
    },
    {
        "id": "photo-grinch-whoville",
        "src_glob": "01a0be06-a248-79ab-9859-2f213d8c9b15.jpg",
        "filename": "grinch_whoville_rooftop.jpg",
        "gen": "08_grinch_whoville_rooftop_1080x1920.png",
        "title": "Photo · Grinch over Whoville",
        "description": "Grinch in a Santa coat on a snowy rooftop above Whoville’s Christmas lights.",
        "crop": {"x": 0.72, "y": 0.38},
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
                **crop,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    MANIFEST.write_text(json.dumps({"status": "INGESTED", "count": len(rows), "assets": rows}, indent=2) + "\n")
    print(f"INGESTED {len(rows)} stills", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

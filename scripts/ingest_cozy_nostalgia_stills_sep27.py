#!/usr/bin/env python3
"""Ingest Sep 27 cozy / nostalgia Christmas stills (batch 2 of 20) into Library."""

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
SOURCE = ROOT / "source" / "batch-cozy-nostalgia-sep27"
MANIFEST = ROOT / "public" / "assets" / "christmas" / "library-stills" / "ingest_cozy_nostalgia_sep27.json"

TAGS = [
    "christmas",
    "reel-source",
    "cinematic",
    "cozy",
    "nostalgia",
    "AI-generated",
]

STILLS_SPEC = [
    {
        "id": "photo-christmas-mansion-gate-nyc",
        "src_glob": "01a0e352-0009-7ba7-ae09-2b2f19c7dbf9.jpg",
        "filename": "christmas_mansion_gate_nyc_twilight.jpg",
        "gen": "11_christmas_mansion_gate_nyc_1080x1920.png",
        "title": "Photo · Christmas mansion gate NYC",
        "description": "Lit stone mansion behind iron gates with Range Rover and twilight NYC skyline.",
        "crop": {"x": 0.50, "y": 0.40},
    },
    {
        "id": "photo-alpine-cabin-tom-jerry-fireplace",
        "src_glob": "01a0e352-0028-79ae-9812-90f18d836d42.jpg",
        "filename": "alpine_cabin_tom_jerry_fireplace.jpg",
        "gen": "12_alpine_cabin_tom_jerry_1080x1920.png",
        "title": "Photo · Alpine cabin Tom & Jerry fireplace",
        "description": "Mountain cabin with fireplace, Tom & Jerry on TV, golden retriever, snowy peaks.",
        "crop": {"x": 0.50, "y": 0.42},
    },
    {
        "id": "photo-home-alone-kevin-tv-christmas",
        "src_glob": "01a0e352-0044-7999-9fb7-82107f29eea5.jpg",
        "filename": "home_alone_kevin_tv_christmas.jpg",
        "gen": "13_home_alone_kevin_tv_1080x1920.png",
        "title": "Photo · Home Alone Kevin TV Christmas",
        "description": "Living room with Kevin McCallister on CRT TV, tree, fireplace, and gift pile.",
        "crop": {"x": 0.50, "y": 0.42},
    },
    {
        "id": "photo-christmas-morning-stairs-child",
        "src_glob": "01a0e352-005e-716f-81eb-40c9ec426053.jpg",
        "filename": "christmas_morning_stairs_child.jpg",
        "gen": "14_christmas_morning_stairs_1080x1920.png",
        "title": "Photo · Christmas morning stairs child",
        "description": "Child in pajamas on the stairs with dog, glowing tree and presents below.",
        "crop": {"x": 0.50, "y": 0.44},
    },
    {
        "id": "photo-family-christmas-dinner-charlie-brown",
        "src_glob": "01a0e352-0079-70e4-8332-2ee3def5f785.jpg",
        "filename": "family_christmas_dinner_charlie_brown.jpg",
        "gen": "15_family_dinner_charlie_brown_1080x1920.png",
        "title": "Photo · Family Christmas dinner Charlie Brown",
        "description": "Multi-generational Christmas dinner with Charlie Brown on TV and roaring fire.",
        "crop": {"x": 0.50, "y": 0.44},
    },
    {
        "id": "photo-library-christmas-golden-retriever",
        "src_glob": "01a0e352-0090-788c-a435-1010e8df5781.jpg",
        "filename": "library_christmas_golden_retriever_fireplace.jpg",
        "gen": "16_library_golden_retriever_1080x1920.png",
        "title": "Photo · Library Christmas golden retriever",
        "description": "Two-story library with tree, fireplace, sleeping golden retriever, snowy window.",
        "crop": {"x": 0.50, "y": 0.42},
    },
    {
        "id": "photo-nyc-saks-rockefeller-snow",
        "src_glob": "01a0e352-00aa-742e-8cb5-9ca63e62f272.jpg",
        "filename": "nyc_saks_rockefeller_tree_snow.jpg",
        "gen": "17_nyc_saks_rockefeller_1080x1920.png",
        "title": "Photo · Saks Fifth Rockefeller tree snow",
        "description": "Saks Fifth Avenue corner, yellow cab, Rockefeller tree and crowds in snowfall.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-train-carriage-viaduct-window",
        "src_glob": "01a0e352-00c4-779a-b0e3-fcdb7678f9f6.jpg",
        "filename": "train_carriage_viaduct_window.jpg",
        "gen": "18_train_carriage_viaduct_1080x1920.png",
        "title": "Photo · Train carriage viaduct window",
        "description": "Luxury Christmas train car interior with viaduct and lit locomotive through the window.",
        "crop": {"x": 0.50, "y": 0.44},
    },
    {
        "id": "photo-nyc-brownstone-empire-vintage",
        "src_glob": "01a0e352-00dc-79ee-a932-1b6d4fdbf0b7.jpg",
        "filename": "nyc_brownstone_empire_vintage_cars.jpg",
        "gen": "19_nyc_brownstone_empire_1080x1920.png",
        "title": "Photo · NYC brownstone Empire vintage",
        "description": "Snowy brownstone steps, vintage red cars, lit trees, Empire State in distance.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-magical-bedroom-santa-moon",
        "src_glob": "01a0e352-00f1-73d0-b227-61cc87a89613.jpg",
        "filename": "magical_bedroom_santa_moon_window.jpg",
        "gen": "20_magical_bedroom_santa_moon_1080x1920.png",
        "title": "Photo · Magical bedroom Santa moon",
        "description": "Christmas bedroom with puppy on bed, tree, cocoa, Santa sleigh crossing full moon.",
        "crop": {"x": 0.50, "y": 0.42},
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
        print(f"CROP {spec['id']} {crop['source_wh']} -> 1080x1920", flush=True)
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

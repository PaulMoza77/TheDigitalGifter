#!/usr/bin/env python3
"""Ingest Sep 27 NYC + holiday train stills into Library + 9:16 generation sources.

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
SOURCE = ROOT / "source" / "batch-nyc-holiday-sep27"
MANIFEST = ROOT / "public" / "assets" / "christmas" / "library-stills" / "ingest_nyc_holiday_sep27.json"

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
        "id": "photo-nyc-new-york-awning-snow",
        "src_glob": "01a0e349-e7a7-7a28-a541-f6b90445d583.jpg",
        "filename": "nyc_new_york_awning_snow_taxis.jpg",
        "gen": "01_nyc_new_york_awning_snow_1080x1920.png",
        "title": "Photo · New York awning snowy Fifth Avenue",
        "description": "NEW YORK canopy, garlands, yellow taxis, and Empire State Building in falling snow.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-christmas-train-nyc-station-clock",
        "src_glob": "01a0e349-e7c2-7bae-bf8f-22003b54df47.jpg",
        "filename": "christmas_train_nyc_station_clock.jpg",
        "gen": "02_christmas_train_nyc_station_clock_1080x1920.png",
        "title": "Photo · Christmas train NYC station clock",
        "description": "Wreath-lit steam locomotive at a snowy platform with station clock and Manhattan skyline.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-christmas-train-grand-central-chrysler",
        "src_glob": "01a0e349-e7de-7b9f-849c-8ebd499774c7.jpg",
        "filename": "christmas_train_grand_central_chrysler.jpg",
        "gen": "03_christmas_train_grand_central_chrysler_1080x1920.png",
        "title": "Photo · Christmas train Grand Central skyline",
        "description": "Festive steam train at a grand arched terminal with Chrysler Building and falling snow.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-christmas-train-viaduct-sunset-peaks",
        "src_glob": "01a0e349-e7fb-7024-8e1b-07d7fdd15338.jpg",
        "filename": "christmas_train_viaduct_sunset_peaks.jpg",
        "gen": "04_christmas_train_viaduct_sunset_peaks_1080x1920.png",
        "title": "Photo · Christmas train viaduct sunset peaks",
        "description": "Polar-style locomotive on a lit stone viaduct at sunset above a snowy alpine valley.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-christmas-mansion-nyc-skyline-gwagon",
        "src_glob": "01a0e349-e812-796c-a09f-096cf6c8120e.jpg",
        "filename": "christmas_mansion_nyc_skyline_gwagon.jpg",
        "gen": "05_christmas_mansion_nyc_skyline_gwagon_1080x1920.png",
        "title": "Photo · Christmas mansion NYC skyline",
        "description": "Lit stone mansion with G-Wagon in the drive and Empire State Building at twilight.",
        "crop": {"x": 0.50, "y": 0.40},
    },
    {
        "id": "photo-christmas-train-viaduct-alpine-village",
        "src_glob": "01a0e349-e829-76d7-909a-16c461fd595c.jpg",
        "filename": "christmas_train_viaduct_alpine_village.jpg",
        "gen": "06_christmas_train_viaduct_alpine_village_1080x1920.png",
        "title": "Photo · Christmas train viaduct alpine village",
        "description": "Wreath-lit train crossing a decorated viaduct at sunset with village and lake below.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-christmas-train-station-traveler",
        "src_glob": "01a0e349-e842-74cf-88da-405f9b6d8263.jpg",
        "filename": "christmas_train_station_traveler_suitcase.jpg",
        "gen": "07_christmas_train_station_traveler_1080x1920.png",
        "title": "Photo · Christmas train station traveler",
        "description": "Woman in a red coat with a suitcase on a garland-lit platform as a wreath train arrives.",
        "crop": {"x": 0.50, "y": 0.44},
    },
    {
        "id": "photo-nyc-radio-city-snow",
        "src_glob": "01a0e349-e856-7cd8-9bd8-79041d059826.jpg",
        "filename": "nyc_radio_city_music_hall_snow.jpg",
        "gen": "08_nyc_radio_city_music_hall_snow_1080x1920.png",
        "title": "Photo · Radio City Music Hall snowy night",
        "description": "Radio City marquee, garlands, yellow cabs, and Empire State Building in heavy snowfall.",
        "crop": {"x": 0.50, "y": 0.46},
    },
    {
        "id": "photo-nyc-penthouse-tom-jerry-pets",
        "src_glob": "01a0e349-e86d-7378-a663-022fa7394c24.jpg",
        "filename": "nyc_penthouse_tom_jerry_cozy_pets.jpg",
        "gen": "09_nyc_penthouse_tom_jerry_cozy_pets_1080x1920.png",
        "title": "Photo · NYC penthouse Tom & Jerry cozy pets",
        "description": "Christmas penthouse with fireplace, tree, snowy skyline, Tom & Jerry on TV, dog and cat on sofa.",
        "crop": {"x": 0.50, "y": 0.42},
    },
    {
        "id": "photo-nyc-penthouse-christmas-empire",
        "src_glob": "01a0e349-e883-7ccf-aa2e-d86639577669.jpg",
        "filename": "nyc_penthouse_christmas_empire_state.jpg",
        "gen": "10_nyc_penthouse_christmas_empire_state_1080x1920.png",
        "title": "Photo · NYC penthouse Christmas Empire State",
        "description": "Luxury living room with lit tree, fireplace, candles, and Central Park snow through floor-to-ceiling windows.",
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

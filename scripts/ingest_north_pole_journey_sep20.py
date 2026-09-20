#!/usr/bin/env python3
"""Ingest Sep 20 North Pole journey stills into Library + 9:16 generation sources.

Preserves original JPEGs. Does not overwrite existing Library files.
Creates 1080x1920 PNG crops for Higgsfield Kling 3.0 Pro I2V.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
ASSETS = Path(
    os.environ.get("TDG_INGEST_ASSETS") or "/home/ubuntu/.cursor/projects/workspace/assets"
)
STILLS = ROOT / "public" / "assets" / "christmas" / "library-stills"
SOURCE = ROOT / "source" / "batch-np-journey"
MANIFEST = ROOT / "public" / "assets" / "christmas" / "library-stills" / "ingest_np_journey_sep20.json"

TAGS = [
    "christmas",
    "reel-source",
    "cinematic",
    "train",
    "north-pole",
    "viral",
    "AI-generated",
]

STILLS_SPEC = [
    {
        "id": "photo-np-train-window",
        "src_glob": "01a0c08a-0436-73b1-9e76-726a5d8d222c.jpg",
        "filename": "np_journey_train_window_girl.jpg",
        "gen": "01_train_window_girl_1080x1920.png",
        "title": "Photo · Magical train window",
        "description": "Child in a red knit hat leans from a lantern-lit carriage as a steam train crosses a moonlit alpine viaduct.",
        "crop": {"x": 0.42, "y": 0.40},
        "tags": ["christmas", "train", "cinematic", "reel-source"],
    },
    {
        "id": "photo-np-express-station",
        "src_glob": "01a0c08a-0453-70fb-84e8-3334748a568f.jpg",
        "filename": "np_journey_north_pole_express_station.jpg",
        "gen": "02_north_pole_express_station_1080x1920.png",
        "title": "Photo · North Pole Express station",
        "description": "Child with backpack faces a wreath-lit steam locomotive under the NORTH POLE EXPRESS station clock.",
        "crop": {"x": 0.50, "y": 0.42},
        "tags": ["christmas", "train", "north-pole", "reel-source"],
    },
    {
        "id": "photo-np-aurora-window",
        "src_glob": "01a0c08a-046f-76d3-8125-b57cb621f439.jpg",
        "filename": "np_journey_aurora_from_train.jpg",
        "gen": "03_aurora_from_train_1080x1920.png",
        "title": "Photo · Aurora from the train",
        "description": "Carriage-side view of a red steam train on a stone viaduct under green northern lights.",
        "crop": {"x": 0.48, "y": 0.42},
        "tags": ["christmas", "train", "aurora", "cinematic"],
    },
    {
        "id": "photo-np-viaduct-aurora",
        "src_glob": "01a0c08a-0489-7ff2-aa70-b337540ab97a.jpg",
        "filename": "np_journey_viaduct_aurora_wide.jpg",
        "gen": "04_viaduct_aurora_wide_1080x1920.png",
        "title": "Photo · Train on aurora viaduct",
        "description": "Wide cinematic steam train crossing a high stone viaduct above a frozen river and alpine village.",
        "crop": {"x": 0.50, "y": 0.44},
        "tags": ["christmas", "train", "aurora", "cinematic"],
    },
    {
        "id": "photo-np-village-arrival",
        "src_glob": "01a0c08a-04a3-7989-94a2-1265a0b83f03.jpg",
        "filename": "np_journey_santa_village_arrival.jpg",
        "gen": "05_santa_village_arrival_1080x1920.png",
        "title": "Photo · North Pole Santa Village",
        "description": "Traveler arriving under the NORTH POLE SANTA VILLAGE arch with elves, gifts, and a clock tower.",
        "crop": {"x": 0.50, "y": 0.42},
        "tags": ["christmas", "north-pole", "santa", "village"],
    },
    {
        "id": "photo-np-workshop-street",
        "src_glob": "01a0c08a-04be-789c-b788-43d678d1089c.jpg",
        "filename": "np_journey_workshop_street.jpg",
        "gen": "06_workshop_street_1080x1920.png",
        "title": "Photo · Santa’s Workshop street",
        "description": "Child facing Santa’s Workshop with reindeer, elves, gifts, and a giant Christmas tree.",
        "crop": {"x": 0.48, "y": 0.42},
        "tags": ["christmas", "workshop", "reindeer", "north-pole"],
    },
    {
        "id": "photo-np-workshop-list",
        "src_glob": "01a0c08a-04db-74cc-8292-21ece3edd22c.jpg",
        "filename": "np_journey_workshop_naughty_nice.jpg",
        "gen": "07_workshop_naughty_nice_1080x1920.png",
        "title": "Photo · Santa and the Naughty or Nice list",
        "description": "Santa at his workshop desk with the Naughty or Nice list, wrapping elf, and sleeping golden retriever.",
        "crop": {"x": 0.50, "y": 0.45},
        "tags": ["christmas", "santa", "workshop", "cozy"],
    },
    {
        "id": "photo-np-workshop-wrapping",
        "src_glob": "01a0c08a-04f6-7b1b-8b83-7408d5d7c393.jpg",
        "filename": "np_journey_workshop_wrapping.jpg",
        "gen": "08_workshop_wrapping_1080x1920.png",
        "title": "Photo · Elves wrapping with Santa",
        "description": "Santa tying a bow while elves wrap toys beside a Good Children Around the World scroll.",
        "crop": {"x": 0.50, "y": 0.44},
        "tags": ["christmas", "santa", "workshop", "elves"],
    },
    {
        "id": "photo-np-window-sleigh",
        "src_glob": "01a0c08a-0510-7f41-8e39-0cfbfae36046.jpg",
        "filename": "np_journey_window_sleigh_payoff.jpg",
        "gen": "09_window_sleigh_payoff_1080x1920.png",
        "title": "Photo · Child watching Santa’s sleigh",
        "description": "Girl and golden retriever at a snowy window as Santa’s sleigh flies over a moonlit village.",
        "crop": {"x": 0.52, "y": 0.40},
        "tags": ["christmas", "sleigh", "cozy", "santa"],
    },
    {
        "id": "photo-np-village-snowman",
        "src_glob": "01a0c08a-052a-7ba2-b6df-62d42368592e.jpg",
        "filename": "np_journey_village_snowman.jpg",
        "gen": "10_village_snowman_1080x1920.png",
        "title": "Photo · Village square snowman",
        "description": "Child placing a carrot nose on a snowman in a festive alpine market with a golden retriever.",
        "crop": {"x": 0.48, "y": 0.42},
        "tags": ["christmas", "village", "cozy", "snowman"],
    },
    {
        "id": "photo-np-plaza-girl-dog",
        "src_glob": "01a0c08a-0546-7c65-bbcb-8da6752d27fc.jpg",
        "filename": "np_journey_plaza_nyc_girl_dog.jpg",
        "gen": "11_plaza_nyc_girl_dog_1080x1920.png",
        "title": "Photo · The Plaza New York arrival",
        "description": "Girl in a red coat and golden retriever at The Plaza Hotel entrance on a snowy Fifth Avenue night.",
        "crop": {"x": 0.50, "y": 0.42},
        "tags": ["christmas", "new-york", "plaza", "cinematic"],
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
                "tags": spec["tags"],
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

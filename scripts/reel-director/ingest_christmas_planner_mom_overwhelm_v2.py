#!/usr/bin/env python3
"""Copy locked v2 stills and crop 1080x1920 I2V sources. Does not generate video."""

from __future__ import annotations

import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = Path("/home/ubuntu/.cursor/projects/workspace/assets")
BASE = ROOT / "public" / "assets" / "christmas" / "christmas_planner_mom_overwhelm_v2"
STILLS = BASE / "stills"
SOURCE = BASE / "source"
MANIFEST = BASE / "ingest_stills.json"

STILLS_SPEC = [
    {
        "id": "ref_01_chaos",
        "src": "01a0c5d0-c312-7e34-93e6-4fb3971de38e.jpg",
        "filename": "ref_01_chaos_family_table.jpg",
        "gen": "ref_01_chaos_1080x1920.png",
        "shot": "shot_01_chaos",
        "title": "Wide family chaos at the Christmas table",
    },
    {
        "id": "ref_02_pressure",
        "src": "01a0c5d0-c32e-7c50-9e10-23377408c3a6.jpg",
        "filename": "ref_02_pressure_lists_son.jpg",
        "gen": "ref_02_pressure_1080x1920.png",
        "shot": "shot_02_pressure",
        "title": "Pressure builds — paper lists, son, husband behind",
    },
    {
        "id": "ref_03_husband",
        "src": "01a0c5d0-c35f-73be-89e3-21837eb69331.jpg",
        "filename": "ref_03_husband_dinner.jpg",
        "gen": "ref_03_husband_1080x1920.png",
        "shot": "shot_03_husband",
        "title": "Husband asks about Christmas dinner",
    },
    {
        "id": "ref_04_breaking",
        "src": "01a0c5d0-c37a-76e7-9457-0b5888dcc309.jpg",
        "filename": "ref_04_breaking_point_closeup.jpg",
        "gen": "ref_04_breaking_1080x1920.png",
        "shot": "shot_04_breaking_point",
        "title": "Lauren close-up, exhausted",
    },
    {
        "id": "ref_05_phone",
        "src": "01a0c5d0-c345-7e83-a596-3eb500210ef6.jpg",
        "filename": "ref_05_friend_message_phone.jpg",
        "gen": "ref_05_phone_1080x1920.png",
        "shot": "shot_05_friend_message",
        "title": "Lauren reads a friend message on her phone",
    },
    {
        "id": "ref_06_cookies",
        "src": "01a0c5d0-c39d-7cc1-821f-aac583f1d3e2.jpg",
        "filename": "ref_06_cookies_lauren_kids.jpg",
        "gen": "ref_06_cookies_1080x1920.png",
        "shot": "shot_07_payoff",
        "title": "Cookie decorating with Lauren and the kids",
    },
    {
        "id": "ref_07_family_bake",
        "src": "01a0c5d0-c3b6-734f-975c-50988551dfbb.jpg",
        "filename": "ref_07_family_bake.jpg",
        "gen": "ref_07_family_bake_1080x1920.png",
        "shot": "shot_07_payoff_alt",
        "title": "Family baking payoff with husband",
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
        print(f"OK {spec['id']} {crop['source_wh']} -> 1080x1920", flush=True)
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
    MANIFEST.write_text(json.dumps({"status": "INGESTED", "project": "christmas_planner_mom_overwhelm_v2", "count": len(rows), "assets": rows}, indent=2) + "\n")
    print(f"INGESTED {len(rows)} stills (no video generated)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

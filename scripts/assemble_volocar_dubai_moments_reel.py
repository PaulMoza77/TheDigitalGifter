#!/usr/bin/env python3
"""Assemble VoloCar Dubai Moments reel v1 from six 5s I2V clips (local ffmpeg, silent 16:9)."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
CLIPS = ROOT / "public/assets/volocar/dubai-moments/clips"
FINAL = ROOT / "public/assets/volocar/dubai-moments/final"
POSTERS = ROOT / "public/assets/volocar/dubai-moments/posters"
MANIFEST = FINAL / "reel_v1_manifest.json"

# Order + trim windows (~22s total, cinematic pacing)
SHOTS = [
    ("01_volocar_dubai_moments_supercar_night_5s.mp4", 0.15, 3.8),
    ("02_volocar_dubai_moments_girls_night_5s.mp4", 0.2, 3.5),
    ("03_volocar_dubai_moments_the_arrival_5s.mp4", 0.25, 3.4),
    ("04_volocar_dubai_moments_morning_escape_5s.mp4", 0.1, 3.6),
    ("05_volocar_dubai_moments_marina_night_5s.mp4", 0.2, 3.5),
    ("06_volocar_dubai_moments_arrival_dubai_5s.mp4", 0.15, 3.7),
]

REEL_NAME = "volocar_dubai_moments_reel_v1_master.mp4"


def probe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,codec_name",
            "-show_entries",
            "format=duration,size",
            "-of",
            "json",
            str(path),
        ]
    )
    data = json.loads(raw)
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    return {
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "duration": float(fmt.get("duration") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
        "codec": stream.get("codec_name"),
    }


def main() -> int:
    FINAL.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    dest = FINAL / REEL_NAME

    inputs: list[str] = []
    filters: list[str] = []
    clip_ids: list[str] = []
    for i, (name, start, dur) in enumerate(SHOTS):
        src = CLIPS / name
        if not src.exists():
            raise FileNotFoundError(src)
        clip_ids.append(name.replace(".mp4", ""))
        inputs.extend(["-i", str(src)])
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            f"fps=30,scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p[v{i}]"
        )
    n = len(SHOTS)
    filters.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[out]")

    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        str(dest),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    poster = POSTERS / "volocar_dubai_moments_reel_v1_master.jpg"
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "1.0",
            "-i",
            str(dest),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(poster),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    pr = probe(dest)
    manifest = {
        "id": "volocar_dubai_moments_reel_v1_master",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "path": str(dest),
        "poster": str(poster),
        "probe": pr,
        "clips_used": clip_ids,
        "method": "ffmpeg_trim_concat_hardcut_16x9_silent",
        "audio": "none",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"REEL OK {dest} duration={pr['duration']:.2f}s {pr['width']}x{pr['height']}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

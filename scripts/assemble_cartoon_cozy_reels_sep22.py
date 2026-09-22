#!/usr/bin/env python3
"""Assemble 3 silent 1080x1920 Reels from QC-passed cartoon-cozy Kling masters.

Uses only PASSED 5s I2V shorts. Hard cuts. No text, no audio, no watermark.
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
MASTERS = ROOT / "public/assets/christmas/cartoon-cozy-sep22/masters"
FINALS = ROOT / "public/assets/christmas/cartoon-cozy-sep22/final"
POSTERS = ROOT / "public/assets/christmas/cartoon-cozy-sep22/posters"
LOG = ROOT / "public/assets/christmas/cartoon-cozy-sep22/generation_manifest.json"

C02 = MASTERS / "cozy_02_family_christmas_boardgame.mp4"
C03 = MASTERS / "cozy_03_tom_jerry_christmas_living_room.mp4"
C04 = MASTERS / "cozy_04_tom_jerry_storm_sleeping.mp4"
C05 = MASTERS / "cozy_05_tom_jerry_storm_bed.mp4"

# Distinct edits — different order, in-points, and emphasis. 12–15s each.
REELS = [
    {
        "id": "reel-cozy-emotional-01",
        "filename": "cartoon_cozy_emotional_reel_01.mp4",
        "poster": "reel-cozy-emotional-01.jpg",
        "title": "Cartoon cozy · emotional",
        "shots": [
            (C05, 0.08, 3.70, "short-cozy-05-tom-jerry-storm-bed"),
            (C04, 0.10, 3.60, "short-cozy-04-tom-jerry-storm-sleep"),
            (C02, 0.08, 3.80, "short-cozy-02-family-boardgame"),
            (C03, 0.08, 3.40, "short-cozy-03-tom-jerry-living-room"),
        ],
    },
    {
        "id": "reel-cozy-atmosphere-02",
        "filename": "cartoon_cozy_atmosphere_reel_02.mp4",
        "poster": "reel-cozy-atmosphere-02.jpg",
        "title": "Cartoon cozy · atmosphere",
        "shots": [
            (C04, 0.04, 3.90, "short-cozy-04-tom-jerry-storm-sleep"),
            (C05, 0.12, 3.50, "short-cozy-05-tom-jerry-storm-bed"),
            (C03, 1.60, 3.50, "short-cozy-03-tom-jerry-living-room"),
            (C02, 0.20, 3.60, "short-cozy-02-family-boardgame"),
        ],
    },
    {
        "id": "reel-cozy-characters-03",
        "filename": "cartoon_cozy_characters_reel_03.mp4",
        "poster": "reel-cozy-characters-03.jpg",
        "title": "Cartoon cozy · characters",
        "shots": [
            (C03, 0.05, 2.50, "short-cozy-03-tom-jerry-living-room"),
            (C05, 1.80, 2.90, "short-cozy-05-tom-jerry-storm-bed"),
            (C02, 0.50, 3.50, "short-cozy-02-family-boardgame"),
            (C04, 0.80, 3.70, "short-cozy-04-tom-jerry-storm-sleep"),
        ],
    },
]


def probe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,codec_name",
            "-show_entries",
            "format=duration,bit_rate,size",
            "-of",
            "json",
            str(path),
        ]
    )
    data = json.loads(raw)
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    fps_txt = stream.get("avg_frame_rate") or "0/1"
    if "/" in str(fps_txt):
        num, den = str(fps_txt).split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    else:
        fps = float(fps_txt or 0)
    return {
        "filename": path.name,
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "bitrate": int(fmt.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def export_reel(spec: dict) -> tuple[Path, dict]:
    dest = FINALS / spec["filename"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    shots = spec["shots"]
    for src, *_ in shots:
        if not src.exists():
            raise FileNotFoundError(src)

    inputs: list[str] = []
    filters: list[str] = []
    expected = 0.0
    for i, (src, start, dur, _lid) in enumerate(shots):
        inputs.extend(["-i", str(src)])
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            f"fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[v{i}]"
        )
        expected += dur

    n = len(shots)
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
        "-profile:v",
        "high",
        "-level",
        "4.2",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-s",
        "1080x1920",
        "-b:v",
        "18M",
        "-minrate",
        "14M",
        "-maxrate",
        "22M",
        "-bufsize",
        "36M",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    print("+ ffmpeg", dest.name, "expected", round(expected, 2), "s", flush=True)
    subprocess.check_call(cmd)
    info = probe(dest)
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{dest.name} not 1080x1920")
    if info["duration"] < 12.0 or info["duration"] > 15.5:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside 12–15s")
    if abs(info["fps"] - 30) > 0.05:
        raise RuntimeError(f"{dest.name} fps {info['fps']}")
    return dest, info


def poster(src: Path, dest: Path, t: float = 0.45) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> int:
    FINALS.mkdir(parents=True, exist_ok=True)
    log: dict = {}
    if LOG.exists():
        try:
            log = json.loads(LOG.read_text())
        except json.JSONDecodeError:
            log = {}

    reel_rows = []
    for spec in REELS:
        dest, info = export_reel(spec)
        poster_path = POSTERS / spec["poster"]
        poster(dest, poster_path, t=0.40)
        print(
            f"FFPROBE {info['filename']} {info['width']}x{info['height']} "
            f"{info['duration']:.3f}s {info['codec']} {info['fps']}fps size={info['size']}",
            flush=True,
        )
        reel_rows.append(
            {
                "id": spec["id"],
                "title": spec["title"],
                "file": str(dest),
                "poster": str(poster_path),
                "probe": info,
                "clips_used": [s[3] for s in spec["shots"]],
                "shots": [
                    {"src": s[0].name, "start": s[1], "duration": s[2], "library_id": s[3]}
                    for s in spec["shots"]
                ],
                "method": "ffmpeg_concat_hardcut_from_kling_i2v_masters",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    log["reels"] = reel_rows
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    print("REELS_OK", [r["id"] for r in reel_rows], flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

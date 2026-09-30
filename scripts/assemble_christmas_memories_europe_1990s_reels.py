#!/usr/bin/env python3
"""Assemble 3 silent 1080×1920 Reels from Christmas Memories Europe 1990s masters."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
BATCH = ROOT / "public/assets/christmas/christmas-memories-europe-1990s"
MASTERS = BATCH / "masters"
FINALS = BATCH / "final"
POSTERS = BATCH / "posters"
LOG = BATCH / "generation_manifest.json"


def master(name: str) -> Path:
    return MASTERS / f"{name}.mp4"


# shots: src, start, duration, zoom, clip_id, transition (cut|fade)
REELS = [
    {
        "id": "reel-cme1990s-cinematic-memory",
        "filename": "christmas_memories_cinematic_memory_reel_01.mp4",
        "title": "Christmas Memories · Cinematic Memory",
        "overlay": None,
        "xfade": 0.32,
        "min_dur": 15.0,
        "max_dur": 20.5,
        "shots": [
            (master("cme1990s_10_eve_window"), 0.06, 4.2, 1.04, "cme1990s_10_eve_window", "cut"),
            (master("cme1990s_04_christmas_morning"), 0.10, 3.6, 1.03, "cme1990s_04_christmas_morning", "fade"),
            (master("cme1990s_03_alpine_chalet"), 0.08, 3.8, 1.03, "cme1990s_03_alpine_chalet", "fade"),
            (master("cme1990s_02_paris_cafe"), 0.12, 3.5, 1.02, "cme1990s_02_paris_cafe", "fade"),
            (master("cme1990s_08_toy_shop"), 0.10, 3.9, 1.04, "cme1990s_08_toy_shop", "fade"),
        ],
    },
    {
        "id": "reel-cme1990s-dynamic-christmas",
        "filename": "christmas_memories_dynamic_christmas_reel_02.mp4",
        "title": "Christmas Memories · Dynamic Christmas",
        "overlay": None,
        "xfade": 0.10,
        "min_dur": 12.0,
        "max_dur": 16.5,
        "shots": [
            (master("cme1990s_01_london"), 0.04, 1.65, 1.06, "cme1990s_01_london", "cut"),
            (master("cme1990s_06_christmas_market"), 0.06, 1.55, 1.05, "cme1990s_06_christmas_market", "cut"),
            (master("cme1990s_05_christmas_train"), 0.08, 1.6, 1.04, "cme1990s_05_christmas_train", "cut"),
            (master("cme1990s_09_road_trip"), 0.06, 1.55, 1.05, "cme1990s_09_road_trip", "cut"),
            (master("cme1990s_07_nyc_apartment"), 0.10, 1.5, 1.03, "cme1990s_07_nyc_apartment", "cut"),
            (master("cme1990s_02_paris_cafe"), 0.08, 1.55, 1.04, "cme1990s_02_paris_cafe", "cut"),
            (master("cme1990s_10_eve_window"), 0.06, 1.7, 1.05, "cme1990s_10_eve_window", "cut"),
            (master("cme1990s_04_christmas_morning"), 0.12, 1.65, 1.04, "cme1990s_04_christmas_morning", "fade"),
        ],
    },
    {
        "id": "reel-cme1990s-coming-home",
        "filename": "christmas_memories_coming_home_reel_03.mp4",
        "title": "Christmas Memories · Coming Home",
        "overlay": None,
        "xfade": 0.26,
        "min_dur": 15.0,
        "max_dur": 20.5,
        "shots": [
            (master("cme1990s_03_alpine_chalet"), 0.08, 3.2, 1.03, "cme1990s_03_alpine_chalet", "cut"),
            (master("cme1990s_09_road_trip"), 0.06, 3.4, 1.04, "cme1990s_09_road_trip", "fade"),
            (master("cme1990s_05_christmas_train"), 0.10, 3.1, 1.03, "cme1990s_05_christmas_train", "fade"),
            (master("cme1990s_06_christmas_market"), 0.08, 3.0, 1.03, "cme1990s_06_christmas_market", "cut"),
            (master("cme1990s_01_london"), 0.12, 2.8, 1.02, "cme1990s_01_london", "fade"),
            (master("cme1990s_10_eve_window"), 0.06, 4.0, 1.05, "cme1990s_10_eve_window", "fade"),
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
            "stream=width,height",
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
    return {
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "bitrate": int(fmt.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def export_reel(reel: dict) -> dict:
    for shot in reel["shots"]:
        src = shot[0]
        if not src.exists():
            raise SystemExit(f"missing master {src}")
    dest = FINALS / reel["filename"]
    FINALS.mkdir(parents=True, exist_ok=True)
    xfade = float(reel["xfade"])
    inputs = []
    filters = []
    durs = []
    grade = "eq=contrast=1.03:brightness=0.005:saturation=1.04"
    for i, (src, start, duration, zoom, _cid, _mode) in enumerate(reel["shots"]):
        inputs.extend(["-i", str(src)])
        z = max(1.0, min(1.08, zoom))
        filters.append(
            f"[{i}:v]trim=start={start}:duration={duration},setpts=PTS-STARTPTS,fps=30,"
            f"scale=1080:1920:flags=lanczos,setsar=1,{grade},format=yuv420p[v{i}]"
        )
        durs.append(duration)
    current = "v0"
    offset = durs[0] - xfade
    for i in range(1, len(reel["shots"])):
        out = "out" if i == len(reel["shots"]) - 1 else f"x{i}"
        mode = reel["shots"][i][5]
        fd = xfade if mode == "fade" else min(0.08, xfade)
        filters.append(f"[{current}][v{i}]xfade=transition=fade:duration={fd:.3f}:offset={max(0.05, offset):.3f}[{out}]")
        current = out
        offset += durs[i] - fd
    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        f"[{current}]",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-b:v",
        "16M",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    print("+ ffmpeg", reel["id"], flush=True)
    subprocess.check_call(cmd)
    info = probe(dest)
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{reel['id']} not 1080x1920")
    if info["duration"] < reel["min_dur"] or info["duration"] > reel["max_dur"]:
        raise RuntimeError(f"{reel['id']} duration {info['duration']} outside range")
    poster = POSTERS / f"{reel['id']}.jpg"
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.35", "-i", str(dest), "-frames:v", "1", "-q:v", "3", str(poster)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    info["poster"] = str(poster.relative_to(ROOT))
    info["file"] = str(dest.relative_to(ROOT))
    return info


def main() -> int:
    report = []
    for reel in REELS:
        info = export_reel(reel)
        report.append(
            {
                "id": reel["id"],
                "title": reel["title"],
                "file": info["file"],
                "probe": info,
                "clips_used": [s[4] for s in reel["shots"]],
                "audio": "none",
            }
        )
        print(f"{reel['id']} {info['duration']:.2f}s", flush=True)
    log = json.loads(LOG.read_text()) if LOG.exists() else {}
    log["reels"] = report
    log["reels_assembled_at"] = datetime.now(timezone.utc).isoformat()
    log["status"] = "COMPLETE"
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

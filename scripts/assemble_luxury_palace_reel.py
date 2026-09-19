#!/usr/bin/env python3
"""Assemble the 12–15s luxury Christmas palace reel from five Kling 3.0 Pro masters."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
MASTERS = ROOT / "public/assets/christmas/luxury-palace/masters"
FINALS = ROOT / "public/assets/christmas/luxury-palace/final"
POSTERS = ROOT / "public/assets/christmas/luxury-palace/posters"
LOG = ROOT / "public/assets/christmas/luxury-palace/generation_manifest.json"

C1 = MASTERS / "palace_01_establish.mp4"
C2 = MASTERS / "palace_02_approach.mp4"
C3 = MASTERS / "palace_03_gates.mp4"
C4 = MASTERS / "palace_04_entrance.mp4"
C5 = MASTERS / "palace_05_hero.mp4"

# Strongest windows: skip the first ~0.2–0.4s (most morph-prone) and keep later hero hold.
# xfade 0.14s — almost invisible motion-matched dissolve, not a template wipe.
XFADE = 0.14
SHOTS = [
    (C1, 0.18, 2.55, "palace_01_establish"),
    (C2, 0.28, 2.55, "palace_02_approach"),
    (C3, 0.16, 2.65, "palace_03_gates"),
    (C4, 0.18, 3.15, "palace_04_entrance"),
    (C5, 0.40, 4.20, "palace_05_hero"),
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


def export_reel(dest: Path) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs: list[str] = []
    filters: list[str] = []
    durs: list[float] = []
    # Subtle shared grade: warm gold vs cool winter already in the stills.
    # Keep blacks rich, highlights natural, no HDR punch, no extra sharpen.
    grade = "eq=contrast=1.035:brightness=0.006:saturation=1.045:gamma=1.01"
    for i, (src, start, dur, _lid) in enumerate(SHOTS):
        if not src.exists():
            raise FileNotFoundError(src)
        inputs.extend(["-i", str(src)])
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            f"fps=30,scale=1080:1920:flags=lanczos,setsar=1,{grade},format=yuv420p[v{i}]"
        )
        durs.append(dur)

    current = "v0"
    offset = durs[0] - XFADE
    n = len(SHOTS)
    for i in range(1, n):
        nxt = f"v{i}"
        out = "out" if i == n - 1 else f"x{i}"
        filters.append(
            f"[{current}][{nxt}]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}[{out}]"
        )
        current = out
        if i < n - 1:
            offset = offset + durs[i] - XFADE

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
    print("+ ffmpeg", dest.name, flush=True)
    subprocess.check_call(cmd)
    info = probe(dest)
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{dest.name} not 1080x1920")
    if info["duration"] < 12.0 or info["duration"] > 15.2:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside 12–15s window")
    return info


def poster(src: Path, dest: Path, t: float = 12.6) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> int:
    FINALS.mkdir(parents=True, exist_ok=True)
    dest = FINALS / "luxury_christmas_palace_reel.mp4"
    info = export_reel(dest)
    poster(dest, POSTERS / "luxury_christmas_palace_reel.jpg", t=max(info["duration"] - 0.8, 0.4))
    row = {
        "id": "luxury-christmas-palace",
        "title": "Luxury Christmas palace journey",
        "file": str(dest),
        "probe": info,
        "xfade": XFADE,
        "shots": [{"src": s[0].name, "start": s[1], "duration": s[2], "id": s[3]} for s in SHOTS],
    }
    if LOG.exists():
        log = json.loads(LOG.read_text())
    else:
        log = {}
    log["reels"] = [row]
    log["reels_assembled_at"] = datetime.now(timezone.utc).isoformat()
    log["status"] = "COMPLETE"
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    print(
        f"MASTER {info['duration']:.3f}s {info['width']}x{info['height']} "
        f"{info['bitrate']/1e6:.2f}Mbps {dest}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

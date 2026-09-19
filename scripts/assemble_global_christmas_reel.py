#!/usr/bin/env python3
"""Assemble the 12–15s global Christmas journey reel from five Kling 3.0 Pro masters."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
MASTERS = ROOT / "public/assets/christmas/global-reel/masters"
FINALS = ROOT / "public/assets/christmas/global-reel/final"
POSTERS = ROOT / "public/assets/christmas/global-reel/posters"
QC = ROOT / "generated/global-christmas/qc"
LOG = ROOT / "public/assets/christmas/global-reel/generation_manifest.json"

C1 = MASTERS / "global_01_lapland.mp4"
C2 = MASTERS / "global_02_alps.mp4"
C3 = MASTERS / "global_03_home.mp4"
C4 = MASTERS / "global_04_plaza.mp4"
C5 = MASTERS / "global_05_white_house.mp4"

# Strongest windows after QC. Skip morph-prone first frames; avoid WH last 1.2s
# (plaque exits and a red edge artifact appears after ~3.6s).
# First second of the reel is Lapland fire + aurora. White House holds so the
# ending can breathe ~0.8s on architecture that is still intact.
XFADE = 0.12
SHOTS = [
    (C1, 0.08, 2.70, "global_01_lapland"),
    (C2, 0.16, 2.75, "global_02_alps"),
    (C3, 0.12, 2.60, "global_03_home"),
    (C4, 0.14, 2.80, "global_04_plaza"),
    (C5, 0.18, 3.35, "global_05_white_house"),
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
    grade = "eq=contrast=1.03:brightness=0.004:saturation=1.04:gamma=1.01"
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


def poster(src: Path, dest: Path, t: float) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def preview(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-profile:v",
            "high",
            "-pix_fmt",
            "yuv420p",
            "-s",
            "1080x1920",
            "-b:v",
            "4M",
            "-maxrate",
            "5M",
            "-bufsize",
            "8M",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )


def reel_contact_sheet(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-vf",
            "fps=1,scale=270:480,tile=5x3",
            "-frames:v",
            "1",
            "-q:v",
            "3",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> int:
    FINALS.mkdir(parents=True, exist_ok=True)
    QC.mkdir(parents=True, exist_ok=True)
    dest = FINALS / "global_christmas_journey_reel.mp4"
    preview_dest = FINALS / "global_christmas_journey_reel_preview.mp4"
    info = export_reel(dest)
    poster(dest, POSTERS / "global_christmas_journey_reel.jpg", t=max(info["duration"] - 0.85, 0.4))
    preview(dest, preview_dest)
    reel_contact_sheet(dest, QC / "reel_contact_sheet.jpg")
    row = {
        "id": "global-christmas-journey",
        "title": "Global Christmas journey",
        "file": str(dest),
        "preview": str(preview_dest),
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

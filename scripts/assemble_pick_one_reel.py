#!/usr/bin/env python3
"""Assemble the pick-one I2V Reel from four Kling 3.0 Pro masters.

Silent 1080x1920 hard-cut Reel with persistent hook + scene numbers 1–4.
Uses real I2V masters only — no still slideshow / Ken Burns fake motion.
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
MASTERS = ROOT / "public/assets/christmas/pick-one/masters"
FINALS = ROOT / "public/assets/christmas/pick-one/final"
POSTERS = ROOT / "public/assets/christmas/pick-one/posters"
LOG = ROOT / "public/assets/christmas/pick-one/generation_manifest.json"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
if not Path(FONT).exists():
    FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

C1 = MASTERS / "pick_one_01_cozy_cabin.mp4"
C2 = MASTERS / "pick_one_02_nyc_penthouse.mp4"
C3 = MASTERS / "pick_one_03_alpine_chalet.mp4"
C4 = MASTERS / "pick_one_04_christmas_mansion.mp4"

# Nearly full 5s masters; tiny trim for clean cuts. Hard cuts (no xfade morph).
SHOTS = [
    (C1, 0.08, 4.75, "short-pick-one-01-cozy-cabin", "1"),
    (C2, 0.08, 4.75, "short-pick-one-02-nyc-penthouse", "2"),
    (C3, 0.08, 4.75, "short-pick-one-03-alpine-chalet", "3"),
    (C4, 0.08, 4.75, "short-pick-one-04-christmas-mansion", "4"),
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
    for src, *_ in SHOTS:
        if not src.exists():
            raise FileNotFoundError(src)

    inputs: list[str] = []
    filters: list[str] = []
    for i, (src, start, dur, _lid, num) in enumerate(SHOTS):
        inputs.extend(["-i", str(src)])
        # Real I2V clip + persistent hook + scene number. No zoompan / Ken Burns.
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            f"fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p,"
            f"drawtext=fontfile={FONT}:text='YOU CAN ONLY PICK ONE':fontsize=42:"
            f"fontcolor=white@0.95:borderw=3:bordercolor=black@0.55:"
            f"x=(w-text_w)/2:y=h*0.08,"
            f"drawtext=fontfile={FONT}:text='{num}':fontsize=72:"
            f"fontcolor=white@0.95:borderw=4:bordercolor=black@0.55:"
            f"x=w*0.08:y=h*0.82,format=yuv420p[v{i}]"
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
    # 4 × 4.75s = 19.0s expected
    if info["duration"] < 18.0 or info["duration"] > 20.5:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside expected window")
    return info


def poster(src: Path, dest: Path, t: float = 0.45) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> int:
    FINALS.mkdir(parents=True, exist_ok=True)
    dest = FINALS / "you-can-only-pick-one-i2v.mp4"
    info = export_reel(dest)
    poster_path = POSTERS / "reel-pick-one-i2v.jpg"
    poster(dest, poster_path, t=0.45)
    print(
        f"FFPROBE {info['filename']} {info['width']}x{info['height']} "
        f"{info['duration']:.3f}s {info['codec']} {info['fps']}fps size={info['size']}",
        flush=True,
    )

    log: dict = {}
    if LOG.exists():
        try:
            log = json.loads(LOG.read_text())
        except json.JSONDecodeError:
            log = {}
    log["reel"] = {
        "id": "reel-pick-one-i2v",
        "file": str(dest),
        "poster": str(poster_path),
        "probe": info,
        "clips_used": [s[3] for s in SHOTS],
        "method": "ffmpeg_concat_hardcut_from_kling_i2v_masters",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    print("REEL_OK", dest, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Build 1080x1920 5s push-in shorts and a 15s reel (no Replicate required)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path("/workspace")
STILLS = ROOT / "public" / "assets" / "christmas" / "library-stills"
OUT = ROOT / "public" / "assets" / "christmas" / "instagram-reel-cut3"
KLING = ROOT / "public" / "assets" / "christmas" / "instagram-reel-kling-1080p"
POSTERS = OUT / "posters"


def run(cmd: list[str]) -> None:
    subprocess.check_call(cmd)


def probe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,bit_rate",
            "-show_entries",
            "format=duration,bit_rate",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(raw)


def make_short(src: Path, dest: Path) -> None:
    # 5s 1080x1920 slow push-in at 24fps. z starts at 1.0 and eases to ~1.12.
    vf = (
        "scale=1080:1920:flags=lanczos,"
        "zoompan=z='min(zoom+0.00048,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=120:s=1080x1920:fps=24,"
        "unsharp=5:5:0.4:5:5:0.0,"
        "format=yuv420p"
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(src),
            "-vf",
            vf,
            "-t",
            "5.04",
            "-r",
            "24",
            "-c:v",
            "libx264",
            "-profile:v",
            "high",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "8M",
            "-maxrate",
            "12M",
            "-bufsize",
            "16M",
            "-movflags",
            "+faststart",
            "-an",
            str(dest),
        ]
    )


def trim_master(src: Path, dest: Path, start: float, duration: float) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start:.2f}",
            "-i",
            str(src),
            "-t",
            f"{duration:.2f}",
            "-vf",
            "scale=1080:1920:flags=lanczos,setsar=1,fps=24,format=yuv420p",
            "-c:v",
            "libx264",
            "-profile:v",
            "high",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "12M",
            "-maxrate",
            "16M",
            "-bufsize",
            "20M",
            "-an",
            str(dest),
        ]
    )


def poster(src: Path, dest: Path) -> None:
    run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "0.4",
            "-i",
            str(src),
            "-frames:v",
            "1",
            "-q:v",
            "3",
            str(dest),
        ]
    )


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    work = ROOT / "generated" / "cut3"
    work.mkdir(parents=True, exist_ok=True)

    shorts = [
        ("clip_ice_nyc", STILLS / "nyc_girl_ice_skating.jpg"),
        ("clip_kids_sled", STILLS / "village_kids_sledding.jpg"),
        ("clip_prague_square", STILLS / "prague_old_town_carousel_market.jpg"),
    ]
    for slug, src in shorts:
        dest = OUT / f"{slug}.mp4"
        make_short(src, dest)
        poster(dest, POSTERS / f"{slug}.jpg")
        print("SHORT", dest, json.dumps(probe(dest))[:400])

    # 15s reel: ice → Prague → kids → existing Polar Express → Santa
    pieces = [
        (OUT / "clip_ice_nyc.mp4", 0.12, 3.0),
        (OUT / "clip_prague_square.mp4", 0.12, 3.0),
        (OUT / "clip_kids_sled.mp4", 0.12, 3.0),
        (KLING / "clip_01_train_raw.mp4", 0.18, 3.0),
        (KLING / "clip_02_santa_raw.mp4", 0.20, 3.0),
    ]
    concat_list = work / "concat.txt"
    lines = []
    for i, (src, start, dur) in enumerate(pieces):
        piece = work / f"piece_{i:02d}.mp4"
        trim_master(src, piece, start, dur)
        lines.append(f"file '{piece}'")
    concat_list.write_text("\n".join(lines) + "\n")
    final = OUT / "final_christmas_reel_cut3.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c:v",
            "libx264",
            "-profile:v",
            "high",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "12M",
            "-maxrate",
            "16M",
            "-bufsize",
            "20M",
            "-r",
            "24",
            "-movflags",
            "+faststart",
            "-an",
            str(final),
        ]
    )
    poster(final, POSTERS / "final.jpg")
    info = probe(final)
    (OUT / "ffprobe_cut3.json").write_text(json.dumps(info, indent=2))
    print("REEL", final, json.dumps(info)[:600])
    width = info["streams"][0]["width"]
    height = info["streams"][0]["height"]
    duration = float(info["format"]["duration"])
    if width != 1080 or height != 1920:
        raise SystemExit(f"bad reel size {width}x{height}")
    if duration < 14.5 or duration > 16.0:
        raise SystemExit(f"bad reel duration {duration}")
    print("OK", duration)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

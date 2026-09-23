#!/usr/bin/env python3
"""Assemble five ~30s silent 1080x1920 Christmas Express Reels.

Uses the 5 new Kling 3.0 Pro I2V shorts plus existing Library Christmas shorts.
Reuses the sep20 cinematic ffmpeg filtergraph (scale/crop, xfade, libx264, no audio).
Does not generate new paid footage.
Countdown overlay, if used, is computed at render time (days until Dec 25).
"""

from __future__ import annotations

import json
import subprocess
import time
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
PUBLIC = ROOT / "public"
CX = PUBLIC / "assets/christmas/christmas-express"
FINALS = CX / "final"
POSTERS = CX / "posters"
LOG = CX / "reels_manifest.json"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"

SHORTS: dict[str, Path] = {
    "short-cx-01-night-viaduct": CX / "masters/cx_01_night_viaduct.mp4",
    "short-cx-02-sunset-viaduct": CX / "masters/cx_02_sunset_viaduct.mp4",
    "short-cx-03-station": CX / "masters/cx_03_station.mp4",
    "short-cx-04-aurora-viaduct": CX / "masters/cx_04_aurora_viaduct.mp4",
    "short-cx-05-santa-gifts": CX / "masters/cx_05_santa_gifts.mp4",
    "short-cinematic-polar-express": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_01_polar_express.mp4",
    "short-cinematic-santa-london": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_06_santa_london.mp4",
    "short-cinematic-workshop": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_07_workshop.mp4",
    "short-npj-01-train-window": PUBLIC / "assets/christmas/np-journey/masters/npj_01_train_window.mp4",
    "short-npj-04-viaduct-wide": PUBLIC / "assets/christmas/np-journey/masters/npj_04_viaduct_wide.mp4",
    "short-npj-05-village-arrival": PUBLIC / "assets/christmas/np-journey/masters/npj_05_village_arrival.mp4",
    "short-npj-09-window-sleigh": PUBLIC / "assets/christmas/np-journey/masters/npj_09_window_sleigh.mp4",
    "short-npj-10-snowman": PUBLIC / "assets/christmas/np-journey/masters/npj_10_snowman.mp4",
    "short-christmas-master-06": PUBLIC / "assets/christmas/reels/masters/christmas_master_06.mp4",
    "short-christmas-master-07": PUBLIC / "assets/christmas/reels/masters/christmas_master_07.mp4",
    "short-christmas-master-08": PUBLIC / "assets/christmas/reels/masters/christmas_master_08.mp4",
    "short-christmas-master-10": PUBLIC / "assets/christmas/reels/masters/christmas_master_10.mp4",
    "short-santa-02-sleigh": PUBLIC / "assets/christmas/north-pole-santa/masters/santa_02_sleigh.mp4",
    "short-global-01-lapland": PUBLIC / "assets/christmas/global-reel/masters/global_01_lapland.mp4",
    "short-global-02-alps": PUBLIC / "assets/christmas/global-reel/masters/global_02_alps.mp4",
}


def days_until_christmas(today: date | None = None) -> int:
    today = today or datetime.now(timezone.utc).date()
    target = date(today.year, 12, 25)
    if today > target:
        target = date(today.year + 1, 12, 25)
    return (target - today).days


# shots: (library_id, start, duration, zoom, transition)
# Reel 2 is the only countdown treatment.
REELS = [
    {
        "id": "reel-christmas-express",
        "filename": "the-christmas-express-30s.mp4",
        "title": "The Christmas Express — 30s",
        "xfade": 0.08,
        "overlay": None,
        "shots": [
            ("short-cx-05-santa-gifts", 0.08, 3.45, 1.01, "cut"),
            ("short-cx-01-night-viaduct", 0.10, 3.40, 1.01, "cut"),
            ("short-cx-02-sunset-viaduct", 0.08, 3.40, 1.01, "cut"),
            ("short-cinematic-polar-express", 0.10, 3.35, 1.02, "cut"),
            ("short-cx-04-aurora-viaduct", 0.08, 3.40, 1.01, "cut"),
            ("short-npj-04-viaduct-wide", 0.10, 3.35, 1.02, "cut"),
            ("short-cx-03-station", 0.08, 3.40, 1.01, "cut"),
            ("short-christmas-master-10", 0.08, 3.35, 1.02, "cut"),
            ("short-npj-01-train-window", 0.12, 3.50, 1.03, "fade"),
        ],
    },
    {
        "id": "reel-christmas-is-coming",
        "filename": "christmas-is-coming-30s.mp4",
        "title": "Christmas Is Coming — 30s",
        "xfade": 0.08,
        "overlay": "countdown",
        "shots": [
            ("short-cx-03-station", 0.06, 3.40, 1.02, "cut"),
            ("short-christmas-master-06", 0.12, 3.35, 1.03, "cut"),
            ("short-cx-01-night-viaduct", 0.10, 3.35, 1.01, "cut"),
            ("short-cinematic-santa-london", 0.08, 3.40, 1.03, "cut"),
            ("short-cx-05-santa-gifts", 0.08, 3.40, 1.01, "cut"),
            ("short-christmas-master-08", 0.10, 3.35, 1.03, "cut"),
            ("short-npj-05-village-arrival", 0.10, 3.35, 1.02, "cut"),
            ("short-cinematic-workshop", 0.10, 3.35, 1.02, "cut"),
            ("short-christmas-master-07", 0.20, 3.55, 1.04, "fade"),
        ],
    },
    {
        "id": "reel-pov-christmas-looked-like-this",
        "filename": "pov-christmas-looked-like-this-30s.mp4",
        "title": "POV: Christmas Looked Like This — 30s",
        "xfade": 0.08,
        "overlay": None,
        "shots": [
            ("short-cinematic-santa-london", 0.04, 3.50, 1.04, "cut"),
            ("short-cx-04-aurora-viaduct", 0.08, 3.40, 1.01, "cut"),
            ("short-global-01-lapland", 0.10, 3.35, 1.02, "cut"),
            ("short-cx-02-sunset-viaduct", 0.08, 3.40, 1.01, "cut"),
            ("short-npj-04-viaduct-wide", 0.10, 3.35, 1.02, "cut"),
            ("short-global-02-alps", 0.10, 3.35, 1.02, "cut"),
            ("short-cinematic-polar-express", 0.10, 3.35, 1.02, "cut"),
            ("short-npj-09-window-sleigh", 0.10, 3.35, 1.03, "cut"),
            ("short-cinematic-workshop", 0.12, 3.50, 1.03, "fade"),
        ],
    },
    {
        "id": "reel-magic-getting-closer",
        "filename": "the-magic-is-getting-closer-30s.mp4",
        "title": "The Magic Is Getting Closer — 30s",
        "xfade": 0.08,
        "overlay": None,
        "shots": [
            ("short-christmas-master-08", 0.06, 3.45, 1.03, "cut"),
            ("short-santa-02-sleigh", 0.08, 3.35, 1.02, "cut"),
            ("short-cinematic-santa-london", 0.08, 3.40, 1.03, "cut"),
            ("short-cx-05-santa-gifts", 0.08, 3.40, 1.01, "cut"),
            ("short-cx-03-station", 0.10, 3.35, 1.01, "cut"),
            ("short-npj-05-village-arrival", 0.10, 3.35, 1.02, "cut"),
            ("short-christmas-master-07", 0.18, 3.45, 1.04, "cut"),
            ("short-npj-10-snowman", 0.10, 3.35, 1.03, "cut"),
            ("short-cx-01-night-viaduct", 0.10, 3.45, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-all-aboard-christmas",
        "filename": "all-aboard-for-christmas-30s.mp4",
        "title": "All Aboard for Christmas — 30s",
        "xfade": 0.06,
        "overlay": None,
        "shots": [
            ("short-cx-05-santa-gifts", 0.04, 3.40, 1.02, "cut"),
            ("short-cx-04-aurora-viaduct", 0.06, 3.35, 1.01, "cut"),
            ("short-cinematic-santa-london", 0.04, 3.40, 1.03, "cut"),
            ("short-cx-02-sunset-viaduct", 0.06, 3.35, 1.01, "cut"),
            ("short-cx-01-night-viaduct", 0.06, 3.35, 1.01, "cut"),
            ("short-cinematic-polar-express", 0.08, 3.35, 1.02, "cut"),
            ("short-cx-03-station", 0.06, 3.40, 1.01, "cut"),
            ("short-christmas-master-10", 0.06, 3.35, 1.02, "cut"),
            ("short-npj-04-viaduct-wide", 0.10, 3.50, 1.03, "fade"),
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
            "stream=width,height,avg_frame_rate,codec_name,nb_frames",
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
        "nb_frames": stream.get("nb_frames"),
    }


def shot_filter(i: int, start: float, dur: float, zoom: float) -> str:
    z = max(1.0, min(zoom, 1.08))
    return (
        f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
        f"fps=30,scale=1080*{z:.3f}:1920*{z:.3f}:flags=lanczos,"
        f"crop=1080:1920:x='(in_w-1080)*t/{dur:.3f}*0.85':y='(in_h-1920)*t/{dur:.3f}*0.45',"
        f"setsar=1,eq=contrast=1.03:saturation=1.04:gamma=0.98,unsharp=5:5:0.35:5:5:0.0,"
        f"format=yuv420p,settb=1/30,fps=30[v{i}]"
    )


def clamp_shots(shots: list[tuple]) -> list[tuple]:
    out = []
    for lid, start, dur, zoom, mode in shots:
        src = SHORTS[lid]
        info = probe(src)
        max_dur = max(0.4, info["duration"] - start - 0.04)
        used = min(dur, max_dur)
        if used < 0.4:
            raise RuntimeError(f"{lid} too short after clamp ({info['duration']}s)")
        out.append((src, start, used, zoom, lid, mode))
    return out


def countdown_text() -> str:
    n = days_until_christmas()
    return f"{n} days until Christmas"


def export_reel(reel: dict) -> dict:
    dest = FINALS / reel["filename"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    shots = clamp_shots(reel["shots"])
    xfade = float(reel["xfade"])
    inputs: list[str] = []
    filters: list[str] = []
    durs: list[float] = []
    modes: list[str] = []
    for i, (src, start, dur, zoom, _lid, mode) in enumerate(shots):
        inputs.extend(["-i", str(src)])
        filters.append(shot_filter(i, start, dur, zoom))
        durs.append(dur)
        modes.append(mode)

    n = len(shots)
    current = "v0"
    offset = durs[0]
    for i in range(1, n):
        nxt = f"v{i}"
        out = "base" if i == n - 1 else f"x{i}"
        fade_dur = xfade if modes[i] == "fade" else min(0.08, xfade)
        fade_at = max(0.05, offset - fade_dur)
        filters.append(
            f"[{current}][{nxt}]xfade=transition=fade:duration={fade_dur:.3f}:offset={fade_at:.3f}[{out}]"
        )
        offset = offset + durs[i] - fade_dur
        current = out

    overlay_used = None
    if reel.get("overlay") == "countdown" and FONT and Path(FONT).exists():
        text = countdown_text().replace(":", r"\:").replace("'", r"\'")
        filters.append(
            f"[base]drawtext=fontfile={FONT}:text='{text}':fontsize=36:"
            f"fontcolor=white@0.88:borderw=2:bordercolor=black@0.40:"
            f"x=(w-text_w)/2:y=h*0.08:enable='between(t,0.40,2.20)',format=yuv420p[out]"
        )
        mapped = "[out]"
        overlay_used = countdown_text()
    else:
        filters.append("[base]format=yuv420p[out]")
        mapped = "[out]"

    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        mapped,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
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
        "16M",
        "-minrate",
        "12M",
        "-maxrate",
        "20M",
        "-bufsize",
        "32M",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    print("+ ffmpeg", dest.name, flush=True)
    subprocess.check_call(cmd)
    info = probe(dest)
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{dest.name} not 1080x1920")
    if info["duration"] < 28.0 or info["duration"] > 32.5:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside ~30s window")
    streams = json.loads(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(dest)]
        )
    )
    if any(s.get("codec_type") == "audio" for s in streams.get("streams") or []):
        raise RuntimeError(f"{dest.name} unexpectedly has audio")
    poster = POSTERS / f"{reel['id']}.jpg"
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.35", "-i", str(dest), "-frames:v", "1", "-q:v", "3", str(poster)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    info["poster"] = str(poster)
    info["clips_used"] = [s[4] for s in shots]
    info["clip_count"] = len(shots)
    info["overlay"] = overlay_used
    return info


def main() -> int:
    t0 = time.time()
    FINALS.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    missing = [lid for lid, p in SHORTS.items() if not p.exists()]
    if missing:
        raise FileNotFoundError("Missing shorts: " + ", ".join(missing))
    report = []
    for reel in REELS:
        info = export_reel(reel)
        row = {
            "id": reel["id"],
            "title": reel["title"],
            "file": str(FINALS / reel["filename"]),
            "probe": {
                "duration": info["duration"],
                "width": info["width"],
                "height": info["height"],
                "bitrate": info["bitrate"],
                "size": info["size"],
                "codec": info["codec"],
                "fps": info["fps"],
            },
            "clips_used": info["clips_used"],
            "clip_count": info["clip_count"],
            "overlay": info.get("overlay"),
            "audio": "none",
            "poster": info["poster"],
        }
        report.append(row)
        print(
            f"{reel['id']} {info['duration']:.3f}s {info['width']}x{info['height']} "
            f"clips={info['clip_count']} overlay={info.get('overlay')}",
            flush=True,
        )

    elapsed = time.time() - t0
    payload = {
        "reels": report,
        "reels_assembled_at": datetime.now(timezone.utc).isoformat(),
        "days_until_christmas": days_until_christmas(),
        "status": "COMPLETE",
        "execution_seconds": round(elapsed, 2),
        "audio": "none",
        "model": "kling-video/v3.0/pro/image-to-video",
    }
    LOG.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"All 5 reels written in {elapsed:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

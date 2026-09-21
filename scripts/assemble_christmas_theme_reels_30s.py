#!/usr/bin/env python3
"""Assemble five ~30s silent 1080x1920 Christmas Reels from existing Library Shorts.

Reuses the sep20 cinematic ffmpeg filtergraph (scale/crop, xfade, libx264, no audio).
Does not generate new footage.
"""

from __future__ import annotations

import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
PUBLIC = ROOT / "public"
FINALS = ROOT / "public/assets/christmas/reels/final"
POSTERS = ROOT / "public/assets/christmas/reels/posters"
LOG = ROOT / "public/assets/christmas/reels/theme_30s_manifest.json"

SHORTS: dict[str, Path] = {
    "short-cinematic-santa-london": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_06_santa_london.mp4",
    "short-cinematic-polar-express": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_01_polar_express.mp4",
    "short-cinematic-workshop": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_07_workshop.mp4",
    "short-cinematic-rockefeller": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_04_rockefeller.mp4",
    "short-cinematic-plaza-hotel": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_05_plaza_hotel.mp4",
    "short-cinematic-home-alone-house": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_03_home_alone_house.mp4",
    "short-cinematic-coca-cola-truck": PUBLIC / "assets/christmas/cinematic-sep20/masters/cinematic_02_coca_cola_truck.mp4",
    "short-npj-01-train-window": PUBLIC / "assets/christmas/np-journey/masters/npj_01_train_window.mp4",
    "short-npj-02-station": PUBLIC / "assets/christmas/np-journey/masters/npj_02_station.mp4",
    "short-npj-03-aurora-window": PUBLIC / "assets/christmas/np-journey/masters/npj_03_aurora_window.mp4",
    "short-npj-04-viaduct-wide": PUBLIC / "assets/christmas/np-journey/masters/npj_04_viaduct_wide.mp4",
    "short-npj-05-village-arrival": PUBLIC / "assets/christmas/np-journey/masters/npj_05_village_arrival.mp4",
    "short-npj-06-workshop-street": PUBLIC / "assets/christmas/np-journey/masters/npj_06_workshop_street.mp4",
    "short-npj-09-window-sleigh": PUBLIC / "assets/christmas/np-journey/masters/npj_09_window_sleigh.mp4",
    "short-npj-10-snowman": PUBLIC / "assets/christmas/np-journey/masters/npj_10_snowman.mp4",
    "short-npj-11-plaza": PUBLIC / "assets/christmas/np-journey/masters/npj_11_plaza.mp4",
    "short-christmas-master-01": PUBLIC / "assets/christmas/reels/masters/christmas_master_01.mp4",
    "short-christmas-master-02": PUBLIC / "assets/christmas/reels/masters/christmas_master_02.mp4",
    "short-christmas-master-03": PUBLIC / "assets/christmas/reels/masters/christmas_master_03.mp4",
    "short-christmas-master-05": PUBLIC / "assets/christmas/reels/masters/christmas_master_05.mp4",
    "short-christmas-master-06": PUBLIC / "assets/christmas/reels/masters/christmas_master_06.mp4",
    "short-christmas-master-07": PUBLIC / "assets/christmas/reels/masters/christmas_master_07.mp4",
    "short-christmas-master-08": PUBLIC / "assets/christmas/reels/masters/christmas_master_08.mp4",
    "short-christmas-master-09": PUBLIC / "assets/christmas/reels/masters/christmas_master_09.mp4",
    "short-christmas-master-10": PUBLIC / "assets/christmas/reels/masters/christmas_master_10.mp4",
    "short-global-01-lapland": PUBLIC / "assets/christmas/global-reel/masters/global_01_lapland.mp4",
    "short-global-02-alps": PUBLIC / "assets/christmas/global-reel/masters/global_02_alps.mp4",
    "short-global-03-home": PUBLIC / "assets/christmas/global-reel/masters/global_03_home.mp4",
    "short-global-04-plaza": PUBLIC / "assets/christmas/global-reel/masters/global_04_plaza.mp4",
    "short-palace-01-establish": PUBLIC / "assets/christmas/luxury-palace/masters/palace_01_establish.mp4",
    "short-palace-02-approach": PUBLIC / "assets/christmas/luxury-palace/masters/palace_02_approach.mp4",
    "short-palace-04-entrance": PUBLIC / "assets/christmas/luxury-palace/masters/palace_04_entrance.mp4",
    "short-palace-05-hero": PUBLIC / "assets/christmas/luxury-palace/masters/palace_05_hero.mp4",
    "short-santa-02-sleigh": PUBLIC / "assets/christmas/north-pole-santa/masters/santa_02_sleigh.mp4",
    "short-ice-nyc": PUBLIC / "assets/christmas/instagram-reel-cut3/clip_ice_nyc.mp4",
    "short-kids-sled": PUBLIC / "assets/christmas/instagram-reel-cut3/clip_kids_sled.mp4",
    "reel-kling-01-train": PUBLIC / "assets/christmas/instagram-reel-kling-1080p/clip_01_train_raw.mp4",
    "reel-kling-02-santa": PUBLIC / "assets/christmas/instagram-reel-kling-1080p/clip_02_santa_raw.mp4",
    "reel-kling-04-chalet": PUBLIC / "assets/christmas/instagram-reel-kling-1080p/clip_04_chalet_raw.mp4",
    "reel-01": PUBLIC / "assets/christmas/instagram-reel/clip_01.mp4",
    "reel-03": PUBLIC / "assets/christmas/instagram-reel/clip_03.mp4",
    "reel-04": PUBLIC / "assets/christmas/instagram-reel/clip_04.mp4",
    "reel-06": PUBLIC / "assets/christmas/instagram-reel/clip_06.mp4",
    "reel-cozy-01": PUBLIC / "assets/christmas/cozy-reel/clip1.mp4",
    "reel-cozy-03": PUBLIC / "assets/christmas/cozy-reel/clip3.mp4",
}

# shots: (library_id, start, duration, zoom, transition)
REELS = [
    {
        "id": "reel-christmas-magic-30s",
        "filename": "christmas-magic-30s.mp4",
        "title": "Christmas Magic — 30s",
        "xfade": 0.10,
        "shots": [
            ("short-cinematic-santa-london", 0.08, 3.55, 1.03, "cut"),
            ("short-cinematic-polar-express", 0.10, 3.45, 1.03, "fade"),
            ("short-npj-04-viaduct-wide", 0.08, 3.40, 1.02, "cut"),
            ("short-npj-05-village-arrival", 0.10, 3.40, 1.03, "fade"),
            ("short-cinematic-workshop", 0.10, 3.35, 1.02, "cut"),
            ("short-christmas-master-08", 0.08, 3.45, 1.03, "fade"),
            ("short-cinematic-rockefeller", 0.12, 3.40, 1.03, "cut"),
            ("short-npj-11-plaza", 0.10, 3.40, 1.02, "fade"),
            ("short-christmas-master-07", 0.20, 3.55, 1.04, "fade"),
        ],
    },
    {
        "id": "reel-christmas-new-york-30s",
        "filename": "christmas-new-york-30s.mp4",
        "title": "Christmas in New York — 30s",
        "xfade": 0.10,
        "shots": [
            ("short-cinematic-plaza-hotel", 0.08, 3.70, 1.03, "cut"),
            ("reel-01", 0.04, 2.05, 1.02, "cut"),
            ("short-cinematic-rockefeller", 0.10, 3.70, 1.03, "fade"),
            ("short-ice-nyc", 0.08, 3.75, 1.02, "cut"),
            ("short-christmas-master-02", 0.08, 3.70, 1.03, "fade"),
            ("short-cinematic-coca-cola-truck", 0.08, 3.65, 1.03, "cut"),
            ("short-global-04-plaza", 0.10, 3.65, 1.02, "fade"),
            ("reel-06", 0.04, 2.05, 1.02, "cut"),
            ("short-npj-11-plaza", 0.12, 3.75, 1.04, "fade"),
        ],
    },
    {
        "id": "reel-christmas-escape-30s",
        "filename": "christmas-escape-30s.mp4",
        "title": "Christmas Escape — 30s",
        "xfade": 0.12,
        "shots": [
            ("short-global-01-lapland", 0.10, 3.50, 1.03, "cut"),
            ("short-npj-04-viaduct-wide", 0.08, 3.40, 1.03, "fade"),
            ("short-global-02-alps", 0.10, 3.45, 1.02, "cut"),
            ("short-christmas-master-01", 0.12, 3.40, 1.03, "fade"),
            ("reel-kling-04-chalet", 0.10, 3.35, 1.02, "cut"),
            ("short-npj-01-train-window", 0.08, 3.40, 1.03, "fade"),
            ("short-cinematic-polar-express", 0.12, 3.35, 1.03, "cut"),
            ("short-christmas-master-10", 0.08, 3.40, 1.02, "fade"),
            ("short-npj-03-aurora-window", 0.10, 3.55, 1.04, "fade"),
        ],
    },
    {
        "id": "reel-christmas-dream-home-30s",
        "filename": "christmas-dream-home-30s.mp4",
        "title": "Christmas Dream Home — 30s",
        "xfade": 0.12,
        "shots": [
            ("short-cinematic-home-alone-house", 0.08, 3.45, 1.04, "cut"),
            ("short-palace-01-establish", 0.08, 3.40, 1.03, "fade"),
            ("short-palace-02-approach", 0.10, 3.35, 1.02, "cut"),
            ("short-palace-04-entrance", 0.10, 3.35, 1.03, "fade"),
            ("short-palace-05-hero", 0.08, 3.40, 1.03, "cut"),
            ("short-global-03-home", 0.10, 3.40, 1.02, "fade"),
            ("reel-cozy-01", 0.20, 3.45, 1.03, "fade"),
            ("reel-04", 0.04, 2.05, 1.02, "cut"),
            ("reel-03", 0.04, 2.05, 1.02, "cut"),
            ("reel-cozy-03", 0.18, 3.50, 1.04, "fade"),
        ],
    },
    {
        "id": "reel-christmas-childhood-30s",
        "filename": "christmas-childhood-30s.mp4",
        "title": "Christmas Childhood — 30s",
        "xfade": 0.10,
        "shots": [
            ("short-christmas-master-10", 0.06, 3.35, 1.03, "cut"),
            ("short-christmas-master-09", 0.10, 3.30, 1.03, "fade"),
            ("reel-kling-01-train", 0.08, 3.30, 1.02, "cut"),
            ("short-npj-02-station", 0.10, 3.25, 1.03, "fade"),
            ("reel-kling-02-santa", 0.08, 3.25, 1.03, "cut"),
            ("short-santa-02-sleigh", 0.10, 3.30, 1.02, "fade"),
            ("short-kids-sled", 0.08, 3.30, 1.03, "cut"),
            ("short-christmas-master-05", 0.10, 3.30, 1.02, "fade"),
            ("short-npj-10-snowman", 0.08, 3.30, 1.03, "cut"),
            ("short-npj-09-window-sleigh", 0.15, 3.45, 1.04, "fade"),
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
    z = max(1.0, min(zoom, 1.12))
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

    filters.append("[base]format=yuv420p[out]")
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
    poster = POSTERS / f"{reel['id']}.jpg"
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.35", "-i", str(dest), "-frames:v", "1", "-q:v", "3", str(poster)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    info["poster"] = str(poster)
    info["clips_used"] = [s[4] for s in shots]
    info["clip_count"] = len(shots)
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
            "overlay": None,
            "audio": "none",
            "poster": info["poster"],
        }
        report.append(row)
        print(
            f"{reel['id']} {info['duration']:.3f}s {info['width']}x{info['height']} "
            f"clips={info['clip_count']} {info['clips_used']}",
            flush=True,
        )

    elapsed = time.time() - t0
    payload = {
        "reels": report,
        "reels_assembled_at": datetime.now(timezone.utc).isoformat(),
        "status": "COMPLETE",
        "execution_seconds": round(elapsed, 2),
        "audio": "none",
    }
    LOG.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"All 5 reels written in {elapsed:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

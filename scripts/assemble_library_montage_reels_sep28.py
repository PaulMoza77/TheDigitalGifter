#!/usr/bin/env python3
"""Assemble 10 distinct ~15–20s Christmas Reels from existing Library short clips only.

No Higgsfield/Kling generation. Uses ffmpeg trim/concat/xfade + CC0 Christmas music.
Outputs to public/assets/christmas/library-montage-sep28/ and writes catalog + QC manifest.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
PUBLIC = ROOT / "public"
OUT = PUBLIC / "assets/christmas/library-montage-sep28"
FINALS = OUT / "final"
POSTERS = OUT / "posters"
SILENT = OUT / "silent"
MANIFEST = OUT / "montage_manifest.json"
CATALOG_TS = ROOT / "src/features/admin-library/libraryMontageSep28Catalog.ts"

MUSIC_DIR = PUBLIC / "assets/music/christmas"
MUSIC_BY_MOOD = {
    "calm": "silent-night-lofi.mp3",
    "cozy": "god-rest-ye-merry-gentlemen-synthwave.mp3",
    "nostalgic": "auld-lang-syne-lofi.mp3",
    "emotional": "o-holy-night-lofi.mp3",
    "warm": "angels-we-have-heard-lofi.mp3",
    "upbeat": "joy-to-the-world-synthwave.mp3",
    "magical": "the-first-noel-synthwave.mp3",
    "cinematic": "we-three-kings-synthwave.mp3",
}


def load_short_paths() -> dict[str, Path]:
    text = (ROOT / "src/features/admin-library/catalog.ts").read_text(encoding="utf-8")
    text += (ROOT / "src/features/admin-library/christmas20BatchCatalog.ts").read_text(encoding="utf-8")
    pairs = re.findall(r'id: "(short-[^"]+)"[\s\S]*?src: "(/assets/[^"]+\.mp4)"', text)
    out: dict[str, Path] = {}
    for lid, src in pairs:
        out.setdefault(lid, PUBLIC / src.lstrip("/"))
    return out


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
        "duration": float(fmt.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "bitrate": int(fmt.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def has_audio(path: Path) -> bool:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            str(path),
        ],
        stderr=subprocess.DEVNULL,
    )
    return b"audio" in raw


def shot_filter(i: int, start: float, dur: float, zoom: float) -> str:
    z = max(1.0, min(zoom, 1.08))
    return (
        f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
        f"fps=30,scale=1080*{z:.3f}:1920*{z:.3f}:flags=lanczos,"
        f"crop=1080:1920:x='(in_w-1080)*t/{dur:.3f}*0.82':y='(in_h-1920)*t/{dur:.3f}*0.42',"
        f"setsar=1,eq=contrast=1.03:saturation=1.04:gamma=0.98,unsharp=5:5:0.32:5:5:0.0,"
        f"format=yuv420p,settb=1/30,fps=30[v{i}]"
    )


def clamp_shots(shorts: dict[str, Path], shots: list[tuple]) -> list[tuple]:
    out = []
    for lid, start, dur, zoom, mode in shots:
        src = shorts[lid]
        if not src.exists():
            raise FileNotFoundError(f"{lid} -> {src}")
        info = probe(src)
        max_dur = max(0.35, info["duration"] - start - 0.05)
        used = min(dur, max_dur)
        if used < 0.35:
            raise RuntimeError(f"{lid} too short after clamp ({info['duration']}s start={start})")
        out.append((src, start, used, zoom, lid, mode))
    return out


def export_silent_reel(dest: Path, clamped: list[tuple], xfade_default: float = 0.12) -> float:
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs: list[str] = []
    filters: list[str] = []
    durs: list[float] = []
    modes: list[str] = []
    for i, (src, start, dur, zoom, _lid, mode) in enumerate(clamped):
        inputs.extend(["-i", str(src)])
        filters.append(shot_filter(i, start, dur, zoom))
        durs.append(dur)
        modes.append(mode)

    n = len(clamped)
    if n == 1:
        filters.append("[v0]format=yuv420p[out]")
    else:
        current = "v0"
        acc = durs[0]
        for i in range(1, n):
            nxt = f"v{i}"
            out_label = "base" if i == n - 1 else f"c{i}"
            if modes[i] == "fade":
                fade_dur = min(0.28, xfade_default + 0.06)
                fade_at = max(0.04, acc - fade_dur)
                filters.append(
                    f"[{current}][{nxt}]xfade=transition=fade:duration={fade_dur:.3f}:offset={fade_at:.3f}[{out_label}]"
                )
                acc = acc + durs[i] - fade_dur
            else:
                tmp = f"t{i}"
                filters.append(f"[{current}][{nxt}]concat=n=2:v=1:a=0[{tmp}]")
                filters.append(f"[{tmp}]settb=1/30,fps=30[{out_label}]")
                acc = acc + durs[i]
            current = out_label
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
    print("+ ffmpeg silent", dest.name, flush=True)
    subprocess.check_call(cmd)
    return sum(durs)


def mix_music(video: Path, music: Path, out: Path, duration: float) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    fade_in, fade_out = 0.8, 1.8
    fade_out_start = max(0, duration - fade_out)
    filt = (
        f"[1:a]afade=t=in:st=0:d={fade_in},afade=t=out:st={fade_out_start}:d={fade_out},"
        f"atrim=0:{duration},asetpts=PTS-STARTPTS,volume=0.88[aout]"
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(music),
            "-filter_complex",
            filt,
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-t",
            str(duration),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def blackdetect(path: Path) -> list[dict]:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(path),
            "-vf",
            "blackdetect=d=0.08:pix_th=0.10",
            "-an",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    hits = []
    for line in (proc.stderr or "").splitlines():
        if "blackdetect" in line and "black_start" in line:
            hits.append({"line": line.strip()})
    return hits


def poster(src: Path, dest: Path, t: float = 0.45) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


# shots: (library_id, start, duration, zoom, transition cut|fade)
REELS = [
    {
        "id": "reel-lib-montage-01-express-rush",
        "filename": "reel-lib-montage-01-express-rush.mp4",
        "title": "Express Rush · 17s montage",
        "concept": "Energetic train crescendo — flash hook → alpine hold → station payoff",
        "mood": "upbeat",
        "pacing": "fast hook (0.8–1.2s cuts) → 3.6s hero viaduct → rapid middle → 5.7s station outro",
        "shots": [
            ("short-cx-05-santa-gifts", 0.04, 1.15, 1.03, "cut"),
            ("short-cx-04-aurora-viaduct", 0.06, 0.85, 1.02, "cut"),
            ("short-npj-04-viaduct-wide", 0.12, 1.05, 1.03, "cut"),
            ("short-c20-06-viaduct-village", 0.18, 3.60, 1.01, "cut"),
            ("short-cx-01-night-viaduct", 0.08, 0.95, 1.02, "cut"),
            ("short-c20-04-viaduct-sunset-peaks", 0.22, 2.40, 1.02, "cut"),
            ("short-npj-01-train-window", 0.14, 1.35, 1.04, "cut"),
            ("short-cx-03-station", 0.10, 5.75, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-02-fireside-embrace",
        "filename": "reel-lib-montage-02-fireside-embrace.mp4",
        "title": "Fireside Embrace · 16s montage",
        "concept": "Cinematic emotional — slow cozy open, tender middle flashes, cabin hero",
        "mood": "emotional",
        "pacing": "4.2s library-dog open → 1s nostalgia cuts → 3.3s dinner → 4.1s alpine fade out",
        "shots": [
            ("short-c20-16-library-dog", 0.30, 4.20, 1.01, "fade"),
            ("short-c20-14-stairs-morning", 0.15, 1.05, 1.03, "cut"),
            ("short-c20-13-home-alone-tv", 0.10, 0.95, 1.02, "cut"),
            ("short-christmas-master-04", 0.12, 1.15, 1.03, "cut"),
            ("short-cozy-04-tom-jerry-storm-sleep", 0.08, 1.00, 1.02, "cut"),
            ("short-c20-15-family-dinner", 0.20, 3.30, 1.02, "cut"),
            ("short-c20-12-alpine-cabin", 0.25, 4.15, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-03-nyc-luxe",
        "filename": "reel-lib-montage-03-nyc-luxe.mp4",
        "title": "NYC Luxe Snow · 19s montage",
        "concept": "Premium Manhattan atmospheric — iconic hook stack, mansion breathing room",
        "mood": "cinematic",
        "pacing": "1s iconic flashes → 3.8s G-Wagon hero → mixed NYC texture → 5.3s penthouse hold",
        "shots": [
            ("short-c20-17-saks-rockefeller", 0.05, 1.25, 1.04, "cut"),
            ("short-c20-08-radio-city", 0.08, 1.00, 1.03, "cut"),
            ("short-nyc-winter-1990-02-rockefeller-tree", 0.06, 0.90, 1.03, "cut"),
            ("short-c20-05-mansion-gwagon", 0.15, 3.80, 1.01, "cut"),
            ("short-c20-10-penthouse-empire", 0.10, 1.10, 1.03, "cut"),
            ("short-c20-01-ny-awning", 0.12, 0.85, 1.02, "cut"),
            ("short-cinematic-plaza-hotel", 0.05, 1.05, 1.03, "cut"),
            ("short-c20-11-mansion-gate", 0.20, 2.60, 1.02, "cut"),
            ("short-c20-10-penthouse-empire", 2.00, 5.35, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-04-santa-sprint",
        "filename": "reel-lib-montage-04-santa-sprint.mp4",
        "title": "Santa Sprint · 16s montage",
        "concept": "Magical workshop energy — sleigh hook, rapid workshop montage, London hero",
        "mood": "magical",
        "pacing": "sub-1s workshop cuts → 3.5s London slow → 4s sleigh reprise",
        "shots": [
            ("short-santa-02-sleigh", 0.02, 1.10, 1.05, "cut"),
            ("short-cinematic-santa-london", 0.03, 0.95, 1.04, "cut"),
            ("short-cx-05-santa-gifts", 0.05, 0.85, 1.02, "cut"),
            ("short-npj-09-window-sleigh", 0.08, 1.05, 1.04, "cut"),
            ("short-santa-01-workshop", 0.10, 1.00, 1.03, "cut"),
            ("short-cinematic-workshop", 0.06, 0.90, 1.03, "cut"),
            ("short-npj-07-workshop-list", 0.12, 0.95, 1.03, "cut"),
            ("short-npj-06-workshop-street", 0.08, 1.10, 1.03, "cut"),
            ("short-cinematic-santa-london", 1.50, 3.50, 1.02, "cut"),
            ("short-santa-02-sleigh", 1.00, 5.45, 1.03, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-05-aurora-pulse",
        "filename": "reel-lib-montage-05-aurora-pulse.mp4",
        "title": "Aurora Pulse · 18s montage",
        "concept": "Slow aurora hook → accelerating North Pole middle → village payoff",
        "mood": "nostalgic",
        "pacing": "5s aurora hold → 0.8–1s pulse cuts → 5.6s arrival fade",
        "shots": [
            ("short-npj-03-aurora-window", 0.05, 5.00, 1.02, "fade"),
            ("short-npj-02-station", 0.10, 0.95, 1.03, "cut"),
            ("short-npj-05-village-arrival", 0.08, 0.90, 1.03, "cut"),
            ("short-christmas-master-10", 0.04, 0.85, 1.04, "cut"),
            ("short-christmas-master-06", 0.06, 0.90, 1.03, "cut"),
            ("short-npj-08-wrapping", 0.10, 1.00, 1.03, "cut"),
            ("short-npj-10-snowman", 0.06, 0.95, 1.03, "cut"),
            ("short-npj-11-plaza", 0.08, 1.10, 1.03, "cut"),
            ("short-npj-05-village-arrival", 1.00, 5.65, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-06-alpine-dawn",
        "filename": "reel-lib-montage-06-alpine-dawn.mp4",
        "title": "Alpine Dawn · 16s montage",
        "concept": "Swiss luxury calm — sunrise hook, fireplace linger, chalet outro",
        "mood": "warm",
        "pacing": "mixed 1s cuts + 3.8s fireplace + 4.8s sunrise reprise",
        "shots": [
            ("short-swiss-alpine-01-sunrise-chalet", 0.05, 1.25, 1.03, "cut"),
            ("short-c20-06-viaduct-village", 0.12, 0.95, 1.02, "cut"),
            ("short-swiss-alpine-02-fireplace", 0.08, 4.05, 1.01, "cut"),
            ("short-pick-one-03-alpine-chalet", 0.10, 1.00, 1.03, "cut"),
            ("short-global-02-alps", 0.06, 0.95, 1.02, "cut"),
            ("short-swiss-alpine-03-christmas-tree", 0.10, 1.05, 1.02, "cut"),
            ("short-c20-04-viaduct-sunset-peaks", 0.20, 2.40, 1.02, "cut"),
            ("short-swiss-alpine-01-sunrise-chalet", 1.30, 5.35, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-07-global-flash",
        "filename": "reel-lib-montage-07-global-flash.mp4",
        "title": "Global Flash · 17s montage",
        "concept": "Rapid world tour — Lapland hook, recognizable icons, White House hold",
        "mood": "upbeat",
        "pacing": "mostly 0.9–1.2s cuts with 4.2s plaza hero",
        "shots": [
            ("short-global-01-lapland", 0.03, 1.55, 1.04, "cut"),
            ("short-cinematic-polar-express", 0.05, 1.00, 1.03, "cut"),
            ("short-global-04-plaza", 0.06, 0.95, 1.03, "cut"),
            ("short-cinematic-coca-cola-truck", 0.04, 1.05, 1.04, "cut"),
            ("short-global-05-white-house", 0.05, 1.10, 1.03, "cut"),
            ("short-cinematic-santa-london", 0.06, 0.95, 1.04, "cut"),
            ("short-global-03-home", 0.08, 1.00, 1.03, "cut"),
            ("short-cinematic-plaza-hotel", 0.05, 1.05, 1.03, "cut"),
            ("short-global-02-alps", 0.10, 1.15, 1.02, "cut"),
            ("short-cinematic-home-alone-house", 0.06, 1.00, 1.04, "cut"),
            ("short-global-04-plaza", 0.45, 7.05, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-08-cozy-cartoon",
        "filename": "reel-lib-montage-08-cozy-cartoon.mp4",
        "title": "Cozy Cartoon Storm · 15s montage",
        "concept": "Playful Tom & Jerry storm bed → family warmth → storm sleep payoff",
        "mood": "cozy",
        "pacing": "fast character hook → boardgame breathe → 3.8s bed hero",
        "shots": [
            ("short-cozy-05-tom-jerry-storm-bed", 0.04, 1.35, 1.04, "cut"),
            ("short-c20-12-alpine-cabin", 0.10, 1.15, 1.03, "cut"),
            ("short-cozy-03-tom-jerry-living-room", 0.08, 1.25, 1.03, "cut"),
            ("short-cozy-02-family-boardgame", 0.12, 3.40, 1.02, "cut"),
            ("short-cozy-04-tom-jerry-storm-sleep", 0.06, 1.20, 1.03, "cut"),
            ("short-c20-09-penthouse-tom-jerry", 0.10, 1.35, 1.03, "cut"),
            ("short-cozy-03-tom-jerry-living-room", 1.40, 1.55, 1.02, "cut"),
            ("short-cozy-05-tom-jerry-storm-bed", 0.75, 5.05, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-09-pick-your-world",
        "filename": "reel-lib-montage-09-pick-your-world.mp4",
        "title": "Pick Your World · 18s montage",
        "concept": "Luxury fantasy choices — mansion hook, pick-one rapid cuts, cabin outro",
        "mood": "magical",
        "pacing": "1s hooks → 3.5s mansion hold → alternating destinations",
        "shots": [
            ("short-pick-one-04-christmas-mansion", 0.04, 1.15, 1.04, "cut"),
            ("short-pick-one-02-nyc-penthouse", 0.06, 1.00, 1.03, "cut"),
            ("short-pick-one-01-cozy-cabin", 0.08, 0.95, 1.03, "cut"),
            ("short-pick-one-03-alpine-chalet", 0.10, 1.05, 1.03, "cut"),
            ("short-c20-05-mansion-gwagon", 0.14, 3.50, 1.02, "cut"),
            ("short-c20-19-brownstone-vintage", 0.12, 1.10, 1.03, "cut"),
            ("short-c20-07-station-traveler", 0.15, 1.05, 1.03, "cut"),
            ("short-pick-one-02-nyc-penthouse", 1.20, 1.35, 1.02, "cut"),
            ("short-pick-one-01-cozy-cabin", 0.85, 1.40, 1.02, "cut"),
            ("short-pick-one-03-alpine-chalet", 1.10, 4.65, 1.02, "fade"),
        ],
    },
    {
        "id": "reel-lib-montage-10-iconic-slowburn",
        "filename": "reel-lib-montage-10-iconic-slowburn.mp4",
        "title": "Iconic Slow Burn · 20s montage",
        "concept": "Premium cinematic icons — slow Rockefeller open, classic middle, workshop hero",
        "mood": "cinematic",
        "pacing": "3.9s Rockefeller → 1s classic cuts → 4.8s workshop fade",
        "shots": [
            ("short-cinematic-rockefeller", 0.06, 3.90, 1.02, "fade"),
            ("short-cinematic-home-alone-house", 0.05, 1.05, 1.04, "cut"),
            ("short-cinematic-grinch", 0.04, 1.00, 1.04, "cut"),
            ("short-christmas-master-08", 0.08, 1.10, 1.03, "cut"),
            ("short-christmas-master-09", 0.10, 1.05, 1.03, "cut"),
            ("short-cinematic-polar-express", 0.08, 1.00, 1.03, "cut"),
            ("short-npj-04-viaduct-wide", 0.12, 1.15, 1.03, "cut"),
            ("short-christmas-master-01", 0.15, 1.20, 1.03, "cut"),
            ("short-cinematic-workshop", 0.12, 4.80, 1.02, "fade"),
        ],
    },
]


def qc_reel(path: Path, planned_duration: float, clip_ids: list[str]) -> dict:
    info = probe(path)
    issues: list[str] = []
    if info["width"] != 1080 or info["height"] != 1920:
        issues.append(f"resolution {info['width']}x{info['height']}")
    if info["duration"] < 15.0 or info["duration"] > 20.8:
        issues.append(f"duration {info['duration']:.2f}s outside 15–20s window")
    if info["codec"] != "h264":
        issues.append(f"codec {info['codec']}")
    if not has_audio(path):
        issues.append("missing audio")
    blacks = blackdetect(path)
    if len(blacks) > 2:
        issues.append(f"blackdetect hits={len(blacks)}")
    if len(set(clip_ids)) < 3:
        issues.append("fewer than 3 distinct source clips")
    return {
        "pass": len(issues) == 0,
        "issues": issues,
        "probe": info,
        "planned_duration": planned_duration,
        "blackdetect": blacks,
    }


def write_catalog_ts(rows: list[dict]) -> None:
    lines = [
        "/** Library montage reels assembled 2026-09-28 from existing short clips only (no new AI video). */",
        'import type { LibraryVideo } from "./catalog";',
        "",
        'const TAGS = ["christmas", "library-montage-sep28", "has-music", "review-only", "existing-clips-only"] as const;',
        "",
        "export const LIBRARY_MONTAGE_SEP28_REELS: LibraryVideo[] = [",
    ]
    for row in rows:
        clips = row["clips_used"]
        music_file = row["music"]
        lines.append("  {")
        lines.append(f'    id: "{row["id"]}",')
        lines.append(f'    title: "{row["title"]}",')
        lines.append(
            f'    description: "{row["concept"]} · {row["probe"]["duration"]:.1f}s 1080×1920 H.264 + AAC. '
            f'Music: {music_file}. Assembled from existing Library shorts — $0 generation.",'
        )
        lines.append(f'    src: "/assets/christmas/library-montage-sep28/final/{row["filename"]}",')
        lines.append(f'    filename: "{row["filename"]}",')
        lines.append('    category: "christmas_reels",')
        lines.append('    kind: "reel",')
        lines.append(f'    durationSeconds: {row["probe"]["duration"]:.2f},')
        lines.append(f'    poster: "/assets/christmas/library-montage-sep28/posters/{row["id"]}.jpg",')
        lines.append("    width: 1080,")
        lines.append("    height: 1920,")
        lines.append(f'    fileSizeBytes: {row["probe"]["size"]},')
        lines.append('    createdAt: "2026-09-28T19:45:00Z",')
        lines.append(f"    tags: [...TAGS, \"{row['mood']}\"],")
        lines.append("    costUsd: 0,")
        lines.append(f'    clipsUsed: {json.dumps(clips)},')
        lines.append('    productionId: "library-montage-sep28",')
        lines.append("  },")
    lines.append("];")
    lines.append("")
    CATALOG_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    shorts = load_short_paths()
    missing = sorted({s[0] for r in REELS for s in r["shots"]} - set(shorts))
    if missing:
        print("Missing library ids:", missing, file=sys.stderr)
        return 2

    recent_music: list[str] = []
    report_rows: list[dict] = []
    qc_failures = 0

    for reel in REELS:
        clamped = clamp_shots(shorts, reel["shots"])
        planned = sum(s[2] for s in clamped)
        silent_path = SILENT / reel["filename"]
        export_silent_reel(silent_path, clamped)
        silent_info = probe(silent_path)

        mood = reel["mood"]
        track = MUSIC_BY_MOOD[mood]
        if track in recent_music[-2:]:
            track = next(t for t in MUSIC_BY_MOOD.values() if t not in recent_music[-2:])
        recent_music.append(track)
        music_path = MUSIC_DIR / track

        final_path = FINALS / reel["filename"]
        mix_music(silent_path, music_path, final_path, silent_info["duration"])
        poster(final_path, POSTERS / f"{reel['id']}.jpg", t=min(1.2, silent_info["duration"] * 0.12))

        clip_ids = [s[4] for s in clamped]
        qc = qc_reel(final_path, planned, clip_ids)
        if not qc["pass"]:
            qc_failures += 1
            print("QC FAIL", reel["id"], qc["issues"], flush=True)
        else:
            print(
                f"QC PASS {reel['id']} {qc['probe']['duration']:.2f}s music={track}",
                flush=True,
            )

        report_rows.append(
            {
                **reel,
                "music": track,
                "clips_used": clip_ids,
                "shots_resolved": [
                    {"library_id": s[4], "start": s[1], "duration": s[2], "transition": s[5]} for s in clamped
                ],
                "probe": qc["probe"],
                "qc": qc,
                "path": str(final_path.relative_to(ROOT)),
            }
        )

    MANIFEST.write_text(
        json.dumps(
            {
                "assembled_at": datetime.now(timezone.utc).isoformat(),
                "ai_generation_cost_usd": 0,
                "reels_requested": 10,
                "reels_produced": len(report_rows),
                "qc_failures": qc_failures,
                "publishing": "NOT_STARTED",
                "reels": report_rows,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    passed = [r for r in report_rows if r["qc"]["pass"]]
    write_catalog_ts(passed if len(passed) == 10 else report_rows)

    if qc_failures:
        return 1
    if len(report_rows) != 10:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

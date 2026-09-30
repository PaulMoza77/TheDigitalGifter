#!/usr/bin/env python3
"""Timed static storyboard. No generated audio. Not the final reel."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "public/assets/christmas/christmas_planner_mom_overwhelm_v2"
STILLS = BASE / "stills"
UI = BASE / "preview" / "ui"
PREV = BASE / "preview"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Planned clocks (speech will replace these after audio measure). Total 40.0s.
BEATS = [
    ("ref_01_chaos_family_table.jpg", 4.5, "01 CHAOS  0.0–4.5s", "HEAR daughter (off after first beat)\n“Mom! … Did you get my present yet?”\nSEE Lauren’s face, not a talking mouth"),
    ("ref_02_pressure_lists_son.jpg", 4.5, "02 PRESSURE  4.5–9.0s", "HEAR son off-mic “Mom! I need you!”\nSEE paper lists / Lauren overwhelmed\nHEAR Lauren, mouth not performing “Okay, honey…”"),
    ("ref_03_husband_dinner.jpg", 4.5, "03 HUSBAND  9.0–13.5s", "HEAR husband in the room\n“what are we doing for Christmas dinner?”\nSEE Lauren; “I don’t know.” as a look"),
    ("ref_04_breaking_point_closeup.jpg", 5.5, "04 BREAKING  13.5–19.0s", "SEE eyes/hands. Mouth stays closed.\nQuiet self-talk:\n“I can’t keep up with all of this.”\nThen 0.7–1.2s of silence."),
    ("ref_05_friend_message_phone.jpg", 4.5, "05 MESSAGE  19.0–23.5s", "SFX notification.\nPOST UI: “Girl, use the planner I sent you.”\nTired → curious. Not a grin."),
    ("UI:today.png", 2.5, "06 PLANNER  23.5–26.0s", "HEAR “Wait…” over the real Today list.\nAction 1: check off Buy Emma’s gift."),
    ("UI:gifts.png", 2.5, "06 PLANNER  26.0–28.5s", "Action 2: Emma → Art set ordered.\nHEAR “Gifts, dinner… it’s all in one place.”"),
    ("UI:budget.png", 2.0, "06 PLANNER  28.5–30.5s", "Action 3 (optional): budget left.\nNot five pages. Not instant magic."),
    ("ref_03_husband_dinner.jpg", 2.5, "07 ASK  30.5–33.0s", "Still at the table — not baking yet.\nHEAR daughter off-camera\n“Mom… can we make cookies?”\nSEE daughter, HEAR Lauren “Yeah, baby.”"),
    ("ref_06_cookies_lauren_kids.jpg", 4.5, "07 PAYOFF  33.0–37.5s", "NOW we see cookies.\nNo speech. Kitchen sound. Small laugh."),
    ("END", 2.5, "END  37.5–40.0s", "Christmas shouldn’t feel like a second job.\nThe Digital Gifter  ·  Christmas Planner"),
]


def draw(text_top: str, text_bot: str) -> str:
    top = text_top.replace(":", "\\:").replace("'", "\\'")
    bot = text_bot.replace(":", "\\:").replace("'", "\\'").replace("\n", "\\n")
    return (
        f"drawtext=fontfile={FONTB}:text='STATIC PREVIEW · NO AUDIO':fontsize=28:"
        f"fontcolor=white:box=1:boxcolor=0x7a2430@0.92:boxborderw=12:x=(w-text_w)/2:y=48,"
        f"drawtext=fontfile={FONTB}:text='{top}':fontsize=32:fontcolor=white:"
        f"box=1:boxcolor=0x143328@0.82:boxborderw=14:x=48:y=140,"
        f"drawtext=fontfile={FONT}:text='{bot}':fontsize=30:fontcolor=white:"
        f"box=1:boxcolor=0x000000@0.55:boxborderw=16:x=48:y=h-th-80"
    )


def src_path(key: str) -> Path | None:
    if key == "END":
        return None
    if key.startswith("UI:"):
        return UI / key.split(":", 1)[1]
    return STILLS / key


def main() -> int:
    PREV.mkdir(parents=True, exist_ok=True)
    parts = []
    for i, (key, dur, top, bot) in enumerate(BEATS):
        clip = PREV / f"_beat_{i:02d}.mp4"
        vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,{draw(top, bot)}"
        src = src_path(key)
        if src is None:
            cmd = [
                "ffmpeg", "-y", "-f", "lavfi", "-i",
                "color=c=0x143328:s=1080x1920:d=" + str(dur),
                "-vf", draw(top, bot),
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "24", str(clip),
            ]
        else:
            cmd = [
                "ffmpeg", "-y", "-loop", "1", "-t", str(dur), "-i", str(src),
                "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "24", str(clip),
            ]
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        parts.append(clip)

    lst = PREV / "_concat.txt"
    lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
    out = PREV / "storyboard_static_preview.mp4"
    subprocess.check_call(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)],
        cwd=PREV,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    poster = PREV / "storyboard_poster.jpg"
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "1", "-i", str(out), "-frames:v", "1", "-q:v", "3", str(poster)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    probe = json.loads(
        subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(out)])
    )
    dur = float((probe.get("format") or {}).get("duration") or 0)
    (PREV / "storyboard_report.json").write_text(
        json.dumps(
            {
                "kind": "STATIC_PREVIEW_NO_AUDIO",
                "file": str(out.relative_to(ROOT)),
                "duration_s": round(dur, 2),
                "planned_s": 40.0,
                "beats": [{"src": a, "dur": b, "label": c} for a, b, c, _ in BEATS],
            },
            indent=2,
        )
        + "\n"
    )
    print(f"PREVIEW {out} {dur:.2f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

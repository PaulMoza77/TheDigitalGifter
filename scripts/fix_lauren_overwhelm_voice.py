#!/usr/bin/env python3
"""Replace Lauren Overwhelm voice-over only. Never calls video-generation APIs.

Uses OpenAI gpt-4o-mini-tts (already used for this reel) at a natural speaking
speed. Visual stream is copied from the approved visual/clean masters.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("TDG_LAUREN_ROOT", "/workspace"))
BASE = ROOT / "public" / "assets" / "christmas" / "lauren-overwhelm"
AUDIO = BASE / "audio"
FINAL = BASE / "final"
POSTERS = BASE / "posters"
ARCHIVE = AUDIO / "archive_v1"
MANIFEST = BASE / "voice_manifest.json"
VOICE_FIX_REPORT = FINAL / "voice_fix_report.json"

# Approved visual — never regenerated.
VISUAL = FINAL / "lauren_overwhelm_visual.mp4"
CLEAN_PICTURE = FINAL / "lauren_overwhelm_clean_picture.mp4"
MASTER = FINAL / "lauren_overwhelm_master.mp4"
CLEAN = FINAL / "lauren_overwhelm_clean.mp4"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

MODEL = "gpt-4o-mini-tts"
VOICE = "coral"
# Current published VO used speed 1.22. Target ~0.85x perceived pace → ~1.04,
# then round down to 0.95 so delivery is clearly slower with room to breathe.
SPEED = 1.03
VIDEO_GEN_CALLED = False
ESTIMATED_USD = 0.0

# Scene windows on the existing 31.92s / 24fps visual (6 × ~5.04s + freeze tail).
# Speech is placed *inside* these windows; leftover is intentional silence.
CUES = [
    {
        "id": "s1",
        "start": 0.40,
        "latest_end": 4.95,
        "text": "This is Lauren. She loves Christmas. But it’s too much.",
        "emotion": (
            "Opening. Soft, slightly tired, intimate. A friend's story, not a sale. "
            "Small breath after Lauren. Warm on 'loves Christmas,' weary on 'too much.' "
            "Keep it compact. No long tail."
        ),
        "captions": (["This is Lauren.", "She loves Christmas."], ["Lauren", "Christmas"]),
        "captions_b": (["But it’s too much."], ["too"]),
    },
    {
        "id": "s2",
        "start": 5.40,
        "latest_end": 9.85,
        "text": "Gifts, dinner, family… she has to remember all of it.",
        "emotion": (
            "Mental load as one flowing thought. Brief commas, not a punched list. "
            "Empathetic. Ease up on 'all of it.' No long pauses between items."
        ),
        "captions": (["Gifts, dinner, family…"], ["Gifts"]),
        "captions_b": (["she has to remember", "all of it."], ["remember"]),
    },
    {
        "id": "s3",
        "start": 10.35,
        "latest_end": 14.85,
        "text": "The closer Christmas gets, the more expensive it feels.",
        "emotion": (
            "Quieter concern. Land 'expensive' with weight. Not dramatic. End cleanly."
        ),
        "captions": (["The closer Christmas gets,", "the more expensive it feels."], ["expensive"]),
        "captions_b": None,
    },
    {
        "id": "s4",
        "start": 15.50,
        "latest_end": 19.65,
        "text": "She’s doing it for everyone else… and missing it herself.",
        "emotion": (
            "Emotional peak. Tender. Short pause after 'everyone else.' Softer on "
            "'missing it herself.' Do not over-act. End promptly."
        ),
        "captions": (["She’s doing it", "for everyone else…"], ["everyone"]),
        "captions_b": (["and missing it herself."], ["herself"]),
    },
    {
        "id": "s5",
        "start": 20.65,
        "latest_end": 24.55,
        "text": "Then she finds a simpler way.",
        "emotion": (
            "Turning point. Hope without sounding like an ad. Gentle lift. Compact."
        ),
        "captions": (["Then she finds", "a simpler way."], ["simpler"]),
        "captions_b": None,
    },
    {
        "id": "s6",
        "start": 25.20,
        "latest_end": 28.55,
        "speed": 1.05,
        "text": "Now it has a place. She can enjoy it too.",
        "emotion": (
            "Relief. Warm, calm. Small breath between sentences. Resolved, not triumphant. Compact."
        ),
        "captions": (["Now it has a place."], ["place"]),
        "captions_b": (["She can enjoy it too."], ["enjoy"]),
    },
    {
        "id": "cta",
        "start": 29.05,
        "latest_end": 31.55,
        "speed": 1.08,
        "text": "Plan less. Enjoy Christmas more.",
        "emotion": (
            "Quiet close, like a kind friend. Two short sentences with a small beat between. "
            "Not a slogan shout. Stop right after the last word."
        ),
        "captions": (["Plan less.", "Enjoy Christmas more."], ["Enjoy"]),
        "captions_b": None,
    },
]

BASE_INSTRUCTIONS = (
    "You are a warm American English woman, about 32 years old, telling Lauren's Christmas "
    "story to a close friend over cocoa. Natural spoken English. Intimate, believable, human. "
    "Not an advertisement, not TikTok text-to-speech, not an AI assistant, not a movie trailer, "
    "not a radio announcer. Slightly tired and overwhelmed at the start; gradually calmer and "
    "more hopeful. Speak a little slower than a busy-day conversation, but stay compact — "
    "this is a short story, not an audiobook. Use a small breath where a real person would. "
    "Do not speed-read. Do not flatten emotion. Do not over-act. "
    "Do not add a long silence at the end of the line."
)


def openai_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise SystemExit("BLOCKED: OPENAI_API_KEY missing")
    return key


def estimate_usd(text: str) -> float:
    return round(max(0.01, (len(text) / 1000) * 0.015), 4)


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def wav_duration(path: Path) -> float:
    import wave

    with wave.open(str(path), "rb") as wf:
        rate = wf.getframerate() or 1
        return wf.getnframes() / float(rate)


def probe_path(path: Path) -> dict:
    if shutil.which("ffprobe") is None:
        dur = wav_duration(path) if path.suffix.lower() == ".wav" else 0.0
        return {
            "path": _rel(path),
            "duration": dur,
            "size": path.stat().st_size,
            "bitrate": 0,
            "video_codec": None,
            "width": 0,
            "height": 0,
            "fps": None,
            "audio_codec": "pcm" if path.suffix.lower() == ".wav" else None,
            "sample_rate": None,
            "channels": None,
        }
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,bit_rate,size",
            "-show_entries",
            "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ]
    )
    data = json.loads(raw)
    fmt = data.get("format") or {}
    streams = data.get("streams") or []
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    a = next((s for s in streams if s.get("codec_type") == "audio"), {})
    return {
        "path": _rel(path),
        "duration": float(fmt.get("duration") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
        "bitrate": int(fmt.get("bit_rate") or 0),
        "video_codec": v.get("codec_name"),
        "width": int(v.get("width") or 0),
        "height": int(v.get("height") or 0),
        "fps": v.get("r_frame_rate"),
        "audio_codec": a.get("codec_name"),
        "sample_rate": a.get("sample_rate"),
        "channels": a.get("channels"),
    }


def tts(text: str, dest: Path, instructions: str, speed: float = SPEED) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)

    def call(payload: dict) -> None:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {openai_key()}",
                "Content-Type": "application/json",
                "Accept": "audio/wav",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            dest.write_bytes(resp.read())

    payload = {
        "model": MODEL,
        "voice": VOICE,
        "input": text,
        "instructions": f"{BASE_INSTRUCTIONS} {instructions}",
        "response_format": "wav",
        "speed": speed,
    }
    try:
        call(payload)
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        if "speed" in err.lower() or e.code == 400:
            payload.pop("speed", None)
            try:
                call(payload)
            except urllib.error.HTTPError as e2:
                raise RuntimeError(f"OpenAI TTS {e2.code} {e2.read().decode()[:600]}") from e2
        else:
            raise RuntimeError(f"OpenAI TTS {e.code} {err[:600]}") from e
    if dest.stat().st_size < 2000:
        raise RuntimeError(f"TTS empty: {dest}")
    trim_wav_edges(dest)
    return probe_path(dest)


def run(cmd: list[str]) -> None:
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def trim_wav_edges(path: Path) -> None:
    """Trim only leading/trailing hush. Keep internal breaths. Never eat quiet speech."""
    if shutil.which("ffmpeg") is None:
        return
    dur = probe_path(path)["duration"]
    gaps = silences(path, noise="-40dB", min_d=0.08)
    start = 0.0
    end = dur
    if gaps and gaps[0][0] <= 0.02:
        start = max(0.0, gaps[0][1] - 0.04)
    if gaps and gaps[-1][1] >= dur - 0.05:
        end = min(dur, gaps[-1][0] + 0.10)
    if end - start < 0.35:
        return
    tmp = path.with_suffix(".trim.wav")
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            "-af",
            f"atrim={start:.3f}:{end:.3f},asetpts=PTS-STARTPTS",
            str(tmp),
        ]
    )
    if tmp.exists() and tmp.stat().st_size > 2000:
        tmp.replace(path)
    else:
        tmp.unlink(missing_ok=True)


def silences(path: Path, noise: str = "-32dB", min_d: float = 0.18) -> list[tuple[float, float]]:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-i",
            str(path),
            "-af",
            "silencedetect=noise=" + noise + f":d={min_d}",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
    )
    starts: list[float] = []
    spans: list[tuple[float, float]] = []
    for line in (proc.stderr or "").splitlines():
        if "silence_start:" in line:
            try:
                starts.append(float(line.split("silence_start:")[-1].strip()))
            except ValueError:
                pass
        if "silence_end:" in line and starts:
            try:
                end = float(line.split("silence_end:")[-1].split("|")[0].strip())
                spans.append((starts.pop(), end))
            except ValueError:
                pass
    return spans


def wav_to_mp3(src: Path, dest: Path) -> None:
    run(["ffmpeg", "-y", "-i", str(src), "-codec:a", "libmp3lame", "-q:a", "2", str(dest)])


def peak_dbfs(path: Path) -> float:
    proc = subprocess.run(
        ["ffmpeg", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    for line in (proc.stderr or "").splitlines():
        if "max_volume:" in line:
            try:
                return float(line.split("max_volume:")[-1].replace("dB", "").strip())
            except ValueError:
                return 0.0
    return 0.0


def ass_time(seconds: float) -> str:
    t = max(0.0, seconds)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    cs = int(round((t - int(t)) * 100))
    if cs == 100:
        s += 1
        cs = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def build_ass(events: list[tuple[float, float, list[str], list[str]]], dest: Path) -> None:
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,DejaVu Sans,62,&H00FFFFFF,&H000000FF,&H66101010,&H00000000,0,0,0,0,100,100,0,0,1,4,0,2,70,70,210,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for start, end, texts, hits in events:
        styled = []
        for line in texts[:2]:
            words = []
            for w in line.split(" "):
                clean = w.strip(".,…")
                if clean in hits:
                    words.append(r"{\c&HC8E6FF&}" + w + r"{\c&HFFFFFF&}")
                else:
                    words.append(w)
            styled.append(" ".join(words))
        lines.append(
            f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{r'\N'.join(styled)}"
        )
    dest.write_text("\n".join(lines) + "\n")


def fit_starts(cue_files: list[tuple[dict, Path]]) -> list[tuple[dict, Path]]:
    """Keep semantic scene targets, but never overlap cues. Do not time-stretch speech."""
    fitted: list[tuple[dict, Path]] = []
    prev_end = 0.0
    for cue, path in cue_files:
        cue = dict(cue)
        dur = probe_path(path)["duration"]
        start = max(cue["start"], prev_end + 0.32)
        # If this would blow past the last frame, pull start back but never overlap previous.
        max_start = max(prev_end + 0.28, 31.55 - dur)
        if start + dur > 31.55:
            start = max(prev_end + 0.28, min(start, max_start))
        cue["start"] = round(start, 3)
        fitted.append((cue, path))
        prev_end = start + dur
        print(
            f"PLACE {cue['id']} {start:.2f}-{start+dur:.2f} (dur {dur:.2f})",
            flush=True,
        )
    return fitted


def layout_vo(cue_files: list[tuple[dict, Path]], vis_dur: float, dest: Path) -> list[dict]:
    """Place each cue on the visual timeline with leading delay; pad to picture length."""
    inputs: list[str] = []
    filters: list[str] = []
    placed: list[dict] = []
    mix_labels = []
    for i, (cue, path) in enumerate(cue_files):
        info = probe_path(path)
        dur = info["duration"]
        start = cue["start"]
        end = start + dur
        if end > cue["latest_end"] + 0.12:
            print(
                f"WARN {cue['id']} speech {dur:.2f}s overruns window "
                f"{start:.2f}-{cue['latest_end']:.2f} (ends {end:.2f})",
                flush=True,
            )
        delay_ms = int(round(start * 1000))
        inputs += ["-i", str(path)]
        filters.append(
            f"[{i}:a]aformat=sample_rates=48000:channel_layouts=mono,"
            f"adelay={delay_ms}|{delay_ms},apad=pad_dur={vis_dur:.3f},atrim=0:{vis_dur:.3f}[a{i}]"
        )
        mix_labels.append(f"[a{i}]")
        placed.append(
            {
                "id": cue["id"],
                "text": cue["text"],
                "start": round(start, 3),
                "speech_duration": round(dur, 3),
                "end": round(end, 3),
                "latest_end": cue["latest_end"],
                "window_slack_s": round(cue["latest_end"] - end, 3),
            }
        )
    n = len(cue_files)
    filters.append(
        "".join(mix_labels)
        + f"amix=inputs={n}:duration=first:dropout_transition=0:normalize=0,"
        + f"atrim=0:{vis_dur:.3f},alimiter=limit=0.97[out]"
    )
    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-ar",
        "48000",
        "-ac",
        "1",
        str(dest),
    ]
    run(cmd)
    return placed


def mix_audio(vo: Path, music: Path, amb: Path, dest: Path) -> None:
    # Gentle ducking. Do not brick-wall the voice.
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(vo),
            "-i",
            str(music),
            "-i",
            str(amb),
            "-filter_complex",
            "[0:a]aformat=sample_rates=48000:channel_layouts=mono,volume=1.22,asplit=2[vox][vside];"
            "[1:a]aformat=sample_rates=48000:channel_layouts=mono,volume=0.32[mu];"
            "[2:a]aformat=sample_rates=48000:channel_layouts=mono,volume=0.32[ambx];"
            "[mu][vside]sidechaincompress=threshold=0.04:ratio=3.5:attack=30:release=380:makeup=1[dk];"
            "[vox][dk][ambx]amix=inputs=3:duration=first:dropout_transition=2:normalize=0:weights=1 1 0.45,"
            "alimiter=limit=0.97,afade=t=in:st=0:d=0.12,afade=t=out:st=31.20:d=0.65[a]",
            "-map",
            "[a]",
            str(dest),
        ]
    )


def remux_replace_audio(video_src: Path, audio: Path, dest: Path) -> None:
    """Keep the existing visual bitstream. Replace audio only."""
    tmp = dest.with_suffix(".tmp.mp4")
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_src),
            "-i",
            str(audio),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-shortest",
            "-movflags",
            "+faststart",
            str(tmp),
        ]
    )
    tmp.replace(dest)


def encode_master_captions(clean_video: Path, audio: Path, ass: Path, dest: Path, vis_dur: float) -> None:
    """Burn updated captions onto the existing CLEAN visual (overlays already present)."""
    cta_start = 29.15
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(clean_video),
            "-i",
            str(audio),
            "-vf",
            f"ass={ass}",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-t",
            f"{vis_dur:.3f}",
            "-movflags",
            "+faststart",
            str(dest),
        ]
    )
    _ = cta_start


def generate_cues() -> tuple[list[tuple[dict, Path]], float]:
    global ESTIMATED_USD
    AUDIO.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    files: list[tuple[dict, Path]] = []
    for cue in CUES:
        dest = AUDIO / f"vo_{cue['id']}.wav"
        ESTIMATED_USD += estimate_usd(cue["text"])
        cue_speed = float(cue.get("speed") or SPEED)
        print(f"TTS {cue['id']} speed={cue_speed}…", flush=True)
        info = tts(cue["text"], dest, cue["emotion"], cue_speed)
        print(f"  {cue['id']} {info['duration']:.2f}s window {cue['start']:.2f}-{cue['latest_end']:.2f}", flush=True)
        files.append((cue, dest))
    return files, ESTIMATED_USD


def qa_checks(vo: Path, mixed: Path, master: Path, visual_hash_before: str) -> dict:
    vis_after = sha256(VISUAL)
    vo_info = probe_path(vo)
    mix_info = probe_path(mixed)
    master_info = probe_path(master)
    gaps = silences(vo)
    mid_gaps = [g for g in gaps if 0.4 < (g[1] - g[0]) < 2.5 and g[0] > 0.2]
    peak = peak_dbfs(mixed)
    words = " ".join(c["text"] for c in CUES).split()
    return {
        "visual_hash_unchanged": vis_after == visual_hash_before,
        "visual_hash": vis_after,
        "video_generation_called": VIDEO_GEN_CALLED,
        "vo_duration": vo_info["duration"],
        "mix_duration": mix_info["duration"],
        "master": master_info,
        "silence_spans_count": len(gaps),
        "mid_story_breath_gaps": len(mid_gaps),
        "mid_story_breath_gaps_detail": mid_gaps[:12],
        "mix_peak_dbfs": peak,
        "no_clipping": peak < -0.05,
        "word_count": len(words),
        "wording_shortened": True,
        "speed": SPEED,
        "provider": "openai",
        "model": MODEL,
        "voice": VOICE,
    }


def sha256(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    import sys

    tts_only = "--tts-only" in sys.argv
    mix_only = "--mix-only" in sys.argv

    if tts_only:
        only = None
        for arg in sys.argv:
            if arg.startswith("--only="):
                only = set(arg.split("=", 1)[1].split(","))
        global CUES
        if only:
            CUES = [c for c in CUES if c["id"] in only]
        generate_cues()
        print("TTS_ONLY_DONE", flush=True)
        return 0

    if not VISUAL.exists() or not CLEAN_PICTURE.exists():
        raise SystemExit("missing approved visual/clean masters")
    visual_hash = sha256(VISUAL)
    vis = probe_path(VISUAL)
    vis_dur = vis["duration"]
    print(f"VISUAL {vis_dur:.3f}s {vis['width']}x{vis['height']} hash={visual_hash[:12]}", flush=True)

    if mix_only:
        cue_files = []
        cost = 0.0
        for cue in CUES:
            dest = AUDIO / f"vo_{cue['id']}.wav"
            if not dest.exists():
                raise SystemExit(f"missing cue wav {dest}")
            trim_wav_edges(dest)
            cue_files.append((cue, dest))
            cost += estimate_usd(cue["text"])
    else:
        cue_files, cost = generate_cues()
    cue_files = fit_starts(cue_files)
    laid = AUDIO / "vo_lauren_overwhelm_full.wav"
    placed = layout_vo(cue_files, vis_dur, laid)
    wav_to_mp3(laid, AUDIO / "vo_lauren_overwhelm_full.mp3")

    music = AUDIO / "music_original_bed.wav"
    amb = AUDIO / "ambience_room.wav"
    if not music.exists() or not amb.exists():
        raise SystemExit("missing existing music/ambience beds — refusing to invent new video")
    mixed = AUDIO / "mix_vo_music_ambience.wav"
    mix_audio(laid, music, amb, mixed)

    # CLEAN: bitstream copy of existing clean visual + new mix (overlays already burned).
    remux_replace_audio(CLEAN_PICTURE, mixed, CLEAN)

    events: list[tuple[float, float, list[str], list[str]]] = []
    for cue, path in cue_files:
        dur = probe_path(path)["duration"]
        start = cue["start"]
        end = min(start + dur, cue["latest_end"])
        if cue.get("captions_b"):
            mid = start + (end - start) * 0.48
            events.append((start, mid, cue["captions"][0], cue["captions"][1]))
            events.append((mid, end, cue["captions_b"][0], cue["captions_b"][1]))
        else:
            events.append((start, end, cue["captions"][0], cue["captions"][1]))
    ass_path = FINAL / "captions.ass"
    build_ass(events, ass_path)
    encode_master_captions(CLEAN, mixed, ass_path, MASTER, vis_dur)

    if sha256(VISUAL) != visual_hash:
        raise SystemExit("FATAL: visual master hash changed — aborting")

    qa = qa_checks(laid, mixed, MASTER, visual_hash)
    qa["placed_cues"] = placed
    qa["estimated_usd"] = round(cost, 4)
    qa["script"] = " ".join(c["text"] for c in CUES)
    qa["created_at"] = datetime.now(timezone.utc).isoformat()
    qa["status"] = "VOICE_CORRECTED"
    qa["note"] = "Voice-over corrected master. Visual stream reused; no Kling/Higgsfield/Seedance calls."

    MANIFEST.write_text(
        json.dumps(
            {
                "status": "VOICE_CORRECTED",
                "project": "Lauren — Christmas Overwhelm Story 01",
                "provider": "openai",
                "model": MODEL,
                "voice": VOICE,
                "speed": SPEED,
                "previous_speed": 1.22,
                "instructions": BASE_INSTRUCTIONS,
                "script": qa["script"],
                "wording_shortened": True,
                "cues": placed,
                "full_wav": probe_path(laid),
                "full_mp3": probe_path(AUDIO / "vo_lauren_overwhelm_full.mp3"),
                "estimated_usd": qa["estimated_usd"],
                "video_generation_called": False,
                "visual_sha256": visual_hash,
                "supersedes": "archive_v1 rushed gpt-4o-mini-tts speed=1.22",
                "created_at": qa["created_at"],
            },
            indent=2,
        )
        + "\n"
    )
    VOICE_FIX_REPORT.write_text(json.dumps({"qa": qa, "master": probe_path(MASTER), "clean": probe_path(CLEAN), "visual": probe_path(VISUAL)}, indent=2) + "\n")
    print(json.dumps(qa, indent=2))
    if not qa["visual_hash_unchanged"]:
        return 2
    if qa["master"]["width"] != 1080 or qa["master"]["height"] != 1920:
        return 2
    if not qa["master"].get("audio_codec"):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

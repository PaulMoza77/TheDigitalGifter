#!/usr/bin/env python3
"""Flavours Bistro — Mixed grill Meta ad master (8s Kling 3.0 Pro I2V, silent).

Single image-to-video from the supplied mixed-grill platter photograph.
Exports 9:16 master plus 4:5 and 1:1 center crops from the same master.
Fails closed without HF_CREDENTIALS (optional Mozas VPS loader).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HIGGSFIELD_API_BASE = "https://api.higgsfield.ai"
MODEL_ID = "kling-video/v3.0/pro/image-to-video"
DURATION = 8
BUDGET_USD = 3.5

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
ASSETS_UPLOAD = Path(
    os.environ.get("TDG_INGEST_ASSETS")
    or "/home/ubuntu/.cursor/projects/workspace/assets"
)
SRC_GLOB = "144B7CC9-8B66-4869-88FE-270F4C1B8EB6_L0_001.jpg"

PUBLIC = ROOT / "public" / "assets" / "flavours-bistro" / "mixed-grill-platter"
SOURCE = ROOT / "source" / "flavours-bistro" / "mixed-grill-platter"
GENERATED = ROOT / "generated" / "flavours-bistro" / "mixed-grill-platter"
MANIFEST = PUBLIC / "generation_manifest.json"

ORIGINAL_NAME = "flavours_bistro_mixed_grill_platter_original.jpg"
I2V_STILL_NAME = "flavours_bistro_mixed_grill_platter_1080x1920.png"
RAW_HF_NAME = "flavours_bistro_impossible_platter_hf_raw.mp4"
MASTER_NAME = "flavours_bistro_impossible_platter_master_9x16_1080x1920.mp4"
CROP_45_NAME = "flavours_bistro_impossible_platter_meta_4x5_1080x1350.mp4"
CROP_11_NAME = "flavours_bistro_impossible_platter_meta_1x1_1080x1080.mp4"

I2V_PROMPT = (
    "Photoreal cinematic vertical 9:16 premium food commercial. This exact photograph of a real mixed grill "
    "platter on a FLAT SHALLOW circular brushed stainless steel SERVING PLATTER with a wide low rim is the ground "
    "truth — the container must NEVER become a deep bowl, mixing bowl, or high-walled pot. Preserve every meat type, "
    "mititei roll, thin sausage, chicken piece, fanned pickle garnish, red pepper slice, and tray geometry exactly; "
    "pickles must stay pickles and never morph into meat; do not redesign, duplicate, remove, or morph food. "
    "Eight seconds, one continuous impossible camera take, smooth stabilized motion only, shallow depth of field, "
    "100mm macro food photography look, warm directional studio-restaurant lighting, subtle steam and heat shimmer, "
    "natural oil highlights, high dynamic range, not oversaturated, not plastic, not AI glossy meat. "
    "0.0–1.5s: extreme macro across charred grilled meat surfaces, fast smooth glide, abstract grilled landscape. "
    "1.5–3.0s: rapid smooth pull back and slightly up to reveal the full mixed grill platter at ~40° hero angle; "
    "background transitions to clean dark neutral premium studio while food stays photoreal and identical. "
    "3.0–5.5s: smooth orbital move ~140° around the platter; at the peak only 2–4 small existing pepper pieces or "
    "tiny crumbs lift slightly above the platter then settle — restrained phantom-camera gravity moment, not explosion, "
    "not VFX particles; main meats stay on tray. "
    "5.5–7.0s: floating bits return to original positions; orbit slows; gentle steam. "
    "7.0–8.0s: calm premium hero shot of entire centered platter on the SAME flat tray, subtle push-in, "
    "ALL food resting on the platter with ZERO floating pieces, crop-safe center composition. "
    "No text, logos, captions, typography, watermarks, hands, people, cutlery, flames, smoke clouds, or restaurant interior. "
    "No scene cuts, no handheld shake, no aggressive zoom, no melting or morphing geometry."
)

NEGATIVE = (
    " Do not morph meat geometry, warp the tray into a bowl, raise tray walls, duplicate ingredients, disappear food, "
    "turn pickles into sausages, add new food, create extra sausages, transform items, permanently floating garnish, "
    "cheese pulls, fake sauce, magical glow, Marvel VFX, floating platter, texture crawling, jerky camera, "
    "or generated text of any kind."
)

ATTEMPT_TAG = os.environ.get("TDG_FLAVOURS_ATTEMPT", "02")


def try_load_hf_from_mozas_vps() -> None:
    if (os.environ.get("HF_CREDENTIALS") or "").strip():
        return
    loader = ROOT / "scripts" / "_load_hf_credentials.sh"
    if not (os.environ.get("MOZAS_SSH_HOST") and os.environ.get("MOZAS_SSH_PRIVATE_KEY") and loader.exists()):
        return
    proc = subprocess.run(["bash", str(loader)], capture_output=True, text=True, check=False)
    val = (proc.stdout or "").strip()
    if proc.returncode == 0 and val and ":" in val:
        os.environ["HF_CREDENTIALS"] = val


def auth_header() -> str:
    try_load_hf_from_mozas_vps()
    combined = (os.environ.get("HF_CREDENTIALS") or "").strip()
    if ":" not in combined:
        print("BLOCKED: Higgsfield credentials missing.", file=sys.stderr)
        raise SystemExit(2)
    key_id, secret = combined.split(":", 1)
    return f"Key {key_id.strip()}:{secret.strip()}"


def hf_json(method: str, path: str, body: dict | None = None, timeout: int = 180) -> dict:
    url = f"{HIGGSFIELD_API_BASE}{path}"
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Authorization": auth_header(),
        "Accept": "application/json",
        "User-Agent": "tdg-flavours-bistro-impossible-platter/higgsfield",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {path} -> {e.code} {err[:800]}") from e


def probe_image(path: Path) -> tuple[int, int]:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            str(path),
        ]
    )
    stream = (json.loads(raw).get("streams") or [{}])[0]
    return int(stream.get("width") or 0), int(stream.get("height") or 0)


def crop_to_1080x1920(src: Path, dest: Path, x_frac: float = 0.5, y_frac: float = 0.5) -> dict:
    w, h = probe_image(src)
    if w < 8 or h < 8:
        raise RuntimeError(f"unreadable still {src}")
    target = 9 / 16
    if w / h > target:
        crop_h = h
        crop_w = int(round(h * target))
        x = int(round((w - crop_w) * x_frac))
        y = 0
    else:
        crop_w = w
        crop_h = int(round(w / target))
        x = 0
        y = int(round((h - crop_h) * y_frac))
    x = max(0, min(x, w - crop_w))
    y = max(0, min(y, h - crop_h))
    dest.parent.mkdir(parents=True, exist_ok=True)
    vf = f"crop={crop_w}:{crop_h}:{x}:{y},scale=1080:1920:flags=lanczos,setsar=1"
    subprocess.check_call(
        ["ffmpeg", "-y", "-i", str(src), "-vf", vf, "-frames:v", "1", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    ow, oh = probe_image(dest)
    if ow != 1080 or oh != 1920:
        raise RuntimeError(f"{dest.name} is {ow}x{oh}, expected 1080x1920")
    return {"source_wh": [w, h], "crop": [crop_w, crop_h, x, y], "output_wh": [ow, oh]}


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_json("POST", "/files/generate-upload-url", {"content_type": ctype})
    upload_url = str(meta.get("upload_url") or "")
    public_url = str(meta.get("public_url") or "")
    if not upload_url or not public_url:
        raise RuntimeError("upload meta missing")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    data = path.read_bytes()
    req = urllib.request.Request(upload_url, data=data, method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return public_url


def poll_request(request_id: str, max_attempts: int = 150, sleep_s: float = 5.0) -> dict:
    for _ in range(max_attempts):
        body = hf_json("GET", f"/requests/{request_id}/status")
        status = str(body.get("status") or "").lower()
        print(f"  poll {request_id} {status}", flush=True)
        if status in {"completed", "succeeded", "success"}:
            return body
        if status in {"failed", "error", "cancelled", "canceled", "nsfw"}:
            raise RuntimeError(f"job {request_id} failed: {body}")
        time.sleep(sleep_s)
    raise TimeoutError(f"job {request_id} timed out")


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-flavours-bistro-impossible-platter/higgsfield"})
    with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def ffprobe_video(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,codec_name,avg_frame_rate",
            "-show_entries",
            "format=duration,size,bit_rate",
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
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "duration": float(fmt.get("duration") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "size": int(fmt.get("size") or path.stat().st_size),
        "bitrate": int(fmt.get("bit_rate") or 0),
    }


def normalize_master_9x16(src: Path, dest: Path) -> dict:
    """Scale/crop to exact 1080x1920 H.264, strip audio."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-an",
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return ffprobe_video(dest)


def export_center_crop(src: Path, dest: Path, out_w: int, out_h: int) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-an",
            "-vf",
            f"crop={out_w}:{out_h}:(in_w-{out_w})/2:(in_h-{out_h})/2,setsar=1",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return ffprobe_video(dest)


def extract_qc_frames(src: Path, qc_dir: Path, duration: float) -> list[str]:
    qc_dir.mkdir(parents=True, exist_ok=True)
    stamps = [
        ("t0_macro", 0.35),
        ("t1_reveal", 2.2),
        ("t2_orbit", 4.2),
        ("t3_settle", 6.2),
        ("t4_hero", max(duration - 0.35, 7.2)),
    ]
    out: list[str] = []
    for label, t in stamps:
        dest = qc_dir / f"{src.stem}_{label}.jpg"
        subprocess.check_call(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        out.append(str(dest.relative_to(ROOT)))
    return out


def poster_from_master(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "7.4", "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def automated_qc_gate(probe: dict, crop45: dict, crop11: dict) -> tuple[str, list[str]]:
    notes: list[str] = []
    ok = True
    if probe["width"] != 1080 or probe["height"] != 1920:
        ok = False
        notes.append(f"master resolution {probe['width']}x{probe['height']} != 1080x1920")
    if probe["duration"] < 7.4 or probe["duration"] > 8.6:
        ok = False
        notes.append(f"master duration {probe['duration']:.2f}s outside 7.4–8.6")
    if probe["size"] < 400_000:
        ok = False
        notes.append("master file suspiciously small")
    if crop45["width"] != 1080 or crop45["height"] != 1350:
        ok = False
        notes.append("4:5 crop wrong dimensions")
    if crop11["width"] != 1080 or crop11["height"] != 1080:
        ok = False
        notes.append("1:1 crop wrong dimensions")
    return ("PASS" if ok else "FAIL"), notes


def main() -> int:
    auth_header()
    for d in (PUBLIC, SOURCE, GENERATED, PUBLIC / "qc", PUBLIC / "posters"):
        d.mkdir(parents=True, exist_ok=True)

    upload_src = ASSETS_UPLOAD / SRC_GLOB
    if not upload_src.exists():
        raise SystemExit(f"missing source image {upload_src}")

    original = PUBLIC / ORIGINAL_NAME
    if not original.exists():
        shutil.copy2(upload_src, original)

    i2v_still = SOURCE / I2V_STILL_NAME
    crop_meta = crop_to_1080x1920(upload_src, i2v_still, 0.5, 0.5)
    print(f"I2V still {i2v_still} crop={crop_meta}", flush=True)

    raw_path = GENERATED / RAW_HF_NAME
    master_path = PUBLIC / "final" / MASTER_NAME
    master_path.parent.mkdir(parents=True, exist_ok=True)
    crop45_path = PUBLIC / "final" / CROP_45_NAME
    crop11_path = PUBLIC / "final" / CROP_11_NAME

    manifest: dict = {}
    if MANIFEST.exists():
        try:
            manifest = json.loads(MANIFEST.read_text())
        except json.JSONDecodeError:
            manifest = {}

    video_step = manifest.get("video") if isinstance(manifest.get("video"), dict) else {}
    job_id = str(video_step.get("job_id") or "")
    total_usd = float(manifest.get("total_usd") or 0.0)

    force = os.environ.get("TDG_FORCE_REGENERATE", "").strip().lower() in {"1", "true", "yes"}
    if force:
        attempt_raw = GENERATED / f"flavours_bistro_impossible_platter_hf_raw_attempt{ATTEMPT_TAG}.mp4"
        if raw_path.exists():
            shutil.move(str(raw_path), str(attempt_raw))
        for p in (master_path, crop45_path, crop11_path):
            if p.exists():
                p.unlink()

    if master_path.exists() and master_path.stat().st_size > 500_000 and not force:
        print(f"REUSE master {master_path}", flush=True)
    else:
        if not raw_path.exists() or raw_path.stat().st_size < 200_000 or force:
            public_url = upload_image(i2v_still)
            prompt = I2V_PROMPT + NEGATIVE
            est_body = hf_json(
                "POST",
                f"/estimate/{MODEL_ID}",
                {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
            )
            est_usd = float(est_body.get("usd"))
            est_credits = est_body.get("credits")
            print(f"ESTIMATE ${est_usd:.4f} credits={est_credits} duration={DURATION}s", flush=True)
            if est_usd > BUDGET_USD:
                raise SystemExit(f"STOP: estimate ${est_usd:.4f} exceeds budget ${BUDGET_USD:.2f}")
            sub = hf_json(
                "POST",
                f"/{MODEL_ID}",
                {"image_url": public_url, "prompt": prompt, "duration": DURATION, "sound": "off"},
            )
            job_id = str(sub.get("request_id") or "")
            if not job_id:
                raise RuntimeError(f"submit failed: {sub}")
            done = poll_request(job_id)
            vurl = video_url_from_status(done)
            if not vurl:
                raise RuntimeError(f"completed job missing video url: {done}")
            download(vurl, raw_path)
            total_usd = est_usd
            video_step = {
                "model": MODEL_ID,
                "job_id": job_id,
                "source_image": str(i2v_still.relative_to(ROOT)),
                "hf_upload_url": public_url,
                "raw_path": str(raw_path.relative_to(ROOT)),
                "generation_cost_usd": est_usd,
                "credits": done.get("credits") or est_credits,
                "raw_probe": ffprobe_video(raw_path),
            }
        else:
            print(f"REUSE raw HF {raw_path}", flush=True)

        master_probe = normalize_master_9x16(raw_path, master_path)
        video_step["master_path"] = str(master_path.relative_to(ROOT))
        video_step["master_probe"] = master_probe

    master_probe = ffprobe_video(master_path)
    crop45_probe = export_center_crop(master_path, crop45_path, 1080, 1350)
    crop11_probe = export_center_crop(master_path, crop11_path, 1080, 1080)

    qc_frames = extract_qc_frames(master_path, PUBLIC / "qc", master_probe["duration"])
    poster = PUBLIC / "posters" / "flavours_bistro_impossible_platter_hero.jpg"
    poster_from_master(master_path, poster)

    qc_status, qc_notes = automated_qc_gate(master_probe, crop45_probe, crop11_probe)

    manifest = {
        "concept": "Flavours Bistro · The Impossible Platter · Meta ad master",
        "client": "Flavours Bistro",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "model": MODEL_ID,
        "duration_seconds": DURATION,
        "sound": "off",
        "source_original": str(original.relative_to(ROOT)),
        "i2v_still": str(i2v_still.relative_to(ROOT)),
        "i2v_still_crop": crop_meta,
        "prompt": I2V_PROMPT,
        "video": video_step if video_step else {"master_path": str(master_path.relative_to(ROOT))},
        "deliverables": {
            "hf_raw": str(raw_path.relative_to(ROOT)) if raw_path.exists() else None,
            "master_9x16": str(master_path.relative_to(ROOT)),
            "meta_4x5": str(crop45_path.relative_to(ROOT)),
            "meta_1x1": str(crop11_path.relative_to(ROOT)),
            "poster": str(poster.relative_to(ROOT)),
        },
        "probes": {
            "master": master_probe,
            "meta_4x5": crop45_probe,
            "meta_1x1": crop11_probe,
        },
        "qc_frames": qc_frames,
        "quality_gate": {
            "automated": qc_status,
            "notes": qc_notes,
            "human_visual": "PENDING",
        },
        "total_usd": round(total_usd, 4),
        "job_id": job_id or video_step.get("job_id"),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    print(json.dumps({"quality_gate_automated": qc_status, "notes": qc_notes, "manifest": str(MANIFEST)}, indent=2))
    print(f"DONE master={master_path}", flush=True)
    return 0 if qc_status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

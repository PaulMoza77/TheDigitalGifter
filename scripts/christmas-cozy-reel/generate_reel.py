#!/usr/bin/env python3
"""Generate 3 Replicate image-to-video clips and merge a 9:16 Christmas Reel."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS_SRC = Path("/home/ubuntu/.cursor/projects/workspace/assets")
OUT_DIR = ROOT / "public" / "assets" / "christmas" / "cozy-reel"
SOURCE_DIR = OUT_DIR / "source"
FONT = "/usr/share/fonts/truetype/noto/NotoSerifDisplay-Regular.ttf"
OVERLAY_TEXT = "100 DAYS LEFT UNTIL CHRISTMAS"
NEGATIVE_PROMPT = (
    "fake zoom, slideshow, pan only, static image, distorted hands, duplicated objects, "
    "warped face, melting objects, flickering geometry, deformed mug, deformed dog, extra limbs, "
    "bad anatomy, surreal movement, text artifacts, subtitles, watermarks"
)

CLIP_PROMPTS = {
    "clip1": (
        "A cozy cinematic Christmas living room at night, ultra warm and photorealistic. "
        "Real motion inside the scene: the fireplace flames flicker naturally, the Christmas tree lights "
        "softly twinkle, candle flames flicker, and snow falls gently outside the large window. "
        "Subtle slow cinematic push-in camera movement. The atmosphere should feel warm, magical, festive, "
        "and luxurious. Preserve the original composition and objects. Keep motion realistic and subtle, "
        "not exaggerated. No morphing, no object deformation, no surreal movement, no fake slideshow effect, no text."
    ),
    "clip2": (
        "A close cozy Christmas scene with a festive mug of hot chocolate in the foreground and a sleepy "
        "golden retriever beside it. Real motion inside the scene: steam rises gently from the hot chocolate, "
        "the dog breathes subtly and may blink once, candlelight flickers softly in the background, Christmas "
        "lights twinkle, and the camera has a very subtle cinematic handheld drift or slow push-in. Preserve "
        "the original cozy composition. Warm, intimate, photorealistic, shallow depth of field. No morphing, "
        "no extra limbs, no object duplication, no fake slideshow effect, no text."
    ),
    "clip3": (
        "A cozy Christmas living room scene with fireplace, Christmas tree, candles, and snowy winter view "
        "outside. Real motion inside the scene: fireplace flames flicker, candle flames flicker, Christmas "
        "lights twinkle, snow falls outside, and the camera slowly drifts forward in a smooth cinematic way. "
        "Preserve the original composition and cozy atmosphere. Warm, photorealistic, magical holiday feeling. "
        "No morphing, no surreal motion, no fake slideshow effect, no text generated inside the scene."
    ),
}

IMAGE_MAP = {
    "clip1": "01a0ab89-10de-7cbb-9054-74e1e171c76b.jpg",
    "clip2": "01a0ab89-10f7-7bd6-bdc2-36837e92ed94.jpg",
    "clip3": "01a0ab89-110e-7855-8dd8-b07e6d8777bc.jpg",
}

# Prefer Kling 3.0 for cinematic I2V + 5s + negative prompt + start image.
# Fall back through proven I2V models if a create call is rejected.
MODEL_CHAIN = [
    {
        "name": "kwaivgi/kling-v3-video",
        "why": (
            "Best current Replicate I2V for cinematic indoor motion: start_image, native 5s duration, "
            "1080p pro mode, negative_prompt, and aspect follows the 9:16 still."
        ),
        "input": lambda prompt, image: {
            "prompt": prompt,
            "start_image": image,
            "duration": 5,
            "mode": "pro",
            "generate_audio": False,
            "negative_prompt": NEGATIVE_PROMPT,
        },
    },
    {
        "name": "kwaivgi/kling-v2.5-turbo-pro",
        "why": "Strong cinematic I2V fallback with 5s clips, start_image, and negative_prompt.",
        "input": lambda prompt, image: {
            "prompt": prompt,
            "start_image": image,
            "duration": 5,
            "negative_prompt": NEGATIVE_PROMPT,
        },
    },
    {
        "name": "bytedance/seedance-1-pro",
        "why": "Reliable 5s I2V with real scene motion; TDG production video model family.",
        "input": lambda prompt, image: {
            "prompt": prompt,
            "image": image,
            "duration": 5,
            "resolution": "1080p",
            "fps": 24,
            "camera_fixed": False,
        },
    },
]

API = "https://api.replicate.com/v1"
UA = "TheDigitalGifter-christmas-cozy-reel/1.0"


def token() -> str:
    value = (os.environ.get("REPLICATE_API_TOKEN") or "").strip()
    if not value:
        raise SystemExit("REPLICATE_API_TOKEN is not set")
    return value


def request(method: str, url: str, *, data: bytes | None = None, content_type: str | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {token()}",
        "User-Agent": UA,
        "Accept": "application/json",
    }
    if data is not None and content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} -> {exc.code}: {body[:1200]}") from exc


def upload_image(path: Path) -> str:
    boundary = "----ReelBoundary7MA4YWxkTrZu0gW"
    filename = path.name
    payload = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="content"; filename="{filename}"\r\n'
        "Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8") + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token()}",
        "User-Agent": UA,
        "Accept": "application/json",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    req = urllib.request.Request(f"{API}/files", data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            created = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"file upload failed {exc.code}: {body[:1200]}") from exc
    urls = created.get("urls") or {}
    url = urls.get("get") or created.get("url")
    if not url:
        raise RuntimeError(f"upload missing url: {created}")
    return str(url)


def create_prediction(model: str, input_payload: dict) -> dict:
    return request(
        "POST",
        f"{API}/models/{model}/predictions",
        data=json.dumps({"input": input_payload}).encode("utf-8"),
        content_type="application/json",
    )


def get_prediction(prediction_id: str) -> dict:
    return request("GET", f"{API}/predictions/{prediction_id}")


def output_url(output: object) -> str | None:
    if isinstance(output, str) and output.startswith("http"):
        return output
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and item.startswith("http"):
                return item
    if isinstance(output, dict):
        url = output.get("url")
        if isinstance(url, str) and url.startswith("http"):
            return url
    return None


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as resp:
        dest.write_bytes(resp.read())


def start_clip(clip_id: str, image_url: str) -> dict:
    last_error = None
    for spec in MODEL_CHAIN:
        try:
            created = create_prediction(spec["name"], spec["input"](CLIP_PROMPTS[clip_id], image_url))
        except Exception as exc:  # noqa: BLE001 — try next model
            last_error = exc
            print(f"{clip_id}: {spec['name']} create failed: {exc}", file=sys.stderr)
            continue
        status = created.get("status")
        if created.get("id") and status not in {"failed", "canceled"}:
            print(json.dumps({"clip": clip_id, "model": spec["name"], "prediction": created.get("id"), "status": status}))
            return {
                "clip": clip_id,
                "model": spec["name"],
                "why": spec["why"],
                "prediction_id": created["id"],
            }
        last_error = created.get("error") or created.get("detail") or created
        print(f"{clip_id}: {spec['name']} rejected: {last_error}", file=sys.stderr)
    raise RuntimeError(f"{clip_id} could not start: {last_error}")


def run_ffmpeg(args: list[str]) -> None:
    proc = subprocess.run(args, check=False, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-2000:] or proc.stdout[-2000:])


def concat_and_overlay(clip_paths: list[Path], final_path: Path) -> None:
    list_path = OUT_DIR / "concat.txt"
    list_path.write_text("".join(f"file '{p.resolve()}'\n" for p in clip_paths), encoding="utf-8")
    merged = OUT_DIR / "merged_raw.mp4"
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "24",
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
            "-an",
            str(merged),
        ]
    )
    # Overlay only in the last 2.5s of the ~15s reel.
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(merged),
            "-vf",
            (
                "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
                "drawtext="
                f"fontfile={FONT}:"
                f"text='{OVERLAY_TEXT}':"
                "fontcolor=white:"
                "fontsize=46:"
                "line_spacing=8:"
                "x=(w-text_w)/2:"
                "y=(h*0.42-text_h/2):"
                "shadowcolor=black@0.7:"
                "shadowx=3:"
                "shadowy=4:"
                "borderw=1:"
                "bordercolor=black@0.25:"
                "enable='gte(t,12.5)'"
            ),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "24",
            "-movflags",
            "+faststart",
            "-an",
            str(final_path),
        ]
    )


def copy_sources() -> dict[str, Path]:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for clip_id, name in IMAGE_MAP.items():
        src = ASSETS_SRC / name
        if not src.exists():
            raise SystemExit(f"missing source image: {src}")
        dest = SOURCE_DIR / f"{clip_id}.jpg"
        dest.write_bytes(src.read_bytes())
        paths[clip_id] = dest
    return paths


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = copy_sources()
    print("Uploading stills to Replicate…")
    image_urls = {clip_id: upload_image(path) for clip_id, path in sources.items()}
    jobs = [start_clip(clip_id, image_urls[clip_id]) for clip_id in ("clip1", "clip2", "clip3")]
    selected = {job["model"] for job in jobs}
    print("SELECTED_MODELS", json.dumps({job["clip"]: {"model": job["model"], "why": job["why"]} for job in jobs}))

    pending = {job["prediction_id"]: job for job in jobs}
    finished: list[dict] = []
    started = time.time()
    while pending:
        if time.time() - started > 900:
            raise TimeoutError(f"clips still pending: {list(pending)}")
        for pred_id in list(pending):
            job = pending[pred_id]
            pred = get_prediction(pred_id)
            status = pred.get("status")
            print(f"{job['clip']}: {status}")
            if status == "succeeded":
                url = output_url(pred.get("output"))
                if not url:
                    raise RuntimeError(f"{job['clip']} succeeded with no output URL: {pred.get('output')}")
                job["output_url"] = url
                finished.append(job)
                del pending[pred_id]
            elif status in {"failed", "canceled"}:
                raise RuntimeError(f"{job['clip']} {status}: {pred.get('error')}")
        if pending:
            time.sleep(8)
    finished.sort(key=lambda job: job["clip"])

    clip_paths = []
    for job in finished:
        dest = OUT_DIR / f"{job['clip']}.mp4"
        print(f"Downloading {job['clip']} from {job['output_url']}")
        download(job["output_url"], dest)
        clip_paths.append(dest)

    concat_and_overlay(clip_paths, OUT_DIR / "final_reel.mp4")
    (OUT_DIR / "generation_manifest.json").write_text(
        json.dumps(
            {
                "models": {job["clip"]: job["model"] for job in finished},
                "why": {job["clip"]: job["why"] for job in finished},
                "selected_unique": sorted(selected),
                "predictions": {job["clip"]: job["prediction_id"] for job in finished},
                "negative_prompt": NEGATIVE_PROMPT,
                "outputs": {
                    "clip1": str(OUT_DIR / "clip1.mp4"),
                    "clip2": str(OUT_DIR / "clip2.mp4"),
                    "clip3": str(OUT_DIR / "clip3.mp4"),
                    "final_reel": str(OUT_DIR / "final_reel.mp4"),
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("DONE", OUT_DIR)


if __name__ == "__main__":
    main()

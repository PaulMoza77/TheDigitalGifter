#!/usr/bin/env python3
"""Generate 5 Higgsfield Kling 3.0 Pro I2V masters (5s, sound=off) and 3 Reels.

Fails closed if Higgsfield credentials are missing. Never uses Replicate.
Credentials: HF_CREDENTIALS=KEY_ID:KEY_SECRET (or HF_API_KEY_ID + HF_API_KEY_SECRET).
Never print credential values.
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
ESTIMATE_PATH = "/estimate/kling-video/v3.0/pro/image-to-video"
SUBMIT_PATH = "/kling-video/v3.0/pro/image-to-video"
DURATION = 5
BUDGET_USD = 2.00
PREVIOUS_JOB_ID = "086e782a-6cc2-47cc-9131-1b5bc3d6830c"

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
SOURCE = Path(os.environ.get("TDG_SOURCE") or (ROOT / "source" / "batch-sep18"))
MASTERS = Path(os.environ.get("TDG_MASTERS") or (ROOT / "public" / "assets" / "christmas" / "reels" / "masters"))
FINALS = Path(os.environ.get("TDG_FINALS") or (ROOT / "public" / "assets" / "christmas" / "reels" / "final"))
POSTERS = Path(os.environ.get("TDG_POSTERS") or (ROOT / "public" / "assets" / "christmas" / "reels" / "posters"))
LOG = Path(os.environ.get("TDG_LOG") or (ROOT / "public" / "assets" / "christmas" / "reels" / "generation_manifest.json"))
GENLOG = Path(os.environ.get("TDG_GENLOG") or (ROOT / "generated" / "batch-sep18" / "generation_log.json"))

CLIPS = [
    {
        "id": "christmas_master_01",
        "filename": "christmas_master_01.mp4",
        "image": SOURCE / "alpine_chalet_hot_tub_1080x1920.png",
        "source_still": "alpine_chalet_hot_tub.jpg",
        "title": "Alpine chalet hot tub",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas dusk. This exact luxury Alpine chalet photograph comes alive "
            "for five seconds. Preserve the house, glass gable, stone chimney, interior Christmas tree, "
            "fireplace, dining table, outdoor fire pit seating, wooden hot tub, lanterns, candles, "
            "snow-covered stones, pine trees, and mountain range exactly as in the first frame. "
            "Hot-tub water ripples gently with steam rising naturally. Candle flames and lanterns flicker "
            "extremely subtly. Fairy lights on the eaves twinkle very softly. Distant fireplace flames breathe. "
            "A few pine needles shift in a cold breeze. Natural sparse snowfall, not a fake overlay. "
            "Very slow cinematic push-in toward the chalet with tiny lens breathing. Architecture stays rigid. "
            "No new people. No morphing. Archival-cinematic luxury Christmas footage."
        ),
    },
    {
        "id": "christmas_master_02",
        "filename": "christmas_master_02.mp4",
        "image": SOURCE / "nyc_ice_skater_1080x1920.png",
        "source_still": "nyc_ice_skater.jpg",
        "title": "NYC ice skater",
        "prompt": (
            "Photoreal cinematic 9:16 New York Christmas night. This exact photograph of the young woman "
            "ice skating comes alive for five seconds. Preserve her face, long brown hair, cream knit sweater, "
            "red scarf, white ruffled skirt, black tights, cream gloves, white ice skates, brownstone wreaths, "
            "streetlamps, and Empire State Building exactly as in the first frame. "
            "She continues one natural skating stride forward on the ice with realistic weight shift, "
            "arm balance, and a small natural blink. Hair and scarf drift slightly in cold air. "
            "Ice reflections slide. Distant lights twinkle. Soft natural snowfall. "
            "Very subtle tracking / slow push-in matching her glide. Skyline and buildings stay structurally stable. "
            "No extra people, no face morph, no warped skates. Genuine cinematic Christmas footage."
        ),
    },
    {
        "id": "christmas_master_03",
        "filename": "christmas_master_03.mp4",
        "image": SOURCE / "village_kids_sledding_1080x1920.png",
        "source_still": "village_kids_sledding.jpg",
        "title": "Village kids sledding",
        "prompt": (
            "Photoreal cinematic 9:16 Alpine Christmas village at sunset. This exact photograph comes alive "
            "for five seconds. Preserve the three children, wooden sleds, golden retriever, stone houses, "
            "garlands, lake, church steeple, bridge, and mountains exactly as in the first frame. "
            "The girl in the green coat and red hat slides a little farther down the lane with realistic sled "
            "physics and joyful body motion. The boy in the blue coat follows on his sled. The child behind "
            "continues naturally. The golden retriever trots beside them with realistic gait. "
            "Chimney smoke rises. Warm window lights twinkle. Natural snowfall. Footsteps and sleds lightly "
            "disturb the snow. Very slow cinematic push-in. Houses and mountains stay rigid. "
            "Preserve all faces and clothing. No extra children. No warped sleds."
        ),
    },
    {
        "id": "christmas_master_04",
        "filename": "christmas_master_04.mp4",
        "image": SOURCE / "prague_cafe_cookies_1080x1920.png",
        "source_still": "prague_cafe_cookies.jpg",
        "title": "Prague cafe cookies",
        "prompt": (
            "Photoreal cinematic 9:16 Christmas bakery cafe. This exact photograph comes alive for five seconds. "
            "Preserve the gingerbread cookies, linzer cookies, cinnamon roll, bundt cake, muffins, floral cocoa "
            "mug with whipped cream, lantern candle, plaid scarf on the chair, pastry case, window, and the "
            "snowy Prague Charles Bridge / Old Town towers outside exactly as in the first frame. "
            "Candle flame flickers extremely subtly. Faint steam rises from the cocoa. Warm fairy lights twinkle. "
            "Tiny snow drift visible through the window. Distant pedestrians outside take a few slow steps only "
            "if they stay sharp. Very slow cinematic push-in toward the cookie plate. Food, mug, and architecture "
            "remain structurally stable. No melting pastry, no morphing cookies, no new objects."
        ),
    },
    {
        "id": "christmas_master_05",
        "filename": "christmas_master_05.mp4",
        "image": SOURCE / "vintage_snowman_1080x1920.png",
        "source_still": "vintage_snowman.jpg",
        "title": "Vintage snowman",
        "prompt": (
            "Photoreal vintage Christmas home-movie 9:16. This exact photograph of three children building a "
            "snowman comes alive for five seconds. Preserve the boy in the red coat, the girl in the green coat, "
            "the kneeling child in the navy coat, the snowman with top hat and red plaid scarf, the vintage sled, "
            "the cream house with wreath and garland, the parked vintage cars, and the neighboring houses "
            "exactly as in the first frame. "
            "The standing boy makes a small natural adjustment to the snowman's face. The girl smiles and "
            "steadies the scarf with realistic hand motion. The kneeling child packs a little snow at the base. "
            "Natural blinking. Clothing shifts slightly. Soft snowfall. Porch lights glow steadily. "
            "Very subtle cinematic push-in with tiny handheld breathing, like a high-quality scan of archival film. "
            "Cars and house stay completely structurally stable. Preserve all faces and period clothing. "
            "No extra people, no morphing snowman, no bending vehicles."
        ),
    },
]


def read_credentials() -> tuple[str, str]:
    combined = (os.environ.get("HF_CREDENTIALS") or os.environ.get("HF_KEY") or "").strip()
    if ":" in combined:
        key_id, secret = combined.split(":", 1)
        key_id, secret = key_id.strip(), secret.strip()
        if key_id and secret:
            return key_id, secret
    key_id = (os.environ.get("HF_API_KEY_ID") or os.environ.get("HF_API_KEY") or "").strip()
    secret = (os.environ.get("HF_API_KEY_SECRET") or os.environ.get("HF_SECRET") or os.environ.get("HF_API_SECRET") or "").strip()
    if key_id and secret:
        return key_id, secret
    print(
        "BLOCKED: Higgsfield credentials missing. Set HF_CREDENTIALS on the job runner "
        "(VPS container thedigitalgifter). Fail closed — no Replicate fallback.",
        file=sys.stderr,
    )
    raise SystemExit(2)


def auth_header() -> str:
    key_id, secret = read_credentials()
    return f"Key {key_id}:{secret}"


def hf_request(method: str, path_or_url: str, data: dict | None = None, timeout: int = 180) -> dict:
    url = path_or_url if path_or_url.startswith("http") else f"{HIGGSFIELD_API_BASE}{path_or_url}"
    body = None if data is None else json.dumps(data).encode()
    headers = {
        "Authorization": auth_header(),
        "User-Agent": "tdg-christmas-batch-sep18/higgsfield",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {url} -> {e.code} {err[:800]}") from e


def parse_estimate(body: unknown) -> dict:
    if not isinstance(body, dict):
        raise RuntimeError(f"estimate response not an object: {body!r}")
    usd_raw = body.get("usd") if isinstance(body, dict) else None
    usd = float(usd_raw) if usd_raw is not None else float("nan")
    if not (usd >= 0):
        raise RuntimeError(f"live estimate missing usd: {body}")
    credits = body.get("credits")
    return {"usd": usd, "credits": None if credits is None else str(credits), "raw": body}


def video_url_from_status(body: dict) -> str | None:
    video = body.get("video")
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    if isinstance(body.get("video_url"), str):
        return body["video_url"]
    return None


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": ctype})
    public_url = meta.get("public_url")
    upload_url = meta.get("upload_url")
    if not public_url or not upload_url:
        raise RuntimeError(f"upload URL missing fields: keys={list(meta.keys())}")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    data = path.read_bytes()
    req = urllib.request.Request(str(upload_url), data=data, method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def clip_payload(image_url: str, prompt: str) -> dict:
    return {
        "image_url": image_url,
        "prompt": prompt,
        "duration": DURATION,
        "sound": "off",
    }


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-batch-sep18/higgsfield"})
    with urllib.request.urlopen(req, timeout=180) as resp, dest.open("wb") as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)


def ffprobe(path: Path) -> dict:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,avg_frame_rate,codec_name,duration,bit_rate",
            "-show_entries",
            "format=duration,bit_rate,size",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(raw)


def probe_summary(path: Path) -> dict:
    data = ffprobe(path)
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
        "path": str(path),
        "duration": float(fmt.get("duration") or stream.get("duration") or 0),
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "codec": stream.get("codec_name"),
        "fps": round(fps, 3),
        "bitrate": int(fmt.get("bit_rate") or stream.get("bit_rate") or 0),
        "size": int(fmt.get("size") or path.stat().st_size),
    }


def validate_master(info: dict) -> None:
    if info["width"] < 1080 or info["height"] < 1080:
        raise RuntimeError(f"{info['filename']} too small: {info['width']}x{info['height']}")
    if info["duration"] < 4.5 or info["duration"] > 6.5:
        raise RuntimeError(f"{info['filename']} duration {info['duration']}")
    if info["size"] < 200_000:
        raise RuntimeError(f"{info['filename']} looks empty/corrupt ({info['size']} bytes)")


def ffmpeg_available() -> bool:
    return bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def export_reel(dest: Path, specs: list[tuple[Path, float, float]]) -> dict:
    dest.parent.mkdir(parents=True, exist_ok=True)
    inputs: list[str] = []
    filters: list[str] = []
    for i, (src, start, dur) in enumerate(specs):
        inputs.extend(["-i", str(src)])
        filters.append(
            f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
            "fps=30,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p[v{i}]".format(i=i)
        )
    n = len(specs)
    concat_in = "".join(f"[v{i}]" for i in range(n))
    filters.append(f"{concat_in}concat=n={n}:v=1:a=0[out]")
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
    info = probe_summary(dest)
    if info["width"] != 1080 or info["height"] != 1920:
        raise RuntimeError(f"{dest.name} not 1080x1920")
    if info["duration"] < 11.5 or info["duration"] > 16.5:
        raise RuntimeError(f"{dest.name} duration {info['duration']} outside 12–15s target window")
    return info


def poster(src: Path, dest: Path, t: float = 0.4) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def verify_auth() -> None:
    print("HIGGSFIELD_AUTH: ping generate-upload-url", flush=True)
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": "image/png"})
    if not meta.get("upload_url"):
        raise RuntimeError("HIGGSFIELD_AUTH FAIL: upload URL response missing upload_url")
    print("HIGGSFIELD_AUTH: PASS", flush=True)
    print(f"MODEL: {MODEL_ID}", flush=True)
    try:
        prev = hf_request("GET", f"/requests/{PREVIOUS_JOB_ID}/status")
        print(
            f"previous_id {PREVIOUS_JOB_ID} higgsfield_status={prev.get('status')}",
            flush=True,
        )
    except RuntimeError as err:
        print(
            f"previous_id {PREVIOUS_JOB_ID} is the TDG job row from the earlier estimate test; "
            f"Higgsfield /requests lookup skipped ({str(err)[:120]})",
            flush=True,
        )


def poll_job(request_id: str, timeout_s: int = 1200) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        current = hf_request("GET", f"/requests/{request_id}/status")
        status = str(current.get("status") or "")
        print(f"  {request_id} {status}", flush=True)
        if status.lower() in {"completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"}:
            return current
        time.sleep(8)
    raise TimeoutError(f"Higgsfield job {request_id} timed out")


def main() -> int:
    estimate_only = "--estimate-only" in sys.argv
    skip_reels = "--skip-reels" in sys.argv
    read_credentials()
    verify_auth()

    MASTERS.mkdir(parents=True, exist_ok=True)
    GENLOG.parent.mkdir(parents=True, exist_ok=True)

    uploads: dict[str, str] = {}
    for clip in CLIPS:
        if not clip["image"].exists():
            raise SystemExit(f"missing still {clip['image']}")
        print(f"Uploading {clip['image'].name}...", flush=True)
        uploads[clip["id"]] = upload_image(clip["image"])

    estimates = []
    total_usd = 0.0
    print("=" * 72)
    print("LIVE HIGGSFIELD ESTIMATE")
    for clip in CLIPS:
        payload = clip_payload(uploads[clip["id"]], clip["prompt"])
        body = hf_request("POST", ESTIMATE_PATH, payload)
        est = parse_estimate(body)
        estimates.append({"id": clip["id"], **est})
        total_usd += est["usd"]
        print(f"  {clip['id']}: ${est['usd']:.4f}  credits={est['credits']}", flush=True)
    print(f"Per clip (first): ${estimates[0]['usd']:.4f}")
    print(f"5 clips: ${total_usd:.4f}")
    credits_vals = []
    for row in estimates:
        try:
            credits_vals.append(float(row["credits"]))
        except (TypeError, ValueError):
            credits_vals.append(None)
    if all(v is not None for v in credits_vals):
        print(f"Credits per clip: {credits_vals[0]}")
        print(f"Total credits: {sum(credits_vals):.4f}")
    else:
        print("Credits per clip: (see rows above)")
        print("Total credits: (see rows above)")
    print("=" * 72, flush=True)

    if total_usd > BUDGET_USD:
        print(f"STOP: live Higgsfield total ${total_usd:.4f} exceeds ${BUDGET_USD:.2f}", flush=True)
        LOG.parent.mkdir(parents=True, exist_ok=True)
        LOG.write_text(
            json.dumps(
                {
                    "status": "BLOCKED_PRICE",
                    "provider": "higgsfield",
                    "model": MODEL_ID,
                    "estimated_total_usd": total_usd,
                    "estimates": [{k: v for k, v in row.items() if k != "raw"} for row in estimates],
                },
                indent=2,
            )
            + "\n"
        )
        return 3

    if estimate_only:
        print("estimate-only: not submitting paid jobs", flush=True)
        return 0

    print("PRICE CHECK: total <= $2.00 — proceeding with paid Higgsfield generation", flush=True)
    jobs = []
    for clip, est in zip(CLIPS, estimates):
        payload = clip_payload(uploads[clip["id"]], clip["prompt"])
        print(f"Submitting {clip['id']}...", flush=True)
        submitted = hf_request("POST", SUBMIT_PATH, payload)
        request_id = submitted.get("request_id")
        if not request_id:
            raise RuntimeError(f"submit missing request_id: {submitted}")
        print(f"  job={request_id} status={submitted.get('status')}", flush=True)
        jobs.append({"clip": clip, "estimate": est, "submit": submitted, "request_id": str(request_id)})
        time.sleep(2)

    log = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "provider": "higgsfield",
        "model": MODEL_ID,
        "duration": DURATION,
        "sound": "off",
        "estimated_total_usd": total_usd,
        "clips": [],
        "reels": [],
    }

    for item in jobs:
        clip = item["clip"]
        request_id = item["request_id"]
        print(f"Polling {clip['id']} {request_id}...", flush=True)
        done = poll_job(request_id)
        status = str(done.get("status") or "").lower()
        if status not in {"completed", "succeeded"}:
            raise RuntimeError(f"{clip['id']} failed: status={done.get('status')} error={done.get('error')}")
        url = video_url_from_status(done)
        if not url:
            raise RuntimeError(f"{clip['id']} missing video url: keys={list(done.keys())}")
        dest = MASTERS / clip["filename"]
        print(f"Downloading {clip['id']} -> {dest}", flush=True)
        download(url, dest)
        info = None
        if ffmpeg_available():
            info = probe_summary(dest)
            validate_master(info)
            print(
                f"FFPROBE {info['filename']} {info['width']}x{info['height']} "
                f"{info['duration']:.3f}s {info['codec']} {info['fps']}fps",
                flush=True,
            )
        else:
            size = dest.stat().st_size
            print(f"DOWNLOADED {dest.name} bytes={size} (ffprobe later)", flush=True)
            if size < 200_000:
                raise RuntimeError(f"{dest.name} looks empty")
        cost = item["estimate"]["usd"]
        entry = {
            "id": clip["id"],
            "title": clip["title"],
            "source_image": clip["source_still"],
            "job_id": request_id,
            "model": MODEL_ID,
            "prompt": clip["prompt"],
            "generation_cost_usd": cost,
            "credits": item["estimate"]["credits"],
            "file": str(dest),
            "probe": info,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        log["clips"].append(entry)
        GENLOG.parent.mkdir(parents=True, exist_ok=True)
        GENLOG.write_text(json.dumps(log, indent=2) + "\n")
        LOG.parent.mkdir(parents=True, exist_ok=True)
        LOG.write_text(json.dumps(log, indent=2) + "\n")

    if skip_reels or not ffmpeg_available():
        print("Masters ready. Skipping reel assembly on this host.", flush=True)
        return 0

    FINALS.mkdir(parents=True, exist_ok=True)
    POSTERS.mkdir(parents=True, exist_ok=True)
    m = {c["id"]: MASTERS / c["filename"] for c in CLIPS}
    cinematic = export_reel(
        FINALS / "christmas_reel_cinematic_01.mp4",
        [
            (m["christmas_master_01"], 0.20, 3.00),
            (m["christmas_master_03"], 0.15, 3.00),
            (m["christmas_master_05"], 0.20, 3.00),
            (m["christmas_master_04"], 0.15, 3.00),
            (m["christmas_master_02"], 0.15, 3.00),
        ],
    )
    social = export_reel(
        FINALS / "christmas_reel_social_hook_02.mp4",
        [
            (m["christmas_master_02"], 0.05, 2.20),
            (m["christmas_master_03"], 0.10, 2.40),
            (m["christmas_master_01"], 0.15, 2.40),
            (m["christmas_master_04"], 0.10, 2.50),
            (m["christmas_master_05"], 0.15, 2.50),
        ],
    )
    nostalgic = export_reel(
        FINALS / "christmas_reel_nostalgic_03.mp4",
        [
            (m["christmas_master_05"], 0.25, 3.20),
            (m["christmas_master_03"], 0.20, 3.00),
            (m["christmas_master_04"], 0.20, 2.80),
            (m["christmas_master_01"], 0.25, 2.80),
            (m["christmas_master_02"], 0.20, 2.70),
        ],
    )
    for name, info in [
        ("christmas_reel_cinematic_01", cinematic),
        ("christmas_reel_social_hook_02", social),
        ("christmas_reel_nostalgic_03", nostalgic),
    ]:
        poster(FINALS / f"{name}.mp4", POSTERS / f"{name}.jpg")
        log["reels"].append({"id": name, "probe": info, "file": str(FINALS / f"{name}.mp4")})
    for clip in CLIPS:
        poster(MASTERS / clip["filename"], POSTERS / f"{clip['id']}.jpg")
    log["status"] = "COMPLETE"
    LOG.write_text(json.dumps(log, indent=2) + "\n")
    GENLOG.write_text(json.dumps(log, indent=2) + "\n")
    print("All masters and reels written.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

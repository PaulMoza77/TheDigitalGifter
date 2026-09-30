#!/usr/bin/env python3
"""Christmas Factory 200 — video-first operational override.

Independent Recraft image + Kling I2V pools. Persist request IDs immediately.
Cap ready-image buffer at ~2× active I2V concurrency. Ramp Kling 6→8→10→12→16
only while stable. Resume in-flight Higgsfield jobs. Do not cancel live jobs.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get("TDG_ROOT") or "/workspace")
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))
from christmas_factory_200_matrix import BUCKETS, build_scenes  # noqa: E402

HIGGSFIELD_API_BASE = "https://api.higgsfield.ai"
IMAGE_MODEL = "recraft/v4.1/pro/text-to-image"
VIDEO_MODEL = "kling-video/v3.0/pro/image-to-video"
DURATION = 5
BATCH_ID = "christmas-factory-200-alive-20260930"
TARGET = int(os.environ.get("TDG_FACTORY_TARGET") or 200)
KLING_STEPS = [6, 8, 10, 12, 16]
BUFFER_MULT = 2
STABILITY_SUCCESSES = 3
ABNORMAL_LATENCY_S = 420.0
START_VIDEO_CONCURRENCY = int(os.environ.get("TDG_FACTORY_VIDEO_CONCURRENCY") or 8)
IMAGE_WORKERS = int(os.environ.get("TDG_FACTORY_IMAGE_WORKERS") or 2)

OUT = ROOT / "generated/christmas-factory-200"
STILLS = OUT / "stills"
MASTERS = OUT / "masters"
POSTERS = OUT / "posters"
MANIFEST = OUT / "generation_manifest.json"
LIVE_STATUS = OUT / "live_status.txt"
OPS_STATE = OUT / "ops_state.json"
HANDOFF = OUT / "handoff_inflight.json"

IMAGE_SUFFIX = (
    " I CAN'T WAIT FOR CHRISTMAS. Photorealistic, bright, warm, alive, magical. "
    "Premium Christmas movie × childhood memory × holiday commercial × real life. "
    "Several practical Christmas lights: golden fairy lights, tree lights, warm windows, fireplace, candles, street decorations, storefront glow. "
    "Night stays luminous. No crushed blacks. Colors: warm gold, creamy white, clean bright snow, Christmas red, rich evergreen, warm wood, soft winter blue, healthy skin. "
    "Three layers: foreground flakes/bokeh lights, midground emotional action, background Christmas world. "
    "Vertical 9:16 photoreal MOMENT, not a location plate. Natural happiness, not poses. "
    "No gloomy gray desaturated low-key fashion-editorial, no plastic skin, no logos, no readable text."
)
MOTION_SUFFIX = (
    " SUBJECT ACTION + ENVIRONMENT ACTION + CAMERA ACTION. People and the world move. "
    "Snow at several depths, lights shimmer, fire/steam/walking/reflections as applicable. "
    "Gentle forward tracking only. Complete the still. No frozen humans, no zoom-only, no morphing."
)

_lock = threading.Lock()
_stop = threading.Event()
_metrics = {
    "http_429": 0,
    "concurrency_rejects": 0,
    "submit_failures": 0,
    "api_errors": 0,
    "abnormal_latency": 0,
    "last_throttle_at": 0.0,
    "stable_successes": 0,
    "video_concurrency": max(6, min(START_VIDEO_CONCURRENCY, 16)),
    "stable_concurrency": 6,
    "active_video": 0,
    "active_image": 0,
    "claimed_video": set(),
    "claimed_image": set(),
    "video_latencies": deque(maxlen=12),
    "video_done_times": deque(maxlen=40),
    "started_at": time.time(),
    "insufficient_funds": False,
    "stop_images": False,
    "expiring_usd": None,
    "permanent_usd": None,
    "balance_usd": None,
}


class ThrottleError(RuntimeError):
    pass


class ConcurrencyLimitError(RuntimeError):
    pass


class InsufficientFundsError(RuntimeError):
    pass


def try_load_hf() -> None:
    if (os.environ.get("HF_CREDENTIALS") or "").strip():
        return
    loader = ROOT / "scripts/_load_hf_credentials.sh"
    if loader.exists():
        proc = subprocess.run(["bash", str(loader)], capture_output=True, text=True, check=False)
        val = (proc.stdout or "").strip()
        if val and ":" in val:
            os.environ["HF_CREDENTIALS"] = val


def auth_header() -> str:
    try_load_hf()
    combined = (os.environ.get("HF_CREDENTIALS") or "").strip()
    if ":" not in combined:
        raise SystemExit("BLOCKED: Higgsfield credentials missing")
    kid, sec = combined.split(":", 1)
    return f"Key {kid.strip()}:{sec.strip()}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def classify_error_body(code: int, text: str) -> None:
    low = (text or "").lower()
    if code == 429 or "too many requests" in low:
        _metrics["http_429"] += 1
        _metrics["last_throttle_at"] = time.time()
        raise ThrottleError(f"{code} {text[:240]}")
    if code == 400 and "concurrent" in low:
        _metrics["concurrency_rejects"] += 1
        _metrics["last_throttle_at"] = time.time()
        raise ConcurrencyLimitError(f"{code} {text[:240]}")
    if (code in {402, 403} and "credit" in low) or any(
        s in low
        for s in (
            "insufficient_funds",
            "not enough credit",
            "not_enough_credit",
            "payment required",
            "out of credit",
            "out_of_credit",
        )
    ):
        raise InsufficientFundsError(f"{code} {text[:240]}")


def hf_request(method: str, path: str, data: dict | None = None, timeout: int = 180, idem: str | None = None) -> dict:
    url = path if path.startswith("http") else f"{HIGGSFIELD_API_BASE}{path}"
    body = None if data is None else json.dumps(data).encode()
    headers = {"Authorization": auth_header(), "Accept": "application/json", "User-Agent": "tdg-christmas-factory-200-ops"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if idem:
        headers["Idempotency-Key"] = idem[:255]
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    last_err: Exception | None = None
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode() if e.fp else ""
            classify_error_body(e.code, raw)
            if e.code in {502, 503, 504} and attempt < 5:
                _metrics["api_errors"] += 1
                time.sleep(2.5 * (attempt + 1))
                last_err = e
                continue
            _metrics["api_errors"] += 1
            raise RuntimeError(f"{method} {url} -> {e.code} {raw[:400]}") from e
        except TimeoutError as e:
            last_err = e
            time.sleep(2.0 * (attempt + 1))
        except urllib.error.URLError as e:
            last_err = e
            time.sleep(2.0 * (attempt + 1))
    raise RuntimeError(f"{method} {url} failed after retries: {last_err}")


def poll_job(request_id: str, timeout_s: int = 1800) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        if _stop.is_set():
            raise TimeoutError(f"stop {request_id}")
        try:
            cur = hf_request("GET", f"/requests/{request_id}/status", timeout=60)
        except (ThrottleError, ConcurrencyLimitError):
            time.sleep(8)
            continue
        except RuntimeError as e:
            if "502" in str(e) or "503" in str(e) or "504" in str(e):
                time.sleep(8)
                continue
            raise
        status = str(cur.get("status") or "").lower()
        if status in {"completed", "succeeded", "failed", "error", "cancelled", "canceled", "nsfw"}:
            return cur
        time.sleep(5)
    raise TimeoutError(request_id)


def image_url_from(body: dict) -> str | None:
    for img in body.get("images") or []:
        if isinstance(img, dict) and img.get("url"):
            return str(img["url"])
        if isinstance(img, str) and img.startswith("http"):
            return img
    if body.get("image_url"):
        return str(body["image_url"])
    return None


def video_url_from(body: dict) -> str | None:
    vid = body.get("video")
    if isinstance(vid, dict) and vid.get("url"):
        return str(vid["url"])
    if body.get("video_url"):
        return str(body["video_url"])
    return None


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "tdg-christmas-factory-200-ops"})
    with urllib.request.urlopen(req, timeout=180) as resp, tmp.open("wb") as f:
        while True:
            chunk = resp.read(256 * 1024)
            if not chunk:
                break
            f.write(chunk)
    tmp.replace(dest)


def upload_image(path: Path) -> str:
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    meta = hf_request("POST", "/files/generate-upload-url", {"content_type": ctype})
    upload_url, public_url = meta.get("upload_url"), meta.get("public_url")
    if not upload_url or not public_url:
        raise RuntimeError("upload url missing")
    headers = dict(meta.get("upload_headers") or {"Content-Type": ctype})
    req = urllib.request.Request(str(upload_url), data=path.read_bytes(), method="PUT", headers=headers)
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp.read()
    return str(public_url)


def empty_manifest(scenes: list[dict]) -> dict:
    return {
        "batch_id": BATCH_ID,
        "campaign": "christmas_factory_200_alive",
        "art_direction": "I CAN'T WAIT FOR CHRISTMAS — bright, warm, alive, magical, photoreal",
        "created_at": now_iso(),
        "models": {"image": IMAGE_MODEL, "video": VIDEO_MODEL},
        "distribution": BUCKETS,
        "costs": {"image_usd": 0.0, "video_usd": 0.0, "total_usd": 0.0},
        "target": TARGET,
        "ops": {},
        "clips": [
            {
                **scene,
                "status": "pending",
                "still": str((STILLS / f"{scene['id']}.jpg").relative_to(ROOT)),
                "master": str((MASTERS / f"{scene['id']}.mp4").relative_to(ROOT)),
            }
            for scene in scenes[: max(TARGET, 200)]
        ],
    }


def load_manifest(scenes: list[dict]) -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return empty_manifest(scenes)


def save_manifest(m: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    m["costs"]["total_usd"] = float(m["costs"].get("image_usd") or 0) + float(m["costs"].get("video_usd") or 0)
    tmp = MANIFEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(m, indent=2) + "\n")
    tmp.replace(MANIFEST)


def load_ops() -> dict:
    if OPS_STATE.exists():
        try:
            return json.loads(OPS_STATE.read_text())
        except json.JSONDecodeError:
            pass
    return {"adopted": [], "unmapped": []}


def save_ops(ops: dict) -> None:
    tmp = OPS_STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(ops, indent=2) + "\n")
    tmp.replace(OPS_STATE)


def still_ready(row: dict) -> bool:
    p = ROOT / row["still"]
    return p.exists() and p.stat().st_size >= 80_000


def master_ready(row: dict) -> bool:
    p = ROOT / row["master"]
    return p.exists() and p.stat().st_size >= 200_000


def clip_done(row: dict) -> bool:
    return master_ready(row) and row.get("status") == "video_ready"


def find_row(m: dict, cid: str) -> dict | None:
    for row in m["clips"]:
        if row.get("id") == cid:
            return row
    return None


def update_row(m: dict, row: dict) -> None:
    with _lock:
        for i, existing in enumerate(m["clips"]):
            if existing.get("id") == row["id"]:
                m["clips"][i] = {**existing, **row}
                break
        save_manifest(m)


def add_cost(m: dict, kind: str, usd: float) -> None:
    with _lock:
        key = "image_usd" if kind == "image" else "video_usd"
        m["costs"][key] = float(m["costs"].get(key) or 0) + float(usd or 0)
        m["costs"]["total_usd"] = float(m["costs"]["image_usd"]) + float(m["costs"]["video_usd"])
        save_manifest(m)


def observed_costs(m: dict) -> tuple[float, float, float, int, int]:
    img = [float(c["image_cost_usd"]) for c in m["clips"] if c.get("image_cost_usd")]
    vid = [float(c["video_cost_usd"]) for c in m["clips"] if c.get("video_cost_usd")]
    avg_img = sum(img) / len(img) if img else 0.21
    avg_vid = sum(vid) / len(vid) if vid else 0.308
    return avg_img, avg_vid, avg_img + avg_vid, len(img), len(vid)


def unmapped_inflight_count() -> int:
    ops = load_ops()
    n = 0
    for item in ops.get("unmapped") or []:
        st = str(item.get("status") or "").lower()
        if st in {"queued", "in_progress", "processing", "pending"}:
            n += 1
    return n


def handoff_block_ids() -> set[str]:
    if not HANDOFF.exists():
        return set()
    try:
        data = json.loads(HANDOFF.read_text())
    except json.JSONDecodeError:
        return set()
    ts = float(data.get("ts") or 0)
    if ts and time.time() - ts > 120:
        return set()
    return set(data.get("stills_without_master") or [])


def ready_image_buffer(m: dict) -> list[dict]:
    blocked = handoff_block_ids()
    out = []
    for row in m["clips"]:
        if master_ready(row) or clip_done(row):
            continue
        if row.get("video_job_id"):
            if row["id"] not in _metrics["claimed_video"]:
                out.append(row)
            continue
        if still_ready(row) and row["id"] not in _metrics["claimed_video"]:
            if row["id"] in blocked:
                continue
            out.append(row)
    return out


def pending_image_rows(m: dict) -> list[dict]:
    out = []
    for row in m["clips"]:
        if still_ready(row) or master_ready(row):
            continue
        if row["id"] in _metrics["claimed_image"]:
            continue
        if row.get("status") in {"video_ready", "image_ready"}:
            continue
        out.append(row)
    return out


def ffmpeg_poster(master: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.4", "-i", str(master), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def extract_raw_frame(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-frames:v",
            "1",
            "-vf",
            "scale=48:48:flags=bilinear,format=gray",
            "-f",
            "rawvideo",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def raw_mse(a: Path, b: Path) -> float:
    da, db = a.read_bytes(), b.read_bytes()
    n = min(len(da), len(db))
    if n < 100:
        return 1e9
    return sum((da[i] - db[i]) ** 2 for i in range(n)) / n


def match_video_to_still(m: dict, video_path: Path) -> dict | None:
    tmp = OUT / "qc" / f"match_{video_path.stem}.raw"
    try:
        extract_raw_frame(video_path, tmp)
    except Exception:
        return None
    best = None
    best_d = 1e9
    for row in m["clips"]:
        if master_ready(row) and row.get("status") == "video_ready":
            continue
        still = ROOT / row["still"]
        if not still.exists():
            continue
        still_f = OUT / "qc" / f"still_{row['id']}.raw"
        try:
            if not still_f.exists() or still_f.stat().st_mtime < still.stat().st_mtime:
                extract_raw_frame(still, still_f)
            d = raw_mse(tmp, still_f)
        except Exception:
            continue
        if d < best_d:
            best_d = d
            best = row
    if best is not None and best_d < 80.0:
        return best
    return None


def finish_video_row(m: dict, row: dict, vid: str, video_usd: float, vurl: str, latency_s: float) -> None:
    master = ROOT / row["master"]
    download(vurl, master)
    try:
        ffmpeg_poster(master, POSTERS / f"{row['id']}.jpg")
    except Exception as e:
        print(f"POSTER_ERR {row['id']} {e}", flush=True)
    row["video_job_id"] = vid
    row["video_cost_usd"] = video_usd
    row["status"] = "video_ready"
    row["video_finished_at"] = now_iso()
    if not row.get("image_cost_usd"):
        # keep ledger consistent if image existed from a prior run
        pass
    add_cost(m, "video", video_usd)
    update_row(m, row)
    _metrics["video_latencies"].append(latency_s)
    _metrics["video_done_times"].append(time.time())
    if latency_s > ABNORMAL_LATENCY_S:
        _metrics["abnormal_latency"] += 1
        _metrics["stable_successes"] = 0
    elif time.time() - float(_metrics["last_throttle_at"] or 0) > 90:
        _metrics["stable_successes"] += 1
    print(f"OK {row['id']} video {latency_s:.0f}s", flush=True)
    maybe_ramp()


def maybe_ramp() -> None:
    cur = int(_metrics["video_concurrency"])
    if _metrics["insufficient_funds"]:
        return
    if _metrics["http_429"] or _metrics["concurrency_rejects"]:
        if time.time() - float(_metrics["last_throttle_at"] or 0) < 90:
            prev = KLING_STEPS[max(0, KLING_STEPS.index(cur) - 1)] if cur in KLING_STEPS else max(6, cur - 2)
            if prev < cur:
                print(f"CONCURRENCY_DOWN {cur}->{prev}", flush=True)
                _metrics["video_concurrency"] = prev
                _metrics["stable_concurrency"] = prev
                _metrics["stable_successes"] = 0
            return
    if _metrics["stable_successes"] < STABILITY_SUCCESSES:
        return
    if cur not in KLING_STEPS:
        return
    idx = KLING_STEPS.index(cur)
    if idx >= len(KLING_STEPS) - 1:
        _metrics["stable_concurrency"] = cur
        return
    nxt = KLING_STEPS[idx + 1]
    print(f"CONCURRENCY_UP {cur}->{nxt}", flush=True)
    _metrics["video_concurrency"] = nxt
    _metrics["stable_concurrency"] = cur
    _metrics["stable_successes"] = 0


def probe_balance() -> None:
    """Higgsfield generation API does not document a balance endpoint; probe quietly."""
    candidates = (
        "/v1/billing/balance",
        "/billing/credits",
        "/account/credits",
        "/credits/balance",
    )
    for path in candidates:
        try:
            body = hf_request("GET", path, timeout=12)
        except Exception:
            continue
        if not isinstance(body, dict):
            continue
        exp = body.get("expiring_usd") or body.get("expiring_balance") or body.get("bonus_usd")
        perm = body.get("permanent_usd") or body.get("paid_usd") or body.get("non_expiring_usd")
        bal = body.get("usd") or body.get("balance") or body.get("balance_usd")
        if exp is not None:
            try:
                _metrics["expiring_usd"] = float(exp)
            except (TypeError, ValueError):
                pass
        if perm is not None:
            try:
                _metrics["permanent_usd"] = float(perm)
            except (TypeError, ValueError):
                pass
        if bal is not None:
            try:
                _metrics["balance_usd"] = float(bal)
            except (TypeError, ValueError):
                pass
        if any(v is not None for v in (_metrics["expiring_usd"], _metrics["permanent_usd"], _metrics["balance_usd"])):
            return


def adapt_target(m: dict) -> int:
    avg_img, avg_vid, avg_master, _, _ = observed_costs(m)
    done = sum(1 for c in m["clips"] if c.get("status") == "video_ready" or master_ready(c))
    inflight = _metrics["active_video"]
    remaining_budget = None
    if _metrics["expiring_usd"] is not None:
        remaining_budget = max(0.0, float(_metrics["expiring_usd"]))
    elif _metrics["balance_usd"] is not None and _metrics["permanent_usd"] is None:
        # Single undifferentiated balance — do not assume it is all expiring.
        remaining_budget = None
    if _metrics.get("stop_images") or _metrics["insufficient_funds"]:
        ready = sum(1 for c in m["clips"] if still_ready(c) and not master_ready(c))
        if _metrics["insufficient_funds"]:
            return done + inflight
        return done + inflight + ready
    if remaining_budget is None:
        return max(TARGET, done + inflight)
    if avg_master <= 0:
        return TARGET
    affordable = done + inflight + int(remaining_budget // avg_master)
    if affordable >= TARGET:
        return max(TARGET, affordable)
    return max(done + inflight, affordable)


def videos_per_hour(m: dict | None = None) -> float:
    times = list(_metrics["video_done_times"])
    if len(times) >= 2:
        window = times[-1] - times[0]
        if window > 1:
            return (len(times) - 1) * 3600.0 / window
    start = float(_metrics["started_at"])
    if m:
        created = str(m.get("created_at") or "")
        try:
            start = datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
        done = sum(1 for c in m["clips"] if master_ready(c))
        elapsed = max(1.0, time.time() - start)
        return done * 3600.0 / elapsed
    elapsed = max(1.0, time.time() - start)
    return (len(times) * 3600.0 / elapsed) if times else 0.0


def write_live_status(m: dict) -> None:
    avg_img, avg_vid, avg_master, _, nvid = observed_costs(m)
    done = sum(1 for c in m["clips"] if master_ready(c))
    buf = len(ready_image_buffer(m))
    exp = _metrics["expiring_usd"]
    if _metrics.get("stop_images") or _metrics["insufficient_funds"]:
        _metrics["expiring_usd"] = 0.0
        exp = 0.0
    if exp is not None and avg_master > 0:
        extra = 0 if _metrics["insufficient_funds"] else sum(
            1 for c in m["clips"] if still_ready(c) and not master_ready(c)
        )
        projected = done + extra
        exp_s = f"${exp:.2f}"
    else:
        projected = adapt_target(m)
        exp_s = "not exposed by API"
    lines = [
        f"Completed videos: {done}",
        f"Active Kling jobs: {_metrics['active_video']}",
        f"Maximum stable Kling concurrency: {_metrics['stable_concurrency']}",
        f"Ready-image buffer: {buf}",
        f"Average image cost: ${avg_img:.3f}",
        f"Average 5s I2V cost: ${avg_vid:.3f}",
        f"Average completed-master cost: ${avg_master:.3f}",
        f"Expiring balance remaining: {exp_s}",
        f"Projected completed videos before balance exhaustion: {projected}",
        f"Current generation rate (completed videos/hour): {videos_per_hour(m):.1f}",
        f"video_concurrency_now: {_metrics['video_concurrency']}",
        f"active_image: {_metrics['active_image']}",
        f"http_429: {_metrics['http_429']}",
        f"concurrency_rejects: {_metrics['concurrency_rejects']}",
        f"updated: {now_iso()}",
    ]
    LIVE_STATUS.write_text("\n".join(lines) + "\n")


def make_poster_and_note(row: dict) -> None:
    master = ROOT / row["master"]
    poster = POSTERS / f"{row['id']}.jpg"
    if master.exists() and not poster.exists():
        try:
            ffmpeg_poster(master, poster)
        except Exception:
            pass


def recover_known_jobs(m: dict, ops: dict) -> None:
    """Attach previously discovered request IDs and download anything already done."""
    known = {c.get("image_job_id") for c in m["clips"]} | {c.get("video_job_id") for c in m["clips"]}
    extra = list(ops.get("unmapped") or [])
    row009 = find_row(m, "cf200_009_dog_present")
    if row009 and not master_ready(row009):
        extra = [{"request_id": "8f15e2d0-2414-4332-bf18-abc8fa8e0fca", "hint": "cf200_009_dog_present"}] + extra
    seen = set()
    pending = []
    for item in extra:
        rid = str(item.get("request_id") or "").strip()
        if not rid or rid in seen or rid in known:
            continue
        seen.add(rid)
        pending.append(item)
    for item in pending:
        rid = item["request_id"]
        try:
            body = hf_request("GET", f"/requests/{rid}/status", timeout=30)
        except Exception as e:
            print(f"RECOVER_SKIP {rid} {e}", flush=True)
            continue
        status = str(body.get("status") or "").lower()
        vurl = video_url_from(body)
        iurl = image_url_from(body)
        hint = item.get("hint")
        if vurl and status in {"completed", "succeeded"}:
            dest = OUT / "qc" / f"orphan_{rid}.mp4"
            try:
                download(vurl, dest)
            except Exception as e:
                print(f"RECOVER_DL_ERR {rid} {e}", flush=True)
                continue
            row = find_row(m, hint) if hint else None
            if row is None or master_ready(row):
                row = match_video_to_still(m, dest)
            if row is None:
                ops.setdefault("unmapped", [])
                if not any(x.get("request_id") == rid for x in ops["unmapped"]):
                    ops["unmapped"].append({"request_id": rid, "kind": "video", "status": status})
                print(f"RECOVER_UNMAPPED_VIDEO {rid}", flush=True)
                continue
            if not master_ready(row):
                (ROOT / row["master"]).parent.mkdir(parents=True, exist_ok=True)
                dest.replace(ROOT / row["master"])
            row["video_job_id"] = rid
            row["status"] = "video_ready"
            if row.get("video_cost_usd") is None:
                row["video_cost_usd"] = 0.308
                add_cost(m, "video", 0.308)
            update_row(m, row)
            make_poster_and_note(row)
            print(f"RECOVER_OK {row['id']} {rid}", flush=True)
        elif iurl and status in {"completed", "succeeded"}:
            # completed image without a mapped clip — leave for the live image worker
            ops.setdefault("unmapped", [])
            if not any(x.get("request_id") == rid for x in ops["unmapped"]):
                ops["unmapped"].append({"request_id": rid, "kind": "image", "status": status, "url": iurl})
        elif status in {"queued", "in_progress", "processing", "pending"}:
            ops.setdefault("unmapped", [])
            if not any(x.get("request_id") == rid for x in ops["unmapped"]):
                ops["unmapped"].append({"request_id": rid, "kind": "unknown", "status": status})
            print(f"RECOVER_INFLIGHT {rid} {status}", flush=True)
    save_ops(ops)


def adopt_unmapped_loop(m: dict, ops: dict) -> None:
    items = list(ops.get("unmapped") or [])
    keep = []
    for item in items:
        rid = str(item.get("request_id") or "")
        if not rid:
            continue
        try:
            body = hf_request("GET", f"/requests/{rid}/status", timeout=30)
        except Exception:
            keep.append(item)
            continue
        status = str(body.get("status") or "").lower()
        vurl = video_url_from(body)
        iurl = image_url_from(body)
        if vurl and status in {"completed", "succeeded"}:
            dest = OUT / "qc" / f"orphan_{rid}.mp4"
            try:
                download(vurl, dest)
                row = match_video_to_still(m, dest)
                if row and not master_ready(row):
                    dest.replace(ROOT / row["master"])
                    row["video_job_id"] = rid
                    row["status"] = "video_ready"
                    if row.get("video_cost_usd") is None:
                        row["video_cost_usd"] = 0.308
                        add_cost(m, "video", 0.308)
                    update_row(m, row)
                    make_poster_and_note(row)
                    print(f"ADOPT_OK {row['id']} {rid}", flush=True)
                    _metrics["video_done_times"].append(time.time())
                    continue
            except Exception as e:
                print(f"ADOPT_ERR {rid} {e}", flush=True)
            keep.append(item)
        elif status in {"failed", "error", "cancelled", "canceled", "nsfw"}:
            print(f"ADOPT_DEAD {rid} {status}", flush=True)
        elif status in {"queued", "in_progress", "processing", "pending"}:
            item["status"] = status
            keep.append(item)
        else:
            keep.append(item)
        _ = iurl
    ops["unmapped"] = keep
    save_ops(ops)


def do_image(m: dict, row: dict) -> None:
    cid = row["id"]
    still = ROOT / row["still"]
    if still_ready(row):
        row["status"] = "image_ready"
        update_row(m, row)
        return
    image_prompt = row["image_core"] + IMAGE_SUFFIX
    print(f"IMAGE {cid}", flush=True)
    est = hf_request("POST", f"/estimate/{IMAGE_MODEL}", {"prompt": image_prompt, "aspect_ratio": "9:16"})
    image_usd = float(est.get("usd") or 0)
    if row.get("image_job_id"):
        done = poll_job(str(row["image_job_id"]))
    else:
        sub = hf_request(
            "POST",
            f"/{IMAGE_MODEL}",
            {"prompt": image_prompt, "aspect_ratio": "9:16"},
            idem=f"{BATCH_ID}:{cid}:image",
        )
        req_id = str(sub.get("request_id") or "")
        if not req_id:
            raise RuntimeError(f"image submit failed {cid}")
        row["image_job_id"] = req_id
        row["image_cost_usd"] = image_usd
        row["status"] = "image_submitted"
        update_row(m, row)
        add_cost(m, "image", image_usd)
        done = poll_job(req_id)
    if str(done.get("status")).lower() not in {"completed", "succeeded"}:
        raise RuntimeError(f"image failed {cid} {done.get('status')}")
    url = image_url_from(done)
    if not url:
        raise RuntimeError(f"image url missing {cid}")
    download(url, still)
    row["image_cost_usd"] = image_usd or float(row.get("image_cost_usd") or 0)
    row["status"] = "image_ready"
    update_row(m, row)
    print(f"IMAGE_OK {cid}", flush=True)


def do_video(m: dict, row: dict) -> None:
    cid = row["id"]
    still = ROOT / row["still"]
    master = ROOT / row["master"]
    if master_ready(row):
        row["status"] = "video_ready"
        update_row(m, row)
        return
    motion_prompt = row["motion_core"] + MOTION_SUFFIX
    print(f"VIDEO {cid}", flush=True)
    t0 = time.time()
    if row.get("video_job_id"):
        vid = str(row["video_job_id"])
        video_usd = float(row.get("video_cost_usd") or 0.308)
        vdone = poll_job(vid, timeout_s=1800)
    else:
        public = upload_image(still)
        vest = hf_request(
            "POST",
            f"/estimate/{VIDEO_MODEL}",
            {"image_url": public, "prompt": motion_prompt, "duration": DURATION, "sound": "off"},
        )
        video_usd = float(vest.get("usd") or 0)
        vsub = hf_request(
            "POST",
            f"/{VIDEO_MODEL}",
            {"image_url": public, "prompt": motion_prompt, "duration": DURATION, "sound": "off"},
            idem=f"{BATCH_ID}:{cid}:video",
        )
        vid = str(vsub.get("request_id") or "")
        if not vid:
            raise RuntimeError(f"video submit failed {cid}")
        row["video_job_id"] = vid
        row["video_cost_usd"] = video_usd
        row["status"] = "video_submitted"
        update_row(m, row)
        vdone = poll_job(vid, timeout_s=1800)
    if str(vdone.get("status")).lower() not in {"completed", "succeeded"}:
        raise RuntimeError(f"video failed {cid} {vdone.get('status')}")
    vurl = video_url_from(vdone)
    if not vurl:
        raise RuntimeError(f"video url missing {cid}")
    finish_video_row(m, row, vid, video_usd, vurl, time.time() - t0)


def image_worker(m: dict) -> None:
    while not _stop.is_set():
        target_n = adapt_target(m)
        done = sum(1 for c in m["clips"] if master_ready(c) or c.get("status") == "video_ready")
        if done >= target_n:
            time.sleep(4)
            continue
        vconc = int(_metrics["video_concurrency"])
        want = vconc * BUFFER_MULT
        have = len(ready_image_buffer(m)) + int(_metrics["active_image"])
        if _metrics.get("stop_images") or _metrics["insufficient_funds"]:
            # Harvest already-submitted image jobs only — do not spend remaining paid credit.
            with _lock:
                resume = [
                    r
                    for r in m["clips"]
                    if r.get("image_job_id")
                    and not still_ready(r)
                    and r["id"] not in _metrics["claimed_image"]
                ]
                row = resume[0] if resume else None
                if row:
                    _metrics["claimed_image"].add(row["id"])
                    _metrics["active_image"] = int(_metrics["active_image"]) + 1
            if row is None:
                time.sleep(4)
                continue
        else:
            if have >= want:
                time.sleep(2)
                continue
            row = None
            with _lock:
                rows = pending_image_rows(m)
                if rows:
                    row = rows[0]
                    _metrics["claimed_image"].add(row["id"])
                    _metrics["active_image"] = int(_metrics["active_image"]) + 1
            if row is None:
                time.sleep(3)
                continue
        try:
            do_image(m, row)
        except InsufficientFundsError as e:
            print(f"FUNDS_STOP image {e}", flush=True)
            _metrics["stop_images"] = True
        except (ThrottleError, ConcurrencyLimitError) as e:
            print(f"THROTTLE image {row['id']} {e}", flush=True)
            time.sleep(12)
        except Exception as e:
            _metrics["submit_failures"] += 1
            print(f"ERR IMAGE {row['id']} {e}", flush=True)
            row["last_error"] = str(e)[:300]
            update_row(m, row)
            time.sleep(4)
        finally:
            with _lock:
                _metrics["active_image"] = max(0, int(_metrics["active_image"]) - 1)
                _metrics["claimed_image"].discard(row["id"])


def video_worker(m: dict) -> None:
    while not _stop.is_set():
        target_n = adapt_target(m)
        done = sum(1 for c in m["clips"] if master_ready(c) or c.get("status") == "video_ready")
        if done >= target_n and int(_metrics["active_video"]) == 0:
            time.sleep(4)
            continue
        row = None
        with _lock:
            if int(_metrics["active_video"]) >= int(_metrics["video_concurrency"]):
                row = None
            else:
                inflight_unmapped = unmapped_inflight_count()
                for cand in ready_image_buffer(m):
                    if cand["id"] in _metrics["claimed_video"]:
                        continue
                    if _metrics["insufficient_funds"] and not cand.get("video_job_id"):
                        continue
                    if not cand.get("video_job_id") and inflight_unmapped > 0:
                        continue
                    _metrics["claimed_video"].add(cand["id"])
                    _metrics["active_video"] = int(_metrics["active_video"]) + 1
                    row = cand
                    break
        if row is None:
            time.sleep(2)
            continue
        try:
            do_video(m, row)
        except InsufficientFundsError as e:
            print(f"FUNDS_STOP video {e}", flush=True)
            _metrics["insufficient_funds"] = True
            _metrics["stop_images"] = True
            _metrics["expiring_usd"] = 0.0
        except (ThrottleError, ConcurrencyLimitError) as e:
            print(f"THROTTLE video {row['id']} {e}", flush=True)
            _metrics["stable_successes"] = 0
            maybe_ramp()
            time.sleep(15)
        except Exception as e:
            _metrics["submit_failures"] += 1
            print(f"ERR VIDEO {row['id']} {e}", flush=True)
            row["last_error"] = str(e)[:300]
            update_row(m, row)
            time.sleep(5)
        finally:
            with _lock:
                _metrics["active_video"] = max(0, int(_metrics["active_video"]) - 1)
                _metrics["claimed_video"].discard(row["id"])


def supervisor(m: dict) -> None:
    ops = load_ops()
    recover_known_jobs(m, ops)
    image_threads = []
    video_threads = []
    for _ in range(max(1, IMAGE_WORKERS)):
        t = threading.Thread(target=image_worker, args=(m,), daemon=True)
        t.start()
        image_threads.append(t)
    launched = 0
    last_balance = 0.0
    last_adopt = 0.0
    print(
        f"OPS_OVERRIDE start video_concurrency={_metrics['video_concurrency']} "
        f"image_workers={IMAGE_WORKERS} buffer={BUFFER_MULT}x",
        flush=True,
    )
    while not _stop.is_set():
        want = int(_metrics["video_concurrency"])
        while launched < want:
            t = threading.Thread(target=video_worker, args=(m,), daemon=True)
            t.start()
            video_threads.append(t)
            launched += 1
        if time.time() - last_adopt > 20:
            adopt_unmapped_loop(m, load_ops())
            last_adopt = time.time()
        if time.time() - last_balance > 120:
            try:
                probe_balance()
            except Exception:
                pass
            last_balance = time.time()
        write_live_status(m)
        done = sum(1 for c in m["clips"] if master_ready(c))
        target_n = adapt_target(m)
        unfinished = [c for c in m["clips"][:target_n] if not master_ready(c)]
        if _metrics["insufficient_funds"] and int(_metrics["active_video"]) == 0:
            print(f"FUNDS_EXHAUSTED done={done}", flush=True)
            break
        if done >= target_n and not unfinished and int(_metrics["active_video"]) == 0 and int(_metrics["active_image"]) == 0:
            print(f"TARGET_REACHED {done}/{target_n}", flush=True)
            break
        time.sleep(2)
    write_live_status(m)


def sync_existing_files(m: dict) -> None:
    changed = False
    for row in m["clips"]:
        if master_ready(row) and row.get("status") != "video_ready":
            row["status"] = "video_ready"
            changed = True
        elif still_ready(row) and row.get("status") in {None, "pending", "image_submitted"}:
            row["status"] = "image_ready"
            changed = True
    if changed:
        save_manifest(m)


def main() -> int:
    for d in (OUT, STILLS, MASTERS, POSTERS, OUT / "qc"):
        d.mkdir(parents=True, exist_ok=True)
    scenes = build_scenes()
    m = load_manifest(scenes)
    if len(m.get("clips") or []) < 200:
        m = empty_manifest(scenes)
        save_manifest(m)
    sync_existing_files(m)
    try_load_hf()
    auth_header()
    done = sum(1 for c in m["clips"] if master_ready(c))
    print(f"FACTORY {BATCH_ID} resume {done}/{len(m['clips'])} ops video={_metrics['video_concurrency']}", flush=True)
    try:
        supervisor(m)
    except KeyboardInterrupt:
        _stop.set()
        print("INTERRUPT keep Higgsfield jobs; request IDs persisted", flush=True)
    write_live_status(m)
    done = sum(1 for c in m["clips"] if master_ready(c))
    print(json.dumps({"done": done, "total": len(m["clips"]), "costs": m["costs"], "ops": {
        "video_concurrency": _metrics["video_concurrency"],
        "stable_concurrency": _metrics["stable_concurrency"],
        "http_429": _metrics["http_429"],
        "concurrency_rejects": _metrics["concurrency_rejects"],
    }}), flush=True)
    return 0 if done >= adapt_target(m) else 1


if __name__ == "__main__":
    raise SystemExit(main())

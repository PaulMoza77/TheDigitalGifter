#!/usr/bin/env python3
"""Secure Christmas Factory assets, persist metadata, and run technical integrity checks.

Does not submit any new Higgsfield jobs.
"""

from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))
from christmas_factory_200 import IMAGE_SUFFIX, MOTION_SUFFIX  # noqa: E402

OUT = ROOT / "generated/christmas-factory-200"
MANIFEST = OUT / "generation_manifest.json"
INVENTORY = OUT / "inventory.json"
GIT_INVENTORY = ROOT / "src/features/admin-library/christmasFactory200Inventory.json"
INTEGRITY = OUT / "integrity_report.json"
POSTERS = OUT / "posters"
STILLS = OUT / "stills"
MASTERS = OUT / "masters"
BUCKET_LABELS = {
    "joy": "JOY",
    "nostalgia": "NOSTALGIA",
    "santa": "SANTA",
    "nyc": "NYC",
    "europe": "EUROPE",
    "cozy": "COZY",
    "wow": "WOW",
    "moody": "ELEGANT",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ffprobe(path: Path) -> dict:
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,codec_name,duration:format=duration,size",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return {"ok": False, "error": (proc.stderr or proc.stdout)[:300]}
    try:
        data = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return {"ok": False, "error": "ffprobe_json"}
    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}
    duration = float(stream.get("duration") or fmt.get("duration") or 0)
    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    return {
        "ok": True,
        "duration": round(duration, 3),
        "width": width,
        "height": height,
        "codec": stream.get("codec_name"),
        "size": int(fmt.get("size") or path.stat().st_size),
        "portrait": height > width,
        "about_5s": 4.2 <= duration <= 6.5,
    }


def make_poster(master: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        ["ffmpeg", "-y", "-ss", "0.4", "-i", str(master), "-frames:v", "1", "-q:v", "3", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> int:
    m = json.loads(MANIFEST.read_text())
    (OUT / "FACTORY_FROZEN").write_text(f"frozen {now_iso()}\nno new paid Higgsfield jobs\n")

    failed_ids = {
        "cf200_053_open_one_eve",
        "cf200_054_train_station_reunion",
        "cf200_055_rooftop_tree_small",
        "cf200_057_ice_truck_cocoa",
    }
    for row in m["clips"]:
        row["image_prompt"] = (row.get("image_core") or "") + IMAGE_SUFFIX
        row["motion_prompt"] = (row.get("motion_core") or "") + MOTION_SUFFIX
        still = ROOT / row["still"]
        master = ROOT / row["master"]
        if still.exists() and still.stat().st_size >= 80_000:
            row["still_bytes"] = still.stat().st_size
        if master.exists() and master.stat().st_size >= 200_000:
            row["status"] = "video_ready"
            row["master_bytes"] = master.stat().st_size
        elif row["id"] in failed_ids:
            row["status"] = "video_failed"
            row["settled_at"] = now_iso()

    completed = []
    failed = []
    stills_ok = []
    broken = []
    for row in m["clips"]:
        still = ROOT / row["still"]
        master = ROOT / row["master"]
        still_ok = still.exists() and still.stat().st_size >= 80_000
        if still_ok:
            stills_ok.append(row["id"])
        if row.get("status") == "video_ready":
            if not master.exists() or master.stat().st_size < 200_000:
                broken.append({"id": row["id"], "issue": "manifest_video_ready_missing_file"})
                continue
            probe = ffprobe(master)
            row["probe"] = probe
            if probe.get("ok"):
                row["duration_seconds"] = probe["duration"]
                row["width"] = probe["width"]
                row["height"] = probe["height"]
            poster = POSTERS / f"{row['id']}.jpg"
            if not poster.exists() or poster.stat().st_size < 8_000:
                try:
                    make_poster(master, poster)
                except Exception as e:
                    broken.append({"id": row["id"], "issue": f"poster_failed:{e}"})
            if not probe.get("ok"):
                broken.append({"id": row["id"], "issue": f"ffprobe:{probe.get('error')}"})
            elif not probe.get("about_5s"):
                broken.append({"id": row["id"], "issue": f"duration_{probe.get('duration')}"})
            elif not probe.get("portrait"):
                broken.append({"id": row["id"], "issue": f"orientation_{probe.get('width')}x{probe.get('height')}"})
            if not still_ok:
                broken.append({"id": row["id"], "issue": "missing_source_still"})
            completed.append(row)
        elif row.get("status") == "video_failed":
            failed.append(row)
            if not still_ok:
                broken.append({"id": row["id"], "issue": "failed_video_missing_still"})

    m["settled_at"] = now_iso()
    m["settled"] = {
        "completed_videos": len(completed),
        "failed_videos": len(failed),
        "source_images": len(stills_ok),
        "broken": broken,
        "target_cancelled": True,
        "no_new_paid_jobs": True,
    }
    img_costs = [float(c.get("image_cost_usd") or 0) for c in m["clips"] if c.get("image_cost_usd")]
    vid_costs = [float(c.get("video_cost_usd") or 0) for c in completed if c.get("video_cost_usd")]
    master_costs = [
        float(c.get("image_cost_usd") or 0) + float(c.get("video_cost_usd") or 0)
        for c in completed
        if c.get("image_cost_usd") or c.get("video_cost_usd")
    ]
    m["costs"]["image_usd"] = round(sum(img_costs), 3)
    m["costs"]["video_usd"] = round(sum(vid_costs), 3)
    m["costs"]["total_usd"] = round(float(m["costs"]["image_usd"]) + float(m["costs"]["video_usd"]), 3)
    m["costs"]["avg_master_usd"] = round(sum(master_costs) / len(master_costs), 3) if master_costs else 0
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")

    by_bucket: dict[str, list[dict]] = {label: [] for label in BUCKET_LABELS.values()}
    records = []
    for row in m["clips"]:
        if row.get("status") not in {"video_ready", "video_failed", "image_ready"} and not (
            (ROOT / row["still"]).exists()
        ):
            continue
        rec = {
            "id": row["id"],
            "status": row.get("status"),
            "category": BUCKET_LABELS.get(row.get("bucket") or "", (row.get("bucket") or "").upper()),
            "bucket": row.get("bucket"),
            "title": row.get("title"),
            "happening": row.get("happening"),
            "emotion": row.get("emotion"),
            "image_prompt": row.get("image_prompt"),
            "motion_prompt": row.get("motion_prompt"),
            "image_job_id": row.get("image_job_id"),
            "video_job_id": row.get("video_job_id"),
            "image_cost_usd": row.get("image_cost_usd"),
            "video_cost_usd": row.get("video_cost_usd"),
            "still": row.get("still"),
            "master": row.get("master") if row.get("status") == "video_ready" else None,
            "duration_seconds": row.get("duration_seconds"),
        }
        records.append(rec)
        if row.get("status") == "video_ready":
            by_bucket.setdefault(rec["category"], []).append({"id": rec["id"], "title": rec["title"]})

    inventory = {
        "batch_id": m.get("batch_id"),
        "settled_at": m["settled_at"],
        "completed_videos": len(completed),
        "failed_videos": [c["id"] for c in failed],
        "source_images": len(stills_ok),
        "distribution": {k: len(v) for k, v in by_bucket.items()},
        "distribution_assets": by_bucket,
        "costs": m["costs"],
        "assets": records,
    }
    INVENTORY.write_text(json.dumps(inventory, indent=2) + "\n")
    GIT_INVENTORY.write_text(json.dumps(inventory, indent=2) + "\n")

    ids = [c["id"] for c in completed]
    dupes = [i for i, n in Counter(ids).items() if n > 1]
    durations = [float(c.get("duration_seconds") or 0) for c in completed]
    report = {
        "completed_videos": len(completed),
        "failed_videos": len(failed),
        "failed_ids": [c["id"] for c in failed],
        "source_images": len(stills_ok),
        "total_duration_seconds": round(sum(durations), 2),
        "avg_master_usd": m["costs"]["avg_master_usd"],
        "total_spend_usd": m["costs"]["total_usd"],
        "broken": broken,
        "duplicates": dupes,
        "distribution": inventory["distribution"],
        "library_shorts": len(completed),
        "library_photos": len(stills_ok),
    }
    INTEGRITY.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    subprocess.check_call([sys.executable, str(ROOT / "scripts/christmas_factory_200_catalog.py")])
    return 0 if not dupes else 1


if __name__ == "__main__":
    raise SystemExit(main())

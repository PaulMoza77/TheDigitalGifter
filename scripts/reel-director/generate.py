#!/usr/bin/env python3
"""Reel Director video runner.

Modes (this revision does not submit paid jobs):
  --dry-run         no network, print jobs / resume / cap
  --estimate-only   live Higgsfield /estimate for 5s and 10s (not submit)
  --execute         paid submit/status/download/resume — requires APPROVED

Resume: existing master files + generation_log job_id are never resubmitted.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from higgsfield import (  # noqa: E402
    MODEL_ID,
    ESTIMATE_PATH,
    SUBMIT_PATH,
    clip_payload,
    credentials_present,
    download,
    hf_request,
    parse_estimate,
    poll_job,
    upload_image,
    verify_auth,
    video_url_from_status,
)

DEFAULT_MANIFEST = (
    ROOT / "public/assets/christmas/christmas_planner_mom_overwhelm_v2/generation_manifest.json"
)


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text())


def paid_shots(manifest: dict) -> list[dict]:
    return [s for s in manifest.get("shots") or [] if (s.get("video") or {}).get("generate")]


def log_path(manifest: dict, manifest_path: Path) -> Path:
    rel = (manifest.get("execution") or {}).get("generation_log")
    if rel:
        p = ROOT / rel
    else:
        p = manifest_path.parent / "generation_log.json"
    return p


def masters_dir(manifest: dict, manifest_path: Path) -> Path:
    rel = (manifest.get("execution") or {}).get("masters_dir")
    return ROOT / rel if rel else manifest_path.parent / "masters"


def load_log(path: Path) -> dict:
    if path.exists():
        try:
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    return {"clips": [], "pending": [], "failed": []}


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def probe_ok(path: Path, expected_s: int) -> bool:
    if not path.exists() or path.stat().st_size < 200_000:
        return False
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)]
    )
    dur = float((json.loads(raw).get("format") or {}).get("duration") or 0)
    lo, hi = expected_s - 0.6, expected_s + 1.6
    return lo <= dur <= hi


def existing_clip(log: dict, shot: dict, dest: Path) -> dict | None:
    expected = int(shot["video"]["duration_s"])
    for row in log.get("clips") or []:
        if row.get("id") == shot["id"] and row.get("job_id") and probe_ok(Path(row.get("file") or dest), expected):
            return row
    if probe_ok(dest, expected):
        return {"id": shot["id"], "file": str(dest), "job_id": "existing-file", "resumed": True, "generation_cost_usd": 0}
    return None


def dry_run(manifest: dict, manifest_path: Path) -> dict:
    shots = paid_shots(manifest)
    log = load_log(log_path(manifest, manifest_path))
    dest_dir = masters_dir(manifest, manifest_path)
    jobs = []
    for shot in shots:
        dest = dest_dir / f"{shot['id']}.mp4"
        already = existing_clip(log, shot, dest)
        jobs.append(
            {
                "id": shot["id"],
                "provider": shot["video"]["provider"],
                "model": shot["video"]["model"],
                "duration_s": shot["video"]["duration_s"],
                "reference": shot["reference_asset"],
                "would_submit": already is None,
                "resume": None if already is None else already.get("job_id"),
                "submit_path": SUBMIT_PATH,
            }
        )
    report = {
        "mode": "dry-run",
        "project": manifest.get("project"),
        "status": manifest.get("status"),
        "approval_required": True,
        "execute_would_run": manifest.get("status") == "APPROVED",
        "credentials_present": credentials_present(),
        "paid_submit_called": False,
        "live_generation_verified": False,
        "jobs": jobs,
        "would_submit_count": sum(1 for j in jobs if j["would_submit"]),
        "resume_count": sum(1 for j in jobs if j["resume"]),
        "approved_cost_cap_usd": (manifest.get("cost_estimate") or {}).get("approved_cost_cap_usd"),
        "audio_first": True,
        "note": "Dry-run only. --estimate-only hits /estimate. --execute is the only paid submit path.",
    }
    return report


def estimate_only(manifest: dict, manifest_path: Path) -> dict:
    out = manifest_path.parent / "live_estimate.json"
    if not credentials_present():
        report = {
            "status": "BLOCKED_MISSING_CREDENTIALS",
            "provider": "higgsfield",
            "model": MODEL_ID,
            "paid_submit_called": False,
            "live_generation_verified": False,
            "blocker": "HF_CREDENTIALS / HF_API_KEY_ID+SECRET not set in this environment. Live 5s/10s estimate not called.",
            "at": datetime.now(timezone.utc).isoformat(),
        }
        write_json(out, report)
        return report
    verify_auth()
    still = ROOT / paid_shots(manifest)[0]["reference_asset"]
    print(f"Uploading still for estimate only: {still.name}", flush=True)
    image_url = upload_image(still)
    prompt = "Estimate probe. Photoreal I2V, subtle handheld, sound off. No extra people."
    rows = []
    for duration in (5, 10):
        body = hf_request("POST", ESTIMATE_PATH, clip_payload(image_url, prompt, duration))
        est = parse_estimate(body)
        rows.append(
            {
                "duration_s": duration,
                "usd": est["usd"],
                "credits": est["credits"],
            }
        )
        print(f"LIVE ESTIMATE {duration}s: ${est['usd']:.4f} credits={est['credits']}", flush=True)
    by_dur = {r["duration_s"]: r for r in rows}
    shots = []
    base = 0.0
    for shot in paid_shots(manifest):
        d = int(shot["video"]["duration_s"])
        row = by_dur[d]
        usd = float(row["usd"])
        shots.append({"id": shot["id"], "duration_s": d, "usd": usd, "credits": row["credits"]})
        base += usd
    cap = float((manifest.get("cost_estimate") or {}).get("approved_cost_cap_usd") or 0)
    report = {
        "status": "LIVE_ESTIMATE",
        "provider": "higgsfield",
        "model": MODEL_ID,
        "paid_submit_called": False,
        "live_generation_verified": False,
        "configs": rows,
        "ten_is_double_five": (
            abs(float(by_dur[10]["usd"]) - 2 * float(by_dur[5]["usd"])) < 0.02
            if 5 in by_dur and 10 in by_dur
            else None
        ),
        "base_video_usd": round(base, 4),
        "approved_cost_cap_usd": cap,
        "within_cap": cap <= 0 or base <= cap,
        "shots": shots,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    write_json(out, report)
    return report


def execute(manifest: dict, manifest_path: Path, only: str | None) -> int:
    if manifest.get("status") != "APPROVED":
        print("BLOCKED: status is not APPROVED. No paid video called.", file=sys.stderr)
        return 2
    if not (manifest.get("audio") or {}).get("measured"):
        print("BLOCKED: measure dialogue audio before video. No paid video called.", file=sys.stderr)
        return 2
    if not (manifest.get("audio") or {}).get("voices_auditioned"):
        print("BLOCKED: voice audition required before video. No paid video called.", file=sys.stderr)
        return 2
    cap = float((manifest.get("cost_estimate") or {}).get("approved_cost_cap_usd") or 0)
    live = manifest_path.parent / "live_estimate.json"
    if not live.exists():
        print("BLOCKED: run --estimate-only first. No paid video called.", file=sys.stderr)
        return 2
    est_doc = json.loads(live.read_text())
    base = float(est_doc.get("base_video_usd") or 0)
    if cap and base > cap:
        print(f"BLOCKED: live base ${base:.2f} exceeds cap ${cap:.2f}", file=sys.stderr)
        return 3

    verify_auth()
    dest_dir = masters_dir(manifest, manifest_path)
    dest_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_path(manifest, manifest_path)
    log = load_log(log_file)
    work = [s for s in paid_shots(manifest) if only is None or s["id"] == only]
    est_by = {row["id"]: row for row in est_doc.get("shots") or []}

    for shot in work:
        dest = dest_dir / f"{shot['id']}.mp4"
        already = existing_clip(log, shot, dest)
        if already:
            print(f"RESUME skip paid submit {shot['id']} job={already.get('job_id')}", flush=True)
            log["clips"] = [c for c in log.get("clips") or [] if c.get("id") != shot["id"]] + [already]
            write_json(log_file, log)
            continue
        pending = next((p.get("job_id") for p in (log.get("pending") or []) if p.get("id") == shot["id"]), None)
        if pending:
            done = poll_job(str(pending))
        else:
            image_url = upload_image(ROOT / shot["reference_asset"])
            payload = clip_payload(image_url, shot["video"]["prompt"], int(shot["video"]["duration_s"]))
            submitted = hf_request("POST", SUBMIT_PATH, payload)
            request_id = submitted.get("request_id")
            if not request_id:
                raise RuntimeError(f"submit missing request_id: {submitted}")
            log.setdefault("pending", []).append({"id": shot["id"], "job_id": request_id})
            write_json(log_file, log)
            done = poll_job(str(request_id))
            pending = request_id
        status = str(done.get("status") or "").lower()
        if status not in {"completed", "succeeded"}:
            raise RuntimeError(f"{shot['id']} failed: {done.get('status')}")
        url = video_url_from_status(done)
        if not url:
            raise RuntimeError(f"{shot['id']} missing video url")
        download(url, dest)
        usd = float((est_by.get(shot["id"]) or {}).get("usd") or 0)
        entry = {
            "id": shot["id"],
            "job_id": str(pending),
            "file": str(dest),
            "generation_cost_usd": usd,
            "model": MODEL_ID,
        }
        log["clips"] = [c for c in log.get("clips") or [] if c.get("id") != shot["id"]] + [entry]
        log["pending"] = [p for p in (log.get("pending") or []) if p.get("id") != shot["id"]]
        write_json(log_file, log)
    print("Masters ready (execute path).", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", nargs="?", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--estimate-only", action="store_true")
    parser.add_argument("--execute", action="store_true", help="Paid submit. Requires APPROVED.")
    parser.add_argument("--only", default=None)
    args = parser.parse_args()
    path = Path(args.manifest)
    if not path.is_absolute():
        path = ROOT / path
    manifest = load_manifest(path)

    if args.execute and (args.dry_run or args.estimate_only):
        print("Use one mode.", file=sys.stderr)
        return 2
    if not args.execute and not args.estimate_only:
        args.dry_run = True

    if args.dry_run:
        report = dry_run(manifest, path)
        write_json(path.parent / "dry_run_report.json", report)
        print(json.dumps(report, indent=2))
        print("DRY-RUN complete. paid_submit_called=false live_generation_verified=false", flush=True)
        return 0

    if args.estimate_only:
        report = estimate_only(manifest, path)
        print(json.dumps({k: v for k, v in report.items() if k != "raw"}, indent=2))
        if report.get("status") == "BLOCKED_MISSING_CREDENTIALS":
            return 2
        return 0

    return execute(manifest, path, args.only)


if __name__ == "__main__":
    raise SystemExit(main())

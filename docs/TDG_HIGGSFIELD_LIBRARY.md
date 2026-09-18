# Higgsfield → TDG Library

Admin-only image-to-video. Clips land in the existing `/admin/library` catalog (static Christmas/pet items plus generated rows). There is no second library.

## Secrets (job runner only)

Do not paste keys in chat or commit them. Do not prefix with `VITE_`.

| Host | Where |
| --- | --- |
| Vercel | Project → Settings → Environment Variables → Production (and Preview if you run jobs there): `HF_CREDENTIALS` |
| Mozas VPS origin | `/opt/mozas/projects/thedigitalgifter/secrets/app.env` then recreate/restart the origin container so Node sees the var |
| Cursor agent / laptop | gitignored `.env` in the repo root |

Format:

```
HF_CREDENTIALS=KEY_ID:KEY_SECRET
```

Also required on the same host: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `HIGGSFIELD_MOCK=true` (no paid API), `TDG_PUBLIC_ORIGIN=https://www.thedigitalgifter.com`.

Apply `supabase/migrations/20260918180000_tdg_library_higgsfield.sql` and `supabase/migrations/20260918190000_tdg_higgsfield_submit_claim.sql` on the live Supabase project before the first real job.

## Duplicate paid submit

Higgsfield generation POST is **not** idempotent (no documented idempotency key). TDG claims `submitting` with an atomic `UPDATE … WHERE status IN ('created','estimated') AND provider_request_id IS NULL`. Concurrent requests cannot both POST.

`submitting` without `provider_request_id` is ambiguous: the runner waits, then marks `submit_unconfirmed`. It never auto-retries POST. `estimateJob` may refresh tariffs but must not roll in-flight rows back to `estimated`.

## MP4 verification

`ffprobe` must succeed (readable MP4, duration, width, height). 5s / 1080×1920 / 9:16 is recorded as `spec_ok`. Nonconforming originals are still stored in TDG Library with explicit notes. No paid regenerate.

## Source photos

Selectable stills are static `LIBRARY_VIDEOS` photos **plus** `tdg_library_items` of `kind=photo` (private `tdg-library` bucket). Private files are uploaded to Higgsfield input storage so the provider can read them. Dimensions are checked before estimate/submit (≥1080×1920, 9:16).

## Persistent runner (VPS)

`vercel.json` cron `/api/admin-library-cron` is not proof that anything runs. Production resume is the origin process: `startHiggsfieldRunner()` in `server/origin.mjs` (`setInterval`, default 120s). Inspect `GET /healthz/higgsfield-runner` (`periodicResume`, `ffmpeg`, `ffprobe`, `credentialsConfigured` booleans only). One job error does not stop the rest of the tick.

## Models (documented IDs)

- Kling 3.0 Pro: `kling-video/v3.0/pro/image-to-video` — duration 5, `sound=off`. No resolution/aspect_ratio fields in the official API; 9:16 1080p is requested via the library still. Effective WxH is recorded from the downloaded MP4.
- Seedance 2.0: `bytedance/seedance-2.0/image-to-video` — duration 5, `resolution=1080p`, `generate_audio=false`.

No silent fallback to 720p or another provider.

## Command (Cursor)

Estimate only (no paid generate):

```
npx tsx scripts/tdg-library-generate.ts --photo photo-nyc-ice-girl --prompt "subtle snowfall, slow cinematic push-in" --estimate-only
```

First real generate after you accept the printed estimate:

```
npx tsx scripts/tdg-library-generate.ts --photo photo-nyc-ice-girl --prompt "subtle snowfall, slow cinematic push-in" --budget 1.50
```

Resume (tablet closed / agent interrupted):

```
npx tsx scripts/tdg-library-generate.ts --job <uuid>
```

Retry TDG import without regenerating:

```
npx tsx scripts/tdg-library-generate.ts --job <uuid> --retry-import
```

Assemble selected shorts with the existing ffmpeg hard-cut Reel montage (needs ffmpeg on the host; $0 Higgsfield):

```
npx tsx scripts/tdg-library-generate.ts --compose short-ice-nyc,short-kids-sled --title "Cut 4"
```

## Live vs verified

The paid path is not fully verified until one real MP4 is imported and playable on `/admin/library`. Mock/unit tests do not consume Higgsfield credits.

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

Apply `supabase/migrations/20260918180000_tdg_library_higgsfield.sql` on the live Supabase project before the first real job.

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

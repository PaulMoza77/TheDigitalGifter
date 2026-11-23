# Mission 02D — Production-Quality Memory Film + Licensed Song Operations

**Date:** 2026-11-23  
**Branch:** `feature/christmas-story-02d-media`  
**Implementation commit:** `a5c4c4241c63f82ef9bc941d0d1443fd681d554a`  
**Baseline:** `f5fe78c515a23ea6b93eeba2d7db325bad72e8a9` (Mission 02C tip)  
**Workspace:** `/Users/paul/tdg-christmas-story-02d`  
**Deployment:** **Not deployed.** LIVE payments **OFF.** PRs #379–#382 untouched.

---

## Architecture

```
Buyer / Admin UI
  └─ christmas-story Edge (authz, song queue metadata, revisions)
        └─ christmas_story_jobs (+ lease columns)

Local / future VPS film worker (NOT Edge)
  └─ LocalJobStore or christmas_story_claim_job RPC
        └─ renderMemoryFilm (FFmpeg argv-only)
              ├─ Pillow text plates (title / dedication / captions)
              ├─ H.264 yuv420p +faststart MP4
              ├─ optional AAC from authorized master
              └─ poster + preview derivatives

Manual song ops
  └─ songProduction state machine + checksummed master copy
```

FFmpeg runs only in the standalone worker. Supabase Edge never renders video.

---

## Implementation

### Film renderer (`server/christmas-story-media/`)
- Secure `spawn` (`shell: false`), path jail, magic-byte validation, size/count limits.
- Warm cinematic template: title plate → slow zoom photo clips → dedication plate.
- Landscape `1280×720` and portrait `720×1280`.
- Silent film when no audio; AAC mux when authorized master supplied.
- Output checksum (SHA-256), poster JPG, preview MP4.

### Durable jobs
- Migration `20261124010000_christmas_story_02d_media_jobs.sql`: lease/heartbeat/retry columns, `christmas_story_claim_job`, `christmas_story_heartbeat_job`, `christmas_story_media_revisions`.
- Local file-backed `LocalJobStore` for isolated testing (claim, heartbeat, crash reclaim, backoff).
- Worker CLI: `scripts/christmas-story-02d/film-worker.mjs`.

### Licensed song admin
- States: awaiting → in production → uploaded → rights verification → buyer review → revision/approved/failed.
- Rejects free/trial evidence language.
- Briefs omit photos/emails.
- Admin UI: `/admin/christmas/story-media` (admin token header, no service role in browser).
- Edge actions: `adminListSongQueue`, `adminAdvanceSongState`, `requestMediaRevision`, `listOrderMediaJobs`.

### Buyer review
- Truthful pending/ready media copy.
- Server-mode approval blocked while media pending.
- Revision requests for song/film.
- No fake oscillator playback (existing ExampleAudioPlayer already real-media-only).

### Demo
- Fictional Emma/Jordan sample film at `public/assets/christmas-story-demo/` (first-party synthetic render).
- Demo song audio intentionally null until a licensed demo master is provided.

---

## Sample render evidence (local)

| Metric | Value |
| --- | --- |
| Output | `artifacts/.../e2e-out/multi/e2e-multi-film.mp4` (also copied to public demo) |
| Duration | **15.2 s** |
| Size | **42,013 bytes** (synthetic color plates; customer photos will be larger) |
| Codec | H.264 / yuv420p / 1280×720 |
| Render wall time | **3,547 ms** |
| Peak RSS (reported) | **~90 MB** |
| Checksum | `498998ff44d1feb82ab1eb25d7cc4d0add0d263419feb007fe18cef945a75392` |

Currency cost estimates intentionally **null** until VPS/labor rates are configured (`buildMediaCostModel`).

---

## Tests

```text
node --experimental-strip-types scripts/christmas-story-02d/e2e-media.mjs
  → RESULT: all media E2E checks passed
    (multi-photo, portrait, audio mux, corrupt/invalid input, claim/retry,
     unauthorized admin, license evidence, revision cycle)

vitest: 62 passed (02D pipeline + 02B/02C + christmasStory + santa-call + commercialOffers)
tsc -p tsconfig.app.json --noEmit → exit 0
npm run build → success
```

Remote Edge/storage E2E against hosted Supabase was **not** claimed (no isolated staging credentials in this session).

---

## Security findings

1. No shell string interpolation for FFmpeg.
2. Path jail + magic bytes; URL inputs forbidden.
3. Admin token required for song queue; service role never exposed to `VITE_*`.
4. Song briefs strip photos/emails before admin list.
5. Free/trial license evidence rejected.
6. Remaining: production object-storage upload path for worker outputs still needs staging credentials; admin audio upload UX is ops/CLI-first.

---

## Outstanding blockers

1. No remote staging Supabase + private bucket credentials for end-to-end signed media delivery.
2. No authorized commercial demo song master (demo audio remains unset by design).
3. Homebrew FFmpeg 9.0.1 lacks `drawtext` — mitigated via Pillow plates.
4. Production VPS worker packaging/deploy not in scope (local worker only).
5. Mobile Chrome visual QA not executed in this session.

---

## Files changed (high level)

- `server/christmas-story-media/**`
- `scripts/christmas-story-02d/**`
- `supabase/migrations/20261124010000_christmas_story_02d_media_jobs.sql`
- `supabase/functions/christmas-story/index.ts`
- `src/features/christmas-story/**` (buyer media review, demo, tests)
- `src/pages/admin/christmas/ChristmasStoryMediaAdminPage.tsx`
- `public/assets/christmas-story-demo/**`
- `docs/christmas-story/MISSION_02D_REPORT.md`

---

## Next mission recommendation

**Mission 02E — Staging media loop:** deploy worker against isolated Supabase storage, wire signed buyer/recipient playback URLs, attach one authorized demo song master, and run mobile Chrome QA on real photo uploads — still with LIVE checkout OFF.

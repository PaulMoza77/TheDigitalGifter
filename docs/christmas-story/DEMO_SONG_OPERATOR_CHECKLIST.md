# Demo song operator checklist (Mission 02E)

The fictional Emma demo **does not** ship a playable song until an authorized commercial master is attached.

## Current status

- Demo `audioUrl`: **null**
- Lyrics: sample-only (not a recording)
- Player: no fake oscillator / synthesized playback

## Upload location (local / future VPS worker)

```text
artifacts/christmas-story-02e/licensed-song-inbox/
  emma-demo-master.mp3   # or .wav / .m4a
  LICENSE.txt            # commercial evidence
  PROVENANCE.json        # provider, dates, checksum
```

Public publish path after verification:

```text
public/assets/christmas-story-demo/emma-demo-song.mp3
```

Then set `DEMO_GIFT.song.audioUrl` to that path and `status: "ready"`.

## Required evidence before attach

1. Provider name + reference / invoice id
2. Explicit commercial-use license language (reject free / trial / unofficial)
3. Creation date + download date
4. SHA-256 checksum of the master
5. Duration / loudness sanity check
6. Manual rights verification state → `ready_for_buyer_review`

## Commands

```bash
# Validate + copy via existing Mission 02D song ops (local store)
node --experimental-strip-types -e "
import { LocalJobStore } from './server/christmas-story-media/localJobStore.ts';
import { createSongJob, attachLicensedSong } from './server/christmas-story-media/songProduction.ts';
// …admin token + paths…
"

# Mux into a film rebuild if desired
node --experimental-strip-types scripts/christmas-story-02e/build-premium-demo.mjs
```

## Forbidden

- Unofficial Suno automation
- Free/trial masters presented as commercial
- Fake browser audio generation
- Copying paying-customer song masters into the demo folder

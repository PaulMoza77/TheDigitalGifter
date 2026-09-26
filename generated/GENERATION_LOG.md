# Premium Christmas Reel · Kling v3 Pro 1080p

## Model selection

Inspected Replicate `image-to-video` collection (55 models). Compared:

- `wan-video/wan-2.2-i2v-fast` · cheap, not 1080p (previous test)
- `alibaba/wan-3` · native 1080p, $0.20/s
- `bytedance/seedance-1-pro` · strong I2V lock, 1080p
- `minimax/hailuo-02` · 1080p but 6s minimum
- `kwaivgi/kling-v3-video` mode=pro · native 1080p, 5s, no audio, cinematic motion

**Selected:** `kwaivgi/kling-v3-video` (`mode=pro`, `generate_audio=false`)

- Resolution: native 1080p, 24 fps, 1080×1920 from 9:16 first frame
- Duration per clip: 5.04s generated; strongest 2.5–3.5s used in edit
- Estimated cost: **$0.112/s × 5s = $0.56/clip**; **$2.80 total** (5 clips, 0 regenerations)

## Source

Original stills: 941×1672 JPEG. Lanczos upscale to 1080×1920 PNG (no extra sharpen).

## Predictions

| Clip | Prediction ID | Regen |
|------|---------------|-------|
| clip_01_train_raw | wmb2tk14h1rmr0d0nsfa99fa54 | no |
| clip_02_santa_raw | 16x2hcnag5rmr0d0nsf9d2p8g8 | no |
| clip_03_market_raw | e3qyn6esmdrmy0d0nsf86nxq0w | no |
| clip_04_chalet_raw | 8rvftx08rnrmw0d0nsfrka2qtr | no |
| clip_05_cozy_raw | 5df470hqwsrmy0d0nsft8eda14 | no |

## 1080p re-export (sharpness pass)

Masters remain Kling v3 Pro **1080×1920** (not proxies). Seedance locked-camera regen was blocked by Replicate **402 insufficient credit**.

Export rebuilt as a **single-pass** 1080×1920 encode from those masters:
- no downscale
- early/stable trim windows
- 12% slowdown to reduce camera/snow busyness
- mild unsharp only
- H.264 High, **16 Mbps** target (12–20 Mbps VBV)

Verified with ffprobe: **1080×1920**, ~15.7 Mbps, 24 fps. See `final/FFPROBE.txt`.

## Edit

Hard cuts, no music/voice.

- 0.00–2.50 train (raw 0.12–2.62)
- 2.50–5.00 Santa (raw 0.20–2.70)
- 5.00–7.50 market (raw 0.18–2.68)
- 7.50–10.00 chalet (raw 0.15–2.65)
- 10.00–13.50 cozy (raw 0.15–3.65)

Final: 13.500s, 1080×1920, H.264 High, 24 fps, no audio.

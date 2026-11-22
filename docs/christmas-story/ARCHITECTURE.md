# Our Christmas Story — Technical Architecture

## Module

`src/features/christmas-story/` — isolated from Santa Call and Planner commerce.

## Routes

| Path | Role |
| --- | --- |
| `/christmas-story` | Landing (copy variants via `?v=song`) |
| `/christmas-story/demo` | Interactive fictional recipient demo |
| `/christmas-story/create` | Progressive creator |
| `/christmas-story/order/:orderId` | Buyer dashboard (local test store) |
| `/gift/:token` | Recipient experience |
| `/christmas/our-story` | Alias → landing |

## Data (MVP)

- Drafts + orders in `localStorage` (`draftStore.ts`)
- No production Stripe, email, or paid AI calls
- Future: `christmas_story_*` tables + Edge fulfill extending `christmas_*` commerce

## Generation adapters

| Concern | Interface | Active MVP |
| --- | --- | --- |
| Story | `StoryProvider` | `mockStoryProvider` (deterministic, non-fabricating) |
| Lyrics | `LyricProvider` | `mockLyricProvider` |
| Music | `MusicProvider` | `mockMusicProvider` (+ `manualMusicProvider`) |
| Images | `ImageHandler` | local canvas normalize |
| Video | `VideoProvider` | frame slideshow mock (FFmpeg later on VPS) |
| Print | `PrintProvider` | HTML gift card + QR |

## Order lifecycle

`DRAFT → CHECKOUT_PENDING → PAID → CONTENT_PENDING → GENERATING → REVIEW_REQUIRED → APPROVED → READY_TO_SEND → SENT → OPENED`

MVP test path jumps to `REVIEW_REQUIRED` after local “test order” creation.

## Safety

- `STORY_OFFER.checkoutEnabled = false`
- `purchase_completed` analytics suppressed unless `checkout_mode=live_verified`
- Recipient pages force `noindex` and strip OG/Twitter tags
- Music path never receives photos

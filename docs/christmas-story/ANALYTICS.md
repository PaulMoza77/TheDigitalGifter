# Christmas Story — Analytics Event Spec

Events are emitted via `trackStoryEvent` → `dataLayer` as `story_<event>`.

| Event | When |
| --- | --- |
| `landing_view` | Landing mount |
| `demo_play` | Demo CTA / audio play |
| `create_gift_click` | Primary CTAs |
| `builder_started` | Creator mount |
| `preview_view` | Preview composed |
| `checkout_started` | Buyer starts checkout |
| `purchase_completed` | **Only** when `meta.checkout_mode === "live_verified"` |
| `gift_generation_started` | Generation begins |
| `gift_ready` | Assets ready for review |
| `gift_approved` | Buyer approves |
| `gift_sent` | Buyer marks sent |
| `gift_opened` | Recipient unwraps |
| `recipient_reaction` | Optional reaction submitted |
| `upsell_purchased` | Reserved (add-ons flagged off) |

PII keys matching `/email|name|token|photo|lyric|memory|phone|address/i` are scrubbed.

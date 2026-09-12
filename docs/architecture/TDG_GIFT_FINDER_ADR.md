# ADR: Christmas Gift Finder

## Status

Accepted for `tdg-christmas-wishlist-gift-finder-010`.

## Context

TDG needs a free acquisition Gift Finder that produces useful Christmas ideas, saves them to Wishlist, and remains safe/cheap. Santa already uses OpenAI with template fallback under quota pressure.

Affiliate infrastructure today is **inbound** (promo codes / referrals), not outbound merchant feeds.

## Decision

1. **Primary provider:** OpenAI Chat Completions (`OPENAI_MODEL` or `gpt-4o-mini`), server-owned system prompt, JSON schema output.
2. **Fallback:** Deterministic curated idea catalog (`CHRISTMAS_GIFT_FINDER_MODE=curated` or automatic on quota/billing/network failure).
3. **No client system prompts.** Browser sends normalized taxonomy keys + short custom interest only.
4. **Safety:** Reject unsafe custom interests; filter weapon/drug/minor-inappropriate ideas; treat user fields as data.
5. **Rate limit:** 8 sessions / hour / `user:{id}` or `guest:{hash}` bucket.
6. **Cost:** Insert `ai_cost_ledger` rows with `product_family=christmas_gift_finder`, `media_type=text`, `cost_state=estimated|exact`.
7. **Affiliate outbound:** DEFERRED — use search_query + TDG preview CTAs (no Buy now / invented prices).
8. **Persistence:** Session + result tables enable Add-to-Wishlist without regenerating.

## Consequences

- Finder remains useful even when OpenAI quota is exhausted.
- Engineering can prove quality with one controlled generation when credentials allow.
- SEO recipient taxonomy lives in shared config for a later factory (`/christmas/gifts-for-*`) without building it now.

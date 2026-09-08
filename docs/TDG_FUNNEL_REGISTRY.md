# TDG Funnel Registry

Source of truth: `src/features/analytics/funnelRegistry.ts`  
Admin: `/admin/funnel-analytics`

## Required funnels

- pet_v1, pet_v2, pet_v3
- christmas_portrait, christmas_santa_video, christmas_tree_gifts
- christmas_wishlist, christmas_gift_finder, christmas_cards, christmas_messages
- christmas_advent, christmas_send_a_gift

## Health states (only)

`healthy` | `degraded` | `unverified` | `disabled`

Never mark GA4 / Meta Pixel / Meta CAPI healthy without delivery evidence.

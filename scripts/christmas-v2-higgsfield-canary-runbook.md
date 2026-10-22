# Christmas V2 Higgsfield canary runbook (operator)

**Authorization required before any paid call.** Cloud Agent default: **BLOCKED** (no HF spend).

## Scope (initial canary)

Maximum **one** Soul v2 image request and **one** Kling 3.0 Pro video request.

| Step | Model | Estimated catalog cost (NOT invoice) | Actual billed |
|------|-------|--------------------------------------|---------------|
| 1 | `higgsfield-ai/soul/v2/image-to-image` | catalog estimate only | unknown until HF invoice |
| 2 | `kling-video/v3.0/pro/image-to-video` (5s, sound off) | catalog estimate only | unknown until HF invoice |

Do **not** invent per-image/per-video billed rates. Record `estimated_cost_usd` in ledger; leave `actual_cost_usd` null until reconciliation.

## Preconditions

1. Staging / disposable DB with Meta+cost migration applied.
2. `CHRISTMAS_GENERATION_MOCK=false` only for this canary window.
3. `HF_CREDENTIALS` or `HF_API_KEY_ID` + `HF_API_KEY_SECRET` in server secrets (never client).
4. Synthetic / staff photo only — **no production customer content**.
5. Explicit written spend approval for ≤ 1 Soul + 1 Kling request.
6. Paid test order on disposable pack (prefer magic EUR 17 so one video entitlement exists) **or** admin-held single-scene fixture.

## Procedure

1. Confirm worker SHA matches PR tip; Edge + Node twins in sync.
2. Create disposable paid order; upload staff photo; fulfill payment (Stripe test mode).
3. Invoke `christmas-generate` once with service-role auth.
4. Verify scene row: `replicate_prediction_id` set **before** terminal success; `result_path` private bucket; signed download works.
5. Invoke `christmas-generate-video` once; confirm `image_url` is the **succeeded Soul scene** signed URL for `source_scene_key`.
6. Inspect `ai_cost_ledger`: one row per `prediction_id`; `actual_cost_usd` null; estimates labeled.
7. Immediately re-set `CHRISTMAS_GENERATION_MOCK=true` after canary.

## Abort / no double-charge rules

- If worker crashes after submit: resume poll using stored `replicate_prediction_id` — do **not** create a second request.
- `uncertain_provider_outcome` (generating without id): **manual review only**.
- `provider_terminal:*`: do not auto re-submit.
- Stop after one Soul + one Kling even if visual quality is poor.

## Manual visual quality checklist (not automated PASS)

Review the single canary outputs for: face/identity consistency, hands, seasonal realism, no identity drift, acceptable motion (video). Record subjective notes separately; never mark visual quality PASS from mocks.

## Billing reconciliation

1. Export HF dashboard usage for the canary `request_id`s.
2. Update ledger `actual_cost_usd` + `cost_state='reconciled'` only from provider-billed figures.
3. Keep estimates for COGS projections; never present estimates as billed actuals.

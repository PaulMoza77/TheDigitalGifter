# ADR: Christmas Copilot P0

## Status

Accepted for a **safe production** landing: read-only, on-device Intelligence + Copilot UI.

## Context

Private Christmas Planner already had a local “Ask Christmas AI” that answered from counts (`assistant.ts`) and never called a model. A future premium Copilot should feel like a chief of staff over the whole plan. A separate Intelligence Engine V1 may still land; this ADR freezes the contract Copilot consumes.

## Decision

1. **P0 is deterministic.** `buildIntelligence()` produces `PlannerSnapshot`, `PlannerInsight[]`, and `NextBestAction`. `askCopilot()` returns a structured `CopilotResponse`. No OpenAI/Anthropic calls. `copilotLlmEnabled()` is hard-false.
2. **No mutations.** Action Registry exists (`applyCopilotPlan` → `not_implemented`). Writes stay in existing Planner UI + RLS.
3. **No new Edge Function, no migration.** Mozas SPA deploy only. Kill switch: `VITE_CHRISTMAS_PLANNER_COPILOT=0`.
4. **Privacy.** Snapshot may include list display names (already on-screen). Never hiding places, booking notes, emails, URLs. Analytics: `copilot_opened` / `copilot_turn` with module + modelPath buckets only.
5. **UX.** Header / FAB sparkle, Today chips, right sheet (desktop) / bottom sheet (mobile). Not a generic chat embed.
6. **LLM + apply** require a later entitled Edge Function (`planner.ai_assistant`), user JWT, confirmation tokens, and fail-closed rate limits. Writes today stay on the Intelligence Engine’s confirmed Action Registry (Planner UI), not Copilot.

## Consequences

- Production Copilot is useful immediately and cannot spend model credits or write data.
- Copilot consumes **Intelligence Engine V1** (`runPlannerIntelligence`) — no second scoring system.

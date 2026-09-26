# Christmas Planner (launch)

**Product key:** `christmas_planner_2026`  
**Routes:** `/christmas/planner` (editorial funnel) · `/christmas/planner/welcome` · `/account/christmas` (command center)

## Architecture (canonical)

| Concern | Source |
|---|---|
| Sales funnel UI | Editorial `ChristmasPlannerPage` (PR #214 + redesign) |
| Commerce / packages / guest claim | Funnel: `user_entitlements`, opaque public token, `christmas-planner-funnel` |
| Interactive Planner app | V1 modules under `/account/christmas` |
| Workspace tables | Migration `20260917180000_christmas_planner_workspace.sql` |
| Feature access | `get_christmas_planner_access()` maps `user_entitlements` (`planner.*`) → app features |

Do **not** introduce a second entitlement table or a conflicting `grant_christmas_planner_entitlements(uuid)` signature.

## Kill switches

- `CHRISTMAS_CHECKOUT_ENABLED`
- `CHRISTMAS_PLANNER_CHECKOUT_ENABLED` **or** product metadata `checkout_live=true`

Seed ships checkout off.

## Migrations (apply in order)

1. `20260917140000_christmas_planner_funnel.sql` · product, packages, `user_entitlements`, claim/grant RPCs
2. `20260917180000_christmas_planner_workspace.sql` · profiles/tasks/gifts/budget/meals/… + access bridge + refund

## Free vs paid

Account Planner works free with limits. Paid packages unlock feature keys via entitlements.

## Christmas Copilot (P0)

Private app sheet on `/account/christmas`. Answers are generated on-device from `PlannerSnapshot` / insights. **No model calls, no Copilot writes.** Architecture: `docs/architecture/TDG_CHRISTMAS_COPILOT_ADR.md`. Kill switch: `VITE_CHRISTMAS_PLANNER_COPILOT=0`.

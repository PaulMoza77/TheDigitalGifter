# Mission 02A — draft PR review description

Title: Refine Christmas Story gifting UI and remove misleading demo playback

Base: `feature/christmas-story-mvp`
Head: `codex/christmas-story-premium-ui`

The Christmas Story MVP presents fictional media as a real example and asks
recipients to advance through ten screens. This change introduces an emerald and
ivory editorial landing, immediate personalized creator cover, progressive optional
inputs, recipient-focused buyer review, and one gift opening followed by a continuous
story with manual memories and a hidden-message disclosure.

Missing audio now shows a lyrics-only preview instead of synthesized tones. Actual
audio/video uses native, user-initiated controls. Test-only storage and delivery
limitations are clearly labeled. The price, checkout and buyer lifecycle handlers,
provider/data contracts, Santa Call, APIs, migrations and production configuration
are unchanged.

Validation: 8 focused server-render tests pass; all feature TSX syntax compiles;
recipient/media subset passes strict typechecking; git diff --check passes.
Recovery verification: Christmas Story Vitest **7/7**, UI render tests **8/8**,
Chrome mobile/desktop route-state captures **60/60** using safe temporary baseline
workarounds. Screenshot evidence is stored in the local QA backup directory.

Clean full app lint/build remains blocked by baseline Santa catalog syntax/type
errors, a missing Santa admin page and the existing analytics helper diagnostic.
WebKit and original-design before screenshots have not been verified.
See MISSION_02A_REPORT.md for exact verification and unresolved backend dependencies.

Draft PR only. Do not mark ready or merge until the upstream baseline build
defects, remaining QA gaps and PR #378 scope issues are resolved.

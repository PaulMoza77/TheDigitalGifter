# Local Meta / Stripe audit harness

This is an explicitly isolated **local** harness. It does not deploy anything. All processes bind to loopback; Supabase uses project `tdg-isolated-stripe` and ports 583xx, gateway 58421, frontend 58400. Never use the existing remote `stripe-webhook-test`: its `isolation=tdg_e2e` branch can select the production service client.

Prerequisites: Node dependencies, Supabase CLI, Docker, Deno, Stripe CLI, Chrome. No production customer data or secrets are needed. The captured schema contains definitions only, no rows. The local `is_admin()` stub denies admin access; service-role requests are used for fixture data.

1. Run `node scripts/meta-audit/setup-local.mjs`. It only accepts the named temporary local project and loopback database; it refuses nonempty public schemas.
2. `TDG_OFFLINE_TEST=1 TDG_MOCK_GENERATION=1 node scripts/meta-audit/start-local.mjs`
3. In another terminal: `node scripts/meta-audit/start-frontend.mjs`.
4. `node scripts/meta-audit/browser-events.mjs` requires the local fixture order JSON created by a previous run. It blocks all outbound browser traffic and replaces the Pixel library with a **local dispatch capture**. Its output is not Meta receipt evidence.

For authorized real Stripe TEST validation, set `TDG_AUTHORIZED_STRIPE_TEST_ACCOUNT=acct_...` and `TDG_AUTHORIZED_STRIPE_TEST_KEY_FILE=/absolute/private/path` before starting without offline mode. The launcher verifies `/v1/account` equals that explicitly approved account. No key values are logged or committed. The discovered `~/.config/tdg/stripe-test.key` showed **Volocar** at hosted checkout; the owner explicitly authorized account `acct_1R7edvGD87aY9yHx` for TDG tests in this session. The launcher still requires explicit account/key-file settings. The production publishable key must never be reused in TEST.

`exercise-checkout.mjs` requires an existing local `/tmp/tdg-isolated-stripe/order.json`, uploads a bundled demo image, and calls the actual Edge checkout implementation. It checks that the returned session is `cs_test_`. It must only run against the launcher after account validation. It writes sensitive local order/session artifacts with mode 0600.

`fixture-delivery.mjs` invokes the real local payment RPC with **synthetic paid state**, checks unpaid/amount/currency rejection and retry behavior, then uses the existing mock generation branch. This is not a Stripe payment or webhook test. The email renderer/persistence runs, but transport is redirected to a local capture and only `@example.invalid` recipients are accepted. External generation providers are blocked. There is no claim of real AI generation or real inbox delivery.

Shutdown: stop the foreground launcher/frontend processes, then `supabase stop --workdir /tmp/tdg-isolated-stripe` to stop only this test project. Keep its data for repeatable evidence. Do not stop, reset or change other projects. Production services and secrets are never used by this harness.

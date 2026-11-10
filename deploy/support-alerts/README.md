# Support chat activation

Implementation is local until these steps are performed on the intended environment.

1. Apply migration `20261110120000_santa_support_chat.sql` after the existing August support migrations. It reuses the admin tickets/messages tables, protects new token-backed threads from the legacy UUID-only guest RPCs, and queues admin alerts for every client message.
2. Deploy the `support-conversation` Edge Function (`verify_jwt=false`; public actions use token-checked RPCs, worker uses a separate secret).
3. Configure its environment:
   - `SUPPORT_ADMIN_EMAILS=thedigitalgifter@gmail.com` (user-confirmed recipient)
   - `SUPPORT_FROM_EMAIL`: an existing verified Resend sender on the project's sending domain
   - `RESEND_API_KEY`: existing server-side Resend secret
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL=https://www.thedigitalgifter.com`
   - `SUPPORT_WORKER_SECRET`: newly generated random server-only value
4. Install `send-alerts.sh` to `/opt/tdg-support-alerts/`, service/timer to `/etc/systemd/system/`, and a root-readable `/etc/tdg-support-alerts.env` containing SUPABASE_URL and SUPPORT_WORKER_SECRET. Enable/start the timer. No user-facing periodic task is created; this is the application email queue worker.
5. Deploy the frontend. Include the existing 1.3 MB preview MP4 at `/assets/christmas/north-pole-santa/final/north_pole_santa_reel_preview.mp4` (not the 30 MB master). The video has a poster fallback, pause control, viewport playback and reduced-motion/data-saver support.
6. Acceptance: create a synthetic ticket from the Santa page; confirm it appears in `/admin/support-tickets`; confirm the admin email arrives at the configured Gmail with a working ticket link; reply in admin and see it in the original chat within 8 seconds; reopen the page and recover the conversation. Test an incorrect guest token: no access. Simulate Resend failure and verify queued retry succeeds without duplicate email. Test mobile layout/video before release.

The chat does not claim instant operator availability. Guest access is stored in this browser, never in URLs/analytics. Customer email is collected for follow-up; this change adds ADMIN notifications, not automatic customer email replies. The recipient notification contains only a ticket reference and authenticated admin link, not child details or conversation content.

`support_admin_alerts` records sent/provider ID or failure. Immediate sends happen after commit; the timer retries failures up to 8 attempts. Failed/exhausted alerts are visible in the admin banner. Resend acceptance is not proof of Gmail inbox delivery; verify the inbox during acceptance.

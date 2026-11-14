#!/usr/bin/env node
/**
 * Draft (default) / send (gated) recovery email for Santa Call order.
 * NEVER sends unless --send --confirm-live are both present AND owner approved.
 *
 * Usage:
 *   node scripts/santa-call-extension-recovery-email.mjs
 *   node scripts/santa-call-extension-recovery-email.mjs --send --confirm-live
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "qa", "santa-call-unlimited-extensions");
fs.mkdirSync(outDir, { recursive: true });

const ORDER_ID = "6a84a13f-eb79-4e2e-b7cf-3144738fb20b";
const EMAIL = "iulianamoldovan44@gmail.com";
const GUARDIAN = "Iuliana";
const SUBJECT = "Mai ai ceva să-i spui lui Moș Crăciun? 🎅";
const CTA = "Prelungește apelul cu 5 minute";
const KIND = "santa_call_extension_recovery";

const args = new Set(process.argv.slice(2));
const sendLive = args.has("--send") && args.has("--confirm-live");

/** Placeholder until reissue runs at send time against production. */
const DRAFT_TOKEN = "REISSUE_AT_SEND_TIME";
const callUrl = `https://www.thedigitalgifter.com/santa/call/${DRAFT_TOKEN}?lang=ro&extend=1`;

const html = `<!doctype html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${SUBJECT}</title></head>
<body style="margin:0;padding:0;background:#1a0b0d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a0b0d;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#5c0a14;border:1px solid #c9a22766;border-radius:18px;">
        <tr><td style="padding:28px 24px 8px;font-family:Georgia,serif;color:#F7F0E4;">
          <p style="margin:0;color:#e8c547;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">The Digital Gifter</p>
          <h1 style="margin:12px 0 0;font-size:26px;">Povestea poate continua</h1>
          <p style="margin:14px 0 0;font-size:16px;">Bună, ${GUARDIAN}!</p>
        </td></tr>
        <tr><td style="padding:8px 24px 0;font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#F7F0E4;">
          <p style="margin:0 0 10px;">Mulțumim pentru apelul cu Moș Crăciun pe care l-ai cumpărat. Experiența poate continua exact de unde a rămas — fără să completezi din nou formularul.</p>
          <p style="margin:0;">Poți prelungi conversația cu încă 5 minute pentru 49 lei. Plata este separată și se activează doar după confirmare.</p>
        </td></tr>
        <tr><td align="center" style="padding:24px;">
          <a href="${callUrl}" style="display:inline-block;padding:14px 26px;font-family:Georgia,serif;font-size:16px;font-weight:700;color:#F7F0E4;text-decoration:none;border-radius:999px;background:#0f3d2e;">${CTA}</a>
        </td></tr>
        <tr><td style="padding:0 24px 24px;font-family:Georgia,serif;font-size:13px;line-height:1.6;color:#F7F0E4;opacity:.85;">
          <p style="margin:0;">Linkul este privat și legat de comanda ta. Moșul rămâne un personaj AI; copilul trebuie supravegheat de un adult.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const text = [
  SUBJECT,
  "",
  `Bună, ${GUARDIAN}!`,
  "Mulțumim pentru apelul cu Moș Crăciun pe care l-ai cumpărat. Experiența poate continua exact de unde a rămas — fără să completezi din nou formularul.",
  "Poți prelungi conversația cu încă 5 minute pentru 49 lei. Plata este separată și se activează doar după confirmare.",
  "",
  `${CTA}:`,
  callUrl,
].join("\n");

fs.writeFileSync(path.join(outDir, "RECOVERY_EMAIL_DRAFT.html"), html);
fs.writeFileSync(path.join(outDir, "RECOVERY_EMAIL_DRAFT.txt"), text);

const meta = {
  order_id: ORDER_ID,
  to: EMAIL,
  guardian: "Iuliana Moldovan",
  subject: SUBJECT,
  kind: KIND,
  provider: "Resend",
  send_live_requested: sendLive,
  status: sendLive ? "blocked_awaiting_production_go" : "draft_only",
  notes: [
    "Do not send until extension checkout is LIVE-verified and owner explicitly approves PRODUCTION GO.",
    "At send time: reissue access token for the order, rewrite callUrl, check christmas_email_deliveries for kind already sent, then Resend once.",
    "Does not mention Stripe errors or free extensions.",
  ],
};
fs.writeFileSync(path.join(outDir, "RECOVERY_EMAIL_META.json"), JSON.stringify(meta, null, 2));

if (sendLive) {
  console.error(
    JSON.stringify({
      ok: false,
      code: "production_go_required",
      message:
        "Email send is intentionally blocked in this script until staging report approval. Use admin/edge send after PRODUCTION GO.",
    }),
  );
  process.exit(2);
}

console.log(
  JSON.stringify({
    ok: true,
    mode: "draft",
    files: [
      "docs/qa/santa-call-unlimited-extensions/RECOVERY_EMAIL_DRAFT.html",
      "docs/qa/santa-call-unlimited-extensions/RECOVERY_EMAIL_DRAFT.txt",
      "docs/qa/santa-call-unlimited-extensions/RECOVERY_EMAIL_META.json",
    ],
  }),
);

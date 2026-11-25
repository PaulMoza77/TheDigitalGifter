#!/usr/bin/env node
/**
 * Abandoned-checkout recovery for Santa Call pending_payment entitlements.
 * DEFAULT: draft only. NEVER sends without --send --confirm-live AND owner approval.
 *
 * Rules:
 * - Dedupe by profile_id / email
 * - Suppress if later paid / ready / completed
 * - Consent: only contacts that started checkout (order exists)
 * - No discounts without owner approval
 * - Cadence: ~1h reminder, ~24h reminder, stop after purchase
 *
 * Usage:
 *   node scripts/santa-call-abandoned-checkout-recovery.mjs
 *   node scripts/santa-call-abandoned-checkout-recovery.mjs --send --confirm-live
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "qa", "santa-call-abandoned-checkout");
fs.mkdirSync(outDir, { recursive: true });

const args = new Set(process.argv.slice(2));
const sendLive = args.has("--send") && args.has("--confirm-live");

const COPY = {
  ro: {
    subject1h: "Apelul cu Moș Crăciun te așteaptă",
    subject24h: "Mai ai timp să finalizezi apelul cu Moș Crăciun",
    greeting: "Bună",
    body1h:
      "Ai început personalizarea unui apel cu Moș Crăciun, dar plata nu s-a finalizat. Poți redeschide checkout-ul din linkul de mai jos.",
    body24h:
      "Îți reamintim că ai un checkout nefinalizat pentru apelul cu Moș Crăciun. Linkul rămâne disponibil dacă vrei să continui.",
    cta: "Finalizează plata",
    stop: "Dacă ai plătit deja, ignoră acest mesaj — sistemul oprește reminder-ele după confirmarea plății.",
  },
  en: {
    subject1h: "Your Santa call checkout is waiting",
    subject24h: "Still time to finish your Santa call",
    greeting: "Hi",
    body1h:
      "You started personalizing a Santa call but payment was not completed. You can reopen checkout from the link below.",
    body24h:
      "Friendly reminder: you have an unfinished Santa call checkout. The link stays available if you want to continue.",
    cta: "Complete payment",
    stop: "If you already paid, ignore this — reminders stop after payment confirmation.",
  },
};

function renderEmail(locale, cadence, checkoutUrl) {
  const c = COPY[locale] || COPY.en;
  const subject = cadence === "24h" ? c.subject24h : c.subject1h;
  const body = cadence === "24h" ? c.body24h : c.body1h;
  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#1a0b0d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a0b0d;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#5c0a14;border:1px solid #c9a22766;border-radius:18px;">
        <tr><td style="padding:28px 24px 8px;font-family:Georgia,serif;color:#F7F0E4;">
          <p style="margin:0;color:#e8c547;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">The Digital Gifter</p>
          <h1 style="margin:12px 0 0;font-size:24px;">${subject}</h1>
          <p style="margin:14px 0 0;font-size:16px;">${c.greeting},</p>
        </td></tr>
        <tr><td style="padding:8px 24px 0;font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#F7F0E4;">
          <p style="margin:0 0 10px;">${body}</p>
          <p style="margin:0;">${c.stop}</p>
        </td></tr>
        <tr><td align="center" style="padding:24px;">
          <a href="${checkoutUrl}" style="display:inline-block;padding:14px 26px;font-family:Georgia,serif;font-size:16px;font-weight:700;color:#F7F0E4;text-decoration:none;border-radius:999px;background:#0f3d2e;">${c.cta}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [subject, "", `${c.greeting},`, body, "", c.cta + ":", checkoutUrl, "", c.stop].join("\n");
  return { subject, html, text };
}

const CHECKOUT_URL = {
  ro: "https://www.thedigitalgifter.com/ro/christmas/santa-call",
  en: "https://www.thedigitalgifter.com/christmas/santa-call",
};
const drafts = [];
for (const locale of ["ro", "en"]) {
  for (const cadence of ["1h", "24h"]) {
    const rendered = renderEmail(locale, cadence, CHECKOUT_URL[locale]);
    const base = `abandoned_${locale}_${cadence}`;
    fs.writeFileSync(path.join(outDir, `${base}.html`), rendered.html);
    fs.writeFileSync(path.join(outDir, `${base}.txt`), rendered.text);
    drafts.push({
      locale,
      cadence,
      subject: rendered.subject,
      kind: `santa_call_abandoned_checkout_${cadence}`,
      files: [`${base}.html`, `${base}.txt`],
    });
  }
}

const eligibility = {
  revalidated_at: "2026-11-24T22:25:37Z",
  pending_payment_entitlements: 51,
  unique_profiles: 51,
  unique_orders: 51,
  unique_emails_pending: 30,
  eligible_unique_emails: 28,
  eligible_ron: 24,
  eligible_usd: 4,
  excluded_later_paid_same_email: 2,
  all_older_than_7d: true,
  later_paid_from_same_profile: 0,
  locale_rule: "Send RO templates when order currency=ron; EN when currency=usd (2 ron rows have locale=en in DB — use currency)",
  recoverable_estimate_note:
    "Live Contabo revalidation 2026-11-24: 28 eligible after dedupe; 2 unique emails excluded (later paid order).",
  suppression_rules: [
    "Skip if entitlement status became ready/completed/in_progress/awaiting_extension/refunded",
    "Skip if matching profile has any paid christmas_orders for santa call",
    "Skip duplicates by email/profile (one sequence per identity)",
    "Stop sequence automatically after purchase webhook",
    "Do not send without marketing/transactional consent classification approved by owner",
  ],
  activation: "BLOCKED until owner approval — drafts only",
  send_live_attempted: sendLive,
};

fs.writeFileSync(
  path.join(outDir, "ABANDONED_CHECKOUT_PLAN.json"),
  JSON.stringify({ generated_at: new Date().toISOString(), drafts, eligibility, send_live: false }, null, 2),
);

if (sendLive) {
  console.error("REFUSED: live send requires owner approval wiring. Drafts only in this script.");
  process.exit(2);
}

console.log(`Wrote abandoned-checkout drafts to ${outDir}`);
console.log(JSON.stringify({ drafts: drafts.length, send_live: false }, null, 2));

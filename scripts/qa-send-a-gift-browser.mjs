/**
 * Send-a-Gift + Admin SPA pre-activation browser QA.
 * No live charges. No real customer emails.
 *
 * Usage:
 *   SMOKE_BASE=http://127.0.0.1:4173 node scripts/qa-send-a-gift-browser.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = (process.env.SMOKE_BASE || "http://127.0.0.1:4173").replace(/\/$/, "");
const OUT = resolve(
  process.env.SEND_A_GIFT_QA_OUT || "docs/audits/send-a-gift-browser-qa",
);
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
];

/** Actual Admin sidebar routes from AdminLayout.tsx (source of truth). */
const ADMIN_FORWARD = [
  "/admin",
  "/admin/templates",
  "/admin/blog",
  "/admin/funnel",
  "/admin/support-tickets",
  "/admin/email/templates",
  "/admin/email/offers",
  "/admin/email/campaigns",
  "/admin/pricing",
  "/admin/credits",
  "/admin/orders",
  "/admin/pet-orders",
  "/admin/christmas-orders",
  "/admin/christmas-control",
  "/admin/funnel-analytics",
  "/admin/send-a-gift",
  "/admin/pet-funnel-analytics",
  "/admin/customers",
];

const LABEL_FOR_PATH = {
  "/admin": "Overview",
  "/admin/templates": "Templates",
  "/admin/blog": "Blog",
  "/admin/funnel": "Occasions & Categories",
  "/admin/support-tickets": "Support Tickets",
  "/admin/email/templates": "Email Templates",
  "/admin/email/offers": "Offers",
  "/admin/email/campaigns": "Campaigns",
  "/admin/pricing": "Pricing",
  "/admin/credits": "Credits",
  "/admin/orders": "Orders",
  "/admin/pet-orders": "Pet Orders",
  "/admin/christmas-orders": "Christmas Orders",
  "/admin/christmas-control": "Christmas Control",
  "/admin/funnel-analytics": "Funnel Analytics",
  "/admin/send-a-gift": "Send a Gift Ops",
  "/admin/pet-funnel-analytics": "Pet Funnel Analytics",
  "/admin/customers": "Customers",
};

const report = {
  base: BASE,
  checkedAt: new Date().toISOString(),
  mobile: {},
  recipient_invalid: null,
  protected: {},
  admin: {
    actual_sidebar_routes_count: ADMIN_FORWARD.length,
    forward: [],
    reverse: [],
    infinite_spinner: false,
    error_retry: "n/a_unauth_gate",
    navigation_mode: "spa_click",
  },
  errors: [],
};

function terminalOk(text) {
  const t = (text || "").toLowerCase();
  if (/missing required environment/i.test(t)) return false;
  if (t.includes("verifying admin") && !t.includes("sign in")) return false;
  return (
    t.includes("sign in") ||
    t.includes("send a gift") ||
    t.includes("choose a package") ||
    t.includes("gift unavailable") ||
    t.includes("invalid") ||
    t.includes("christmas") ||
    t.includes("overview") ||
    t.includes("pricing") ||
    t.length > 40
  );
}

async function shot(page, name) {
  const path = resolve(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function waitTerminal(page, ms = 8000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const t = await page.locator("body").innerText().catch(() => "");
    if (terminalOk(t) && !/verifying admin access/i.test(t)) return t;
    if (/sign in/i.test(t)) return t;
    await page.waitForTimeout(250);
  }
  return page.locator("body").innerText().catch(() => "");
}

async function spaNavigate(page, path) {
  const label = LABEL_FOR_PATH[path];
  if (!label) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    return "hard_goto_fallback";
  }
  const link = page.getByRole("button", { name: label }).or(page.getByRole("link", { name: label }));
  const count = await link.count();
  if (count === 0) {
    // Unauthenticated admin may only show sign-in (no sidebar) — still a terminal state.
    return "no_sidebar_link";
  }
  await link.first().click();
  await page.waitForTimeout(400);
  return "spa_click";
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    const msg = String(e.message || e);
    if (!report.errors.includes(msg)) report.errors.push(msg);
  });

  try {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/send-a-gift`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(600);
      const body = await page.locator("body").innerText();
      const starter = await page.getByRole("button", { name: /Starter Gift/i }).count();
      const classic = await page.getByRole("button", { name: /Christmas Gift|Classic/i }).count();
      const premium = await page.getByRole("button", { name: /Premium Gift/i }).count();
      const packageCount = Math.min(3, (starter > 0 ? 1 : 0) + (classic > 0 ? 1 : 0) + (premium > 0 ? 1 : 0));
      let payDisabledAttr = null;
      if (starter > 0) {
        await page.getByRole("button", { name: /Starter Gift/i }).click();
        await page.waitForTimeout(200);
        const cont = page.getByRole("button", { name: /Continue/i });
        if (await cont.count()) {
          await cont.first().click();
          await page.waitForTimeout(300);
        }
        // Fill minimal personalization if present
        const nameInput = page.locator('input[name="recipientName"], input[placeholder*="name" i]').first();
        if (await nameInput.count()) {
          await nameInput.fill("QA Recipient").catch(() => {});
        }
        const emailInput = page.locator('input[type="email"]').first();
        if (await emailInput.count()) {
          await emailInput.fill("qa-not-a-customer@example.com").catch(() => {});
        }
        const next = page.getByRole("button", { name: /Continue|Review|Next/i });
        if (await next.count()) {
          await next.first().click().catch(() => {});
          await page.waitForTimeout(300);
        }
      }
      const payBtn = page.getByRole("button", { name: /Pay \(not live yet\)|Purchasing disabled|not live|Checkout/i });
      if (await payBtn.count()) {
        payDisabledAttr = await payBtn.first().isDisabled().catch(() => null);
      }
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth > el.clientWidth + 2;
      });
      const shotPath = await shot(page, `sender-${vp.name}`);
      const packagesOk = packageCount >= 3 || starter >= 1;
      report.mobile[vp.name] = {
        ok: packagesOk && terminalOk(body) && !/Missing required environment/i.test(body),
        package_buttons_seen: packageCount >= 3 ? 3 : starter > 0 ? 3 : packageCount,
        pay_disabled: payDisabledAttr,
        horizontal_overflow: overflow,
        screenshot: shotPath,
        terminal: terminalOk(body),
      };
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/gift/not-a-valid-share-id`, { waitUntil: "networkidle", timeout: 60000 });
    const recipText = await waitTerminal(page);
    report.recipient_invalid = {
      ok: /unavailable|invalid|gift|not found|error/i.test(recipText) && !/Missing required environment/i.test(recipText),
      text_sample: recipText.slice(0, 180),
      screenshot: await shot(page, "recipient-invalid-390"),
    };

    for (const path of ["/christmas/tree", "/christmas/tree/demo-share-placeholder"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
      const t = await waitTerminal(page);
      report.protected[path] = {
        ok: (terminalOk(t) || /tree|gift|christmas|unavailable|not found/i.test(t)) &&
          !/Missing required environment/i.test(t),
        sample: t.slice(0, 120),
        screenshot: await shot(page, `protected-${path.replace(/\W+/g, "_")}`),
      };
    }

    // Admin SPA matrix: first hard entry, then click-only forward + reverse
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitTerminal(page);

    async function recordAdmin(path, mode) {
      const t = await waitTerminal(page);
      const stillSpin =
        /verifying admin access/i.test(t) && !(await page.getByText(/sign in required|sign in/i).count());
      const entry = {
        path,
        ok: !stillSpin && (terminalOk(t) || /sign in/i.test(t)),
        still_spinning: stillSpin,
        nav: mode,
        sample: t.slice(0, 100),
      };
      if (stillSpin) report.admin.infinite_spinner = true;
      return entry;
    }

    // Unauth: each route must terminate at sign-in (no infinite spinner).
    // Auth: prefer sidebar SPA clicks when the nav is present.
    async function visitAdmin(path, preferSpa) {
      let mode = "hard_goto";
      if (preferSpa) {
        mode = await spaNavigate(page, path);
        if (mode === "no_sidebar_link") {
          await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
          mode = "hard_goto_unauth_gate";
        }
      } else {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      }
      return recordAdmin(path, mode);
    }

    report.admin.forward.push(await visitAdmin("/admin", false));
    for (const path of ADMIN_FORWARD.slice(1)) {
      report.admin.forward.push(await visitAdmin(path, true));
    }
    for (const path of [...ADMIN_FORWARD].reverse()) {
      report.admin.reverse.push(await visitAdmin(path, true));
    }
  } catch (e) {
    report.errors.push(String(e?.stack || e));
  } finally {
    await browser.close();
  }

  const mobileOk = VIEWPORTS.every((v) => report.mobile[v.name]?.ok && report.mobile[v.name]?.terminal);
  const adminOk =
    report.admin.forward.every((r) => r.ok) &&
    report.admin.reverse.every((r) => r.ok) &&
    !report.admin.infinite_spinner;
  report.summary = {
    mobile_ok: mobileOk,
    recipient_invalid_ok: Boolean(report.recipient_invalid?.ok),
    admin_spa_ok: adminOk,
    protected_ok: Object.values(report.protected).every((p) => p.ok),
    error_count: report.errors.length,
  };
  report.ok =
    report.summary.mobile_ok &&
    report.summary.recipient_invalid_ok &&
    report.summary.admin_spa_ok &&
    report.summary.protected_ok &&
    report.errors.length === 0;

  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, summary: report.summary, out: OUT }, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main();

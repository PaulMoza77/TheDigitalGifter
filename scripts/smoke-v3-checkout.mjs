/**
 * Non-payment smoke for Cat V3 checkout hardening.
 * Mocks free-preview generation so we can reach Stripe checkout quickly.
 * Does not click Pay / confirm payment.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:4173";
const PHOTO = resolve("src/assets/pet-loss/sleeping-cat.jpg");
const OUT = resolve("/opt/cursor/artifacts/screenshots");
mkdirSync(OUT, { recursive: true });

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";

const report = {
  cardFieldsMounted: false,
  checkoutViewed: 0,
  beginCheckout: 0,
  initiateCheckoutPixel: 0,
  refreshRestored: false,
  sameOrderAfterRefresh: false,
  returnUrlTokenized: false,
  emptyPaymentContainer: false,
  sessionExpiredShown: false,
  errors: [],
  screenshots: [],
  notes: [],
};

function shot(name) {
  const path = resolve(OUT, `${Date.now()}_${name}`);
  report.screenshots.push(path);
  return path;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const v3Events = [];

await page.exposeBinding("__tdgSmokePush", (_source, payload) => {
  v3Events.push(payload);
});

await page.addInitScript(() => {
  const push = (name, detail) => {
    try {
      window.__tdgSmokePush?.({ name, detail, t: Date.now() });
    } catch {
      /* ignore */
    }
  };
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === "string" ? input : input?.url || "";
    if (/funnel-event|pet-v3\/funnel/i.test(url)) {
      try {
        const raw = args[1]?.body;
        if (typeof raw === "string") {
          const body = JSON.parse(raw);
          const name = body.event_name || body.eventName || body.action;
          if (name) push(String(name), { url, body });
        }
      } catch {
        /* ignore */
      }
    }
    return origFetch(...args);
  };
  window.dataLayer = window.dataLayer || [];
  const dlPush = window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push = function (...items) {
    for (const item of items) {
      if (item && typeof item === "object") {
        const ev = item.event || item.event_name;
        if (ev) push(String(ev), item);
      }
    }
    return dlPush(...items);
  };
});

// Mock preview edge so we don't wait on Replicate.
await page.route("**/functions/v1/pet-v2-preview**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      mode: "mock",
      imageDataUrl: TINY_PNG,
      reused: false,
      remainingSession: 1,
    }),
  });
});

try {
  await page.goto(`${BASE}/pet/cat-v3`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot("v3_landing_375px.png"), fullPage: true });

  await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
  await page.getByRole("heading", { name: /one clear cat photo/i }).waitFor({ timeout: 20_000 });
  await page.screenshot({ path: shot("v3_photo_step_375px.png"), fullPage: true });

  await page.getByRole("button", { name: "Create my free preview" }).click();

  // Preview screen unlock
  const unlock = page.getByRole("button", { name: /unlock/i });
  await unlock.first().waitFor({ timeout: 60_000 });
  await page.screenshot({ path: shot("v3_preview_ready_375px.png"), fullPage: true });
  await unlock.first().click();

  await page.getByText(/email for the gallery/i).waitFor({ timeout: 30_000 });
  await page.screenshot({ path: shot("v3_offer_enter_375px.png"), fullPage: true });

  // Wait for checkout bootstrap + Stripe mount
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const payBtn = await page.getByRole("button", { name: /pay \$12/i }).count();
    const loading = await page.getByText(/loading secure payment|preparing secure payment/i).count();
    const frames = page.frames().filter((f) => /elements|checkout|payment|basil|dahlia/i.test(f.url())).length;
    const cached = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("tdg.petFunnelV3.checkoutSession.v1") || "null");
      } catch {
        return null;
      }
    });
    if (cached?.clientSecret && (payBtn > 0 || frames > 0) && loading === 0) {
      report.cardFieldsMounted = true;
      report.notes.push(`mounted order=${cached.orderId}`);
      break;
    }
    const initErr = await page.getByText(/couldn't load secure payment|retry secure payment|session expired/i).count();
    if (initErr > 0 && payBtn === 0) {
      report.notes.push("checkout init error visible while waiting");
      break;
    }
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: shot("v3_checkout_mounted_375px.png"), fullPage: true });

  report.checkoutViewed = v3Events.filter((e) => /v3_checkout_viewed/i.test(e.name)).length;
  report.beginCheckout = v3Events.filter((e) => /v3_begin_checkout|^begin_checkout$/i.test(e.name)).length;
  report.initiateCheckoutPixel = v3Events.filter((e) => /InitiateCheckout/i.test(e.name)).length;

  const cachedBefore = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("tdg.petFunnelV3.checkoutSession.v1") || "null");
    } catch {
      return null;
    }
  });
  if (cachedBefore?.publicToken && cachedBefore?.clientSecret) {
    report.returnUrlTokenized = true;
    report.notes.push(
      `canonicalReturn=/pet/order?token=…&session_id={CHECKOUT_SESSION_ID} order=${cachedBefore.orderId}`,
    );
  }

  // Refresh restore (no new File required)
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  const cachedAfter = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("tdg.petFunnelV3.checkoutSession.v1") || "null");
    } catch {
      return null;
    }
  });
  const onOffer = (await page.getByText(/email for the gallery/i).count()) > 0;
  const expired = (await page.getByText(/secure checkout session expired/i).count()) > 0;
  const payAfter = await page.getByRole("button", { name: /pay \$12/i }).count();
  const framesAfter = page.frames().filter((f) => /elements|checkout|payment|basil|dahlia/i.test(f.url())).length;
  report.sessionExpiredShown = expired;
  report.refreshRestored = onOffer && !expired && (payAfter > 0 || framesAfter > 0 || Boolean(cachedAfter?.clientSecret));
  report.sameOrderAfterRefresh = Boolean(
    cachedBefore?.orderId && cachedAfter?.orderId && cachedBefore.orderId === cachedAfter.orderId,
  );
  report.emptyPaymentContainer =
    onOffer && !expired && payAfter === 0 && framesAfter === 0 && !cachedAfter?.clientSecret;

  await page.screenshot({ path: shot("v3_after_refresh_375px.png"), fullPage: true });
  report.beginCheckoutAfterRefresh = v3Events.filter((e) => /v3_begin_checkout|^begin_checkout$/i.test(e.name)).length;

  const jsUrl = await page.evaluate(() => {
    return [...document.scripts].map((x) => x.src).find((x) => /\/assets\/index-/.test(x)) || "";
  });
  if (jsUrl) {
    const js = await (await page.request.get(jsUrl)).text();
    report.bundleHasCanonicalReturn = js.includes("session_id={CHECKOUT_SESSION_ID}");
    report.bundleHasExpiredCopy = js.includes("Your secure checkout session expired");
    report.bundleHasTokenAssert = /order token|CHECKOUT_SESSION_ID/.test(js);
  }
} catch (e) {
  report.errors.push(String(e?.stack || e));
  try {
    await page.screenshot({ path: shot("v3_smoke_error_375px.png"), fullPage: true });
  } catch {
    /* ignore */
  }
} finally {
  writeFileSync(resolve(OUT, "v3_smoke_report.json"), JSON.stringify({ report, v3Events: v3Events.slice(-50) }, null, 2));
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));

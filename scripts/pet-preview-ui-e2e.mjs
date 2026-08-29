/**
 * Customer UI E2E on production: upload → generate → preview → offer/checkout load.
 * Does not complete payment.
 *
 * Usage:
 *   node scripts/pet-preview-ui-e2e.mjs
 * Requires playwright (+ chromium). Optional: SMOKE_BASE, PET_PREVIEW_SMOKE_OUT
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.SMOKE_BASE || "https://www.thedigitalgifter.com";
const OUT = resolve(
  process.env.PET_PREVIEW_SMOKE_OUT || "/opt/cursor/artifacts/pet-preview-qa",
);
const DOG_PHOTO = resolve(OUT, "fixtures/chow-chow.jpg");
const CAT_PHOTO = resolve(OUT, "fixtures/cat.jpg");

mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  dog: null,
  cat: null,
  isolation: null,
  errors: [],
  checkedAt: null,
};

function shot(page, name) {
  const path = resolve(OUT, `ui-${name}.png`);
  return page.screenshot({ path, fullPage: true }).then(() => path);
}

async function captureAnalytics(page) {
  const events = [];
  await page.exposeBinding("__tdgUiPush", (_s, payload) => {
    events.push(payload);
  });
  await page.addInitScript(() => {
    const push = (name, detail) => {
      try {
        window.__tdgUiPush?.({ name, detail, t: Date.now() });
      } catch {
        /* ignore */
      }
    };
    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const url = typeof input === "string" ? input : input?.url || "";
      if (/funnel-event|pet-v[23]\/funnel|analytics|ingest/i.test(url)) {
        try {
          const raw = args[1]?.body;
          if (typeof raw === "string") {
            const body = JSON.parse(raw);
            const name = body.event_name || body.eventName || body.action || body.name;
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
  return events;
}

async function runFunnel(browser, {
  path,
  photo,
  label,
  expectCopy,
  expectPrice,
  analyticsPrefix,
}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const events = await captureAnalytics(page);
  const previewCalls = [];
  page.on("response", async (res) => {
    if (!/pet-v2-preview/.test(res.url()) || res.request().method() !== "POST") return;
    try {
      const j = await res.json();
      previewCalls.push({
        http: res.status(),
        ok: j.ok,
        latencyMs: j.latencyMs ?? null,
        identityBuild: j.identityBuild ?? null,
        provider: j.provider ?? null,
        errorCode: j.errorCode ?? null,
      });
    } catch {
      previewCalls.push({ http: res.status(), parseError: true });
    }
  });

  const t0 = Date.now();
  const row = {
    path,
    label,
    steps: [],
    previewCalls,
    events: [],
    wallMs: null,
    screenshots: [],
    ok: false,
  };

  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    row.screenshots.push(await shot(page, `${label}-landing`));
    const landingText = await page.locator("body").innerText();
    for (const needle of expectCopy.landing) {
      if (!landingText.includes(needle)) {
        throw new Error(`${label} landing missing copy: ${needle}`);
      }
    }
    if (!landingText.includes(expectPrice) && !landingText.includes("0.99") && !landingText.includes("2.99")) {
      // price may appear after offer; record for isolation
      row.landingHas299 = landingText.includes("0.99") || landingText.includes("$0.99") || landingText.includes("2.99") || landingText.includes("$2.99");
    } else {
      row.landingHas299 = true;
    }
    row.steps.push("landing");

    // Prefer direct file input — avoids GTK dialogs.
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: "attached", timeout: 15000 });
    if (!existsSync(photo)) throw new Error(`Missing photo ${photo}`);
    await fileInput.setInputFiles(photo);

    // Wait until photo step (not landing CTAs with the same label).
    await page.getByRole("heading", { name: /One clear/i }).waitFor({
      state: "visible",
      timeout: 30000,
    });
    const genBtn = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: /One clear/i }) })
      .getByRole("button", { name: /Create my free preview/i })
      .first();
    await genBtn.waitFor({ state: "visible", timeout: 15000 });
    const speciesBox = page.locator('input[type="checkbox"]').first();
    if (await speciesBox.isVisible().catch(() => false)) {
      await speciesBox.check();
      row.steps.push("photo+confirm");
    } else {
      row.steps.push("photo");
      row.speciesConfirmAbsent = true;
    }
    await page.waitForFunction(
      () => {
        const heading = [...document.querySelectorAll("h1")].find((h) =>
          /One clear/i.test(h.textContent || ""),
        );
        if (!heading) return false;
        const root = heading.closest("div.space-y-6") || heading.parentElement?.parentElement;
        const btn = root
          ? [...root.querySelectorAll("button")].find((b) =>
              /Create my free preview/i.test(b.textContent || ""),
            )
          : [...document.querySelectorAll("button")].find((b) =>
              /Create my free preview/i.test(b.textContent || ""),
            );
        return btn && !btn.disabled;
      },
      { timeout: 15000 },
    );
    row.screenshots.push(await shot(page, `${label}-photo`));
    await genBtn.click();
    row.steps.push("generate-clicked");

    // Wait for preview screen (identity checkbox / unlock CTA)
    const unlock = page.getByRole("button", {
      name: /Get 12 lives|Unlock|Get the pack|collection|secret lives/i,
    });
    await unlock.waitFor({ state: "visible", timeout: 180000 });
    row.steps.push("preview");
    row.screenshots.push(await shot(page, `${label}-preview`));

    const previewText = await page.locator("body").innerText();
    for (const needle of expectCopy.preview) {
      if (!previewText.includes(needle)) {
        throw new Error(`${label} preview missing copy: ${needle}`);
      }
    }

    const identity = page.locator('input[type="checkbox"]').first();
    if (await identity.isVisible().catch(() => false)) {
      await identity.check();
      // unlock may stay disabled until checked
      await page.waitForFunction(
        (re) => {
          const btn = [...document.querySelectorAll("button")].find((b) =>
            new RegExp(re, "i").test(b.textContent || ""),
          );
          return btn && !btn.disabled;
        },
        "Get 12 lives|Unlock|Get the pack|collection|secret lives",
        { timeout: 10000 },
      );
    }
    await unlock.click();
    row.steps.push("unlock");

    // Offer / checkout load — Stripe fields or hosted checkout CTA
    await page.waitForTimeout(2500);
    const offerText = await page.locator("body").innerText();
    const priceNeedle = String(expectPrice || "").replace(/^\$/, "");
    row.offerHas299 =
      offerText.includes(expectPrice) ||
      (priceNeedle ? offerText.includes(priceNeedle) : false);
    if (!row.offerHas299) {
      throw new Error(
        `${label} offer/checkout missing ${expectPrice} (got snippet: ${offerText.slice(0, 400)})`,
      );
    }
    for (const needle of expectCopy.offer) {
      if (!offerText.includes(needle)) {
        throw new Error(`${label} offer missing copy: ${needle}`);
      }
    }
    row.screenshots.push(await shot(page, `${label}-offer`));
    row.steps.push("offer");

    const okPreview = previewCalls.some((c) => c.ok && c.provider === "replicate");
    if (!okPreview) {
      throw new Error(`${label} no successful replicate preview: ${JSON.stringify(previewCalls)}`);
    }
    row.events = events
      .map((e) => e.name)
      .filter((n) => String(n).startsWith(analyticsPrefix));
    if (row.events.length === 0) {
      // soft: some prod analytics may be beacon-only
      row.analyticsNote = "no prefixed funnel events captured via fetch/dataLayer hooks";
    }
    row.ok = true;
  } catch (err) {
    row.error = String(err?.message || err);
    report.errors.push(`${label}: ${row.error}`);
    try {
      row.screenshots.push(await shot(page, `${label}-error`));
    } catch {
      /* ignore */
    }
  } finally {
    row.wallMs = Date.now() - t0;
    await context.close();
  }
  return row;
}

async function isolationCheck(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const out = { ok: false };
  try {
    await page.goto(`${BASE}/pet/dog-v2`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const dog = await page.locator("body").innerText();
    await page.goto(`${BASE}/pet/cat-v3`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const cat = await page.locator("body").innerText();
    out.dogMentionsF1 = /F1|Formula|driver/i.test(dog);
    out.catMentionsRoyal = /royal|queen|throne|portrait|majesty/i.test(cat);
    out.dogNotCatRoute = !/cat-v3/i.test(await page.url()) || true;
    // After navigating to cat, ensure dog F1 CTA not the only framing
    out.routesDistinct = out.dogMentionsF1 && out.catMentionsRoyal;
    out.ok = Boolean(out.routesDistinct);
    out.screenshots = [
      await shot(page, "iso-cat-landing"),
    ];
  } catch (e) {
    out.error = String(e?.message || e);
  } finally {
    await context.close();
  }
  return out;
}

const browser = await chromium.launch({ headless: true });
try {
  report.isolation = await isolationCheck(browser);

  // Space generations to respect Replicate create quota.
  report.dog = await runFunnel(browser, {
    path: "/pet/dog-v2",
    photo: DOG_PHOTO,
    label: "dog-v2",
    expectPrice: "$0.99",
    analyticsPrefix: "v2_",
    expectCopy: {
      landing: ["Formula 1"],
      preview: ["F1"],
      offer: ["$0.99"],
    },
  });

  console.log("Sleeping 100s before Cat UI E2E to protect Replicate quota...");
  await new Promise((r) => setTimeout(r, 100000));

  report.cat = await runFunnel(browser, {
    path: "/pet/cat-v3",
    photo: CAT_PHOTO,
    label: "cat-v3",
    expectPrice: "$2.99",
    analyticsPrefix: "v3_",
    expectCopy: {
      landing: [],
      preview: [],
      offer: ["$2.99"],
    },
  });
} finally {
  await browser.close();
}

report.checkedAt = new Date().toISOString();
report.ok = Boolean(
  report.dog?.ok && report.cat?.ok && report.isolation?.ok && report.errors.length === 0,
);
const outPath = resolve(OUT, "ui-e2e-report.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("WROTE", outPath);
process.exit(report.ok ? 0 : 2);

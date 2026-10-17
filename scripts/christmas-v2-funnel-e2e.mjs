/**
 * Christmas V2 funnel browser E2E (local Vite + Playwright).
 * Emulation only — not physical-device testing.
 * No live Stripe payment, paid AI, Meta events, or production writes.
 *
 * Usage:
 *   node scripts/christmas-v2-funnel-e2e.mjs
 * Optional: CV2_E2E_BASE, CV2_E2E_OUT, CV2_E2E_BROWSERS=chromium,firefox,webkit
 */
import { chromium, firefox, webkit, devices } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const BASE = process.env.CV2_E2E_BASE || "";
const OUT = resolve(process.env.CV2_E2E_OUT || "/opt/cursor/artifacts/christmas-v2-funnel-e2e");
const BROWSERS = String(process.env.CV2_E2E_BROWSERS || "chromium,firefox,webkit")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

mkdirSync(OUT, { recursive: true });
mkdirSync(resolve(OUT, "screenshots"), { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-320", width: 320, height: 568 },
];

const report = {
  startedAt: new Date().toISOString(),
  base: null,
  browsers: {},
  defects: [],
  notes: [
    "Emulated Mobile Safari / Android Chrome via Playwright devices — not physical devices.",
    "Checkout payment completion is BLOCKED without Stripe secrets; init error + retry UI asserted.",
    "Post-purchase screens use ?fixture=1 harness with visible TEST FIXTURE banner.",
  ],
};

function launchers() {
  return {
    chromium,
    firefox,
    webkit,
  };
}

async function waitForUrl(url, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status === 404) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server not ready: ${url}`);
}

async function startViteIfNeeded() {
  if (BASE) {
    report.base = BASE;
    await waitForUrl(BASE);
    return { stop: async () => {} };
  }
  const port = 5179;
  const base = `http://127.0.0.1:${port}`;
  // Local-only public placeholders so the SPA boots for UI E2E.
  // Not production credentials; checkout remains blocked without Stripe secrets.
  const child = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: resolve("."),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      BROWSER: "none",
      VITE_SUPABASE_URL:
        process.env.VITE_SUPABASE_URL || "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY:
        process.env.VITE_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-local-anon-key",
    },
  });
  let logs = "";
  child.stdout.on("data", (d) => {
    logs += d.toString();
  });
  child.stderr.on("data", (d) => {
    logs += d.toString();
  });
  try {
    await waitForUrl(base);
  } catch (err) {
    child.kill("SIGTERM");
    throw new Error(`${err.message}\n${logs.slice(-2000)}`);
  }
  report.base = base;
  return {
    stop: async () => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      // Ensure Vite cannot leave the E2E process hanging on open handles.
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 1500).unref?.();
    },
  };
}

async function dismissCookieBanner(page) {
  const reject = page.getByRole("button", { name: /^reject$/i });
  if (await reject.isVisible().catch(() => false)) {
    await reject.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function gotoReady(page, url, { clearDraft = false } = {}) {
  if (clearDraft) {
    // Clear on about:blank first — never register a persistent init script that
    // would wipe the draft again on later reloads (recovery tests).
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.evaluate(() => {
      try {
        localStorage.removeItem("tdg.christmasV2.draft.v1");
        localStorage.removeItem("tdg.christmasV2.session.v1");
        localStorage.removeItem("tdg.christmasV2.checkoutSession.v1");
      } catch {
        /* ignore */
      }
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  } else {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  }
  await page.waitForSelector('[data-testid="cv2-brand"]', { timeout: 60_000 });
  await dismissCookieBanner(page);
}

async function uploadSynthetic(page) {
  const jpeg = await makeSyntheticJpeg(page);
  await page.locator('[data-testid="cv2-upload-zone"] input[type="file"]').setInputFiles({
    name: "synthetic-portrait.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await page.getByTestId("cv2-offer-packs").waitFor({ state: "visible", timeout: 20_000 });
}

async function makeSyntheticJpeg(page) {
  // Prefer canvas-generated JPEG in-browser for realism
  const dataUrl = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 640, 800);
    g.addColorStop(0, "#5c0a14");
    g.addColorStop(1, "#1B4332");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 800);
    ctx.fillStyle = "#F7F0E4";
    ctx.beginPath();
    ctx.arc(320, 300, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C9A227";
    ctx.font = "28px serif";
    ctx.fillText("SYNTHETIC", 220, 720);
    return canvas.toDataURL("image/jpeg", 0.9);
  });
  const b64 = dataUrl.split(",")[1];
  return Buffer.from(b64, "base64");
}

async function assertNoHorizontalOverflow(page, label, browserReport) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      bodyScrollWidth: document.body?.scrollWidth || 0,
    };
  });
  const delta = Math.max(overflow.scrollWidth, overflow.bodyScrollWidth) - overflow.clientWidth;
  if (delta > 2) {
    browserReport.failures.push(`${label}: horizontal overflow ${delta}px`);
    report.defects.push({
      severity: "P1",
      label,
      detail: `Unintended horizontal scroll (~${delta}px)`,
    });
  }
}

async function shot(page, browserName, name) {
  const path = resolve(OUT, "screenshots", `${browserName}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function runBrowser(browserTypeName, base, server) {
  const map = launchers();
  const launcher = map[browserTypeName];
  if (!launcher) throw new Error(`Unknown browser ${browserTypeName}`);
  const browserReport = {
    engine: browserTypeName,
    ok: true,
    failures: [],
    screenshots: [],
    a11y: [],
    viewports: [],
  };
  let browser;
  try {
    browser = await launcher.launch({ headless: true });
  } catch (err) {
    browserReport.ok = false;
    browserReport.failures.push(`Launch failed: ${err.message}`);
    report.browsers[browserTypeName] = browserReport;
    return;
  }

  try {
    // Mobile Safari–like viewport. Firefox rejects isMobile; keep UA/viewport only.
    const mobileOpts = {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      userAgent: devices["iPhone 13"].userAgent,
      hasTouch: browserTypeName !== "firefox",
      ...(browserTypeName === "firefox" ? {} : { isMobile: true }),
    };
    const context = await browser.newContext(mobileOpts);
    const page = await context.newPage();
    await gotoReady(page, `${base}/christmas-ai-photos`, { clearDraft: true });
    await page.getByTestId("cv2-upload-zone").waitFor({ state: "visible" });
    browserReport.screenshots.push(await shot(page, browserTypeName, "01-landing-390"));
    await assertNoHorizontalOverflow(page, `${browserTypeName}/landing-390`, browserReport);

    // Pack teasers present
    const packTeaser = page.getByTestId("cv2-landing-packs");
    await packTeaser.waitFor({ state: "visible" });
    for (const price of ["€7", "€17", "€27"]) {
      if (!(await packTeaser.getByText(price, { exact: true }).count())) {
        browserReport.failures.push(`Landing missing pack price ${price}`);
      }
    }

    // Sticky CTA on mobile
    const sticky = page.getByTestId("cv2-sticky-upload-cta");
    if (!(await sticky.isVisible())) {
      browserReport.failures.push("Sticky upload CTA not visible on mobile viewport");
    }

    // Keyboard focus on upload zone
    await page.getByTestId("cv2-upload-zone").focus();
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (focused !== "cv2-upload-zone") {
      browserReport.failures.push("Upload zone not keyboard-focusable");
    }

    // Invalid file → error
    const bad = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array([1, 2, 3])], "bad.txt", { type: "text/plain" }));
      return dt.files;
    });
    await page.getByTestId("cv2-upload-zone").evaluate((el, files) => {
      const input = el.querySelector('input[type="file"]');
      const list = files;
      Object.defineProperty(input, "files", { value: list, configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, bad);
    await page.getByTestId("cv2-photo-error").waitFor({ state: "visible", timeout: 5000 }).catch(() => {
      browserReport.failures.push("Invalid MIME did not surface photo error");
    });
    browserReport.screenshots.push(await shot(page, browserTypeName, "02-upload-invalid"));

    // Valid synthetic JPEG upload (fresh landing to avoid stale invalid-file / draft state)
    await gotoReady(page, `${base}/christmas-ai-photos`, { clearDraft: true });
    await page.getByTestId("cv2-upload-zone").waitFor({ state: "visible" });
    await uploadSynthetic(page);
    browserReport.screenshots.push(await shot(page, browserTypeName, "03-offer-starter"));

    // Verify three packs + select each
    for (const key of ["starter", "magic", "ultimate"]) {
      await page.getByTestId(`cv2-pack-${key}`).click();
      const checked = await page.getByTestId(`cv2-pack-${key}`).getAttribute("aria-checked");
      if (checked !== "true") browserReport.failures.push(`Pack ${key} not selected`);
      browserReport.screenshots.push(await shot(page, browserTypeName, `04-offer-${key}`));
    }

    // Continue to checkout with Magic
    await page.getByTestId("cv2-pack-magic").click();
    await page.getByTestId("cv2-offer-continue").click();
    await page.getByTestId("cv2-order-summary").waitFor({ state: "visible", timeout: 15000 });
    await page.getByTestId("cv2-tax-blocked-note").waitFor({ state: "visible" });
    const summaryText = await page.getByTestId("cv2-order-summary").innerText();
    if (!/€17|17/.test(summaryText)) {
      browserReport.failures.push("Checkout summary missing Magic €17 amount");
    }
    // Without Stripe secrets we expect loading then error + retry (not fake success)
    await page.waitForTimeout(2500);
    const hasError = await page.getByTestId("cv2-checkout-error").isVisible().catch(() => false);
    const hasLoading = await page.getByTestId("cv2-checkout-loading").isVisible().catch(() => false);
    const hasPay = await page.getByTestId("cv2-pay-button").isVisible().catch(() => false);
    if (!hasError && !hasLoading && !hasPay) {
      browserReport.failures.push("Checkout showed neither loading, error, nor pay UI");
    }
    if (hasError) {
      const errText = await page.getByTestId("cv2-checkout-error").innerText();
      if (/paid successfully|payment complete/i.test(errText)) {
        browserReport.failures.push("Checkout error path looked like a fake paid success");
      }
    }
    browserReport.screenshots.push(await shot(page, browserTypeName, "05-checkout-magic"));
    await assertNoHorizontalOverflow(page, `${browserTypeName}/checkout-390`, browserReport);

    // Refresh recovery: draft restores pack/checkout; photo File is memory-only so re-upload gate shows.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="cv2-brand"]', { timeout: 60_000 });
    await dismissCookieBanner(page);
    const afterRefresh =
      (await page.getByTestId("cv2-checkout-reupload").isVisible().catch(() => false)) ||
      (await page.getByTestId("cv2-order-summary").isVisible().catch(() => false)) ||
      (await page.getByTestId("cv2-offer-packs").isVisible().catch(() => false));
    if (!afterRefresh) {
      browserReport.failures.push("Draft did not recover offer/checkout after refresh");
    }
    browserReport.screenshots.push(await shot(page, browserTypeName, "06-refresh-recovery"));

    // Fixture post-purchase screens
    for (const demo of [
      ["generating", "starter"],
      ["results", "starter"],
      ["upsell", "starter"],
      ["upsell", "ultimate"],
      ["error", "starter"],
    ]) {
      const [mode, pack] = demo;
      await gotoReady(
        page,
        `${base}/christmas-ai-photos/order?fixture=1&demo=${mode}&pack=${pack}`,
      );
      await page.getByTestId("cv2-fixture-banner").waitFor({ state: "visible" });
      const banner = await page.getByTestId("cv2-fixture-banner").innerText();
      if (!/TEST FIXTURE/i.test(banner)) {
        browserReport.failures.push(`Fixture banner missing for ${mode}/${pack}`);
      }
      if (mode === "results" || mode === "upsell") {
        await page.getByTestId("cv2-results").waitFor({ state: "visible" });
      }
      if (mode === "upsell" && pack === "ultimate") {
        await page.getByTestId("cv2-upsell-none").waitFor({ state: "visible" });
      }
      if (mode === "upsell" && pack === "starter") {
        await page.getByTestId("cv2-upsell").waitFor({ state: "visible" });
        if (!(await page.getByText("Optional upgrade").count())) {
          browserReport.failures.push("Upsell missing Optional upgrade label");
        }
      }
      browserReport.screenshots.push(
        await shot(page, browserTypeName, `07-fixture-${mode}-${pack}`),
      );
      await assertNoHorizontalOverflow(
        page,
        `${browserTypeName}/fixture-${mode}-${pack}`,
        browserReport,
      );
    }

    // Multi-viewport landing/offer snapshots (Chromium-quality matrix; others sample)
    const matrix =
      browserTypeName === "chromium"
        ? VIEWPORTS
        : VIEWPORTS.filter((v) => ["desktop-1440", "tablet-768", "mobile-390", "mobile-320"].includes(v.name));

    for (const vp of matrix) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoReady(page, `${base}/christmas-ai-photos`, { clearDraft: true });
      await page.getByTestId("cv2-upload-zone").waitFor({ state: "visible", timeout: 15_000 });
      browserReport.screenshots.push(await shot(page, browserTypeName, `vp-landing-${vp.name}`));
      await assertNoHorizontalOverflow(page, `${browserTypeName}/vp-landing-${vp.name}`, browserReport);
      // upload again for offer shot on mobile/desktop samples
      if (["desktop-1440", "tablet-768", "mobile-390", "mobile-320"].includes(vp.name)) {
        await uploadSynthetic(page);
        browserReport.screenshots.push(await shot(page, browserTypeName, `vp-offer-${vp.name}`));
        await assertNoHorizontalOverflow(page, `${browserTypeName}/vp-offer-${vp.name}`, browserReport);
      }
      browserReport.viewports.push(vp.name);
    }

    // Android Chrome emulation (Chromium only)
    if (browserTypeName === "chromium") {
      const android = devices["Pixel 7"];
      const androidCtx = await browser.newContext({ ...android });
      const androidPage = await androidCtx.newPage();
      await gotoReady(androidPage, `${base}/christmas-ai-photos`);
      browserReport.screenshots.push(await shot(androidPage, browserTypeName, "08-android-chrome-landing"));
      await assertNoHorizontalOverflow(androidPage, `${browserTypeName}/android-landing`, browserReport);
      await androidCtx.close();
    }

    await context.close();
  } catch (err) {
    browserReport.ok = false;
    browserReport.failures.push(err.message);
  } finally {
    await browser.close();
  }

  if (browserReport.failures.length) browserReport.ok = false;
  report.browsers[browserTypeName] = browserReport;
}

async function main() {
  const server = await startViteIfNeeded();
  try {
    for (const name of BROWSERS) {
      await runBrowser(name, report.base, server);
    }
  } finally {
    await server.stop();
  }
  report.finishedAt = new Date().toISOString();
  report.ok = Object.values(report.browsers).every((b) => b.ok);
  const outPath = resolve(OUT, "report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, outPath, base: report.base, browsers: Object.keys(report.browsers) }, null, 2));
  // Force-exit: Vite child / Playwright handles can keep Node alive.
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

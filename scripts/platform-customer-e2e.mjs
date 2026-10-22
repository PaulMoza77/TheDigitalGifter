/**
 * Platform customer surface browser E2E (local Vite + Playwright).
 * Emulation only — not physical devices. No live auth/email/Stripe.
 *
 * Usage: node scripts/platform-customer-e2e.mjs
 */
import { chromium, firefox, webkit, devices } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const OUT = resolve(process.env.PLATFORM_E2E_OUT || "/opt/cursor/artifacts/platform-customer-e2e");
const BROWSERS = String(process.env.PLATFORM_E2E_BROWSERS || "chromium")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

mkdirSync(resolve(OUT, "screenshots"), { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  base: null,
  browsers: {},
  notes: [
    "Login/password-reset UI only — live email delivery BLOCKED.",
    "Account dashboard requires auth — unauthenticated redirect asserted.",
    "Christmas V2 fixture remains available at /christmas-ai-photos/order?fixture=1.",
  ],
};

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

async function startVite() {
  const port = 5181;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: resolve("."),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      BROWSER: "none",
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY:
        process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-local-anon-key",
    },
  });
  await waitForUrl(base);
  report.base = base;
  return {
    base,
    stop: async () => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    },
  };
}

async function dismissCookies(page) {
  const reject = page.getByRole("button", { name: /^reject$/i });
  if (await reject.isVisible().catch(() => false)) {
    await reject.click().catch(() => {});
  }
}

async function shot(page, name) {
  const path = resolve(OUT, "screenshots", `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function runBrowser(name, base) {
  const map = { chromium, firefox, webkit };
  const launcher = map[name];
  const browserReport = { engine: name, ok: true, failures: [], screenshots: [] };
  let browser;
  try {
    browser = await launcher.launch({ headless: true });
  } catch (err) {
    browserReport.ok = false;
    browserReport.failures.push(`Launch failed: ${err.message}`);
    report.browsers[name] = browserReport;
    return;
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: devices["iPhone 13"].userAgent,
      ...(name === "firefox" ? {} : { isMobile: true, hasTouch: true }),
    });
    const page = await context.newPage();

    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector('[data-testid="christmas-auth-screen"]', { timeout: 60_000 });
    await dismissCookies(page);
    if (!(await page.getByTestId("auth-forgot-password").count())) {
      browserReport.failures.push("Forgot password control missing");
    }
    browserReport.screenshots.push(await shot(page, `${name}-login`));

    await page.goto(`${base}/pricing`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector('[data-testid="pricing-page"]', { timeout: 60_000 });
    await dismissCookies(page);
    browserReport.screenshots.push(await shot(page, `${name}-pricing`));

    await page.goto(`${base}/account`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500);
    // Unauthenticated account access should not expose another user's data.
    const body = await page.locator("body").innerText();
    if (/credits_ledger|service_role|SUPABASE_SERVICE/i.test(body)) {
      browserReport.failures.push("Account page leaked privileged strings while logged out");
    }
    browserReport.screenshots.push(await shot(page, `${name}-account-unauth`));

    await page.goto(`${base}/christmas-ai-photos/order?fixture=1&demo=results&pack=starter`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.getByTestId("cv2-fixture-banner").waitFor({ state: "visible", timeout: 60_000 });
    browserReport.screenshots.push(await shot(page, `${name}-cv2-fixture-results`));

    // Desktop sample
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="christmas-auth-screen"]');
    browserReport.screenshots.push(await shot(page, `${name}-login-desktop-1280`));

    await context.close();
  } catch (err) {
    browserReport.ok = false;
    browserReport.failures.push(err.message);
  } finally {
    await browser.close();
  }

  if (browserReport.failures.length) browserReport.ok = false;
  report.browsers[name] = browserReport;
}

async function main() {
  const server = await startVite();
  try {
    for (const name of BROWSERS) {
      await runBrowser(name, server.base);
    }
  } finally {
    await server.stop();
  }
  report.finishedAt = new Date().toISOString();
  report.ok = Object.values(report.browsers).every((b) => b.ok);
  const outPath = resolve(OUT, "report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, outPath, browsers: Object.keys(report.browsers) }, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

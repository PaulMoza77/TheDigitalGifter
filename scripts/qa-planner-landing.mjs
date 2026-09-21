#!/usr/bin/env node
/**
 * Local interaction QA for /christmas/planner (no real payments).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const BASE = process.env.PLANNER_QA_URL || "http://127.0.0.1:5173/christmas/planner";
const OUT = process.env.PLANNER_QA_OUT || "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function dismissCookies(page) {
  const btn = page.getByRole("button", { name: /accept|reject/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(200);
  }
}

async function runViewport(name, size) {
  const page = await browser.newPage({ viewport: size });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await dismissCookies(page);

  const heroSummary = page.locator(".tdg-pl__summary");
  const heroGifts = page.locator(".tdg-pl__hero-product .tdg-pl__list li");
  check(`${name}: hero has summary`, await heroSummary.count() === 1);
  check(`${name}: hero has no gift list`, (await heroGifts.count()) === 0);

  await page.screenshot({ path: join(OUT, `planner-${name}-hero.png`), fullPage: false });

  await page.getByRole("button", { name: "See the planner" }).click();
  await page.waitForTimeout(600);
  const demoTop = await page.locator("#demo").evaluate((el) => el.getBoundingClientRect().top);
  check(`${name}: See the planner scrolls to demo`, demoTop < size.height * 0.55 && demoTop > -40, `demoTop=${Math.round(demoTop)}`);

  const demo = page.locator('[data-testid="planner-demo"]');
  await demo.scrollIntoViewIfNeeded();
  await demo.getByRole("tab", { name: "Meals & shopping" }).click();
  await page.waitForTimeout(150);
  check(
    `${name}: meals tab shows recipe`,
    await demo.getByText("Herb-butter roast turkey").isVisible(),
  );

  const butterBefore = await demo.getByText(/150\s*g/).count();
  check(`${name}: base butter 150g`, butterBefore >= 1);

  await demo.getByRole("button", { name: "More portions" }).click();
  await demo.getByRole("button", { name: "More portions" }).click();
  await demo.getByRole("button", { name: "More portions" }).click();
  await demo.getByRole("button", { name: "More portions" }).click();
  await page.waitForTimeout(100);
  const portions = await demo.locator('input[aria-label="Number of portions"]').inputValue();
  check(`${name}: portions increased to 12`, portions === "12", `got ${portions}`);
  const butterAfter = await demo.getByText(/225\s*g/).count();
  check(`${name}: butter scaled to 225g`, butterAfter >= 1);

  await demo.getByRole("button", { name: "Add to shopping list" }).click();
  check(
    `${name}: grocery demo status`,
    await demo.getByRole("status").filter({ hasText: /Demo list updated/i }).isVisible(),
  );

  await page.screenshot({ path: join(OUT, `planner-${name}-meals.png`), fullPage: false });

  await page.locator("#offer").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, `planner-${name}-offer.png`), fullPage: false });

  const paySurface = page.locator('[data-testid="planner-pay-surface"]');
  const cta = page.getByTestId("planner-buy-cta-offer");
  // Hide sticky CTA so it does not intercept the offer button on short viewports.
  await page.locator(".tdg-pl__sticky").evaluateAll((nodes) => {
    for (const node of nodes) node.style.display = "none";
  }).catch(() => undefined);
  if (await cta.isVisible().catch(() => false)) {
    await cta.scrollIntoViewIfNeeded();
    await cta.click({ force: true });
    const disabledLoc = page.getByTestId("planner-checkout-disabled");
    const alert = page.locator(".tdg-pl__error").first();
    try {
      await Promise.race([
        paySurface.waitFor({ state: "visible", timeout: 20000 }),
        disabledLoc.waitFor({ state: "visible", timeout: 20000 }),
        alert.waitFor({ state: "visible", timeout: 20000 }),
      ]);
    } catch {
      /* fall through to checks */
    }
    await page.waitForTimeout(2500);
    const isDisabled = await disabledLoc.isVisible().catch(() => false);
    const surface = await paySurface.isVisible().catch(() => false);
    const alertText = (await alert.textContent().catch(() => "")) || "";
    check(
      `${name}: checkout open or honest disabled state`,
      isDisabled || surface || /opening soon|Could not start/i.test(alertText),
      surface ? "pay surface" : isDisabled ? "disabled" : alertText || "no state",
    );
    if (surface) {
      await page.waitForTimeout(2000);
      const orPayVisible = await paySurface.getByText("Or pay with card").isVisible().catch(() => false);
      const expressVisible = await paySurface.locator(".StripeElement").first().isVisible().catch(() => false);
      if (!expressVisible) {
        check(`${name}: no empty wallet chrome`, !orPayVisible, orPayVisible ? "divider without wallets" : "hidden");
      } else {
        check(`${name}: wallet or card-only layout ok`, true, orPayVisible ? "wallets+divider" : "wallets only");
      }
      await page.screenshot({ path: join(OUT, `planner-${name}-checkout.png`), fullPage: false });
    }
  } else {
    check(`${name}: offer CTA present`, false, "missing buy CTA");
  }

  // Keyboard FAQ
  const faqSummary = page.locator(".tdg-pl__faq summary").nth(2);
  await faqSummary.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  const open = await faqSummary.evaluate((el) => el.parentElement?.open === true);
  check(`${name}: FAQ keyboard open`, open);

  await page.close();
}

try {
  await runViewport("desktop", { width: 1440, height: 900 });
  await runViewport("mobile", { width: 390, height: 844 });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);

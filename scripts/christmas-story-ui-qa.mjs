/** Local-only browser QA. Start Vite on 4173, then run this script. */
import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.UI_QA_BASE_URL || "http://127.0.0.1:4173";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "QA only creates test orders on localhost");
const output = path.resolve(process.env.UI_QA_OUTPUT || "artifacts/christmas-story-ui/after");
const browserType = process.env.UI_QA_BROWSER === "webkit" ? webkit : chromium;
const launchOptions = process.env.UI_QA_BROWSER === "chrome" ? { channel: "chrome" } : {};
const browser = await browserType.launch(launchOptions);
await mkdir(output, { recursive: true });
const results = [];
let failure;
try {
  for (const width of [375, 390, 430, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1024 }, reducedMotion: "reduce", hasTouch: width < 800 });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__storyLayoutShift = 0;
      try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__storyLayoutShift += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch { /* Not supported in every browser. */ }
    });
    async function capture(label) {
      await page.evaluate(() => document.fonts.ready);
      const measurements = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        layoutShift: window.__storyLayoutShift,
        brokenImages: [...document.images].filter(img => img.complete && !img.naturalWidth).map(img => img.alt),
        playingMedia: [...document.querySelectorAll("audio,video")].filter(media => !media.paused).length,
      }));
      assert.ok(measurements.scrollWidth <= width + 1, `${label}: horizontal overflow at ${width}px`);
      assert.equal(measurements.brokenImages.length, 0, `${label}: broken images`);
      assert.equal(measurements.playingMedia, 0, `${label}: media played without consent`);
      await page.screenshot({ path: path.join(output, `${width}-${label}.png`), fullPage: true });
      results.push({ browser: browserType.name(), width, label, ...measurements });
    }
    for (const [route, label] of [["/christmas-story", "landing"], ["/christmas-story?v=song", "landing-song"]]) {
      await page.goto(base + route);
      await page.getByRole("heading", { level: 1 }).waitFor();
      const primary = page.getByRole("link", { name: "Create Their Gift" }).first();
      const bounds = await primary.boundingBox();
      assert.ok(bounds && bounds.y + bounds.height <= page.viewportSize().height, "Hero CTA must fit in first viewport");
      assert.equal(await page.getByText("Watch a Real Example").count(), 0);
      if (route.includes("v=song")) assert.match(await primary.getAttribute("href"), /v=song/);
      await capture(label);
      // Real visitor cookie choice; do not bypass consent with a forced click.
      const rejectCookies = page.getByRole("button", { name: "Reject", exact: true });
      if (await rejectCookies.isVisible()) await rejectCookies.click();
    }
    await page.goto(base + "/christmas-story/demo");
    await page.getByRole("button", { name: "Open your gift" }).waitFor();
    await capture("demo-welcome");
    await page.getByRole("button", { name: "Open your gift" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.tagName === "H1");
    assert.equal(await page.locator("audio").count(), 0, "Demo must not synthesize or fake audio");
    await page.getByRole("button", { name: "Next memory" }).click();
    await page.getByText("2 / 4", { exact: true }).waitFor();
    await page.locator(".cs-surprise summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".cs-surprise").getAttribute("open"), "");
    await capture("demo-opened");
    await page.goto(base + "/christmas-story/create?v=song");
    await page.getByRole("button", { name: "Partner", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Partner", exact: true }).getAttribute("aria-pressed"), "true");
    await page.getByLabel(/What is their first name/).fill("Alexandria-Catherine");
    await page.getByLabel(/What makes them special/).fill("You always make the ordinary moments feel like home.");
    await page.getByText("For Alexandria-Catherine", { exact: true }).waitFor();
    await page.reload();
    assert.equal(await page.getByLabel(/What is their first name/).inputValue(), "Alexandria-Catherine");
    await capture("creator-story");
    await page.getByRole("button", { name: "See their preview" }).click();
    await page.locator(".cs-customize summary").click();
    await page.getByLabel("A special memory (optional)").fill("Our winter walks beside the river.");
    await capture("creator-customize");
    await page.getByRole("button", { name: "Review the gift", exact: true }).click();
    await page.getByRole("button", { name: "Continue (test order)", exact: true }).waitFor();
    await capture("creator-review");
    await page.getByRole("button", { name: "Continue (test order)", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Please confirm" }).waitFor();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue (test order)", exact: true }).click();
    await page.waitForURL(/\/christmas-story\/order\//);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("button", { name: "Approve test gift" }).click();
    await page.getByRole("status").filter({ hasText: "Gift approved" }).waitFor();
    await capture("buyer-review");
    const recipientPath = await page.getByRole("link", { name: /Preview their complete gift/ }).getAttribute("href");
    await page.goto(base + recipientPath);
    await page.getByRole("button", { name: "Open your gift" }).waitFor();
    await capture("recipient-welcome");
    await page.getByRole("button", { name: "Open your gift" }).click();
    await page.locator("#gift-memories").waitFor();
    assert.equal(await page.getByText("$57", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: /Create.*Gift/i }).count(), 0);
    await capture("recipient-opened");
    await page.goto(base + "/gift/unavailable-qa-token");
    await page.getByRole("heading", { name: "Gift unavailable" }).waitFor();
    await capture("recipient-unavailable");
    await page.goto(base + "/christmas-story/order/unavailable-qa-order");
    await page.getByRole("heading", { name: "Order not found" }).waitFor();
    await capture("order-unavailable");
    assert.deepEqual(errors, [], "No uncaught page exceptions");
    await context.close();
  }
} catch (error) { failure = error; }
finally {
  await writeFile(path.join(output, "qa-results.json"), JSON.stringify({ status: failure ? "failed" : "passed", error: failure?.message, results }, null, 2));
  await browser.close();
}
if (failure) throw failure;
console.log(`Passed ${results.length} route/state captures. Results: ${output}`);

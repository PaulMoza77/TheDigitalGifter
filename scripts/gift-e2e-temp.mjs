import { chromium } from "playwright";

const url = process.env.URL || "https://www.thedigitalgifter.com/christmas/gifts";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
const reqs = [];
page.on("request", (r) => {
  if (r.url().includes("gift-tree") || r.url().includes("funnel-event") || r.url().includes("christmas-tree")) {
    reqs.push(`${r.method()} ${r.url()}`);
  }
});
page.on("response", async (r) => {
  if (r.url().includes("gift-tree") || r.url().includes("funnel-event")) {
    const body = await r.text().catch(() => "");
    reqs.push(`RESP ${r.status()} ${r.url()} ${body.slice(0, 200)}`);
  }
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const buttons = await page.locator('button[aria-label*="Open Christmas present"]').all();
console.log("present buttons:", buttons.length);
for (const b of buttons.slice(0, 3)) {
  const box = await b.boundingBox();
  console.log("button box", box, "disabled", await b.isDisabled());
}
if (buttons.length) {
  await buttons[0].click({ force: true });
  await page.waitForTimeout(2500);
}
const dialog = await page.locator('[role="dialog"]').count();
console.log("dialogs:", dialog);
console.log("logs:\n", logs.join("\n"));
console.log("reqs:\n", reqs.join("\n"));
await page.screenshot({ path: "/tmp/gift-e2e-desktop.png", fullPage: false });
await browser.close();

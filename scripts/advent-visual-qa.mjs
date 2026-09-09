import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("saved", name);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: `${OUT}/pw-video`, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();

await page.goto("http://127.0.0.1:5173/christmas/advent", { waitUntil: "networkidle" });
await page.waitForSelector(".advent-board");
await shot(page, "advent_desktop_preseason");

await page.goto("http://127.0.0.1:5173/christmas/advent?sim=2026-12-07", { waitUntil: "networkidle" });
await page.waitForSelector('.advent-page[data-advent-sim="2026-12-07"]');
await page.waitForSelector(".advent-door.is-today", { state: "attached" });
const simAttr = await page.getAttribute(".advent-page", "data-advent-day");
console.log("sim day attr", simAttr);
await page.locator(".advent-board").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await shot(page, "advent_desktop_dec7");

// Door open interaction via DOM click (3D door panels confuse Playwright hit testing)
await page.evaluate(() => {
  const btn = document.querySelector(".advent-door.is-today");
  if (!(btn instanceof HTMLButtonElement)) throw new Error("today door missing");
  btn.scrollIntoView({ block: "center" });
  btn.click();
});
await page.waitForSelector(".advent-reveal", { timeout: 8000 });
await page.waitForTimeout(1200);
await shot(page, "advent_desktop_door_opened");
await page.locator(".advent-reveal .advent-btn--soft").click();
await page.waitForTimeout(500);

await page.goto("http://127.0.0.1:5173/christmas/advent?sim=2026-12-01", { waitUntil: "networkidle" });
await page.waitForSelector('.advent-page[data-advent-sim="2026-12-01"]');
await shot(page, "advent_desktop_dec1");

await page.goto("http://127.0.0.1:5173/christmas/advent?sim=2026-12-24", { waitUntil: "networkidle" });
await page.waitForSelector('.advent-page[data-advent-sim="2026-12-24"]');
await shot(page, "advent_desktop_dec24");

await page.goto("http://127.0.0.1:5173/christmas/advent?sim=2026-12-26", { waitUntil: "networkidle" });
await page.waitForSelector('.advent-page[data-advent-day="after"]');
await shot(page, "advent_desktop_after");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:5173/christmas/advent?sim=2026-12-07", { waitUntil: "networkidle" });
await page.waitForSelector('.advent-page[data-advent-sim="2026-12-07"]');
await shot(page, "advent_mobile_dec7");

const video = page.video();
await context.close();
await browser.close();
if (video) {
  const vpath = await video.path();
  console.log("video_raw", vpath);
}
console.log("done");

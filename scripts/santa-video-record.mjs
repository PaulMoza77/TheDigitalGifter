import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SANTA_BASE || "http://127.0.0.1:5174";
const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: `${OUT}/pw-video`, size: { width: 1280, height: 800 } },
});

const page = await context.newPage();
await page.goto(`${BASE}/christmas`);
await page.evaluate(() => {
  sessionStorage.clear();
  localStorage.clear();
});
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("heading", { name: /Who should Santa talk to/i }).scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await page.getByPlaceholder("Emma").fill("Emma");
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Create their Santa message/i }).click();
await page.waitForURL(/\/christmas\/santa-video/);
await page.getByRole("heading", { name: /make Emma/i }).waitFor();
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Continue Emma/i }).click();
await page.getByRole("heading", { name: /How old is Emma/i }).waitFor();
await page.locator('input[type="number"]').fill("7");
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Continue$/i }).click();
await page.locator("textarea").fill("you learned something new");
await page.getByRole("button", { name: /^Continue$/i }).click();
await page.getByPlaceholder(/pink bicycle/i).fill("a pink bicycle");
await page.getByRole("button", { name: /^Continue$/i }).click();
await page.getByPlaceholder(/Milo/i).fill("Her dog is called Milo");
await page.getByRole("button", { name: /^Continue$/i }).click();
await page.getByRole("button", { name: /See message preview/i }).click();
await page.getByRole("heading", { name: /Emma’s Santa Message|Emma's Santa Message/i }).waitFor();
await page.waitForTimeout(2000);

await context.close();
await browser.close();

const { renameSync, readdirSync } = await import("node:fs");
const files = readdirSync(`${OUT}/pw-video`).filter((f) => f.endsWith(".webm"));
if (!files.length) throw new Error("No video produced");
renameSync(`${OUT}/pw-video/${files[0]}`, `${OUT}/santa_homepage_handoff_funnel_demo.webm`);
console.log("Wrote", `${OUT}/santa_homepage_handoff_funnel_demo.webm`);

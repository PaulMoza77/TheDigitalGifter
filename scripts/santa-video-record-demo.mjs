import { chromium } from "playwright";
import { mkdirSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.SANTA_BASE || "http://127.0.0.1:5173";
const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });
const TMP = join(OUT, "video-tmp");
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: TMP, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
await page.goto(`${BASE}/christmas`);
await page.evaluate(() => {
  sessionStorage.clear();
  localStorage.clear();
});
await page.goto(`${BASE}/christmas/santa-video?name=John`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: /How old is John/i }).waitFor();
await page.waitForTimeout(1200);
await page.locator('input[type="number"]').fill("7");
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Continue/i }).first().click();
await page.getByRole("heading", { name: /proud of John/i }).waitFor();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Did well at school/i }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Continue/i }).first().click();
await page.getByRole("heading", { name: /What does John love/i }).waitFor();
await page.getByRole("button", { name: /^LEGO$/i }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Continue/i }).first().click();
await page.getByPlaceholder(/red bicycle/i).fill("a red bicycle");
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Continue/i }).first().click();
await page.getByRole("button", { name: /Mom & Dad/i }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /See message preview/i }).click();
await page.getByRole("heading", { name: /Santa’s message for John|Santa's message for John/i }).waitFor();
await page.waitForTimeout(2200);
await context.close();
await browser.close();

const files = readdirSync(TMP).filter((f) => f.endsWith(".webm"));
if (!files.length) throw new Error("No video produced");
renameSync(join(TMP, files[0]), join(OUT, "santa_john_funnel_walkthrough.webm"));
console.log("saved", join(OUT, "santa_john_funnel_walkthrough.webm"));

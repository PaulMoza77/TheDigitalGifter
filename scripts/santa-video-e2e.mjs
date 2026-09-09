import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SANTA_BASE || "http://127.0.0.1:5174";
const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

async function clearStorage(page) {
  await page.goto(`${BASE}/christmas`);
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/usr/local/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // Desktop direct
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await clearStorage(page);
    await page.goto(`${BASE}/christmas/santa-video`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1");
    await page.screenshot({ path: `${OUT}/santa_direct_hero_desktop.png`, fullPage: false });
    console.log("hero desktop ok", await page.locator("h1").innerText());

    await page.getByRole("button", { name: /Create Their Santa Video/i }).click();
    await page.getByRole("button", { name: /My child/i }).click();
    await page.getByPlaceholder("Emma").fill("Emma");
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.getByRole("heading", { name: /How old is Emma/i }).waitFor();
    await page.locator('input[type="number"]').fill("7");
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.locator("textarea").fill("learned how to ride her bike");
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.getByPlaceholder(/pink bicycle/i).fill("a pink bicycle");
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.getByPlaceholder(/Milo/i).fill("Her dog is called Milo");
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.getByRole("button", { name: /See message preview/i }).click();
    await page.getByRole("heading", { name: /Emma’s Santa Message|Emma's Santa Message/i }).waitFor();
    const preview = await page.locator("section blockquote").first().innerText();
    console.log("preview snippet:", preview.slice(0, 160));
    if (!/Emma/i.test(preview) || !/pink bicycle/i.test(preview) || !/Milo/i.test(preview)) {
      throw new Error("Preview missing personalization: " + preview);
    }
    await page.screenshot({ path: `${OUT}/santa_preview_desktop.png`, fullPage: false });

    await page.getByRole("button", { name: /This is perfect/i }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Create Emma/i }).click();
    await page.getByRole("heading", { name: /Your Personalized Santa Video/i }).waitFor();
    await page.screenshot({ path: `${OUT}/santa_offer_desktop.png`, fullPage: false });
    await page.close();
  }

  // Homepage handoff
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await clearStorage(page);
    await page.goto(`${BASE}/christmas`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Who should Santa talk to/i }).waitFor();
    await page.getByPlaceholder("Emma").fill("Emma");
    await page.getByRole("button", { name: /Create their Santa message/i }).click();
    await page.waitForURL(/\/christmas\/santa-video/);
    await page.getByRole("heading", { name: /Let’s make Emma’s Christmas magical|Let's make Emma's Christmas magical/i }).waitFor();
    // Must not show name question on landing
    const body = await page.locator("body").innerText();
    if (/What’s their name|What's their name/i.test(body) && !/Continue Emma/i.test(body)) {
      throw new Error("Handoff still asking for name");
    }
    await page.screenshot({ path: `${OUT}/santa_handoff_hero_desktop.png`, fullPage: false });
    await page.getByRole("button", { name: /Continue Emma/i }).click();
    await page.getByRole("heading", { name: /How old is Emma/i }).waitFor();
    await page.screenshot({ path: `${OUT}/santa_handoff_age_desktop.png`, fullPage: false });
    await page.close();
  }

  // Mobile
  {
    const page = await browser.newPage({
      ...devices["iPhone 12"],
      viewport: { width: 390, height: 844 },
    });
    await clearStorage(page);
    await page.goto(`${BASE}/christmas/santa-video`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1");
    await page.screenshot({ path: `${OUT}/santa_direct_hero_mobile.png`, fullPage: false });
    await page.goto(`${BASE}/christmas/santa-video?name=Emma`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Let’s make Emma’s Christmas magical|Let's make Emma's Christmas magical/i }).waitFor();
    await page.screenshot({ path: `${OUT}/santa_handoff_hero_mobile.png`, fullPage: false });
    await page.close();
  }

  await browser.close();
  console.log("ALL SANTA E2E CHECKS PASSED");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

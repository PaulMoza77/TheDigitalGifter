import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SANTA_BASE || "http://127.0.0.1:5173";
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
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // Desktop: name=John handoff → age → full funnel → preview
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await clearStorage(page);
    await page.goto(`${BASE}/christmas/santa-video?name=John`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /How old is John/i }).waitFor({ timeout: 15000 });
    const body = await page.locator("body").innerText();
    if (/Who is Santa making this for|Your child’s name|Your child's name/i.test(body) && /Start the Magic/i.test(body)) {
      throw new Error("Handoff still asking for name");
    }
    if (!/Santa already knows/i.test(body) || !/John/i.test(body)) {
      throw new Error("Missing John personalization headline");
    }
    if (!/STEP 1 OF 5/i.test(body)) {
      throw new Error("Missing step progress");
    }
    await page.screenshot({ path: `${OUT}/santa_john_age_desktop.png`, fullPage: false });
    console.log("desktop age ok");

    await page.locator('input[type="number"]').fill("7");
    await page.getByRole("button", { name: /Continue/i }).first().click();
    await page.getByRole("heading", { name: /proud of John/i }).waitFor();
    await page.getByRole("button", { name: /Did well at school/i }).click();
    await page.getByRole("button", { name: /Continue/i }).first().click();

    await page.getByRole("heading", { name: /What does John love/i }).waitFor();
    await page.getByRole("button", { name: /^LEGO$/i }).click();
    await page.getByRole("button", { name: /Continue/i }).first().click();

    await page.getByRole("heading", { name: /hoping for this Christmas/i }).waitFor();
    await page.getByPlaceholder(/red bicycle/i).fill("a red bicycle");
    await page.getByRole("button", { name: /Continue/i }).first().click();

    await page.getByRole("heading", { name: /Who is this magical message from/i }).waitFor();
    await page.getByRole("button", { name: /Mom & Dad/i }).click();
    await page.getByRole("button", { name: /See message preview/i }).click();

    await page.getByRole("heading", { name: /Santa’s message for John|Santa's message for John/i }).waitFor();
    const preview = await page.locator(".sv-preview").innerText();
    console.log("preview:", preview.slice(0, 200));
    if (!/John/i.test(preview) || !/bicycle/i.test(preview) || !/LEGO/i.test(preview)) {
      throw new Error("Preview missing personalization: " + preview);
    }
    await page.screenshot({ path: `${OUT}/santa_john_preview_desktop.png`, fullPage: false });
    console.log("desktop preview ok");

    await page.getByRole("button", { name: /This looks magical/i }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Create John’s Santa Video|Create John's Santa Video/i }).click();
    await page.getByRole("heading", { name: /Your Personalized Santa Video/i }).waitFor();
    await page.screenshot({ path: `${OUT}/santa_john_offer_desktop.png`, fullPage: false });
    await page.close();
  }

  // Mobile handoff
  {
    const iPhone = devices["iPhone 13"];
    const page = await browser.newPage({ ...iPhone });
    await clearStorage(page);
    await page.goto(`${BASE}/christmas/santa-video?name=John`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /How old is John/i }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/santa_john_age_mobile.png`, fullPage: false });
    console.log("mobile age ok");
    await page.close();
  }

  // Direct visitor without name
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await clearStorage(page);
    await page.goto(`${BASE}/christmas/santa-video`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Who is Santa making this for/i }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/santa_direct_name_desktop.png`, fullPage: false });
    await page.getByPlaceholder(/child’s name|child's name/i).fill("Emma");
    await page.getByRole("button", { name: /Start the Magic/i }).click();
    await page.getByRole("heading", { name: /How old is Emma/i }).waitFor();
    await page.screenshot({ path: `${OUT}/santa_direct_age_desktop.png`, fullPage: false });
    console.log("direct visitor ok");
    await page.close();
  }

  await browser.close();
  console.log("ALL SANTA E2E PASSED");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

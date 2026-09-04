/**
 * Synthetic Christmas Cards/Messages QA (Playwright).
 * Proves PNG dimensions + EN/RO message generation + Message→Card handoff.
 * Usage: node scripts/christmas-cards-messages-qa.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:4173";
const OUT = resolve("tmp/christmas-cards-messages-qa");
mkdirSync(OUT, { recursive: true });

function pngSize(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not_png");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, bytes: buf.length };
}

const report = {
  base: BASE,
  at: new Date().toISOString(),
  messages_en: null,
  messages_ro: null,
  handoff: null,
  cards: {},
  errors: [],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  // EN messages
  await page.goto(`${BASE}/christmas/messages`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Partner" }).click();
  await page.getByRole("button", { name: "Romantic" }).click();
  await page.getByRole("button", { name: "Medium" }).click();
  await page.getByRole("button", { name: "Generate messages" }).click();
  await page.waitForSelector('section[aria-label="Generated messages"] li', { timeout: 45000 });
  const enTexts = await page.locator('section[aria-label="Generated messages"] li p').allTextContents();
  report.messages_en = {
    count: enTexts.length,
    samples: enTexts.slice(0, 3),
    fallback_banner: await page.locator("text=curated Christmas wording").count(),
  };
  if (enTexts.length < 3) throw new Error("en_lt_3");

  await page.getByRole("button", { name: "Use in Christmas Card" }).first().click();
  await page.waitForURL(/\/christmas\/cards/, { timeout: 15000 });
  const cardMsg = await page.locator("#card-message").inputValue();
  report.handoff = { message_len: cardMsg.length, matches_first: cardMsg === enTexts[0] };
  if (!cardMsg || cardMsg.length < 10) throw new Error("handoff_empty");

  // RO messages
  await page.goto(`${BASE}/christmas/messages`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "Română" }).click();
  await page.getByRole("button", { name: "Mamă" }).click();
  await page.getByRole("button", { name: "Din suflet" }).click();
  await page.getByRole("button", { name: "Mediu" }).click();
  await page.getByRole("button", { name: "Generează mesaje" }).click();
  await page.waitForSelector('section[aria-label="Generated messages"] li', { timeout: 45000 });
  const roTexts = await page.locator('section[aria-label="Generated messages"] li p').allTextContents();
  const hasDia = roTexts.some((t) => /[ăâîșțĂÂÎȘȚ]/.test(t));
  report.messages_ro = { count: roTexts.length, samples: roTexts.slice(0, 3), diacritics: hasDia };
  if (!hasDia) throw new Error("ro_no_diacritics");

  // Cards PNG layouts
  await page.goto(`${BASE}/christmas/cards`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#card-message").fill(
    "Crăciun fericit! Îți doresc căldură, liniște și zile pline de bunătate alături de cei dragi.",
  );

  for (const layout of ["Square", "Story", "Landscape"]) {
    await page.getByRole("button", { name: new RegExp(`^${layout}`) }).click();
    await page.getByRole("button", { name: /Create card|Creează cardul/ }).click();
    await page.waitForSelector('img[alt*="Christmas card"], img[alt*="Card de Crăciun"]', {
      timeout: 30000,
    });
    const src = await page.locator("img[alt*='Christmas card'], img[alt*='Card de Crăciun']").getAttribute("src");
    if (!src?.startsWith("data:image/png")) throw new Error(`no_png_${layout}`);
    const b64 = src.split(",")[1];
    const buf = Buffer.from(b64, "base64");
    const meta = pngSize(buf);
    const file = resolve(OUT, `card-${layout.toLowerCase()}.png`);
    writeFileSync(file, buf);
    report.cards[layout.toLowerCase()] = { ...meta, file };
    await page.getByRole("button", { name: /Edit card|Editează/ }).click();
  }

  // Long message
  await page.locator("#card-message").fill(
    "Merry Christmas! ".repeat(40) +
      "May your season be full of kindness, rest, and light that lasts beyond December.",
  );
  await page.getByRole("button", { name: /^Square/ }).click();
  await page.getByRole("button", { name: /Create card|Creează cardul/ }).click();
  await page.waitForSelector("img[alt*='Christmas card'], img[alt*='Card de Crăciun']", { timeout: 30000 });
  const longSrc = await page.locator("img[alt*='Christmas card'], img[alt*='Card de Crăciun']").getAttribute("src");
  const longBuf = Buffer.from(longSrc.split(",")[1], "base64");
  report.cards.long_message = { ...pngSize(longBuf), file: resolve(OUT, "card-long.png") };
  writeFileSync(report.cards.long_message.file, longBuf);

  // Dimension assertions
  if (report.cards.square.width !== 1080 || report.cards.square.height !== 1080) {
    throw new Error("square_dims");
  }
  if (report.cards.story.width !== 1080 || report.cards.story.height !== 1920) {
    throw new Error("story_dims");
  }
  if (report.cards.landscape.width !== 1600 || report.cards.landscape.height !== 900) {
    throw new Error("landscape_dims");
  }
} catch (err) {
  report.errors.push(String(err?.message || err));
  await page.screenshot({ path: resolve(OUT, "error.png"), fullPage: true }).catch(() => undefined);
} finally {
  await browser.close();
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exit(1);
}

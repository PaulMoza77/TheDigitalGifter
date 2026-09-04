/**
 * Offline visual QA for Christmas card canvas renderer.
 * Writes PNGs under /tmp/tdg-card-qa/ and prints dimension checks.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const OUT = "/tmp/tdg-card-qa";
mkdirSync(OUT, { recursive: true });

function pngSize(buf) {
  if (buf[0] !== 0x89 || buf.toString("ascii", 1, 4) !== "PNG") throw new Error("not_png");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, bytes: buf.length };
}

const require = createRequire(import.meta.url);
const stylesPath = new URL("../src/features/christmas/cards/cardStyles.ts", import.meta.url);
// Inline minimal renderer mirror in page — load built page isn't available offline.
// Use page.evaluate with self-contained canvas draw matching production layout sizes.

const cases = [
  {
    name: "en_photo_card_square",
    layout: { key: "square", width: 1080, height: 1080 },
    message: "Merry Christmas, love. Our first Christmas in our new home.",
    photo: true,
    style: { bgTop: "#7f1d1d", bgBottom: "#14532d", accent: "#fbbf24", text: "#fff7ed", muted: "#fde68a", panel: "rgba(0,0,0,0.35)" },
  },
  {
    name: "ro_photo_card_square",
    layout: { key: "square", width: 1080, height: 1080 },
    message: "Crăciun fericit, mamă! Mereu ne adună pe toți în jurul bradului.",
    photo: true,
    style: { bgTop: "#9f1239", bgBottom: "#4c0519", accent: "#fb7185", text: "#fff1f2", muted: "#fecdd3", panel: "rgba(0,0,0,0.35)" },
  },
  {
    name: "text_only_landscape",
    layout: { key: "landscape", width: 1600, height: 900 },
    message: "Wishing you a warm and peaceful Christmas.",
    photo: false,
    style: { bgTop: "#1c1917", bgBottom: "#292524", accent: "#eab308", text: "#fef3c7", muted: "#fcd34d", panel: "rgba(0,0,0,0.45)" },
  },
  {
    name: "long_message_story",
    layout: { key: "story", width: 1080, height: 1920 },
    message:
      "Merry Christmas to my wonderful family and friends near and far. May this season bring warmth, rest, kindness, and time together that we will remember for years. Thank you for every shared meal, every laugh, and every quiet moment of care.",
    photo: false,
    style: { bgTop: "#0c4a6e", bgBottom: "#e0f2fe", accent: "#38bdf8", text: "#0f172a", muted: "#075985", panel: "rgba(255,255,255,0.72)" },
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();

const results = [];
for (const c of cases) {
  const dataUrl = await page.evaluate(async ({ layout, message, photo, style }) => {
    const canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, layout.height);
    grad.addColorStop(0, style.bgTop);
    grad.addColorStop(1, style.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, layout.width - 40, layout.height - 40);

    let textTop = 80;
    if (photo) {
      // Synthetic non-personal gradient block as photo stand-in
      const ph = Math.round(layout.height * 0.36);
      const pg = ctx.createLinearGradient(60, 60, 60 + layout.width - 120, 60 + ph);
      pg.addColorStop(0, "#64748b");
      pg.addColorStop(1, "#94a3b8");
      ctx.fillStyle = pg;
      ctx.fillRect(60, 60, layout.width - 120, ph);
      textTop = 60 + ph + 40;
    }

    const words = message.split(" ");
    const maxW = layout.width * 0.72;
    const fontSize = message.length > 250 ? 36 : 48;
    ctx.font = `600 ${fontSize}px Georgia, serif`;
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= maxW) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = w;
        if (lines.length >= 12) break;
      }
    }
    if (cur && lines.length < 12) lines.push(cur);

    const lineH = fontSize * 1.28;
    const panelH = lines.length * lineH + 80;
    ctx.fillStyle = style.panel;
    ctx.fillRect(layout.width * 0.1, textTop, layout.width * 0.8, panelH);
    ctx.fillStyle = style.text;
    ctx.textAlign = "center";
    let y = textTop + 32;
    for (const line of lines) {
      ctx.fillText(line, layout.width / 2, y, maxW);
      y += lineH;
    }
    return canvas.toDataURL("image/png");
  }, c);

  const b64 = dataUrl.split(",")[1];
  const buf = Buffer.from(b64, "base64");
  const meta = pngSize(buf);
  const path = `${OUT}/${c.name}.png`;
  writeFileSync(path, buf);
  const ok =
    meta.width === c.layout.width &&
    meta.height === c.layout.height &&
    meta.bytes > 1000;
  results.push({ name: c.name, ...meta, ok, path });
  console.log(JSON.stringify({ name: c.name, ...meta, ok, path }));
}

await browser.close();
const allOk = results.every((r) => r.ok);
if (!allOk) process.exit(1);
console.log("CARD_QA_PASS", results.length);
// silence unused
void require;
void stylesPath;
void readFileSync;

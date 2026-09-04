/**
 * Synthetic Christmas card visual QA (Playwright Chromium).
 * Writes PNGs under /tmp/tdg-card-qa and prints dimension checks.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const OUT = "/tmp/tdg-card-qa";
mkdirSync(OUT, { recursive: true });

const STYLES = {
  classic_christmas: {
    bgTop: "#7f1d1d",
    bgBottom: "#14532d",
    accent: "#fbbf24",
    text: "#fff7ed",
    muted: "#fde68a",
    panel: "rgba(0,0,0,0.35)",
  },
  romantic_christmas: {
    bgTop: "#9f1239",
    bgBottom: "#4c0519",
    accent: "#fb7185",
    text: "#fff1f2",
    muted: "#fecdd3",
    panel: "rgba(0,0,0,0.35)",
  },
};

const LAYOUTS = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  landscape: { w: 1600, h: 900 },
};

function pngSize(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not_png");
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h, bytes: buf.length };
}

const cases = [
  {
    id: "en_photo_card",
    layout: "square",
    style: "classic_christmas",
    message: "Merry Christmas, my love. Our first Christmas in our new home feels magical.",
    photo: true,
    diacritics: false,
  },
  {
    id: "ro_photo_card",
    layout: "square",
    style: "romantic_christmas",
    message:
      "Crăciun fericit, Mamă! Îți mulțumesc că mereu ne adună pe toți în jurul bradului.",
    photo: true,
    diacritics: true,
  },
  {
    id: "text_only",
    layout: "square",
    style: "classic_christmas",
    message: "Wishing you warmth, rest, and kindness this Christmas season.",
    photo: false,
    diacritics: false,
  },
  {
    id: "long_message",
    layout: "square",
    style: "classic_christmas",
    message:
      "Merry Christmas! As the year winds down I keep thinking about how grateful I am for you and for every quiet kindness you shared. May your holidays be filled with rest, laughter, soft lights, and the people who make ordinary days feel like home — today and all season long.",
    photo: false,
    diacritics: false,
  },
  {
    id: "story",
    layout: "story",
    style: "classic_christmas",
    message: "Merry Christmas! Sending love from our home to yours.",
    photo: false,
    diacritics: false,
  },
  {
    id: "landscape",
    layout: "landscape",
    style: "classic_christmas",
    message: "Season's greetings — wishing you a peaceful holiday.",
    photo: false,
    diacritics: false,
  },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = [];
for (const c of cases) {
  const layout = LAYOUTS[c.layout];
  const style = STYLES[c.style];
  const dataUrl = await page.evaluate(
    async ({ layout, style, message, withPhoto }) => {
      const canvas = document.createElement("canvas");
      canvas.width = layout.w;
      canvas.height = layout.h;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 0, layout.h);
      grad.addColorStop(0, style.bgTop);
      grad.addColorStop(1, style.bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, layout.w, layout.h);
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 12;
      ctx.strokeRect(20, 20, layout.w - 40, layout.h - 40);

      let textTop = 80;
      if (withPhoto) {
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(60, 60, layout.w - 120, Math.round(layout.h * 0.34));
        ctx.fillStyle = style.accent;
        ctx.font = "28px sans-serif";
        ctx.fillText("PHOTO", layout.w / 2 - 40, 60 + Math.round(layout.h * 0.17));
        textTop = 60 + Math.round(layout.h * 0.34) + 40;
      }

      const maxW = layout.w - 160;
      let fontSize = layout.w >= 1500 ? 40 : 46;
      if (message.length > 250) fontSize = Math.round(fontSize * 0.75);
      ctx.font = `600 ${fontSize}px Georgia, serif`;
      ctx.fillStyle = style.panel;
      const panelH = Math.min(layout.h - textTop - 80, Math.max(220, message.length > 200 ? 360 : 260));
      ctx.fillRect(60, textTop, layout.w - 120, panelH);
      ctx.fillStyle = style.text;
      ctx.textAlign = "center";
      const words = message.split(" ");
      const lines = [];
      let cur = "";
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(next).width <= maxW) cur = next;
        else {
          if (cur) lines.push(cur);
          cur = w;
          if (lines.length >= 10) break;
        }
      }
      if (cur && lines.length < 10) lines.push(cur);
      let y = textTop + 40;
      for (const line of lines) {
        ctx.fillText(line, layout.w / 2, y, maxW);
        y += fontSize * 1.28;
      }
      return canvas.toDataURL("image/png");
    },
    { layout, style, message: c.message, withPhoto: c.photo },
  );

  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  const path = resolve(OUT, `${c.id}.png`);
  writeFileSync(path, buf);
  const meta = pngSize(buf);
  const dimOk = meta.w === layout.w && meta.h === layout.h && meta.bytes > 5000;
  results.push({
    id: c.id,
    path,
    ...meta,
    expected: layout,
    dimOk,
    diacritics_in_message: c.diacritics,
    readable_assumption: "PASS_synthetic_canvas",
  });
}

await browser.close();
writeFileSync(resolve(OUT, "report.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ out: OUT, results }, null, 2));
if (!results.every((r) => r.dimOk)) process.exit(1);

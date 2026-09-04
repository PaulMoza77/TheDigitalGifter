/**
 * Visual QA: render Christmas card PNGs via Playwright Chromium (same layout sizes as production).
 * Writes fixtures under tmp/christmas-card-qa/ for inspection.
 */
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const OUT = resolve(process.cwd(), "tmp/christmas-card-qa");
mkdirSync(OUT, { recursive: true });

const LAYOUTS = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1600, height: 900 },
};

const STYLE = {
  bgTop: "#7f1d1d",
  bgBottom: "#14532d",
  accent: "#fbbf24",
  text: "#fff7ed",
  muted: "#fde68a",
  panel: "rgba(0,0,0,0.35)",
};

async function renderOne(page, { layoutKey, message, filename, withPhoto }) {
  const layout = LAYOUTS[layoutKey];
  const dataUrl = await page.evaluate(
    async ({ layout, style, message, withPhoto }) => {
      const canvas = document.createElement("canvas");
      canvas.width = layout.width;
      canvas.height = layout.height;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 0, layout.height);
      grad.addColorStop(0, style.bgTop);
      grad.addColorStop(1, style.bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, layout.width, layout.height);

      if (withPhoto) {
        // synthetic non-personal fixture: solid photo block
        ctx.fillStyle = "#334155";
        const ph = Math.round(layout.height * 0.42);
        ctx.fillRect(0, 0, layout.width, ph);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "28px system-ui";
        ctx.fillText("QA photo fixture", 40, 60);
      }

      const pad = Math.round(layout.width * 0.06);
      const panelY = withPhoto ? Math.round(layout.height * 0.4) : Math.round(layout.height * 0.22);
      const panelH = layout.height - panelY - pad * 1.5;
      ctx.fillStyle = style.panel;
      ctx.beginPath();
      ctx.roundRect(pad, panelY, layout.width - pad * 2, panelH, 22);
      ctx.fill();

      const words = String(message).replace(/\s+/g, " ").trim().split(" ");
      let fontSize = layout.width >= 1500 ? 44 : 48;
      if (message.length > 250) fontSize = Math.round(fontSize * 0.75);
      ctx.fillStyle = style.text;
      ctx.font = `600 ${fontSize}px Georgia, serif`;
      ctx.textAlign = "center";
      const maxW = layout.width - pad * 4;
      const lines = [];
      let cur = "";
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(next).width <= maxW) cur = next;
        else {
          if (cur) lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
      let ty = panelY + 40;
      for (const line of lines.slice(0, 12)) {
        ctx.fillText(line, layout.width / 2, ty, maxW);
        ty += fontSize * 1.25;
      }
      ctx.fillStyle = style.accent;
      ctx.font = "500 18px system-ui";
      ctx.fillText("The Digital Gifter", layout.width / 2, layout.height - pad);

      return canvas.toDataURL("image/png");
    },
    { layout, style: STYLE, message, withPhoto },
  );

  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  const path = resolve(OUT, filename);
  writeFileSync(path, buf);
  const st = statSync(path);
  // PNG signature check
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error(`not_png:${filename}`);
  return { path, bytes: st.size, width: layout.width, height: layout.height };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body></body></html>");

const cases = [
  {
    layoutKey: "square",
    message:
      "Merry Christmas, my love. Our first Christmas in our new home already feels like a tradition.",
    filename: "en-photo-square.png",
    withPhoto: true,
  },
  {
    layoutKey: "square",
    message:
      "Crăciun fericit, mamă! Mulțumesc că mereu ne adună pe toți în jurul bradului cu atâta grijă și dragoste.",
    filename: "ro-photo-square.png",
    withPhoto: true,
  },
  {
    layoutKey: "square",
    message: "Warm Christmas wishes — text only, no photo required.",
    filename: "text-only-square.png",
    withPhoto: false,
  },
  {
    layoutKey: "story",
    message:
      "Merry Christmas! As the year winds down I keep thinking about how grateful I am for you. May your holidays be filled with rest, laughter, and the kind of warmth that stays long after the lights come down. Thank you for every quiet kindness this year.",
    filename: "long-message-story.png",
    withPhoto: false,
  },
  {
    layoutKey: "landscape",
    message: "Season's greetings and warm wishes for the holidays.",
    filename: "landscape.png",
    withPhoto: false,
  },
];

const results = [];
for (const c of cases) {
  results.push(await renderOne(page, c));
}
await browser.close();
console.log(JSON.stringify({ ok: true, out: OUT, results }, null, 2));

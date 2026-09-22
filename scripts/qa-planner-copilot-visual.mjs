#!/usr/bin/env node
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = process.env.PLANNER_QA_OUT || "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });
const css = readFileSync(join(ROOT, "src/features/christmas/planner/plannerApp.css"), "utf8");
const photo = "/assets/christmas/christmas_hero_room.webp";

const MIME = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".html": "text/html",
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" />
  <style>${css}
    html, body { margin: 0; background: #f7f1e8; height: 100%; }
  </style>
</head>
<body>
<div class="tdg-planner-app">
  <div class="tdg-planner-frame">
    <aside class="tdg-planner-side">
      <div class="tdg-planner-side-head">
        <a class="tdg-planner-side-home" href="#">🎁</a>
      </div>
      <div class="tdg-planner-side-brand">
        <strong>Christmas Planner</strong>
        <i class="tdg-planner-side-flourish"></i>
        <span>Your calm Christmas starts here.</span>
      </div>
      <nav class="tdg-planner-side-nav">
        <a href="#"><svg width="16" height="16"></svg>Home</a>
        <a href="#"><svg width="16" height="16"></svg>Today</a>
        <a href="#"><svg width="16" height="16"></svg>Plan</a>
        <a class="active" href="#"><svg width="16" height="16"></svg>Gifts</a>
        <a href="#"><svg width="16" height="16"></svg>Meals</a>
        <a href="#"><svg width="16" height="16"></svg>Recipes</a>
        <a href="#"><svg width="16" height="16"></svg>Shopping</a>
        <a href="#"><svg width="16" height="16"></svg>More</a>
      </nav>
      <div class="tdg-planner-side-foot">
        <button type="button" class="tdg-planner-side-copilot"><span class="tdg-planner-side-text">AI Copilot</span></button>
        <a href="#"><span class="tdg-planner-side-text">Account</span></a>
      </div>
    </aside>
    <main class="tdg-planner-main">
      <div class="tdg-planner-page tdg-gifts">
        <header class="tdg-gifts-head">
          <div class="tdg-gifts-head-copy">
            <p class="tdg-planner-kicker tdg-planner-kicker--accent">Thoughtful gifts. Happier moments.</p>
            <h1>Gifts</h1>
            <p>Everyone you love. Everything in one place.</p>
          </div>
          <div class="tdg-gifts-head-actions">
            <label class="tdg-gifts-search is-open">
              <input class="tdg-planner-input" placeholder="Search gifts, people or ideas..." />
            </label>
            <button type="button" class="tdg-planner-btn primary">+ Add Someone</button>
          </div>
        </header>
        <div class="tdg-gifts-layout">
          <div class="tdg-gifts-main">
            <div class="tdg-gifts-summary">
              <div><strong>0 / 1</strong><span>Gifts planned</span></div>
              <div><strong>1</strong><span>Left to buy</span></div>
              <div><strong>0 EUR / 50 EUR</strong><span>Budget</span></div>
              <div><strong>4</strong><span>People</span></div>
            </div>
            <div class="tdg-gifts-people-head">
              <h2>Your people</h2>
              <div class="tdg-gifts-chips">
                <button class="on" type="button">All (4)</button>
                <button type="button">Family</button>
                <button type="button">To buy</button>
              </div>
            </div>
            <div class="tdg-gifts-grid">
              ${["Andreas","Emma","Emil","Sophie"].map((name, i) => `
              <button type="button" class="tdg-gifts-card">
                <span class="tdg-gifts-card-visual"><img src="${["/christmas/planner/gifts-editorial.webp","/christmas/gifts-still-life.png","/christmas/gifts/scene-desktop.jpg","/assets/christmas/christmas_finale_room.webp"][i]}" alt="" /></span>
                <span class="tdg-gifts-card-body">
                  <strong>${name}</strong>
                  <span class="tdg-gifts-card-meta">0 of 0 gifts</span>
                  <span class="tdg-gifts-card-next">${i === 0 ? "1 left to buy" : "Add a gift"}</span>
                </span>
              </button>`).join("")}
            </div>
            <aside class="tdg-gifts-spotlight">
              <div class="tdg-gifts-context-mood"><p>It’s not just about gifts.<br />It’s about the people who make Christmas special.</p></div>
              <div class="tdg-gifts-context-card">
                <p class="tdg-planner-kicker">Need inspiration?</p>
                <h2>Still need something for Andreas?</h2>
                <p>1 gift left to buy. 50 EUR remaining.</p>
                <button type="button" class="tdg-planner-btn primary">Find an idea</button>
              </div>
              <div class="tdg-gifts-context-card is-quiet">
                <p class="tdg-planner-kicker">Budget</p>
                <p>0 EUR / 50 EUR</p>
                <a href="#">Open budget →</a>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
    <div class="tdg-copilot-rail">
      <section class="tdg-copilot-panel is-rail">
        <div class="tdg-copilot-panel-photo" style="background-image:url('${photo}')"></div>
        <div class="tdg-copilot-panel-veil"></div>
        <div class="tdg-copilot-panel-inner">
          <header class="tdg-copilot-panel-head">
            <div>
              <h2>✦ Christmas Copilot</h2>
              <p>A little help. A little Christmas magic.</p>
            </div>
          </header>
          <div class="tdg-copilot-panel-scroll">
            <div class="tdg-copilot-suggest">
              <button type="button">Find a gift for Andreas</button>
              <button type="button">Help me stay under €50</button>
              <button type="button">Surprise me with an idea</button>
            </div>
            <div class="tdg-copilot-nextwin">
              <p class="tdg-copilot-nextwin-kicker">Your next little win</p>
              <p class="tdg-copilot-nextwin-title">One thoughtful gift for Andreas.</p>
              <button type="button" class="tdg-planner-btn primary">Find an idea</button>
            </div>
          </div>
          <form class="tdg-copilot-dock">
            <input placeholder="Ask your Christmas Copilot..." />
            <button type="button" class="tdg-copilot-send" aria-label="Send">➤</button>
          </form>
        </div>
      </section>
    </div>
  </div>
</div>
</body>
</html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/" || url.pathname === "/gifts") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const file = join(ROOT, "public", decodeURIComponent(url.pathname));
  if (!file.startsWith(join(ROOT, "public")) || !existsSync(file)) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

await new Promise((resolveReady) => server.listen(4178, "127.0.0.1", resolveReady));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function shot(name, size) {
  const page = await browser.newPage({ viewport: size });
  await page.goto("http://127.0.0.1:4178/gifts", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(400);
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: false });
  console.log("wrote", path);
  await page.close();
}

await shot("planner-copilot-desktop.png", { width: 1440, height: 900 });
await shot("planner-copilot-mobile.png", { width: 390, height: 844 });

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://127.0.0.1:4178/gifts", { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    const root = document.createElement("div");
    root.className = "tdg-copilot-root";
    root.innerHTML = document.querySelector(".tdg-copilot-rail")?.innerHTML.replace("is-rail", "is-sheet") || "";
    document.body.appendChild(root);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "planner-copilot-mobile-sheet.png"), fullPage: false });
  console.log("wrote", join(OUT, "planner-copilot-mobile-sheet.png"));
  await page.close();
}
await browser.close();
server.close();
console.log("visual QA complete");

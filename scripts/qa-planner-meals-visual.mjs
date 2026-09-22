#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = process.env.PLANNER_QA_OUT || "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });
const css = readFileSync("src/features/christmas/planner/plannerApp.css", "utf8");
const file = (rel) => `file://${resolve(rel)}`;

const HERO = file("public/christmas/planner/dinner-table.webp");
const SPREAD = file("public/assets/christmas/library-stills/prague_balcony_christmas_spread.jpg");
const BAKERY = file("public/assets/christmas/library-stills/prague_bakery_window.jpg");
const COOKIES = file("public/assets/christmas/library-stills/prague_cafe_street_cookies.jpg");
const MARKET = file("public/assets/christmas/library-stills/prague_market_gingerbread_stall.jpg");
const COPILOT = file("public/christmas/planner/copilot-cozy.webp");

const rawHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" />
  <style>${css}
    html, body { margin: 0; background: #faf8f6; }
  </style>
</head>
<body>
<div class="tdg-planner-app">
  <div class="tdg-planner-frame tdg-planner-frame--copilot">
    <header class="tdg-planner-header">
      <a class="tdg-planner-logo" href="#"><span>Christmas Planner</span></a>
      <p class="tdg-planner-header-count"><strong>94</strong> days until Christmas</p>
      <div class="tdg-planner-header-meta">
        <div class="tdg-planner-header-tools">
          <button class="tdg-planner-header-icon" type="button" aria-label="Search">⌕</button>
          <button class="tdg-planner-header-icon" type="button" aria-label="Notifications">◉</button>
        </div>
        <div class="tdg-planner-account-chrome"><button class="tdg-planner-avatar" type="button">PM</button></div>
      </div>
    </header>
    <aside class="tdg-planner-side" aria-label="Planner modules">
      <div class="tdg-planner-side-brand"><strong>Christmas Planner</strong><i class="tdg-planner-side-flourish"></i><span>Your calm Christmas starts here.</span></div>
      <nav class="tdg-planner-side-nav">
        <a href="#">Home</a>
        <a href="#">Today</a>
        <a href="#">Plan</a>
        <a href="#">Gifts</a>
        <a class="active" href="#">Meals</a>
        <a href="#">Recipes</a>
        <a href="#">Shopping</a>
        <a href="#">More</a>
      </nav>
    </aside>
    <main class="tdg-planner-main">
      <div class="tdg-planner-page tdg-meals">
        <header class="tdg-meals-page-head">
          <h1>Meals</h1>
          <p>Plan every festive table, from breakfast to the big Christmas dinner.</p>
        </header>
        <section class="tdg-meals-hero">
          <img src="${HERO}" alt="" />
          <div class="tdg-meals-hero-veil"></div>
          <div class="tdg-meals-hero-copy">
            <p class="tdg-meals-hero-kicker">Your Christmas feast</p>
            <h2>A beautiful menu, planned around your people.</h2>
            <div class="tdg-meals-hero-badges"><span>Christmas Day</span><span>8 guests</span></div>
            <button class="tdg-planner-btn primary tdg-meals-hero-cta" type="button">Build my menu</button>
          </div>
        </section>
        <div class="tdg-meals-summary">
          <div><strong>8</strong><span>Guests</span></div>
          <div><strong>0 / 4</strong><span>Courses</span></div>
          <div><strong>0</strong><span>Recipes saved</span></div>
          <div><strong>Not calculated</strong><span>Estimated cost</span></div>
        </div>
        <section class="tdg-meals-menu">
          <div class="tdg-meals-menu-head"><h2>Your Christmas menu</h2><a href="#">Open grocery →</a></div>
          <div class="tdg-meals-tabs">
            <button type="button">Christmas Eve</button>
            <button type="button" class="on">Christmas Day</button>
            <button type="button">Christmas Breakfast</button>
            <button type="button">Custom meal</button>
          </div>
          <div class="tdg-meals-courses">
            <article class="tdg-meals-course"><button class="tdg-meals-course-visual" type="button"><img src="${SPREAD}" alt="" /></button><div class="tdg-meals-course-body"><p class="tdg-meals-course-label">Starter</p><strong>Not chosen yet</strong><p class="tdg-planner-muted">Choose a starter for this table.</p><button class="tdg-planner-btn" type="button">Choose starter</button></div></article>
            <article class="tdg-meals-course"><button class="tdg-meals-course-visual" type="button"><img src="${HERO}" alt="" /></button><div class="tdg-meals-course-body"><p class="tdg-meals-course-label">Main</p><strong>Not chosen yet</strong><p class="tdg-planner-muted">Choose the centrepiece.</p><button class="tdg-planner-btn" type="button">Choose main</button></div></article>
            <article class="tdg-meals-course"><button class="tdg-meals-course-visual" type="button"><img src="${MARKET}" alt="" /></button><div class="tdg-meals-course-body"><p class="tdg-meals-course-label">Sides</p><strong>Not chosen yet</strong><p class="tdg-planner-muted">Add a side to round it out.</p><button class="tdg-planner-btn" type="button">Choose sides</button></div></article>
            <article class="tdg-meals-course"><button class="tdg-meals-course-visual" type="button"><img src="${BAKERY}" alt="" /></button><div class="tdg-meals-course-body"><p class="tdg-meals-course-label">Dessert</p><strong>Not chosen yet</strong><p class="tdg-planner-muted">Save something sweet for last.</p><button class="tdg-planner-btn" type="button">Choose dessert</button></div></article>
          </div>
        </section>
        <section class="tdg-meals-ideas">
          <div class="tdg-meals-ideas-head"><h2>Ideas picked for your table</h2><a href="#">View all recipes</a></div>
          <div class="tdg-meals-ideas-grid">
            <article class="tdg-meals-idea"><div class="tdg-meals-idea-visual"><img src="${HERO}" alt="" /></div><div class="tdg-meals-idea-body"><strong>Herb-butter roast turkey</strong><p>A whole turkey roasted over onions and citrus, with thyme-sage butter under the skin.</p><p class="tdg-meals-idea-meta">4h 10m · advanced</p></div></article>
            <article class="tdg-meals-idea"><div class="tdg-meals-idea-visual"><img src="${COOKIES}" alt="" /></div><div class="tdg-meals-idea-body"><strong>Gingerbread stars</strong><p>Crisp spiced biscuits for the Christmas table.</p><p class="tdg-meals-idea-meta">45m · easy</p></div></article>
            <article class="tdg-meals-idea"><div class="tdg-meals-idea-visual"><img src="${BAKERY}" alt="" /></div><div class="tdg-meals-idea-body"><strong>Citrus honey roasted carrots</strong><p>A bright side for the Christmas table with honey and thyme.</p><p class="tdg-meals-idea-meta">40m · easy</p></div></article>
          </div>
        </section>
        <section class="tdg-meals-diet">
          <div class="tdg-meals-diet-head"><h2>Dietary notes</h2><a href="#">Manage guests</a></div>
          <div class="tdg-meals-chips">
            <button type="button" class="on">No restrictions</button>
            <button type="button">Vegetarian</button>
            <button type="button">Gluten-free</button>
            <button type="button">Nut-free</button>
          </div>
        </section>
        <aside class="tdg-meals-copilot-cta">
          <p class="tdg-planner-kicker">Christmas Copilot</p>
          <h2>Let Christmas Copilot create the first draft</h2>
          <p>Tell us your preferences and we’ll build a balanced menu.</p>
          <button class="tdg-planner-btn primary" type="button">Suggest my full menu</button>
        </aside>
      </div>
    </main>
    <aside class="tdg-planner-copilot-rail">
      <section class="tdg-xmas-copilot tdg-xmas-copilot--docked">
        <div class="tdg-xmas-copilot-photo" style="background-image:url('${COPILOT}')"><div class="tdg-xmas-copilot-veil"></div></div>
        <header class="tdg-xmas-copilot-head"><div><p class="tdg-xmas-copilot-brand">Christmas Copilot</p><p class="tdg-xmas-copilot-sub">A little help. A little Christmas magic.</p></div></header>
        <div class="tdg-xmas-copilot-scroll">
          <div class="tdg-xmas-copilot-suggestions">
            <button class="tdg-xmas-copilot-chip" type="button"><span>Create a dinner plan for 8.</span></button>
            <button class="tdg-xmas-copilot-chip" type="button"><span>What should I prep tomorrow?</span></button>
            <button class="tdg-xmas-copilot-chip" type="button"><span>Give me a rescue plan.</span></button>
          </div>
          <div class="tdg-xmas-copilot-win">
            <p class="tdg-xmas-copilot-win-kicker">Your next little win</p>
            <p class="tdg-xmas-copilot-win-body">Build a balanced four-course menu for Christmas Day.</p>
            <button class="tdg-xmas-copilot-win-cta" type="button">Plan dinner →</button>
          </div>
        </div>
      </section>
    </aside>
    <nav class="tdg-planner-nav">
      <a href="#">Home</a>
      <a href="#">Plan</a>
      <button class="tdg-planner-nav-copilot" type="button">AI Copilot</button>
      <a href="#">Shopping</a>
      <a href="#">More</a>
    </nav>
  </div>
</div>
</body>
</html>`;

writeFileSync("/tmp/planner-meals-visual.html", rawHtml);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function shot(name, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto("file:///tmp/planner-meals-visual.html", { waitUntil: "load" });
  await page.waitForTimeout(700);
  const dest = `${OUT}/meals-${name}.png`;
  await page.screenshot({ path: dest, fullPage: true });
  console.log(dest);
  await page.close();
}

await shot("desktop", { width: 1440, height: 1100 });
await shot("tablet", { width: 834, height: 1112 });
await shot("mobile", { width: 390, height: 1100 });
await browser.close();

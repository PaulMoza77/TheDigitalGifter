#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = process.env.PLANNER_QA_OUT || "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });
const css = readFileSync("src/features/christmas/planner/plannerApp.css", "utf8");
const dinner = resolve("public/christmas/planner/dinner-table.webp");
const gifts = resolve("public/christmas/planner/gifts-editorial.webp");
const bakery = resolve("public/assets/christmas/library-stills/prague_bakery_window.jpg");
const cozy = resolve("public/christmas/planner/copilot-cozy.webp");
const clip = resolve("public/assets/christmas/cozy-reel/posters/clip1.jpg");

const family = resolve("public/assets/christmas/library-stills/family_christmas_boardgame.jpg");

function copilotChips(nav) {
  if (nav === "shopping") {
    return `
            <button type="button" class="tdg-xmas-copilot-chip"><span>What am I missing?</span></button>
            <button type="button" class="tdg-xmas-copilot-chip"><span>What should I buy next?</span></button>
            <button type="button" class="tdg-xmas-copilot-chip"><span>Consolidate my list</span></button>`;
  }
  return `
            <button type="button" class="tdg-xmas-copilot-chip"><span>What should I do next?</span></button>
            <button type="button" class="tdg-xmas-copilot-chip"><span>Help me catch up</span></button>
            <button type="button" class="tdg-xmas-copilot-chip"><span>What is urgent?</span></button>`;
}

function shell({ title, nav, copilot = false, main }) {
  return `<!doctype html>
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
  <div class="tdg-planner-frame${copilot ? " tdg-planner-frame--copilot" : ""}">
    <header class="tdg-planner-header">
      <a class="tdg-planner-logo" href="#"><span>Christmas Planner</span></a>
      <p class="tdg-planner-header-count"><strong>94</strong> days until Christmas</p>
      <div class="tdg-planner-header-meta">
        <span class="tdg-planner-ready-mini"><span>42% <span class="tdg-planner-ready-mini-label">ready</span></span><span class="tdg-planner-bar is-compact"><span style="width:42%"></span></span></span>
      </div>
    </header>
    <aside class="tdg-planner-side">
      <div class="tdg-planner-side-brand"><strong>Christmas Planner</strong><span>Your calm Christmas starts here.</span></div>
      <nav class="tdg-planner-side-nav">
        <a class="${nav === "home" ? "active" : ""}" href="#">Home</a>
        <a href="#">Today</a>
        <a class="${nav === "plan" ? "active" : ""}" href="#">Plan</a>
        <a class="${nav === "gifts" ? "active" : ""}" href="#">Gifts</a>
        <a class="${nav === "meals" ? "active" : ""}" href="#">Meals</a>
        <a class="${nav === "recipes" ? "active" : ""}" href="#">Recipes</a>
        <a class="${nav === "shopping" ? "active" : ""}" href="#">Shopping</a>
        <a class="${nav === "more" || nav === "budget" ? "active" : ""}" href="#">More</a>
      </nav>
      <div class="tdg-planner-side-foot">
        <a class="tdg-planner-magic tdg-planner-magic--side" href="/generator?occasion=christmas">
          <span class="tdg-planner-magic-visual" aria-hidden="true"><img src="${gifts}" alt="" /></span>
          <span class="tdg-planner-magic-copy">
            <span class="tdg-planner-magic-kicker">Create Christmas magic</span>
            <span class="tdg-planner-magic-lede">Turn your favorite moments into something magical.</span>
            <span class="tdg-planner-magic-cta">Create a memory →</span>
          </span>
        </a>
        <div class="tdg-planner-side-account">
          <button type="button" class="tdg-planner-side-copilot">AI Copilot</button>
          <a href="#">Account</a>
        </div>
      </div>
    </aside>
    <main class="tdg-planner-main">${main}</main>
    ${copilot ? `<aside class="tdg-planner-copilot-rail" aria-label="Christmas Copilot">
      <section class="tdg-xmas-copilot tdg-xmas-copilot--docked">
        <div class="tdg-xmas-copilot-photo" style="background-image:url('${cozy}')"><div class="tdg-xmas-copilot-veil"></div></div>
        <header class="tdg-xmas-copilot-head"><div><p class="tdg-xmas-copilot-brand">Christmas Copilot</p><p class="tdg-xmas-copilot-sub">A little help. A little Christmas magic.</p><p class="tdg-xmas-copilot-meta">42% ready · 94 days left</p></div></header>
        <div class="tdg-xmas-copilot-scroll">
          <div class="tdg-xmas-copilot-suggestions">${copilotChips(nav)}
          </div>
          <div class="tdg-xmas-copilot-win">
            <p class="tdg-xmas-copilot-win-kicker">Your next little win</p>
            <p class="tdg-xmas-copilot-win-body">${nav === "shopping" ? "Tick smoked salmon off the Christmas Day list." : "Choose a gift for Andreas before the weekend post."}</p>
            <button type="button" class="tdg-xmas-copilot-win-cta">${nav === "shopping" ? "Open shopping" : "Find a gift"}</button>
          </div>
        </div>
        <form class="tdg-xmas-copilot-composer"><input class="tdg-xmas-copilot-input" placeholder="Ask anything..." /></form>
      </section>
    </aside>` : ""}
    <nav class="tdg-planner-nav">
      <a class="${nav === "home" ? "active" : ""}" href="#">Home</a>
      <a class="${nav === "plan" ? "active" : ""}" href="#">Plan</a>
      <button class="tdg-planner-nav-copilot" type="button">AI Copilot</button>
      <a class="${nav === "shopping" ? "active" : ""}" href="#">Shopping</a>
      <a class="${nav === "more" || nav === "budget" ? "active" : ""}" href="#">More</a>
    </nav>
  </div>
</div>
</body></html>`;
}

const pages = {
  home: shell({
    title: "Home",
    nav: "home",
    copilot: true,
    main: `
      <div class="tdg-planner-today">
        <header class="tdg-home-hero">
          <div class="tdg-home-hero-visual" aria-hidden="true">
            <img src="${dinner}" alt="" />
            <div class="tdg-home-hero-veil"></div>
          </div>
          <div class="tdg-home-hero-copy">
            <p class="tdg-planner-kicker">Good evening</p>
            <h1>94 days until Christmas</h1>
            <p class="tdg-planner-ready">42% ready for Christmas</p>
            <div class="tdg-planner-bar"><span style="width:42%"></span></div>
          </div>
        </header>
        <div class="tdg-planner-dash">
          <div class="tdg-planner-today-main">
            <section class="tdg-planner-section tdg-intel-nba">
              <p class="tdg-intel-kicker">Next best action</p>
              <h2>Choose a gift for Andreas</h2>
              <p class="tdg-planner-muted">He still needs an idea, and posted gifts should leave this week.</p>
              <a class="tdg-planner-btn primary" href="#">Continue</a>
            </section>
            <section class="tdg-planner-section">
              <h2>Today</h2>
              <div class="tdg-planner-list">
                <article class="tdg-planner-task"><div></div><div class="tdg-planner-task-body"><div class="tdg-planner-task-title">Order posted gifts</div><div class="tdg-planner-task-meta">Due today</div></div></article>
                <article class="tdg-planner-task"><div></div><div class="tdg-planner-task-body"><div class="tdg-planner-task-title">Confirm guest count</div><div class="tdg-planner-task-meta">Meals</div></div></article>
                <article class="tdg-planner-task"><div></div><div class="tdg-planner-task-body"><div class="tdg-planner-task-title">Set a wrapping evening</div><div class="tdg-planner-task-meta">Later this week</div></div></article>
              </div>
            </section>
          </div>
          <aside class="tdg-planner-snapshot">
            <h2>This season</h2>
            <div class="tdg-planner-snap-row"><p class="tdg-planner-kicker">Gifts</p><p>4 people</p><a href="#">Open gifts</a></div>
            <div class="tdg-planner-snap-row"><p class="tdg-planner-kicker">Meals</p><p>Christmas Dinner</p><a href="#">Open meals</a></div>
            <div class="tdg-planner-snap-row"><p class="tdg-planner-kicker">Shopping</p><p>6 still needed</p><a href="#">Open shopping</a></div>
            <div class="tdg-planner-snap-row"><p class="tdg-planner-kicker">Budget</p><p>€420 spent</p><a href="#">Open budget</a></div>
          </aside>
        </div>
      </div>`,
  }),
  plan: shell({
    title: "Plan",
    nav: "plan",
    copilot: true,
    main: `
      <div class="tdg-planner-page tdg-tasks">
        <header class="tdg-tasks-hero">
          <div class="tdg-tasks-hero-copy">
            <h1>Tasks</h1>
            <p>Everything you need to get Christmas done — without the last-minute stress.</p>
          </div>
          <div class="tdg-tasks-hero-art" aria-hidden="true">
            <div class="tdg-tasks-hero-fade"></div>
            <img src="${clip}" alt="" />
          </div>
        </header>
        <div class="tdg-tasks-seg" role="tablist">
          <button type="button">Today</button>
          <button type="button">This week</button>
          <button type="button" class="on">All</button>
          <button type="button">Calendar</button>
        </div>
        <div class="tdg-planner-composer tdg-planner-panel">
          <form class="tdg-tasks-composer">
            <input class="tdg-planner-input" placeholder="Add a task..." />
            <select class="tdg-planner-select"><option>Other</option></select>
            <button type="button" class="tdg-planner-btn primary tdg-tasks-add">Add task</button>
          </form>
        </div>
        <section class="tdg-tasks-stats tdg-tasks-stats--plan">
          <article class="tdg-tasks-stat tdg-tasks-stat--plan">
            <svg class="tdg-tasks-ring" viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="20" fill="none" stroke="#e6ddd2" stroke-width="5"/><circle cx="28" cy="28" r="20" fill="none" stroke="#2a4d3e" stroke-width="5" stroke-dasharray="80" stroke-dashoffset="60" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle" font-size="11" font-weight="700" fill="#6a5f55">25%</text></svg>
            <div><h2>Your Christmas plan</h2><p>3 of 12 tasks completed</p><div class="tdg-tasks-stat-bar"><span style="width:25%"></span></div></div>
          </article>
        </section>
        <section class="tdg-tasks-today">
          <div class="tdg-tasks-today-head"><h2>All <span class="tdg-tasks-count">5</span></h2><p>Tue, Sep 22</p></div>
          <section class="tdg-planner-section"><h3>Overdue</h3><article class="tdg-planner-task"><div></div><div class="tdg-planner-task-body"><div class="tdg-planner-task-title">Order posted gifts</div><div class="tdg-planner-task-meta">Yesterday</div></div></article></section>
          <section class="tdg-planner-section"><h3>Today</h3><article class="tdg-planner-task"><div></div><div class="tdg-planner-task-body"><div class="tdg-planner-task-title">Confirm guest count</div><div class="tdg-planner-task-meta">Today</div></div></article></section>
          <section class="tdg-planner-section"><h3>This week</h3><article class="tdg-planner-task"><div></div><div class="tdg-planner-task-body"><div class="tdg-planner-task-title">Buy wrapping paper</div><div class="tdg-planner-task-meta">Thu</div></div></article></section>
          <section class="tdg-planner-section"><h3>Later</h3><article class="tdg-planner-task"><div></div><div class="tdg-planner-task-body"><div class="tdg-planner-task-title">Write cards</div><div class="tdg-planner-task-meta">Dec</div></div></article></section>
        </section>
      </div>`,
  }),
  gifts: shell({
    title: "Gifts",
    nav: "gifts",
    copilot: true,
    main: `
      <div class="tdg-planner-page tdg-gifts">
        <header class="tdg-gifts-head">
          <div class="tdg-gifts-head-hero" aria-hidden="true"><img src="${gifts}" alt="" /></div>
          <div class="tdg-gifts-head-copy">
            <p class="tdg-planner-kicker">Thoughtful gifts. Happier moments.</p>
            <h1>Gifts</h1>
            <p>Everyone you love. Everything in one place.</p>
          </div>
          <div class="tdg-gifts-head-actions">
            <button type="button" class="tdg-planner-btn primary">+ Add Someone</button>
          </div>
        </header>
        <div class="tdg-gifts-layout">
          <div class="tdg-gifts-main">
            <div class="tdg-gifts-people-head"><h2>Your people</h2></div>
            <div class="tdg-gifts-grid">
              <article class="tdg-gifts-card"><div class="tdg-gifts-card-visual"><img src="${gifts}" alt="" /></div><div class="tdg-gifts-card-body"><strong>Andreas</strong><p class="tdg-gifts-card-meta">Family · 1 of 2 bought</p><p class="tdg-gifts-card-next">Buy next</p></div></article>
              <article class="tdg-gifts-card"><div class="tdg-gifts-card-visual"><img src="${dinner}" alt="" /></div><div class="tdg-gifts-card-body"><strong>Emma</strong><p class="tdg-gifts-card-meta">Family · Idea chosen</p><p class="tdg-gifts-card-next">Buy next</p></div></article>
              <button type="button" class="tdg-gifts-add-card"><span class="tdg-gifts-add-plus">+</span><span>Add Someone</span><em>Start shopping for someone new</em></button>
            </div>
          </div>
        </div>
      </div>`,
  }),
  meals: shell({
    title: "Meals",
    nav: "meals",
    copilot: true,
    main: `
      <div class="tdg-planner-page tdg-food-product tdg-meals">
        <header class="tdg-planner-page-head"><h1>Meals</h1><p>Plan every festive table, from breakfast to the big Christmas dinner.</p></header>
        <div class="tdg-meals-toolbar">
          <div class="tdg-planner-seg">
            <button type="button">Christmas Eve</button>
            <button type="button" class="on">Christmas Day</button>
            <button type="button">Christmas Breakfast</button>
          </div>
          <label class="tdg-meals-guests">Guests <input class="tdg-planner-input" type="number" value="8" /></label>
        </div>
        <section class="tdg-meal-summary">
          <div class="tdg-meals-menu-head">
            <div><h2>Christmas Day</h2><p class="tdg-planner-muted">8 guests</p></div>
            <button type="button" class="tdg-planner-btn">Open grocery</button>
          </div>
          <div class="tdg-meals-courses">
            ${[
              ["Starter", resolve("public/assets/christmas/library-stills/prague_balcony_christmas_spread.jpg"), "Smoked salmon blinis"],
              ["Main", dinner, "Roast turkey"],
              ["Sides", resolve("public/assets/christmas/library-stills/prague_market_gingerbread_stall.jpg"), "Honey carrots"],
              ["Dessert", bakery, "Mince pies"],
              ["Drinks", resolve("public/assets/christmas/library-stills/alpine_village_cocoa_bridge.jpg"), "Mulled wine"],
            ]
              .map(
                ([label, img, dish]) => `<article class="tdg-meals-course"><img src="${img}" alt="" /><p class="tdg-meals-course-label">${label}</p><strong>${dish}</strong><p class="tdg-planner-muted">45m</p></article>`,
              )
              .join("")}
          </div>
        </section>
      </div>`,
  }),
  recipes: shell({
    title: "Recipes",
    nav: "recipes",
    copilot: true,
    main: `
      <div class="tdg-planner-page tdg-food-product">
        <header class="tdg-planner-page-head"><h1>Recipes</h1><p>Find the dish, then add it to the table.</p></header>
        <input class="tdg-planner-input tdg-recipe-search" placeholder="Search recipes..." />
        <div class="tdg-recipe-quick">
          <button type="button" class="tdg-planner-chip on">All</button>
          <button type="button" class="tdg-planner-chip">Dessert</button>
          <button type="button" class="tdg-planner-chip">Dietary</button>
          <button type="button" class="tdg-planner-chip">Under 30 min</button>
          <button type="button" class="tdg-planner-chip">Tradition</button>
        </div>
        <details class="tdg-recipe-filters"><summary>Filters</summary></details>
        <div class="tdg-recipe-grid">
          <article class="tdg-recipe-card"><button type="button" class="tdg-recipe-open"><img class="tdg-recipe-art" src="${dinner}" alt="" /><strong>Roast turkey</strong><p class="tdg-planner-muted">3h 20m · 8 servings</p></button></article>
          <article class="tdg-recipe-card"><button type="button" class="tdg-recipe-open"><img class="tdg-recipe-art" src="${bakery}" alt="" /><strong>Mince pies</strong><p class="tdg-planner-muted">50m · 12 servings · vegetarian</p></button></article>
          <article class="tdg-recipe-card"><button type="button" class="tdg-recipe-open"><img class="tdg-recipe-art" src="${dinner}" alt="" /><strong>Honey carrots</strong><p class="tdg-planner-muted">40m · 8 servings</p></button></article>
        </div>
      </div>`,
  }),
  shopping: shell({
    title: "Shopping",
    nav: "shopping",
    copilot: true,
    main: `
      <div class="tdg-planner-page tdg-shop">
        <header class="tdg-planner-page-head"><h1>Shopping</h1><p>Everything you still need, in one place.</p></header>
        <div class="tdg-planner-seg tdg-planner-seg--status" role="tablist">
          <button type="button" class="on">Need to buy <span class="tdg-planner-seg-count">4</span></button>
          <button type="button">Ordered</button>
          <button type="button">Arriving</button>
          <button type="button">Arrived</button>
          <button type="button">Returns</button>
        </div>
        <section class="tdg-shop-group">
          <h2>Groceries</h2>
          <ul class="tdg-shop-list">
            <li><label class="tdg-shop-row"><input type="checkbox" /><span><strong>smoked salmon</strong><small>Smoked salmon with capers and rye</small></span><em>400 g</em></label></li>
            <li><label class="tdg-shop-row"><input type="checkbox" /><span><strong>rye bread</strong><small>Christmas Dinner</small></span><em>8 pieces</em></label></li>
            <li><label class="tdg-shop-row"><input type="checkbox" /><span><strong>Brussels sprouts</strong><small>Christmas Dinner</small></span><em>800 g</em></label></li>
          </ul>
        </section>
        <section class="tdg-shop-group">
          <h2>Gifts</h2>
          <ul class="tdg-shop-list">
            <li><label class="tdg-shop-row"><input type="checkbox" /><span><strong>Cashmere scarf</strong><small>Andreas</small></span><em>€48</em></label></li>
          </ul>
        </section>
      </div>`,
  }),
  more: shell({
    title: "More",
    nav: "more",
    copilot: true,
    main: `
      <div class="tdg-planner-page">
        <header class="tdg-planner-page-head"><h1>More</h1><p>Everything else for your Christmas season.</p></header>
        <a class="tdg-planner-magic tdg-planner-magic--more" href="/generator?occasion=christmas">
          <span class="tdg-planner-magic-visual" aria-hidden="true"><img src="${family}" alt="" /></span>
          <span class="tdg-planner-magic-copy">
            <span class="tdg-planner-magic-kicker">Create Christmas magic</span>
            <strong>Your plans make Christmas happen. Now create something worth remembering.</strong>
            <span class="tdg-planner-magic-lede">Create Christmas images and videos from your favorite moments.</span>
            <span class="tdg-planner-magic-cta">Start creating →</span>
          </span>
        </a>
        <section class="tdg-planner-section">
          <p class="tdg-planner-kicker">Plan</p>
          <div class="tdg-planner-more">
            <a href="#"><span></span><span>Calendar<span class="desc">See every date, task and delivery</span></span></a>
            <a href="#"><span></span><span>Traditions<span class="desc">Make time for what matters</span></span></a>
          </div>
        </section>
        <section class="tdg-planner-section">
          <p class="tdg-planner-kicker">Home</p>
          <div class="tdg-planner-more">
            <a href="#"><span></span><span>Hosting<span class="desc">Guests, prep and home</span></span></a>
          </div>
        </section>
      </div>`,
  }),
  budget: shell({
    title: "Budget",
    nav: "budget",
    copilot: true,
    main: `
      <div class="tdg-planner-page tdg-budget-page">
        <header class="tdg-budget-head">
          <div>
            <p class="tdg-planner-kicker">Christmas Budget</p>
            <h1>€420 spent of €1,000</h1>
            <p class="tdg-planner-muted">€580 remaining</p>
          </div>
        </header>
        <div class="tdg-planner-bar"><span style="width:42%"></span></div>
        <section class="tdg-planner-section">
          <h2>Categories</h2>
          <p>Gifts €280 · Food €90 · Home €50</p>
        </section>
      </div>`,
  }),
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

for (const [name, html] of Object.entries(pages)) {
  const file = `/tmp/planner-ux-${name}.html`;
  writeFileSync(file, html);
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 1100 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`file://${file}`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    const out = `${OUT}/planner-${name}-${label}.png`;
    const fullPage = name !== "shopping" && name !== "more";
    await page.screenshot({ path: out, fullPage });
    console.log(out);
    await page.close();
  }
}

await browser.close();

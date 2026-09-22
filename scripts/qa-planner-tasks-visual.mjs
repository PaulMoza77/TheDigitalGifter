#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = process.env.PLANNER_QA_OUT || "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });
const css = readFileSync("src/features/christmas/planner/plannerApp.css", "utf8");

const rawHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@400;500;600;700&display=swap" />
  <style>${css}
    html, body { margin: 0; background: #f7f1e8; }
  </style>
</head>
<body>
<div class="tdg-planner-app">
  <div class="tdg-planner-frame">
    <header class="tdg-planner-header">
      <a class="tdg-planner-logo" href="#">
        <svg class="tdg-planner-gift-mark" viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
          <rect x="8" y="20" width="32" height="22" rx="4" fill="#B5232E"></rect>
          <rect x="8" y="20" width="32" height="6" fill="#8E1B24"></rect>
          <rect x="22" y="20" width="4" height="22" fill="#F4D7A1"></rect>
          <path d="M24 20c-6-8-13-8-13-2 0 4 5 6 13 8 8-2 13-4 13-8 0-6-7-6-13 2z" fill="#C4A574"></path>
          <path d="M24 20c-4-5-9-6-9-2 0 3 4 5 9 6 5-1 9-3 9-6 0-4-5-3-9 2z" fill="#B5232E"></path>
        </svg>
        <span>Christmas Planner</span>
      </a>
      <p class="tdg-planner-header-count"><strong>94</strong> days until Christmas
        <svg class="tdg-planner-tree-mark" viewBox="0 0 18 18" width="14" height="14"><path d="M9 1.8 3.2 8.8h3.1L3 14h12l-3.3-5.2h3.1L9 1.8z" fill="#2a4d3e"/><rect x="8.1" y="14" width="1.8" height="2.4" rx="0.4" fill="#6d4c2f"/></svg>
      </p>
      <div class="tdg-planner-header-meta">
        <div class="tdg-planner-header-tools">
          <button class="tdg-planner-header-icon" type="button" aria-label="Search">⌕</button>
          <button class="tdg-planner-header-icon" type="button" aria-label="Notifications">◉</button>
        </div>
        <div class="tdg-planner-account-chrome"><button class="tdg-planner-avatar" type="button">PM</button></div>
      </div>
    </header>
    <aside class="tdg-planner-side" aria-hidden="true">
      <div class="tdg-planner-side-brand"><strong>Christmas Planner</strong><span>Your calm Christmas starts here.</span></div>
    </aside>
    <main class="tdg-planner-main">
      <div class="tdg-planner-page tdg-tasks">
        <header class="tdg-tasks-hero">
          <div class="tdg-tasks-hero-copy">
            <h1>Tasks</h1>
            <p>Everything you need to get Christmas done — without the last-minute stress.</p>
          </div>
          <div class="tdg-tasks-hero-art" aria-hidden="true">
            <div class="tdg-tasks-hero-fade"></div>
            <img src="FILE_HERO" alt="" />
            <p class="tdg-tasks-hero-caption">Small steps today<br>A magical Christmas<br>tomorrow</p>
          </div>
        </header>
        <div class="tdg-tasks-seg" role="tablist">
          <button type="button" class="on">Today</button>
          <button type="button">This week</button>
          <button type="button">All</button>
          <button type="button">Calendar</button>
        </div>
        <div class="tdg-planner-composer tdg-planner-panel">
          <form class="tdg-tasks-composer">
            <input class="tdg-planner-input" placeholder="Add a task..." />
            <select class="tdg-planner-select"><option>Other</option></select>
            <button type="button" class="tdg-planner-btn primary tdg-tasks-add">+ Add task</button>
          </form>
        </div>
        <section class="tdg-tasks-stats">
          <article class="tdg-tasks-stat tdg-tasks-stat--plan">
            <svg class="tdg-tasks-ring" viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="20" fill="none" stroke="#e6ddd2" stroke-width="5"/><text x="28" y="32" text-anchor="middle" font-size="11" font-weight="700" fill="#6a5f55">0%</text></svg>
            <div>
              <h2>Your Christmas plan</h2>
              <p>0 of 48 tasks completed</p>
              <div class="tdg-tasks-stat-bar"><span style="width:0%"></span></div>
            </div>
          </article>
          <article class="tdg-tasks-stat"><span class="tdg-tasks-stat-ico tdg-tasks-stat-ico--gift">□</span><strong>8</strong><span>Gift ideas</span></article>
          <article class="tdg-tasks-stat"><span class="tdg-tasks-stat-ico tdg-tasks-stat-ico--shop">□</span><strong>0</strong><span>Items to buy</span></article>
          <article class="tdg-tasks-stat"><span class="tdg-tasks-stat-ico tdg-tasks-stat-ico--event">□</span><strong>0</strong><span>Events planned</span></article>
        </section>
        <div class="tdg-tasks-mid">
          <section class="tdg-tasks-start">
            <p class="tdg-tasks-start-kicker">Get started</p>
            <h2>Your Christmas plan starts here</h2>
            <p class="tdg-tasks-start-lede">Here are a few recommended tasks to help you get organized:</p>
            <ul class="tdg-tasks-suggest">
              <li><button class="tdg-tasks-suggest-row" type="button"><span class="tdg-tasks-suggest-check"></span><span class="tdg-tasks-suggest-ico tdg-tasks-suggest-ico--budget"></span><span class="tdg-tasks-suggest-copy"><strong>Set your Christmas budget</strong><span>Know what you want to spend and stick to it.</span></span></button></li>
              <li><button class="tdg-tasks-suggest-row" type="button"><span class="tdg-tasks-suggest-check"></span><span class="tdg-tasks-suggest-ico tdg-tasks-suggest-ico--gift"></span><span class="tdg-tasks-suggest-copy"><strong>Start your gift list</strong><span>Add family, friends and gift ideas.</span></span></button></li>
              <li><button class="tdg-tasks-suggest-row" type="button"><span class="tdg-tasks-suggest-check"></span><span class="tdg-tasks-suggest-ico tdg-tasks-suggest-ico--travel"></span><span class="tdg-tasks-suggest-copy"><strong>Decide where you’re spending Christmas</strong><span>Home, traveling, or hosting?</span></span></button></li>
              <li><button class="tdg-tasks-suggest-row" type="button"><span class="tdg-tasks-suggest-check"></span><span class="tdg-tasks-suggest-ico tdg-tasks-suggest-ico--home"></span><span class="tdg-tasks-suggest-copy"><strong>Plan your decorations</strong><span>Make your home feel magical.</span></span></button></li>
            </ul>
            <div class="tdg-tasks-start-actions">
              <button class="tdg-planner-btn primary" type="button">+ Add all to my plan</button>
              <button class="tdg-tasks-skip" type="button">Not now, I’ll explore on my own</button>
            </div>
          </section>
          <aside class="tdg-tasks-rail">
            <blockquote class="tdg-tasks-quote">
              <svg class="tdg-tasks-quote-mark" viewBox="0 0 48 36" width="36" height="28"><path d="M18 0C8 4 0 14 0 24c0 7 5 12 11 12 6 0 10-4 10-10 0-6-4-9-9-9-1 0-3 0-4 1 2-6 7-12 14-16L18 0zm30 0C38 4 30 14 30 24c0 7 5 12 11 12 6 0 10-4 10-10 0-6-4-9-9-9-1 0-3 0-4 1 2-6 7-12 14-16L48 0z" fill="#c4a574"/></svg>
              <p>A little progress every day makes a stress-free Christmas.</p>
            </blockquote>
            <figure class="tdg-tasks-door">
              <img src="FILE_DOOR" alt="" />
              <figcaption>It’s not just a to-do list.<br>It’s a more magical Christmas.</figcaption>
            </figure>
          </aside>
        </div>
        <section class="tdg-tasks-today">
          <div class="tdg-tasks-today-head"><h2>Today <span class="tdg-tasks-count">0</span></h2><p>Tue, Sep 22</p></div>
          <div class="tdg-tasks-empty"><strong>No tasks for today yet.</strong><p>Add a task or use the suggestions above to get started.</p></div>
        </section>
      </div>
    </main>
    <nav class="tdg-planner-nav">
      <a href="#">Home</a>
      <a class="active" href="#">Plan</a>
      <button class="tdg-planner-nav-copilot" type="button">AI Copilot</button>
      <a href="#">Shopping</a>
      <a href="#">More</a>
    </nav>
  </div>
</div>
</body>
</html>`;

const html = rawHtml
  .replaceAll("FILE_HERO", resolve("public/assets/christmas/cozy-reel/posters/clip1.jpg"))
  .replaceAll("FILE_DOOR", resolve("public/assets/christmas/luxury-palace/posters/palace_04_entrance.jpg"));

writeFileSync("/tmp/planner-tasks-visual.html", html);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function shot(name, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto("file:///tmp/planner-tasks-visual.html", { waitUntil: "load" });
  await page.waitForTimeout(600);
  const file = `${OUT}/tasks-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
  await page.close();
}

await shot("desktop", { width: 1280, height: 1100 });
await shot("tablet", { width: 834, height: 1112 });
await shot("mobile", { width: 390, height: 1100 });
await browser.close();

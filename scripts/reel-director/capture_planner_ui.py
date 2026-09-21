#!/usr/bin/env python3
"""Render 9:16 captures from production planner CSS + fictional household.

This is NOT an authenticated /account/christmas session. Env has no planner test login.
Markup/classes come from src/features/christmas/planner (Today / Gifts / Budget).
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/christmas/christmas_planner_mom_overwhelm_v2/preview/ui"
CSS = "/src/features/christmas/planner/plannerApp.css"

NAV = """
<nav class="tdg-planner-nav" aria-label="Christmas planner">
  <a class="{today}" href="#today"><span>Today</span></a>
  <a class="{gifts}" href="#gifts"><span>Gifts</span></a>
  <a class="{meals}" href="#meals"><span>Meals</span></a>
  <a class="{more}" href="#more"><span>More</span></a>
</nav>
"""

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=390, initial-scale=1"/>
<title>{title}</title>
<link rel="stylesheet" href="{css}"/>
<style>
  html,body {{ margin:0; background:#f6efe4; }}
  .tdg-planner-side {{ display:none !important; }}
  .capture-banner {{
    position: sticky; top:0; z-index:80;
    background:#7a2430; color:#f7f0e4;
    font: 600 11px/1.3 "Source Sans 3", sans-serif;
    letter-spacing:.04em; text-transform:uppercase;
    padding:6px 10px;
  }}
  .tdg-planner-check {{
    width:22px; height:22px; border-radius:6px;
    border:1.5px solid #143328; background:#fffdf8;
    display:inline-flex; align-items:center; justify-content:center;
  }}
  .tdg-planner-check.is-on {{ background:#143328; color:#f7f0e4; }}
</style>
</head>
<body>
<div class="tdg-planner-app">
<p class="capture-banner">Static source render · fictional data · not a signed-in session</p>
<div class="tdg-planner-frame">
<header class="tdg-planner-header">
  <a class="tdg-planner-logo" href="#"><span>The Digital Gifter</span></a>
  <div class="tdg-planner-header-meta"><span class="tdg-planner-ready-mini">38% ready</span></div>
</header>
<main class="tdg-planner-main">
{body}
</main>
{nav}
</div>
</div>
</body>
</html>
"""


def write(name: str, title: str, nav_key: str, body: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    nav = NAV.format(
        today="active" if nav_key == "today" else "",
        gifts="active" if nav_key == "gifts" else "",
        meals="active" if nav_key == "meals" else "",
        more="active" if nav_key == "more" else "",
    )
    path = OUT / name
    path.write_text(HEAD.format(title=title, css=CSS, body=body, nav=nav), encoding="utf-8")
    return path


def pages() -> None:
    write(
        "today.html",
        "Today",
        "today",
        """
<div class="tdg-planner-today">
  <header class="tdg-planner-hero tdg-home-hero">
    <p class="tdg-planner-kicker">94 days until Christmas</p>
    <h1>What do I need to do next for Christmas?</h1>
    <p class="tdg-planner-ready">Your Christmas is 38% planned</p>
    <div class="tdg-planner-bar" role="progressbar"><span style="width:38%"></span></div>
    <ol class="tdg-home-next">
      <li>2 gifts left to buy</li>
      <li>Dinner menu not started</li>
    </ol>
  </header>
  <section class="tdg-planner-section">
    <div class="tdg-planner-section-head"><h2>Today’s priorities</h2></div>
    <div class="tdg-planner-list">
      <div class="tdg-planner-task is-done">
        <button class="tdg-planner-check is-on" type="button" aria-pressed="true">✓</button>
        <div class="tdg-planner-task-body">
          <div class="tdg-planner-task-title">Buy Emma’s gift</div>
          <div class="tdg-planner-task-meta">Gifts · today</div>
        </div>
      </div>
      <div class="tdg-planner-task">
        <button class="tdg-planner-check" type="button"></button>
        <div class="tdg-planner-task-body">
          <div class="tdg-planner-task-title">Decide Christmas dinner</div>
          <div class="tdg-planner-task-meta">Meals · today</div>
        </div>
      </div>
      <div class="tdg-planner-task">
        <button class="tdg-planner-check" type="button"></button>
        <div class="tdg-planner-task-body">
          <div class="tdg-planner-task-title">Set a Christmas budget</div>
          <div class="tdg-planner-task-meta">Budget</div>
        </div>
      </div>
    </div>
  </section>
</div>
""",
    )
    write(
        "gifts.html",
        "Gifts",
        "gifts",
        """
<div class="tdg-planner-page">
  <header class="tdg-planner-page-head">
    <h1>Gifts</h1>
    <p>Plan everyone you’re buying for - privately, in one place.</p>
  </header>
  <div class="tdg-planner-summary">
    <div class="tdg-planner-summary-cell"><span class="tdg-planner-kicker">People</span><strong>3</strong><span>on your list</span></div>
    <div class="tdg-planner-summary-cell"><span class="tdg-planner-kicker">Ideas</span><strong>1</strong><span>still deciding</span></div>
    <div class="tdg-planner-summary-cell"><span class="tdg-planner-kicker">Ordered</span><strong>1</strong><span>in motion</span></div>
  </div>
  <div class="tdg-planner-people">
    <button type="button" class="tdg-planner-person on">
      <strong>Emma</strong>
      <div class="tdg-planner-muted">Daughter</div>
      <div class="tdg-planner-gift-meta"><span>1 gift</span><span>1 in motion</span></div>
    </button>
    <button type="button" class="tdg-planner-person">
      <strong>Noah</strong>
      <div class="tdg-planner-muted">Son</div>
      <div class="tdg-planner-gift-meta"><span>1 gift</span><span>still deciding</span></div>
    </button>
  </div>
  <div class="tdg-planner-panel">
    <h2>Emma</h2>
    <p class="tdg-planner-muted">Daughter</p>
    <div class="tdg-planner-task is-done">
      <button class="tdg-planner-check is-on" type="button">✓</button>
      <div class="tdg-planner-task-body">
        <div class="tdg-planner-task-title">Art set</div>
        <div class="tdg-planner-task-meta">Ordered</div>
      </div>
    </div>
  </div>
</div>
""",
    )
    write(
        "budget.html",
        "Budget",
        "more",
        """
<div class="tdg-planner-page tdg-budget-page">
  <header class="tdg-planner-page-head">
    <h1>Christmas Budget</h1>
    <p>Keep Christmas spending under control.</p>
  </header>
  <div class="tdg-planner-summary">
    <div class="tdg-planner-summary-cell"><span class="tdg-planner-kicker">Total</span><strong>$1,200</strong><span>this season</span></div>
    <div class="tdg-planner-summary-cell"><span class="tdg-planner-kicker">Spent</span><strong>$180</strong><span>so far</span></div>
    <div class="tdg-planner-summary-cell"><span class="tdg-planner-kicker">Left</span><strong>$1,020</strong><span>remaining</span></div>
  </div>
  <div class="tdg-planner-bar" role="progressbar"><span style="width:15%"></span></div>
  <section class="tdg-planner-section">
    <div class="tdg-planner-section-head"><h2>Categories</h2></div>
    <p>Gifts $600 · Food $250 · Other $350</p>
  </section>
</div>
""",
    )


def screenshot(html: Path, png: Path) -> None:
    chrome = "/usr/local/bin/google-chrome"
    png.parent.mkdir(parents=True, exist_ok=True)
    url = "http://127.0.0.1:8765/" + str(html.relative_to(ROOT))
    profile = f"/tmp/tdg-chrome-{png.stem}"
    cmd = [
        "timeout",
        "25",
        chrome,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--virtual-time-budget=8000",
        f"--user-data-dir={profile}",
        "--window-size=390,693",
        f"--screenshot={png}",
        url,
    ]
    try:
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        if not png.exists() or png.stat().st_size < 1000:
            raise


def main() -> int:
    pages()
    proc = subprocess.Popen(
        ["python3", "-m", "http.server", "8765", "--bind", "127.0.0.1"],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        import time

        time.sleep(0.8)
        for name in ("today", "gifts", "budget"):
            screenshot(OUT / f"{name}.html", OUT / f"{name}.png")
            print(f"captured {name}.png", flush=True)
    finally:
        proc.terminate()
        proc.wait(timeout=5)
    note = {
        "status": "SOURCE_RENDER",
        "authenticated_account_christmas": False,
        "blocker": "No planner test login / VITE_SUPABASE_* in this Cloud Agent environment. Could not open live /account/christmas, /gifts, /food, /budget, or /plan.",
        "what_was_captured": "9:16 pages using production plannerApp.css and the real Today / Gifts / Budget chrome, filled with fictional Lauren household data.",
        "reel_actions": [
            "Today: check off Buy Emma's gift",
            "Gifts: Emma / Art set ordered",
            "Budget remaining as optional third beat",
        ],
        "files": ["today.png", "gifts.png", "budget.png"],
    }
    (OUT / "capture_report.json").write_text(json.dumps(note, indent=2) + "\n")
    print("SOURCE_RENDER captures ready", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

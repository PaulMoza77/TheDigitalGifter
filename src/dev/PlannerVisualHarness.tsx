import { Gift, Home, LayoutList, MoreHorizontal, ShoppingBag, Sparkles, UserRound } from "lucide-react";
import { ChristmasCopilotPanel } from "@/features/christmas/planner/copilot/ChristmasCopilotPanel";
import type { CopilotTurn } from "@/features/christmas/planner/copilot/ChristmasCopilotPanel";
import { PlannerGiftMark } from "@/features/christmas/planner/plannerMarks";
import "@/features/christmas/planner/plannerApp.css";
import { useMemo, useState } from "react";
import { askCopilot } from "@/features/christmas/planner/copilot/ask";
import { buildPlannerSnapshot } from "@/features/christmas/planner/intelligence/snapshot";
import { runPlannerIntelligence } from "@/features/christmas/planner/intelligence/engine";
import type { GiftItem, GiftRecipient, PlannerProfile, PlannerTask } from "@/features/christmas/planner/types";
import {
  buildCopilotNextWin,
  buildCopilotSuggestions,
} from "@/features/christmas/planner/copilot/context";

const NOW = new Date("2026-12-12T12:00:00Z");

function fixtureIntel() {
  const profile: PlannerProfile = {
    id: "profile-visual",
    user_id: "user-visual",
    season_year: 2026,
    country_code: "IE",
    currency: "eur",
    timezone: "UTC",
    household_label: "",
    recipient_count_approx: 4,
    total_budget_minor: 50000,
    hosting: true,
    travelling: false,
    has_children: false,
    prepared_level: "some",
    known_dates: [],
    onboarding_completed_at: "2026-09-01T00:00:00Z",
    plan_mode: "sprint",
    locale: "en",
  };
  const recipients: GiftRecipient[] = [
    { id: "r1", profile_id: profile.id, display_name: "Andreas", relationship: "family", budget_minor: 12000, notes: "" },
    { id: "r2", profile_id: profile.id, display_name: "Emma", relationship: "family", budget_minor: 12000, notes: "" },
    { id: "r3", profile_id: profile.id, display_name: "Emil", relationship: "family", budget_minor: 10000, notes: "" },
    { id: "r4", profile_id: profile.id, display_name: "Sophie", relationship: "friend", budget_minor: 8000, notes: "" },
  ];
  const gifts: GiftItem[] = [
    {
      id: "g1",
      profile_id: profile.id,
      recipient_id: "r1",
      idea: "Leather notebook",
      selected_gift: "Leather notebook",
      url: null,
      store: "",
      planned_price_minor: 4500,
      actual_price_minor: null,
      status: "idea",
      hiding_place: "",
      delivery_on: null,
      return_deadline: null,
      source_type: "manual",
      source_ref: null,
    },
  ];
  const tasks: PlannerTask[] = [
    {
      id: "t1",
      profile_id: profile.id,
      title: "Buy Andreas a gift",
      category: "gifts",
      due_on: "2026-12-15",
      status: "open",
      priority: "high",
      notes: "",
      origin: "user",
      template_key: null,
    },
  ];
  return runPlannerIntelligence(
    buildPlannerSnapshot({
      profile,
      tasks,
      recipients,
      gifts,
      budgetEntries: [],
      meals: [],
      grocery: [],
      trips: [],
      now: NOW,
    }),
  );
}

const PEOPLE = [
  { name: "Andreas", cover: "/christmas/planner/gifts-editorial.webp", progress: "0 of 1 gifts", footer: "1 left to buy" },
  { name: "Emma", cover: "/christmas/gifts-still-life.png", progress: "0 of 0 gifts", footer: "Add a gift idea" },
  { name: "Emil", cover: "/assets/christmas/christmas_finale_room.webp", progress: "0 of 0 gifts", footer: "Add a gift idea" },
  { name: "Sophie", cover: "/christmas/cabin-hero-1280.webp", progress: "0 of 0 gifts", footer: "Add a gift idea" },
];

/**
 * Local-only visual harness for Gifts + Copilot chrome (no auth / no network).
 * Open at /dev/planner-visual while Vite is running.
 */
export default function PlannerVisualHarness() {
  const intel = useMemo(() => fixtureIntel(), []);
  const suggestions = useMemo(() => buildCopilotSuggestions("gifts", intel), [intel]);
  const nextWin = useMemo(() => buildCopilotNextWin("gifts", intel), [intel]);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  function ask(prompt?: string) {
    const q = (prompt ?? question).trim();
    if (!q) return;
    const reply = askCopilot(q, intel);
    setTurns((prev) => [...prev, { id: `${Date.now()}`, question: q, reply }]);
    setQuestion("");
  }

  const panel = (
    <ChristmasCopilotPanel
      mode={mobileOpen ? "drawer" : "docked"}
      intel={intel}
      suggestions={suggestions}
      nextWin={nextWin}
      turns={turns}
      question={question}
      applyNote={null}
      onQuestionChange={setQuestion}
      onAsk={ask}
      onClose={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="tdg-planner-app" data-testid="planner-visual-harness">
      <div className="tdg-planner-frame tdg-planner-frame--copilot">
        <header className="tdg-planner-header">
          <p className="tdg-planner-header-count">
            <strong>13</strong> days until Christmas
          </p>
        </header>
        <aside className="tdg-planner-side" aria-label="Planner modules">
          <div className="tdg-planner-side-brand">
            <PlannerGiftMark size={44} />
            <strong>Christmas Planner</strong>
            <i className="tdg-planner-side-flourish" aria-hidden="true" />
            <span>Your calm Christmas starts here.</span>
          </div>
          <nav className="tdg-planner-side-nav">
            {[
              ["Home", Home],
              ["Today", LayoutList],
              ["Plan", LayoutList],
              ["Gifts", Gift],
              ["Meals", ShoppingBag],
              ["Recipes", ShoppingBag],
              ["Shopping", ShoppingBag],
              ["More", MoreHorizontal],
            ].map(([label, Icon], i) => (
              <a key={String(label)} href="#gifts" className={label === "Gifts" ? "active" : undefined}>
                <Icon size={16} strokeWidth={1.7} aria-hidden />
                <span className="tdg-planner-side-label">{label}</span>
              </a>
            ))}
          </nav>
          <div className="tdg-planner-side-foot">
            <button type="button" className="tdg-planner-side-copilot" onClick={() => setMobileOpen(true)}>
              <Sparkles size={16} strokeWidth={1.7} aria-hidden />
              AI Copilot
            </button>
            <a href="#account">
              <UserRound size={16} strokeWidth={1.6} aria-hidden />
              Account
            </a>
          </div>
        </aside>
        <main className="tdg-planner-main">
          <div className="tdg-planner-page tdg-gifts">
            <header className="tdg-gifts-head">
              <div className="tdg-gifts-head-hero" aria-hidden="true">
                <img src="/christmas/planner/gifts-editorial.webp" alt="" />
              </div>
              <div className="tdg-gifts-head-copy">
                <p className="tdg-planner-kicker">Thoughtful gifts. Happier moments.</p>
                <h1>Gifts</h1>
                <p>Everyone you love. Everything in one place.</p>
              </div>
              <div className="tdg-gifts-head-actions">
                <label className="tdg-gifts-search is-open">
                  <input className="tdg-planner-input" placeholder="Search gifts, people or ideas..." readOnly />
                </label>
                <button type="button" className="tdg-planner-btn primary">
                  + Add Someone
                </button>
              </div>
            </header>
            <div className="tdg-gifts-summary">
              <div>
                <Gift size={18} aria-hidden />
                <strong>0 / 1</strong>
                <span>Gifts planned</span>
              </div>
              <div>
                <strong>1</strong>
                <span>Left to buy</span>
              </div>
              <div>
                <strong>0 EUR / 50 EUR</strong>
                <span>Budget</span>
              </div>
              <div>
                <strong>4</strong>
                <span>People</span>
              </div>
            </div>
            <div className="tdg-gifts-people-head">
              <h2>Your people</h2>
              <div className="tdg-gifts-chips">
                <button type="button" className="on">
                  All (4)
                </button>
                <button type="button">Family</button>
                <button type="button">To buy</button>
              </div>
            </div>
            <div className="tdg-gifts-grid">
              {PEOPLE.map((person) => (
                <article key={person.name} className="tdg-gifts-card">
                  <div className="tdg-gifts-card-visual">
                    <img src={person.cover} alt="" />
                  </div>
                  <div className="tdg-gifts-card-body">
                    <strong>{person.name}</strong>
                    <p className="tdg-gifts-card-meta">{person.progress}</p>
                    <div className="tdg-planner-bar" aria-hidden="true">
                      <span style={{ width: person.name === "Andreas" ? "0%" : "0%" }} />
                    </div>
                    <span className="tdg-gifts-card-next">{person.footer}</span>
                  </div>
                </article>
              ))}
            </div>
            <aside className="tdg-gifts-context">
              <div className="tdg-gifts-context-mood">
                <p>
                  It’s not just about gifts.
                  <br />
                  It’s about the people who make Christmas special.
                </p>
              </div>
              <div className="tdg-gifts-context-card">
                <p className="tdg-planner-kicker">Need inspiration?</p>
                <h2>Still need something for Andreas?</h2>
                <button type="button" className="tdg-planner-btn primary" onClick={() => ask("Need an idea for Andreas?")}>
                  Find an idea
                </button>
              </div>
              <div className="tdg-gifts-context-card is-quiet">
                <p className="tdg-planner-kicker">Budget</p>
                <p>0 EUR / 50 EUR</p>
                <a href="#budget">Open budget →</a>
              </div>
            </aside>
          </div>
        </main>
        <aside className="tdg-planner-copilot-rail">{panel}</aside>
        <nav className="tdg-planner-nav">
          <a href="#home" className="">
            <Home size={18} aria-hidden />
            Home
          </a>
          <a href="#plan">
            <LayoutList size={18} aria-hidden />
            Plan
          </a>
          <button type="button" className="tdg-planner-nav-copilot" onClick={() => setMobileOpen(true)}>
            <Sparkles size={18} aria-hidden />
            AI Copilot
          </button>
          <a href="#shopping">
            <ShoppingBag size={18} aria-hidden />
            Shopping
          </a>
          <a href="#more">
            <MoreHorizontal size={18} aria-hidden />
            More
          </a>
        </nav>
      </div>
      {mobileOpen ? (
        <div className="tdg-xmas-copilot-drawer-root">
          <button type="button" className="tdg-xmas-copilot-drawer-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close" />
          {panel}
        </div>
      ) : null}
    </div>
  );
}

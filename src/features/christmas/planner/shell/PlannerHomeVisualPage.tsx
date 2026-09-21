import { accessFromGrants } from "../entitlements";
import { buildPlannerSnapshot } from "../intelligence/snapshot";
import { buildModuleCards, collectHomeNextActions, homeProgressFromReadiness } from "./homeStats";
import { PlannerHomeRail } from "./PlannerHomeRail";
import { PlannerModuleGrid } from "./PlannerModuleCard";
import { PlannerSearch } from "./PlannerSearch";
import type { PlannerProfile } from "../types";
import "../plannerApp.css";

const profile: PlannerProfile = {
  id: "preview",
  user_id: "preview",
  season_year: 2026,
  country_code: "IE",
  currency: "eur",
  timezone: "UTC",
  household_label: "",
  recipient_count_approx: 4,
  total_budget_minor: 100000,
  hosting: true,
  travelling: false,
  has_children: false,
  prepared_level: "some",
  known_dates: [],
  onboarding_completed_at: "2026-09-01T00:00:00Z",
  plan_mode: "standard",
  locale: "en",
};

/** Dev-only visual of the Home view. Does not touch Stripe or live planner data. */
export default function PlannerHomeVisualPage() {
  const snapshot = buildPlannerSnapshot({
    profile,
    tasks: [],
    recipients: [{ id: "r1", profile_id: "preview", display_name: "Dad", relationship: "family", budget_minor: 20000, notes: "" }],
    gifts: [
      {
        id: "g1",
        profile_id: "preview",
        recipient_id: "r1",
        idea: "idea",
        selected_gift: "Scarf",
        url: null,
        store: "",
        planned_price_minor: 4000,
        actual_price_minor: 4000,
        status: "wrapped",
        hiding_place: "",
        delivery_on: null,
        return_deadline: null,
        source_type: "manual",
        source_ref: null,
      },
    ],
    budgetEntries: [],
    meals: [{ id: "m1", title: "Christmas dinner", section: "christmas_day", meal_on: null }],
    recipes: [{ id: "rc1", title: "Cookies", servings: 12, prep_minutes: 20, cook_minutes: 12, category: "cookies", tags: [], ingredients: [] }],
    now: new Date("2026-12-01T09:30:00Z"),
  });
  const access = accessFromGrants({ grantKeys: ["planner_core", "gift_planner", "budget"], seasonYear: 2026 });
  const cards = buildModuleCards({ snapshot, access, spentMinor: 4000 });
  const nextActions = collectHomeNextActions({ snapshot });
  const progress = homeProgressFromReadiness(42, cards);

  return (
    <div className="tdg-planner-app tdg-planner-home-preview">
        <div className="tdg-planner-frame">
          <aside className="tdg-planner-side" aria-label="Preview sidebar">
            <div className="tdg-planner-side-brand">
              <strong>Christmas Planner</strong>
            </div>
            <nav className="tdg-planner-side-nav">
              <a className="active" href="/account/christmas">
                Home
              </a>
              <a href="/account/christmas/today">Today</a>
              <a href="/account/christmas/plan">Plan</a>
              <a href="/account/christmas/gifts">Gifts</a>
              <a href="/account/christmas/food">Meals</a>
              <a href="/account/christmas/recipes">Recipes</a>
              <a href="/account/christmas/shopping">Shopping</a>
              <div className="tdg-planner-more-group">
                <button type="button">More</button>
              </div>
              <button type="button" className="tdg-planner-side-idea">
                Need an idea?
              </button>
            </nav>
            <div className="tdg-planner-side-foot">
              <a href="/account/dashboard">
                <span className="tdg-planner-avatar">L</span>
                <span className="tdg-planner-side-user">
                  <strong>Lauren</strong>
                  <span>Account &amp; settings</span>
                </span>
              </a>
            </div>
          </aside>
          <main className="tdg-planner-main">
            <header className="tdg-planner-mobile-top tdg-planner-hub-mobile-top">
              <span>Christmas Planner</span>
              <span className="tdg-planner-avatar">L</span>
            </header>
            <div className="tdg-planner-hub">
              <header className="tdg-planner-hub-head">
                <div className="tdg-planner-hub-hello">
                  <h1>Good morning, Lauren!</h1>
                  <p>A calmer, happier Christmas is just a few clicks away. 🎄</p>
                </div>
                <PlannerSearch compact />
              </header>
              <div className="tdg-planner-hub-body">
                <PlannerModuleGrid cards={cards} />
                <PlannerHomeRail showUpgrade progress={progress} nextActions={nextActions} daysLeft={snapshot.daysLeft} />
              </div>
            </div>
          </main>
          <nav className="tdg-planner-nav" aria-label="Christmas planner">
            <a className="active" href="/account/christmas">
              Home
            </a>
            <a href="/account/christmas/plan">Plan</a>
            <span className="tdg-planner-nav-copilot">AI Copilot</span>
            <a href="/account/christmas/shopping">Shopping</a>
            <a href="/account/christmas/more">More</a>
          </nav>
        </div>
      </div>
  );
}

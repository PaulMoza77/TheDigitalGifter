import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CHRISTMAS_CLUB_ROUTE } from "@/features/christmas/club/config";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import { hasFeature } from "./entitlements";
import { PlannerPaywall } from "./Paywall";
import { trackPlannerEvent } from "./analytics";
import { loadGifts, loadTasks } from "./api";
import type { GiftItem, PlannerTask } from "./types";
import { ChristmasPlannerSimpleModule } from "./ChristmasPlannerPages";

export function ChristmasPlannerShoppingPage() {
  const { loading, profile } = usePlannerBundle();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [tab, setTab] = useState<"need" | "ordered" | "arriving" | "arrived" | "returns">("need");

  useEffect(() => {
    if (!profile) return;
    void loadGifts(profile.id).then(setGifts);
    trackPlannerEvent("planner_module_opened", { module: "shopping" });
  }, [profile?.id]);

  if (loading) return <p>Loading shopping…</p>;
  if (!profile) return <PlannerOnboarding />;

  const filtered = gifts.filter((g) => {
    if (tab === "need") return g.status === "idea" || g.status === "planned";
    if (tab === "ordered" || tab === "arriving") return g.status === "ordered";
    if (tab === "arrived") return g.status === "arrived" || g.status === "hidden" || g.status === "wrapped";
    return Boolean(g.return_deadline);
  });

  return (
    <div>
      <h1>Shopping</h1>
      <p className="tdg-planner-muted">Uses your gift list so you don’t keep a second spreadsheet.</p>
      <div className="tdg-planner-chips">
        {(["need", "ordered", "arriving", "arrived", "returns"] as const).map((t) => (
          <button key={t} type="button" className={`tdg-planner-chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t === "need" ? "Need to buy" : t}
          </button>
        ))}
      </div>
      {filtered.map((g) => (
        <div key={g.id} className="tdg-planner-card">
          <strong>{g.selected_gift || g.idea}</strong>
          <div className="tdg-planner-muted">
            {g.status}
            {g.delivery_on ? ` · arrives ${g.delivery_on}` : ""}
            {g.store ? ` · ${g.store}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChristmasPlannerCalendarPage() {
  const { loading, profile } = usePlannerBundle();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; title: string; starts_on: string }>>([]);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      loadTasks(profile.id),
      supabase.from("christmas_events").select("id,title,starts_on").eq("profile_id", profile.id),
    ]).then(([t, e]) => {
      setTasks(t);
      setEvents((e.data as typeof events) || []);
    });
    trackPlannerEvent("planner_module_opened", { module: "calendar" });
  }, [profile?.id]);

  if (loading) return <p>Loading calendar…</p>;
  if (!profile) return <PlannerOnboarding />;

  const items = [
    ...tasks.filter((t) => t.due_on).map((t) => ({ id: t.id, on: t.due_on as string, title: t.title, kind: "task" })),
    ...events.map((e) => ({ id: e.id, on: e.starts_on, title: e.title, kind: "event" })),
  ].sort((a, b) => a.on.localeCompare(b.on));

  return (
    <div>
      <h1>Calendar</h1>
      <p className="tdg-planner-muted">Tasks, deliveries, and dates in one list. Calendar sync is architected for later — no OAuth in V1.</p>
      {items.map((item) => (
        <div key={`${item.kind}-${item.id}`} className="tdg-planner-card tdg-planner-row">
          <div>
            <strong>{item.title}</strong>
            <div className="tdg-planner-muted">
              {item.on} · {item.kind}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChristmasPlannerFoodPage() {
  return (
    <ChristmasPlannerSimpleModule
      module="food"
      title="Christmas food"
      feature="food_planner"
      table="christmas_meals"
      fields={[
        { key: "title", placeholder: "Meal name (Christmas Day lunch…)" },
        { key: "section", placeholder: "christmas_day / christmas_eve / breakfast…" },
      ]}
      addLabel="Add meal"
      event="planner_meal_created"
    />
  );
}

export function ChristmasPlannerRecipesPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [recipes, setRecipes] = useState<Array<{ id: string; title: string; description: string; teaser: boolean; entitlement_key: string }>>([]);

  useEffect(() => {
    void supabase
      .from("christmas_recipes")
      .select("id,title,description,teaser,entitlement_key")
      .eq("published", true)
      .then(({ data }) => setRecipes((data as typeof recipes) || []));
    trackPlannerEvent("planner_module_opened", { module: "recipes", feature: "recipes" });
  }, []);

  if (loading) return <p>Loading recipes…</p>;
  if (!profile) return <PlannerOnboarding />;

  const canAll = hasFeature(access, "recipes");
  return (
    <div>
      <h1>Recipes</h1>
      <p className="tdg-planner-muted">Original TDG recipes — not copied from other sites. Free teasers stay free.</p>
      {recipes.map((r) => {
        const locked = r.entitlement_key !== "free" && !r.teaser && !canAll;
        return (
          <div key={r.id} className="tdg-planner-card">
            <strong>{r.title}</strong>
            <p>{r.description}</p>
            {locked ? (
              <PlannerPaywall feature="recipes" title="Full recipe pack" body="Save recipes, add them to meals, and roll ingredients into groceries." />
            ) : (
              <button
                type="button"
                className="tdg-planner-btn"
                onClick={async () => {
                  await supabase.from("christmas_recipe_saves").insert({ profile_id: profile.id, recipe_id: r.id });
                  trackPlannerEvent("planner_recipe_saved", { module: "recipes" });
                }}
              >
                Save
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChristmasPlannerHostingPage() {
  return (
    <ChristmasPlannerSimpleModule
      module="hosting"
      title="Hosting"
      feature="hosting"
      table="christmas_guests"
      fields={[
        { key: "display_name", placeholder: "Guest name or household" },
        { key: "dietary", placeholder: "Dietary needs (optional)" },
        { key: "bringing", placeholder: "What they’re bringing" },
      ]}
      addLabel="Add guest"
      event="planner_guest_added"
    />
  );
}

export function ChristmasPlannerHomePage() {
  return (
    <ChristmasPlannerSimpleModule
      module="home"
      title="Home & decorating"
      table="christmas_home_items"
      fields={[
        { key: "title", placeholder: "Lights, wreath, guest towels…" },
        { key: "area", placeholder: "tree / living_room / dining / outside…" },
      ]}
      addLabel="Add item"
    />
  );
}

export function ChristmasPlannerTravelPage() {
  return (
    <ChristmasPlannerSimpleModule
      module="travel"
      title="Travel"
      feature="travel"
      table="christmas_trips"
      fields={[
        { key: "destination", placeholder: "Where are you going?" },
        { key: "booking_notes", placeholder: "Booking references / notes (no card or passport data)" },
      ]}
      addLabel="Add trip"
    />
  );
}

export function ChristmasPlannerTraditionsPage() {
  return (
    <ChristmasPlannerSimpleModule
      module="traditions"
      title="Activities & traditions"
      table="christmas_traditions"
      fields={[
        { key: "title", placeholder: "Lights walk, baking, market…" },
      ]}
      addLabel="Save idea"
      event="planner_activity_scheduled"
    />
  );
}

export function ChristmasPlannerCardsPage() {
  const { loading, profile } = usePlannerBundle();
  const [rows, setRows] = useState<Array<{ id: string; contact_name: string; status: string }>>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!profile) return;
    void supabase
      .from("christmas_card_tracker")
      .select("id,contact_name,status")
      .eq("profile_id", profile.id)
      .then(({ data }) => setRows((data as typeof rows) || []));
    trackPlannerEvent("planner_module_opened", { module: "cards" });
  }, [profile?.id]);

  if (loading) return <p>Loading cards…</p>;
  if (!profile) return <PlannerOnboarding />;

  return (
    <div>
      <h1>Cards & messages</h1>
      <p className="tdg-planner-muted">Track who needs a card. Create in the existing makers — we don’t duplicate generation.</p>
      <div className="tdg-planner-actions" style={{ marginBottom: 12 }}>
        <Link className="tdg-planner-btn primary" to="/christmas/messages">
          Create message
        </Link>
        <Link className="tdg-planner-btn" to="/christmas/cards">
          Create card
        </Link>
      </div>
      <div className="tdg-planner-card">
        <input className="tdg-planner-input" placeholder="Who needs a card?" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="tdg-planner-btn"
          onClick={async () => {
            if (!name.trim()) return;
            const { data } = await supabase
              .from("christmas_card_tracker")
              .insert({ profile_id: profile.id, contact_name: name.trim(), status: "needed" })
              .select("id,contact_name,status")
              .maybeSingle();
            if (data) {
              setRows((p) => [...p, data as (typeof rows)[0]]);
              setName("");
            }
          }}
        >
          Add
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="tdg-planner-card tdg-planner-row">
          <div>
            <strong>{r.contact_name}</strong>
            <div className="tdg-planner-muted">{r.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChristmasPlannerMemoriesPage() {
  return (
    <ChristmasPlannerSimpleModule
      module="memories"
      title="Memories"
      table="christmas_memories"
      fields={[
        { key: "title", placeholder: "Favorite moment, meal, or tradition" },
        { key: "body", placeholder: "A note for next year" },
      ]}
      addLabel="Save memory"
    />
  );
}

export function ChristmasPlannerClubPage() {
  useEffect(() => {
    trackPlannerEvent("planner_module_opened", { module: "club" });
  }, []);
  return (
    <div>
      <h1>Christmas Club</h1>
      <p>
        Community posts aren’t live yet — we won’t fake an active feed. Join the existing Christmas Club for countdown
        updates.
      </p>
      <div className="tdg-planner-actions" style={{ marginTop: 16 }}>
        <Link className="tdg-planner-btn primary" to={CHRISTMAS_CLUB_ROUTE}>
          Open Christmas Club
        </Link>
      </div>
    </div>
  );
}

export function ChristmasPlannerSettingsPage() {
  const { loading, profile, reload } = usePlannerBundle();
  const [hosting, setHosting] = useState(false);
  const [travelling, setTravelling] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setHosting(profile.hosting);
    setTravelling(profile.travelling);
  }, [profile]);

  if (loading) return <p>Loading settings…</p>;
  if (!profile) return <PlannerOnboarding />;

  return (
    <div>
      <h1>Settings</h1>
      <div className="tdg-planner-card">
        <p className="tdg-planner-muted">Season {profile.season_year} · {profile.currency.toUpperCase()} · {profile.country_code}</p>
        <div className="tdg-planner-chips">
          <button type="button" className={`tdg-planner-chip ${hosting ? "on" : ""}`} onClick={() => setHosting((v) => !v)}>
            Hosting
          </button>
          <button type="button" className={`tdg-planner-chip ${travelling ? "on" : ""}`} onClick={() => setTravelling((v) => !v)}>
            Travelling
          </button>
        </div>
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            await supabase
              .from("christmas_planner_profiles")
              .update({ hosting, travelling })
              .eq("id", profile.id);
            await reload();
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function ChristmasPlannerWishlistBridgePage() {
  return (
    <div>
      <h1>Wishlist</h1>
      <p>Your personal Christmas wishlist stays on the existing shareable list. Reservations stay hidden from you.</p>
      <Link className="tdg-planner-btn primary" to="/christmas/wishlist">
        Open My Wishlist
      </Link>
    </div>
  );
}


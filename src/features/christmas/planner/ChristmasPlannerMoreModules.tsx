import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CHRISTMAS_CLUB_ROUTE } from "@/features/christmas/club/config";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import { hasFeature } from "./entitlements";
import { PlannerPaywall } from "./Paywall";
import { trackPlannerEvent } from "./analytics";
import { loadGifts, loadTasks } from "./api";
import { peekPlannerQuery, plannerListKey } from "./plannerQueryCache";
import { deriveCalendarItems, deriveShoppingItems, shoppingForTab, executePlannerAction, invalidatePlannerSnapshot, detectTravelConflicts, buildPlannerSnapshot } from "./intelligence";
import { PlannerRecommendationSheet } from "./intelligence/components";
import { HOME_AREAS, type GiftItem, type PlannerTask } from "./types";
import { formatPlannerDate, giftStatusLabel, prettyLabel } from "./date";
import { PlannerComposer, PlannerEmptyState, PlannerField, PlannerLoading, PlannerPageHeader, PlannerSeg, PlannerStatusChip } from "./plannerUi";
import { PlannerGiftOutboundLink, PlannerGiftPriceLabel } from "./PlannerGiftLink";
import { cardsStudioCues, memoriesStudioCues, PlannerStudioCue } from "./studio/PlannerStudioCue";

export function ChristmasPlannerShoppingPage() {
  const { loading, profile } = usePlannerBundle();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [grocery, setGrocery] = useState<Array<{ id: string; name: string; quantity: string; status: string; source_notes?: string | null }>>([]);
  const [tab, setTab] = useState<"need" | "ordered" | "arriving" | "arrived" | "returns">("need");
  const [extra, setExtra] = useState({ name: "", store: "", price: "", delivery: "" });
  const [ready, setReady] = useState(() => Boolean(profile && peekPlannerQuery(plannerListKey("gifts", profile.id))));
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const giftsHit = peekPlannerQuery<GiftItem[]>(plannerListKey("gifts", profile.id));
    if (giftsHit) {
      setGifts(giftsHit);
      setReady(true);
    }
    void Promise.all([
      loadGifts(profile.id),
      supabase.from("christmas_grocery_items").select("id,name,quantity,status,source_notes").eq("profile_id", profile.id),
    ])
      .then(([g, groc]) => {
        if (cancelled) return;
        setGifts(g);
        setGrocery((groc.data as typeof grocery) || []);
        setReady(true);
        if (groc.error) setNotice("Could not load groceries. Gifts are still shown.");
      })
      .catch(() => {
        if (cancelled) return;
        setNotice("Could not load shopping. Try again.");
        setReady(true);
      });
    trackPlannerEvent("planner_module_opened", { module: "shopping" });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading shopping…" />;
  if (!profile) return <PlannerOnboarding />;
  if (!ready) return <PlannerLoading label="Loading shopping…" />;

  const derivedShopping = deriveShoppingItems(gifts);
  const filtered = shoppingForTab(derivedShopping, tab)
    .map((row) => gifts.find((g) => g.id === row.giftId))
    .filter((g): g is GiftItem => Boolean(g));

  async function addPurchase() {
    if (saveLock.current || !profile || !extra.name.trim()) return;
    saveLock.current = true;
    setSaving(true);
    let household = (await supabase.from("christmas_gift_recipients").select("*").eq("profile_id", profile.id).eq("display_name", "Household").maybeSingle()).data;
    if (!household) {
      const created = await supabase
        .from("christmas_gift_recipients")
        .insert({ profile_id: profile.id, display_name: "Household", relationship: "other" })
        .select("*")
        .maybeSingle();
      household = created.data;
    }
    if (!household) {
      setNotice("Could not add that purchase. Try again.");
      saveLock.current = false;
      setSaving(false);
      return;
    }
    const { data } = await supabase
      .from("christmas_gift_items")
      .insert({
        profile_id: profile.id,
        recipient_id: (household as { id: string }).id,
        idea: extra.name.trim().slice(0, 200),
        store: extra.store.slice(0, 80),
        planned_price_minor: extra.price ? Number(extra.price) * 100 : null,
        delivery_on: extra.delivery || null,
        status: "planned",
        source_type: "manual",
      })
      .select("*")
      .maybeSingle();
    if (data) {
      setGifts((p) => [...p, data as GiftItem]);
      setExtra({ name: "", store: "", price: "", delivery: "" });
      setNotice(null);
      trackPlannerEvent("planner_gift_added", { module: "shopping" });
    } else {
      setNotice("Could not add that purchase. Try again.");
    }
    saveLock.current = false;
    setSaving(false);
  }

  const groceryNeed = grocery.filter((row) => row.status === "need");
  const tabCounts = {
    need: groceryNeed.length + shoppingForTab(derivedShopping, "need").length,
    ordered: shoppingForTab(derivedShopping, "ordered").length,
    arriving: shoppingForTab(derivedShopping, "arriving").length,
    arrived: shoppingForTab(derivedShopping, "arrived").length,
    returns: shoppingForTab(derivedShopping, "returns").length,
  };

  return (
    <div className="tdg-planner-page tdg-shop">
      <PlannerPageHeader title="Shopping" lede="Everything you still need, in one place." />
      {notice ? <p role="alert">{notice}</p> : null}
      <PlannerSeg
        className="tdg-planner-seg--status"
        label="Shopping lanes"
        value={tab}
        onChange={setTab}
        options={(["need", "ordered", "arriving", "arrived", "returns"] as const).map((t) => ({
          id: t,
          label: t === "need" ? "Need to buy" : prettyLabel(t),
          count: tabCounts[t],
        }))}
      />
      {tab === "need" && groceryNeed.length ? (
        <section className="tdg-shop-group">
          <h2>Groceries</h2>
          <ul className="tdg-shop-list">
            {groceryNeed.map((row) => (
              <li key={row.id}>
                <label className="tdg-shop-row">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={async () => {
                      const { error } = await supabase
                        .from("christmas_grocery_items")
                        .update({ status: "bought" })
                        .eq("id", row.id)
                        .eq("profile_id", profile.id);
                      if (error) {
                        setNotice("Could not update that item. Try again.");
                        return;
                      }
                      setGrocery((p) => p.map((x) => (x.id === row.id ? { ...x, status: "bought" } : x)));
                      setNotice(null);
                    }}
                  />
                  <span>
                    <strong>{row.name.includes("|") ? row.name.split("|").slice(1).join("|") : row.name}</strong>
                    <small>{row.source_notes || "Christmas menu"}</small>
                  </span>
                  <em>{row.quantity || ""}</em>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {filtered.length === 0 && !(tab === "need" && groceryNeed.length) ? (
        <PlannerEmptyState mark="shopping" title="Nothing to buy here." body="Add a purchase, or move gifts along as you order them." />
      ) : filtered.length ? (
        <section className="tdg-shop-group">
          <h2>Gifts</h2>
          <ul className="tdg-shop-list">
            {filtered.map((g) => (
              <li key={g.id}>
                <label className="tdg-shop-row">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={tab !== "need"}
                    onChange={async () => {
                      if (tab !== "need") return;
                      const { error } = await supabase
                        .from("christmas_gift_items")
                        .update({ status: "ordered" })
                        .eq("id", g.id)
                        .eq("profile_id", profile.id);
                      if (error) {
                        setNotice("Could not update that gift. Try again.");
                        return;
                      }
                      setGifts((p) => p.map((x) => (x.id === g.id ? { ...x, status: "ordered" } : x)));
                      setNotice(null);
                    }}
                  />
                  <span>
                    <strong>{g.selected_gift || g.idea}</strong>
                    <small>{g.store || "Gifts"}</small>
                  </span>
                  <em>
                    <PlannerGiftPriceLabel gift={g} currency={profile.currency} />
                  </em>
                </label>
                {g.url ? (
                  <div className="tdg-shop-extra">
                    <PlannerGiftOutboundLink gift={g} source="shopping" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="tdg-planner-section">
        <h2>Non-gift purchase</h2>
        <PlannerComposer>
        <input className="tdg-planner-input" placeholder="Item" value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Store" value={extra.store} onChange={(e) => setExtra({ ...extra, store: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Price" type="number" value={extra.price} onChange={(e) => setExtra({ ...extra, price: e.target.value })} />
        <input className="tdg-planner-input" type="date" value={extra.delivery} onChange={(e) => setExtra({ ...extra, delivery: e.target.value })} />
        <button type="button" className="tdg-planner-btn primary" disabled={saving || !extra.name.trim()} onClick={() => void addPurchase()}>
          Add purchase
        </button>
        </PlannerComposer>
      </section>
    </div>
  );
}

export function ChristmasPlannerCalendarPage() {
  const { loading, profile } = usePlannerBundle();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; title: string; starts_on: string; event_kind: string }>>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<"month" | "agenda">("month");

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      loadTasks(profile.id),
      loadGifts(profile.id),
      supabase.from("christmas_events").select("id,title,starts_on,event_kind").eq("profile_id", profile.id),
    ]).then(([t, g, e]) => {
      setTasks(t);
      setGifts(g);
      setEvents((e.data as typeof events) || []);
    });
    trackPlannerEvent("planner_module_opened", { module: "calendar" });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading calendar…" />;
  if (!profile) return <PlannerOnboarding />;

  const derived = deriveCalendarItems({
    season: profile.season_year,
    today: "",
    daysLeft: 0,
    timezone: profile.timezone,
    currency: profile.currency,
    planMode: profile.plan_mode,
    profile: {
      id: profile.id,
      userId: profile.user_id,
      hosting: profile.hosting,
      travelling: profile.travelling,
      hasChildren: profile.has_children,
      preparedLevel: profile.prepared_level,
      chaosAreas: [],
      totalBudgetMinor: profile.total_budget_minor,
      onboardingCompleted: true,
    },
    tasks,
    recipients: [],
    gifts,
    budgetEntries: [],
    meals: [],
    dishes: [],
    recipes: [],
    grocery: [],
    guests: [],
    home: [],
    trips: [],
    events: events.map((e) => ({ id: e.id, title: e.title, event_kind: e.event_kind, starts_on: e.starts_on, source_type: "manual", source_ref: null })),
    cards: [],
    traditions: [],
  });
  const items = derived.map((item) => ({ id: item.sourceId, on: item.date, title: item.title, kind: item.kind, href: item.href, key: item.id }));

  const first = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
  const cells: Array<{ iso: string; day: number } | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const iso = `${cursor.y}-${String(cursor.m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { iso, day };
    }),
  ];

  const todayIso = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(cursor.y, cursor.m - 1, 1)),
  );

  return (
    <div className="tdg-planner-page tdg-planner-cal-page">
      <PlannerPageHeader title="Calendar" lede="See your season at a glance." />
      <PlannerSeg
        label="Calendar views"
        value={view}
        onChange={setView}
        options={[
          { id: "month", label: "Month" },
          { id: "agenda", label: "Agenda" },
        ]}
      />
      {view === "month" ? (
        <>
          <div className="tdg-planner-cal-nav">
            <button type="button" className="tdg-planner-btn" onClick={() => setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 }))}>
              Previous
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" className="tdg-planner-btn" onClick={() => setCursor((c) => (c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 }))}>
              Next
            </button>
          </div>
          <div className="tdg-planner-cal-weekdays" aria-hidden>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="tdg-planner-cal">
            {cells.map((cell, i) =>
              cell ? (
                <button
                  key={cell.iso}
                  type="button"
                  className={`${items.some((it) => it.on === cell.iso) ? "has" : ""} ${selected === cell.iso ? "on" : ""} ${cell.iso === todayIso ? "is-today" : ""}`}
                  onClick={() => setSelected(cell.iso)}
                >
                  <span>{cell.day}</span>
                  <span className="tdg-planner-cal-dots">
                    {items
                      .filter((it) => it.on === cell.iso)
                      .slice(0, 3)
                      .map((it) => (
                        <i key={`${it.kind}-${it.id}`} className={`dot-${it.kind === "gift_delivery" || it.kind === "gift_return" ? "delivery" : it.kind === "task" ? "task" : "event"}`} />
                      ))}
                  </span>
                </button>
              ) : (
                <span key={`e-${i}`} />
              ),
            )}
          </div>
        </>
      ) : null}
      {(view === "agenda" ? items : items.filter((it) => it.on === selected)).length === 0 ? (
        <PlannerEmptyState
          mark="calendar"
          title={selected ? "Nothing on this day yet." : "Pick a day, or switch to Agenda."}
          body="Add an event or a task so the calendar has a spine."
        />
      ) : (
        (view === "agenda" ? items : items.filter((it) => it.on === selected)).map((item) => (
          <div key={item.key} className="tdg-planner-row tdg-planner-appear">
            <div>
              {item.href ? (
                <Link to={item.href}>
                  <strong>{item.title}</strong>
                </Link>
              ) : (
                <strong>{item.title}</strong>
              )}
              <div className="tdg-planner-muted">
                {formatPlannerDate(item.on)} · {prettyLabel(item.kind)}
              </div>
            </div>
          </div>
        ))
      )}
      {selected ? (
        <PlannerComposer>
          <h2>Add on {formatPlannerDate(selected)}</h2>
          <input className="tdg-planner-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Event or task title" />
          <div className="tdg-planner-actions">
            <button
              type="button"
              className="tdg-planner-btn primary"
              onClick={async () => {
                if (!draft.trim()) return;
                const { data } = await supabase
                  .from("christmas_events")
                  .insert({ profile_id: profile.id, title: draft.trim().slice(0, 120), starts_on: selected, event_kind: "personal" })
                  .select("id,title,starts_on,event_kind")
                  .maybeSingle();
                if (data) setEvents((p) => [...p, data as (typeof events)[0]]);
                setDraft("");
                trackPlannerEvent("planner_event_created", { module: "calendar" });
              }}
            >
              Add event
            </button>
            <button
              type="button"
              className="tdg-planner-btn"
              onClick={async () => {
                if (!draft.trim()) return;
                await supabase.from("christmas_planner_tasks").insert({
                  profile_id: profile.id,
                  title: draft.trim().slice(0, 160),
                  due_on: selected,
                  category: "events",
                  status: "open",
                  origin: "user",
                });
                const next = await loadTasks(profile.id);
                setTasks(next);
                setDraft("");
                trackPlannerEvent("planner_task_added", { module: "calendar" });
              }}
            >
              Add task
            </button>
          </div>
        </PlannerComposer>
      ) : null}
    </div>
  );
}

export { ChristmasPlannerFoodPage, ChristmasPlannerRecipesPage, ChristmasPlannerGroceryPage } from "./food/FoodPages";

export function ChristmasPlannerHostingPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [guests, setGuests] = useState<Array<{ id: string; display_name: string; rsvp: string; dietary: string; sleeping: string; bringing: string }>>([]);
  const [draft, setDraft] = useState({ name: "", dietary: "", sleeping: "", bringing: "" });
  const [home, setHome] = useState<Array<{ id: string; title: string; area: string; status: string }>>([]);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      supabase.from("christmas_guests").select("id,display_name,rsvp,dietary,sleeping,bringing").eq("profile_id", profile.id),
      supabase.from("christmas_home_items").select("id,title,area,status").eq("profile_id", profile.id),
    ]).then(([g, h]) => {
      setGuests((g.data as typeof guests) || []);
      setHome((h.data as typeof home) || []);
    });
    trackPlannerEvent("planner_module_opened", { module: "hosting" });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading hosting…" />;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "hosting")) {
    return (
      <div className="tdg-planner-page">
        <PlannerPageHeader title="Hosting" lede="Guests, prep, and a calm house - no extra sensitive data." />
        <PlannerPaywall feature="hosting" title="Hosting, beautifully organized." body="Guests, RSVP, dietary notes, and rooms - no extra sensitive data." />
      </div>
    );
  }

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Hosting" lede="Guests, prep, and a calm house - no extra sensitive data." />
      <section className="tdg-planner-section">
        <h2>Guests</h2>
        <PlannerComposer>
        <input className="tdg-planner-input" placeholder="Name or household" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Dietary notes" value={draft.dietary} onChange={(e) => setDraft({ ...draft, dietary: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Sleeping" value={draft.sleeping} onChange={(e) => setDraft({ ...draft, sleeping: e.target.value })} />
        <input className="tdg-planner-input" placeholder="What they bring" value={draft.bringing} onChange={(e) => setDraft({ ...draft, bringing: e.target.value })} />
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            if (!draft.name.trim()) return;
            const { data } = await supabase
              .from("christmas_guests")
              .insert({
                profile_id: profile.id,
                display_name: draft.name.trim().slice(0, 80),
                dietary: draft.dietary.slice(0, 200),
                sleeping: draft.sleeping.slice(0, 120),
                bringing: draft.bringing.slice(0, 200),
                rsvp: "maybe",
              })
              .select("id,display_name,rsvp,dietary,sleeping,bringing")
              .maybeSingle();
            if (data) setGuests((p) => [...p, data as (typeof guests)[0]]);
            setDraft({ name: "", dietary: "", sleeping: "", bringing: "" });
            trackPlannerEvent("planner_guest_added", { module: "hosting" });
          }}
        >
          Add guest
        </button>
        </PlannerComposer>
        {guests.length === 0 ? (
          <PlannerEmptyState mark="home" title="No guests yet." body="Add the first household so RSVPs and dietary notes live here." />
        ) : null}
        {guests.map((g) => (
          <div key={g.id} className="tdg-planner-row">
            <div>
              <strong>{g.display_name}</strong>
              <div className="tdg-planner-muted">{[g.rsvp, g.dietary, g.sleeping, g.bringing].filter(Boolean).join(" · ")}</div>
            </div>
            <select
              className="tdg-planner-select"
              style={{ width: 120, margin: 0 }}
              value={g.rsvp}
              onChange={async (e) => {
                await supabase.from("christmas_guests").update({ rsvp: e.target.value }).eq("id", g.id);
                setGuests((p) => p.map((x) => (x.id === g.id ? { ...x, rsvp: e.target.value } : x)));
              }}
            >
              <option value="yes">yes</option>
              <option value="maybe">maybe</option>
              <option value="no">no</option>
            </select>
          </div>
        ))}
      </section>
      <section className="tdg-planner-section">
        <h2>Home preparation</h2>
        {["Guest room", "Bathroom", "Table", "Kitchen", "Cleaning"].map((title) => {
          const row = home.find((h) => h.title === title);
          return (
            <label key={title} className="tdg-planner-row">
              <span>{title}</span>
              <input
                type="checkbox"
                checked={row?.status === "done"}
                onChange={async (e) => {
                  if (row) {
                    await supabase.from("christmas_home_items").update({ status: e.target.checked ? "done" : "todo" }).eq("id", row.id);
                    setHome((p) => p.map((x) => (x.id === row.id ? { ...x, status: e.target.checked ? "done" : "todo" } : x)));
                  } else {
                    const { data } = await supabase
                      .from("christmas_home_items")
                      .insert({ profile_id: profile.id, title, area: "guest_rooms", status: e.target.checked ? "done" : "todo" })
                      .select("id,title,area,status")
                      .maybeSingle();
                    if (data) setHome((p) => [...p, data as (typeof home)[0]]);
                  }
                }}
              />
            </label>
          );
        })}
      </section>
    </div>
  );
}

export function ChristmasPlannerHomePage() {
  const { loading, profile } = usePlannerBundle();
  const [rows, setRows] = useState<Array<{ id: string; title: string; area: string; status: string }>>([]);
  const [draft, setDraft] = useState({ title: "", area: "tree" });

  useEffect(() => {
    if (!profile) return;
    void supabase.from("christmas_home_items").select("id,title,area,status").eq("profile_id", profile.id).then(({ data }) => setRows((data as typeof rows) || []));
    trackPlannerEvent("planner_module_opened", { module: "home" });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading home…" />;
  if (!profile) return <PlannerOnboarding />;

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Home" lede="Tree, rooms, and the little setups that make the house feel ready." />
      {rows.length === 0 ? (
        <PlannerEmptyState mark="home" title="The house is still a blank page." body="Add tree, lights, and rooms so Christmas feels ready." />
      ) : null}
      {HOME_AREAS.map((area) => (
        <section key={area} className="tdg-planner-section">
          <h2>{area.replace(/_/g, " ")}</h2>
          {rows
            .filter((r) => r.area === area)
            .map((r) => (
              <label key={r.id} className="tdg-planner-row">
                <span>{r.title}</span>
                <input
                  type="checkbox"
                  checked={r.status === "done"}
                  onChange={async (e) => {
                    await supabase.from("christmas_home_items").update({ status: e.target.checked ? "done" : "todo" }).eq("id", r.id);
                    setRows((p) => p.map((x) => (x.id === r.id ? { ...x, status: e.target.checked ? "done" : "todo" } : x)));
                  }}
                />
              </label>
            ))}
        </section>
      ))}
      <PlannerComposer>
        <input className="tdg-planner-input" placeholder="Buy tree, test lights…" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <select className="tdg-planner-select" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>
          {HOME_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            if (!draft.title.trim()) return;
            const { data } = await supabase
              .from("christmas_home_items")
              .insert({ profile_id: profile.id, title: draft.title.trim().slice(0, 120), area: draft.area, status: "todo" })
              .select("id,title,area,status")
              .maybeSingle();
            if (data) setRows((p) => [...p, data as (typeof rows)[0]]);
            setDraft({ title: "", area: draft.area });
          }}
        >
          Add
        </button>
      </PlannerComposer>
    </div>
  );
}

export function ChristmasPlannerTravelPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [trips, setTrips] = useState<Array<{ id: string; destination: string; start_on: string | null; end_on: string | null; booking_notes: string; packing: string; gifts_to_take: string; home_arrangements: string }>>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState({ destination: "", start: "", end: "", booking: "", packing: "", gifts: "", home: "", pets: "" });

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      supabase
        .from("christmas_trips")
        .select("id,destination,start_on,end_on,booking_notes,packing,gifts_to_take,home_arrangements")
        .eq("profile_id", profile.id),
      loadTasks(profile.id),
    ]).then(([tripRes, taskRows]) => {
      setTrips((tripRes.data as typeof trips) || []);
      setTasks(taskRows);
    });
    trackPlannerEvent("planner_module_opened", { module: "travel" });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading travel…" />;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "travel")) {
    return (
      <div className="tdg-planner-page">
        <PlannerPageHeader title="Travel" lede="Trips, packing, and home notes. Never passports or cards." />
        <PlannerPaywall feature="travel" title="Travel, without the paperwork panic." body="Trips, packing, and home notes. We never store passport or card data." />
      </div>
    );
  }

  const conflicts = detectTravelConflicts(
    buildPlannerSnapshot({
      profile,
      tasks,
      recipients: [],
      gifts: [],
      budgetEntries: [],
      trips: trips.map((t) => ({
        id: t.id,
        destination: t.destination,
        start_on: t.start_on,
        end_on: t.end_on,
        packing: t.packing || "",
        gifts_to_take: t.gifts_to_take || "",
      })),
    }),
  );

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Travel" lede="Trips, packing, and home notes. Never passports or cards." />
      {conflicts.length > 0 ? (
        <div className="tdg-intel-card tdg-intel-important">
          <h3>{conflicts.length} tasks conflict with your travel dates</h3>
          <p>Dates will not change until you apply suggestions.</p>
          <button type="button" className="tdg-planner-btn primary" onClick={() => setSheet(true)}>
            Review changes
          </button>
        </div>
      ) : null}
      <div className="tdg-planner-card">
        <input className="tdg-planner-input" placeholder="Destination" value={draft.destination} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} />
        <input className="tdg-planner-input" type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
        <input className="tdg-planner-input" type="date" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Booking note / reference" value={draft.booking} onChange={(e) => setDraft({ ...draft, booking: e.target.value })} />
        <textarea className="tdg-planner-area" placeholder="Packing list" value={draft.packing} onChange={(e) => setDraft({ ...draft, packing: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Gifts to take" value={draft.gifts} onChange={(e) => setDraft({ ...draft, gifts: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Home arrangements" value={draft.home} onChange={(e) => setDraft({ ...draft, home: e.target.value })} />
        <input className="tdg-planner-input" placeholder="Pet arrangements" value={draft.pets} onChange={(e) => setDraft({ ...draft, pets: e.target.value })} />
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            if (!draft.destination.trim()) return;
            const home = [draft.home, draft.pets ? `Pets: ${draft.pets}` : ""].filter(Boolean).join(" · ").slice(0, 500);
            const { data } = await supabase
              .from("christmas_trips")
              .insert({
                profile_id: profile.id,
                destination: draft.destination.trim().slice(0, 120),
                start_on: draft.start || null,
                end_on: draft.end || null,
                booking_notes: draft.booking.slice(0, 500),
                packing: draft.packing.slice(0, 1000),
                gifts_to_take: draft.gifts.slice(0, 500),
                home_arrangements: home,
              })
              .select("id,destination,start_on,end_on,booking_notes,packing,gifts_to_take,home_arrangements")
              .maybeSingle();
            if (data) setTrips((p) => [...p, data as (typeof trips)[0]]);
            setDraft({ destination: "", start: "", end: "", booking: "", packing: "", gifts: "", home: "", pets: "" });
          }}
        >
          Add trip
        </button>
      </div>
      {trips.length === 0 ? (
        <PlannerEmptyState mark="travel" title="No trips yet." body="Add a destination and dates. We never store passport or card data." />
      ) : (
        trips.map((t) => (
        <div key={t.id} className="tdg-planner-card">
          <strong>{t.destination}</strong>
          <div className="tdg-planner-muted">
            {[t.start_on, t.end_on].filter(Boolean).join(" → ")}
            {t.booking_notes ? ` · ${t.booking_notes}` : ""}
          </div>
          {t.packing ? <p>{t.packing}</p> : null}
          {t.gifts_to_take ? <p className="tdg-planner-muted">Gifts: {t.gifts_to_take}</p> : null}
          {t.home_arrangements ? <p className="tdg-planner-muted">{t.home_arrangements}</p> : null}
        </div>
        ))
      )}
      {sheet ? (
        <PlannerRecommendationSheet
          title="Move these tasks before your trip?"
          body="Nothing is changed until you apply."
          rows={conflicts.map((c) => ({ id: c.taskId, label: c.title, from: c.oldDate || "No date", to: c.suggestedDate }))}
          confirmLabel={`Apply ${conflicts.length} changes`}
          onCancel={() => setSheet(false)}
          onConfirm={() => {
            void executePlannerAction(
              { userId: profile.user_id, access, profile },
              {
                type: "reschedule_tasks",
                confirm: true,
                payload: { changes: conflicts.map((c) => ({ taskId: c.taskId, dueOn: c.suggestedDate })) },
              },
            ).then(async () => {
              setSheet(false);
              setTasks(await loadTasks(profile.id));
            });
          }}
        />
      ) : null}
    </div>
  );
}

const TRADITION_IDEAS: Record<string, string[]> = {
  family: ["Christmas market", "Movie night", "Drive to see lights", "Christmas photos"],
  kids: ["Bake cookies", "Letter to Santa", "Pajama night"],
  couple: ["Quiet dinner", "Lights walk"],
  friends: ["Cookie swap", "Carol evening"],
  kindness: ["Donate toys", "Neighbor treats"],
};

export function ChristmasPlannerTraditionsPage() {
  const { loading, profile } = usePlannerBundle();
  const [rows, setRows] = useState<Array<{ id: string; title: string; status: string; scheduled_on: string | null; notes: string }>>([]);

  useEffect(() => {
    if (!profile) return;
    void supabase.from("christmas_traditions").select("id,title,status,scheduled_on,notes").eq("profile_id", profile.id).then(({ data }) => setRows((data as typeof rows) || []));
    trackPlannerEvent("planner_module_opened", { module: "traditions" });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading traditions…" />;
  if (!profile) return <PlannerOnboarding />;

  async function saveIdea(title: string, section: string) {
    const { data } = await supabase
      .from("christmas_traditions")
      .insert({ profile_id: profile!.id, title: title.slice(0, 120), notes: section, status: "saved" })
      .select("id,title,status,scheduled_on,notes")
      .maybeSingle();
    if (data) setRows((p) => [...p, data as (typeof rows)[0]]);
    trackPlannerEvent("planner_activity_scheduled", { module: "traditions" });
  }

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Traditions" lede="Make time for what matters - family, kindness, and the small rituals." />
      {Object.entries(TRADITION_IDEAS).map(([section, ideas]) => (
        <section key={section} className="tdg-planner-section">
          <h2>{section}</h2>
          {ideas.map((idea) => (
            <div key={idea} className="tdg-planner-row">
              <span>{idea}</span>
              <button type="button" className="tdg-planner-btn" onClick={() => void saveIdea(idea, section)}>
                Save
              </button>
            </div>
          ))}
        </section>
      ))}
      {rows.map((r) => (
        <div key={r.id} className="tdg-planner-row">
          <div>
            <strong>{r.title}</strong>
            <div className="tdg-planner-muted">{r.status}{r.scheduled_on ? ` · ${r.scheduled_on}` : ""}</div>
          </div>
          <div className="tdg-planner-actions">
            <input
              className="tdg-planner-input"
              style={{ width: 150, margin: 0 }}
              type="date"
              value={r.scheduled_on || ""}
              onChange={async (e) => {
                await supabase.from("christmas_traditions").update({ scheduled_on: e.target.value || null, status: "scheduled" }).eq("id", r.id);
                setRows((p) => p.map((x) => (x.id === r.id ? { ...x, scheduled_on: e.target.value, status: "scheduled" } : x)));
              }}
            />
            <button
              type="button"
              className="tdg-planner-btn"
              onClick={async () => {
                await supabase.from("christmas_traditions").update({ status: "done" }).eq("id", r.id);
                setRows((p) => p.map((x) => (x.id === r.id ? { ...x, status: "done" } : x)));
              }}
            >
              Complete
            </button>
          </div>
        </div>
      ))}
    </div>
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

  if (loading) return <PlannerLoading label="Loading cards…" />;
  if (!profile) return <PlannerOnboarding />;

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Cards" lede="Track who needs a greeting. Creating a card, photo, or video uses separate credits and is not part of the $17 planner." />
      <PlannerStudioCue cues={cardsStudioCues()} />
      <div className="tdg-planner-actions" style={{ marginBottom: 12 }}>
        <Link className="tdg-planner-btn primary" to="/christmas/messages">
          Generate Message
        </Link>
        <Link className="tdg-planner-btn" to="/christmas/cards">
          Create Card
        </Link>
      </div>
      <PlannerComposer>
        <input className="tdg-planner-input" placeholder="Who needs a card?" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="tdg-planner-btn primary"
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
      </PlannerComposer>
      {rows.length === 0 ? (
        <PlannerEmptyState mark="star" title="No cards to track yet." body="Add who still needs a greeting. Making a card uses separate credits." />
      ) : null}
      {rows.map((r) => (
        <div key={r.id} className="tdg-planner-row">
          <div>
            <strong>{r.contact_name}</strong>
            <div className="tdg-planner-muted">{r.status}</div>
          </div>
          <select
            className="tdg-planner-select"
            style={{ width: 160, margin: 0 }}
            value={r.status}
            onChange={async (e) => {
              await supabase.from("christmas_card_tracker").update({ status: e.target.value }).eq("id", r.id);
              setRows((p) => p.map((x) => (x.id === r.id ? { ...x, status: e.target.value } : x)));
            }}
          >
            <option value="needed">Needs card</option>
            <option value="prepared">Card / message ready</option>
            <option value="sent">Sent</option>
          </select>
        </div>
      ))}
    </div>
  );
}

export function ChristmasPlannerMemoriesPage() {
  const { loading, profile } = usePlannerBundle();
  const [rows, setRows] = useState<Array<{ id: string; entry_kind: string; title: string; body: string }>>([]);
  const [draft, setDraft] = useState({ kind: "moment", title: "", body: "" });

  useEffect(() => {
    if (!profile) return;
    void supabase.from("christmas_memories").select("id,entry_kind,title,body").eq("profile_id", profile.id).then(({ data }) => setRows((data as typeof rows) || []));
    trackPlannerEvent("planner_module_opened", { module: "memories" });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading memories…" />;
  if (!profile) return <PlannerOnboarding />;

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Memories" lede="A quiet journal for this season, and a note for the next." />
      <PlannerStudioCue cues={memoriesStudioCues()} />
      <div className="tdg-planner-card">
        <select className="tdg-planner-select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
          <option value="photo_note">Photo</option>
          <option value="moment">Moment</option>
          <option value="meal">Favorite meal</option>
          <option value="tradition">Favorite tradition</option>
          <option value="next_year">Notes for next year</option>
        </select>
        <input className="tdg-planner-input" placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <textarea className="tdg-planner-area" placeholder="A note" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            const { data } = await supabase
              .from("christmas_memories")
              .insert({
                profile_id: profile.id,
                entry_kind: draft.kind,
                title: draft.title.slice(0, 120),
                body: draft.body.slice(0, 2000),
              })
              .select("id,entry_kind,title,body")
              .maybeSingle();
            if (data) setRows((p) => [data as (typeof rows)[0], ...p]);
            setDraft({ kind: draft.kind, title: "", body: "" });
          }}
        >
          Save memory
        </button>
      </div>
      {rows.length === 0 ? (
        <PlannerEmptyState mark="memory" title="No memories saved yet." body="Keep a quiet note for this season, or for next year." />
      ) : (
        rows.map((r) => (
          <div key={r.id} className="tdg-planner-card">
            <div className="tdg-planner-muted">{r.entry_kind}</div>
            <strong>{r.title || "Untitled"}</strong>
            <p>{r.body}</p>
          </div>
        ))
      )}
    </div>
  );
}

export function ChristmasPlannerClubPage() {
  useEffect(() => {
    trackPlannerEvent("planner_module_opened", { module: "club" });
  }, []);
  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Christmas Club" lede="The community feed is not live and is not included in Christmas Planner." />
      <p>Community posts aren’t live yet - we won’t fake an active feed. The $17 planner does not include this feed. Countdown updates stay on the separate Christmas Club page.</p>
      <div className="tdg-planner-actions" style={{ marginTop: 16 }}>
        <Link className="tdg-planner-btn primary" to={CHRISTMAS_CLUB_ROUTE}>
          Open Christmas Club
        </Link>
      </div>
    </div>
  );
}

export function ChristmasPlannerSettingsPage() {
  const { loading, profile, reload, access } = usePlannerBundle();
  const [form, setForm] = useState({
    hosting: false,
    travelling: false,
    currency: "eur",
    country_code: "US",
    prepared_level: "starting",
    total: "",
    confirmReset: false,
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      hosting: profile.hosting,
      travelling: profile.travelling,
      currency: profile.currency,
      country_code: profile.country_code,
      prepared_level: profile.prepared_level,
      total: profile.total_budget_minor ? String(profile.total_budget_minor / 100) : "",
      confirmReset: false,
    });
  }, [profile]);

  if (loading) return <PlannerLoading label="Loading settings…" />;
  if (!profile) return <PlannerOnboarding />;

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Settings" lede="Season preferences. This Planner is private - there is no share setting." />
      <div className="tdg-planner-card">
        <PlannerField label="Currency">
        <select className="tdg-planner-select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
          {["eur", "usd", "gbp", "ron"].map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>
        </PlannerField>
        <PlannerField label="Country">
        <input className="tdg-planner-input" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.slice(0, 8) })} placeholder="Country" />
        </PlannerField>
        <div className="tdg-planner-chips">
          <button type="button" className={`tdg-planner-chip ${form.hosting ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, hosting: !f.hosting }))}>
            Hosting
          </button>
          <button type="button" className={`tdg-planner-chip ${form.travelling ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, travelling: !f.travelling }))}>
            Travelling
          </button>
        </div>
        <PlannerField label="How prepared you feel">
        <select className="tdg-planner-select" value={form.prepared_level} onChange={(e) => setForm({ ...form, prepared_level: e.target.value })}>
          {["starting", "some", "mostly", "rescue"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        </PlannerField>
        <PlannerField label="Total budget">
        <input className="tdg-planner-input" type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="Total budget" />
        </PlannerField>
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            await supabase
              .from("christmas_planner_profiles")
              .update({
                hosting: form.hosting,
                travelling: form.travelling,
                currency: form.currency,
                country_code: form.country_code,
                prepared_level: form.prepared_level,
                total_budget_minor: form.total ? Number(form.total) * 100 : null,
              })
              .eq("id", profile.id);
            await reload();
            if (form.hosting) {
              invalidatePlannerSnapshot(profile.id);
              await executePlannerAction(
                { userId: profile.user_id, access, profile: { ...profile, hosting: true } },
                { type: "ensure_hosting_tasks", payload: {} },
              );
            }
          }}
        >
          Save
        </button>
      </div>
      <div className="tdg-planner-card">
        <h2>Reset planner</h2>
        <p className="tdg-planner-muted">Deletes this season’s private plan. Cannot be undone.</p>
        <label className="tdg-planner-row">
          <span>I understand</span>
          <input type="checkbox" checked={form.confirmReset} onChange={(e) => setForm({ ...form, confirmReset: e.target.checked })} />
        </label>
        <button
          type="button"
          className="tdg-planner-btn danger"
          disabled={!form.confirmReset}
          onClick={async () => {
            await supabase.from("christmas_planner_profiles").delete().eq("id", profile.id);
            await reload();
          }}
        >
          Reset this season
        </button>
      </div>
    </div>
  );
}

export function ChristmasPlannerWishlistBridgePage() {
  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Wishlist" lede="Your shareable list lives separately. Sharing it never shares this Planner." />
      <p>Your personal Christmas wishlist stays on the existing shareable list. Sharing wishlist does not share this Planner.</p>
      <Link className="tdg-planner-btn primary" to="/christmas/wishlist">
        Open My Wishlist
      </Link>
    </div>
  );
}

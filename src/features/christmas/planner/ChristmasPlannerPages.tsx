import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "./analytics";
import { answerFromContext } from "./assistant";
import { insertTask, loadBudget, loadGifts, loadRecipients, loadTasks } from "./api";
import { countdownCopy, daysUntilChristmas, isoDate, localDateParts, planModeLabel, resolvePlanMode } from "./date";
import { canAddCustomTask, canAddRecipient, hasFeature } from "./entitlements";
import { recommendedToday } from "./planGenerator";
import { computeReadiness } from "./readiness";
import { money, PlannerPaywall } from "./Paywall";
import { ASSISTANT_PROMPTS, TaskRow } from "./plannerUi";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import {
  BUDGET_CATEGORIES,
  GIFT_ITEM_STATUSES,
  TASK_CATEGORIES,
  type BudgetCategory,
  type BudgetEntry,
  type GiftItem,
  type GiftItemStatus,
  type GiftRecipient,
  type PlannerTask,
  type TaskCategory,
} from "./types";

export default function ChristmasPlannerTodayPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [budget, setBudget] = useState<BudgetEntry[]>([]);
  const [mealsCount, setMealsCount] = useState(0);
  const [quick, setQuick] = useState<"task" | "gift" | "event" | "meal" | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      loadTasks(profile.id),
      loadRecipients(profile.id),
      loadGifts(profile.id),
      loadBudget(profile.id),
      supabase.from("christmas_meals").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    ]).then(([t, r, g, b, meals]) => {
      setTasks(t);
      setRecipients(r);
      setGifts(g);
      setBudget(b);
      setMealsCount(meals.count || 0);
    });
  }, [profile?.id]);

  useEffect(() => {
    if (profile) trackPlannerEvent("planner_dashboard_viewed", { planMode: profile.plan_mode });
  }, [profile?.id]);

  if (loading) return <p className="tdg-planner-muted">Opening your Christmas…</p>;
  if (!profile) return <PlannerOnboarding />;

  const tz = profile.timezone;
  const daysLeft = daysUntilChristmas(new Date(), tz);
  const mode = resolvePlanMode(daysLeft, profile.prepared_level);
  const todayIso = isoDate(localDateParts(new Date(), tz));
  const todayTasks = recommendedToday(tasks.filter((t) => t.status === "open" || t.status === "rescheduled"), todayIso, 6);
  const readiness = computeReadiness({
    profile,
    tasks,
    recipients,
    gifts,
    mealsCount,
  });
  const plannedGifts = gifts.filter((g) => g.status !== "idea").length;
  const wrapped = gifts.filter((g) => g.status === "wrapped" || g.status === "given").length;
  const planned = budget.reduce((s, b) => s + b.planned_minor, 0) || profile.total_budget_minor || 0;
  const spent =
    budget.reduce((s, b) => s + b.spent_minor, 0) +
    gifts.reduce((s, g) => s + (g.actual_price_minor || 0), 0);
  const remaining = planned - spent;
  const nextUp = tasks
    .filter((t) => t.status === "open" && t.due_on && t.due_on > todayIso)
    .slice(0, 5);

  async function addQuick(event: FormEvent) {
    event.preventDefault();
    if (!profile || !draft.trim() || !quick) return;
    if (quick === "task") {
      const gate = canAddCustomTask(access, tasks.filter((t) => t.origin === "user").length, tasks.filter((t) => t.status === "open").length);
      if (!gate.ok) return;
      const row = await insertTask({
        profile_id: profile.id,
        title: draft.trim().slice(0, 160),
        category: "other",
        due_on: todayIso,
        status: "open",
        priority: "normal",
        notes: "",
        origin: "user",
        template_key: null,
      });
      if (row) {
        setTasks((p) => [...p, row]);
        trackPlannerEvent("planner_task_added", { module: "today" });
      }
    }
    if (quick === "gift") {
      const gate = canAddRecipient(access, recipients.length);
      if (!gate.ok) return;
      const { data } = await supabase
        .from("christmas_gift_recipients")
        .insert({ profile_id: profile.id, display_name: draft.trim().slice(0, 80), relationship: "other" })
        .select("*")
        .maybeSingle();
      if (data) {
        setRecipients((p) => [...p, data as GiftRecipient]);
        trackPlannerEvent("planner_recipient_added", { countBucket: String(recipients.length + 1) });
      }
    }
    if (quick === "event") {
      await supabase.from("christmas_events").insert({
        profile_id: profile.id,
        title: draft.trim().slice(0, 120),
        event_kind: "personal",
        starts_on: todayIso,
      });
      trackPlannerEvent("planner_event_created", { module: "today" });
    }
    if (quick === "meal") {
      await supabase.from("christmas_meals").insert({
        profile_id: profile.id,
        title: draft.trim().slice(0, 120),
        section: "christmas_day",
      });
      trackPlannerEvent("planner_meal_created", { module: "today" });
      setMealsCount((n) => n + 1);
    }
    setDraft("");
    setQuick(null);
  }

  return (
    <div>
      <header className="tdg-planner-hero">
        <p className="tdg-planner-muted">{planModeLabel(mode)}</p>
        <h1>{countdownCopy(daysLeft)}</h1>
        <p className="tdg-planner-ready">Your Christmas is {readiness.percent}% ready</p>
        <div className="tdg-planner-bar" aria-hidden>
          <span style={{ width: `${readiness.percent}%` }} />
        </div>
      </header>

      <section className="tdg-planner-section">
        <h2>Today</h2>
        {todayTasks.length === 0 ? (
          <p>You’re clear for today. Add a gift or a custom task when you’re ready.</p>
        ) : (
          todayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onChange={(next) => setTasks((prev) => (next ? prev.map((t) => (t.id === next.id ? next : t)) : prev.filter((t) => t.id !== task.id)))}
            />
          ))
        )}
      </section>

      <section className="tdg-planner-section">
        <h2>Next up</h2>
        {nextUp.length === 0 ? (
          <p className="tdg-planner-muted">No upcoming dates yet.</p>
        ) : (
          nextUp.map((t) => (
            <div key={t.id} className="tdg-planner-row">
              <div>
                <strong>{t.title}</strong>
                <div className="tdg-planner-muted">{t.due_on} · {t.category}</div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="tdg-planner-section">
        <div className="tdg-planner-stats">
          <div className="tdg-planner-stat">
            <span className="tdg-planner-muted">Gift status</span>
            <b>
              {recipients.length} {recipients.length === 1 ? "person" : "people"}
            </b>
            <span className="tdg-planner-muted">
              {plannedGifts} planned · {wrapped} wrapped
            </span>
          </div>
          <div className="tdg-planner-stat">
            <span className="tdg-planner-muted">Budget</span>
            <b>{money(spent, profile.currency)} spent</b>
            <span className="tdg-planner-muted">of {money(planned || 0, profile.currency)}</span>
          </div>
          {profile.hosting ? (
            <div className="tdg-planner-stat">
              <span className="tdg-planner-muted">Food / hosting</span>
              <b>{mealsCount} meals</b>
              <span className="tdg-planner-muted">{mealsCount ? "Menus started" : "Add Christmas Eve or Day"}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="tdg-planner-section">
        <h2>Quick add</h2>
        <div className="tdg-planner-actions">
          {(["task", "gift", "event", "meal"] as const).map((k) => (
            <button key={k} type="button" className={`tdg-planner-chip ${quick === k ? "on" : ""}`} onClick={() => setQuick(k)}>
              + {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        {quick ? (
          <form onSubmit={(e) => void addQuick(e)}>
            <input className="tdg-planner-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add ${quick}`} />
            <button type="submit" className="tdg-planner-btn primary">
              Add
            </button>
          </form>
        ) : null}
      </section>

      {!hasFeature(access, "planner_core") ? (
        <PlannerPaywall
          feature="planner_core"
          title="Free planner is ready — Core unlocks the full season"
          body="You have countdown, Today, a short plan, and up to 3 gift people. Core adds unlimited gifts, budget, rescue mode, and the date-aware plan."
        />
      ) : null}

      <AssistantPanel
        daysLeft={daysLeft}
        planMode={mode}
        readinessPercent={readiness.percent}
        openTasks={tasks.filter((t) => t.status === "open").length}
        recipientCount={recipients.length}
        giftsWithoutPlan={Math.max(0, recipients.length - new Set(gifts.filter((g) => g.status !== "idea").map((g) => g.recipient_id)).size)}
        budgetRemainingMinor={planned ? remaining : null}
        currency={profile.currency}
        hosting={profile.hosting}
      />
    </div>
  );
}

function AssistantPanel(props: Parameters<typeof answerFromContext>[1]) {
  const [q, setQ] = useState("What should I do this weekend?");
  const [a, setA] = useState<string | null>(null);
  useEffect(() => {
    trackPlannerEvent("planner_ai_opened", { module: "today" });
  }, []);
  return (
    <section className="tdg-planner-section">
      <h2>Ask Christmas AI</h2>
      <p className="tdg-planner-muted">Answers use your planner counts only. Private notes never leave this device.</p>
      <div className="tdg-planner-prompt">
        {ASSISTANT_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setQ(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
      <input className="tdg-planner-input" value={q} onChange={(e) => setQ(e.target.value.slice(0, 140))} />
      <button
        type="button"
        className="tdg-planner-btn primary"
        onClick={() => setA(answerFromContext(q, props).text)}
      >
        Ask
      </button>
      {a ? <p style={{ marginTop: 12, color: "inherit" }}>{a}</p> : null}
    </section>
  );
}

export function ChristmasPlannerPlanPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [view, setView] = useState<"today" | "week" | "all" | "calendar">("today");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("other");

  useEffect(() => {
    if (!profile) return;
    void loadTasks(profile.id).then(setTasks);
    trackPlannerEvent("planner_module_opened", { module: "plan" });
  }, [profile?.id]);

  if (loading) return <p>Loading plan…</p>;
  if (!profile) return <PlannerOnboarding />;

  const tz = profile.timezone;
  const todayIso = isoDate(localDateParts(new Date(), tz));
  const weekEnd = isoDate(localDateParts(new Date(Date.now() + 7 * 86400000), tz));
  const filtered = tasks.filter((t) => {
    if (view === "today") return t.status !== "skipped" && (t.due_on || todayIso) <= todayIso;
    if (view === "week") return t.status !== "skipped" && (t.due_on || todayIso) <= weekEnd;
    if (view === "calendar") return Boolean(t.due_on);
    return true;
  });

  async function addCustom() {
    if (!profile || !title.trim()) return;
    const gate = canAddCustomTask(
      access,
      tasks.filter((t) => t.origin === "user").length,
      tasks.filter((t) => t.status === "open").length,
    );
    if (!gate.ok) return;
    const row = await insertTask({
      profile_id: profile.id,
      title: title.trim().slice(0, 160),
      category,
      due_on: todayIso,
      status: "open",
      priority: "normal",
      notes: "",
      origin: "user",
      template_key: null,
    });
    if (row) {
      setTasks((prev) => [...prev, row]);
      setTitle("");
      trackPlannerEvent("planner_task_added", { module: "plan" });
    }
  }

  const byDate = useMemo(() => {
    const map = new Map<string, PlannerTask[]>();
    for (const task of filtered) {
      const key = task.due_on || "undated";
      map.set(key, [...(map.get(key) || []), task]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div>
      <h1>Plan</h1>
      <div className="tdg-planner-chips">
        {(["today", "week", "all", "calendar"] as const).map((v) => (
          <button key={v} type="button" className={`tdg-planner-chip ${view === v ? "on" : ""}`} onClick={() => setView(v)}>
            {v === "week" ? "This week" : v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <div className="tdg-planner-card">
        <input className="tdg-planner-input" placeholder="Add a custom task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="tdg-planner-select" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
          {TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" className="tdg-planner-btn primary" onClick={() => void addCustom()}>
          Add task
        </button>
      </div>
      {view === "calendar"
        ? byDate.map(([date, rows]) => (
            <section key={date} className="tdg-planner-section">
              <h2>{date}</h2>
              {rows.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onChange={(next) => setTasks((prev) => (next ? prev.map((t) => (t.id === next.id ? next : t)) : prev.filter((t) => t.id !== task.id)))}
                />
              ))}
            </section>
          ))
        : filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onChange={(next) => setTasks((prev) => (next ? prev.map((t) => (t.id === next.id ? next : t)) : prev.filter((t) => t.id !== task.id)))}
            />
          ))}
    </div>
  );
}

export function ChristmasPlannerGiftsPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("family");
  const [budget, setBudget] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [editing, setEditing] = useState<GiftItem | null>(null);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadRecipients(profile.id), loadGifts(profile.id)]).then(([r, g]) => {
      setRecipients(r);
      setGifts(g);
      setActiveId(r[0]?.id || null);
    });
    trackPlannerEvent("planner_module_opened", { module: "gifts" });
  }, [profile?.id]);

  if (loading) return <p>Loading gifts…</p>;
  if (!profile) return <PlannerOnboarding />;

  const active = recipients.find((r) => r.id === activeId) || recipients[0];
  const locked = !canAddRecipient(access, recipients.length).ok;

  async function addPerson() {
    if (!profile || !name.trim()) return;
    const gate = canAddRecipient(access, recipients.length);
    if (!gate.ok) {
      trackPlannerEvent("planner_paywall_viewed", { feature: "gift_planner" });
      return;
    }
    const { data } = await supabase
      .from("christmas_gift_recipients")
      .insert({
        profile_id: profile.id,
        display_name: name.trim().slice(0, 80),
        relationship: relation.slice(0, 40),
        budget_minor: budget ? Math.max(0, Number(budget) * 100) : null,
      })
      .select("*")
      .maybeSingle();
    if (data) {
      setRecipients((p) => [...p, data as GiftRecipient]);
      setActiveId((data as GiftRecipient).id);
      setName("");
      setBudget("");
      trackPlannerEvent("planner_recipient_added", { countBucket: String(recipients.length + 1) });
    }
  }

  async function addGift() {
    if (!profile || !active || !idea.trim()) return;
    const { data } = await supabase
      .from("christmas_gift_items")
      .insert({
        profile_id: profile.id,
        recipient_id: active.id,
        idea: idea.trim().slice(0, 200),
        status: "idea",
        source_type: "manual",
      })
      .select("*")
      .maybeSingle();
    if (data) {
      setGifts((p) => [...p, data as GiftItem]);
      setIdea("");
      trackPlannerEvent("planner_gift_added", { countBucket: "1" });
    }
  }

  const personGifts = gifts.filter((g) => g.recipient_id === active?.id);

  return (
    <div>
      <h1>Gifts</h1>
      <p className="tdg-planner-muted">People you need to buy for — not your public wishlist.</p>
      {!hasFeature(access, "gift_planner") ? (
        <p className="tdg-planner-muted">Free: up to 3 people.</p>
      ) : null}
      <div className="tdg-planner-split">
        <div>
          <div className="tdg-planner-card">
            <input className="tdg-planner-input" placeholder="Add a person" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="tdg-planner-input" placeholder="Relationship" value={relation} onChange={(e) => setRelation(e.target.value)} />
            <input className="tdg-planner-input" placeholder="Budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <button type="button" className="tdg-planner-btn primary" disabled={locked && !name} onClick={() => void addPerson()}>
              Add person
            </button>
          </div>
          <div className="tdg-planner-people">
            {recipients.map((r) => {
              const theirs = gifts.filter((g) => g.recipient_id === r.id);
              const planned = theirs.filter((g) => ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(g.status)).length;
              return (
                <button key={r.id} type="button" className={`tdg-planner-chip ${active?.id === r.id ? "on" : ""}`} onClick={() => setActiveId(r.id)}>
                  <strong>{r.display_name}</strong>
                  <div className="tdg-planner-muted">
                    {r.budget_minor != null ? money(r.budget_minor, profile.currency) : "No budget"} · {theirs.length} ideas · {planned} purchased
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {active ? (
          <div>
            <h2>{active.display_name}</h2>
            <p className="tdg-planner-muted">{active.relationship}</p>
            <input className="tdg-planner-input" placeholder="Gift idea" value={idea} onChange={(e) => setIdea(e.target.value)} />
            <div className="tdg-planner-actions">
              <button type="button" className="tdg-planner-btn primary" onClick={() => void addGift()}>
                Add idea
              </button>
              <Link className="tdg-planner-btn" to={`/christmas/gift-finder?plannerRecipient=${active.id}`}>
                Need an idea?
              </Link>
            </div>
            {personGifts.map((g) => (
              <div key={g.id} className="tdg-planner-card">
                <div className="tdg-planner-row">
                  <div>
                    <strong>{g.selected_gift || g.idea}</strong>
                    <div className="tdg-planner-muted">
                      {g.status}
                      {g.store ? ` · ${g.store}` : ""}
                      {g.planned_price_minor ? ` · ${money(g.planned_price_minor, profile.currency)}` : ""}
                    </div>
                  </div>
                  <select
                    className="tdg-planner-select"
                    style={{ width: 140, margin: 0 }}
                    value={g.status}
                    onChange={async (e) => {
                      const status = e.target.value as GiftItemStatus;
                      await supabase.from("christmas_gift_items").update({ status }).eq("id", g.id);
                      setGifts((p) => p.map((x) => (x.id === g.id ? { ...x, status } : x)));
                      trackPlannerEvent("planner_gift_status_changed", { module: "gifts" });
                    }}
                  >
                    {GIFT_ITEM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="tdg-planner-linkish" onClick={() => setEditing(g)}>
                  Details
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {editing ? (
        <GiftEditor
          gift={editing}
          currency={profile.currency}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setGifts((p) => p.map((x) => (x.id === next.id ? next : x)));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function GiftEditor({
  gift,
  currency,
  onClose,
  onSave,
}: {
  gift: GiftItem;
  currency: string;
  onClose: () => void;
  onSave: (g: GiftItem) => void;
}) {
  const [form, setForm] = useState(gift);
  return (
    <div className="tdg-planner-sheet">
      <button type="button" className="tdg-planner-sheet-backdrop" onClick={onClose} aria-label="Close" />
      <div className="tdg-planner-sheet-card">
        <div className="tdg-planner-sheet-head">
          <h2>Gift details</h2>
          <button type="button" className="tdg-planner-linkish" onClick={onClose}>
            Close
          </button>
        </div>
        <input className="tdg-planner-input" value={form.idea} onChange={(e) => setForm({ ...form, idea: e.target.value.slice(0, 200) })} placeholder="Idea" />
        <input className="tdg-planner-input" value={form.selected_gift} onChange={(e) => setForm({ ...form, selected_gift: e.target.value.slice(0, 200) })} placeholder="Selected gift" />
        <input className="tdg-planner-input" value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value || null })} placeholder="URL" />
        <input className="tdg-planner-input" value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value.slice(0, 80) })} placeholder="Store" />
        <input className="tdg-planner-input" type="number" placeholder="Planned price" value={form.planned_price_minor ? form.planned_price_minor / 100 : ""} onChange={(e) => setForm({ ...form, planned_price_minor: e.target.value ? Number(e.target.value) * 100 : null })} />
        <input className="tdg-planner-input" type="number" placeholder="Actual price" value={form.actual_price_minor ? form.actual_price_minor / 100 : ""} onChange={(e) => setForm({ ...form, actual_price_minor: e.target.value ? Number(e.target.value) * 100 : null })} />
        <input className="tdg-planner-input" type="date" value={form.delivery_on || ""} onChange={(e) => setForm({ ...form, delivery_on: e.target.value || null })} />
        <input className="tdg-planner-input" type="date" value={form.return_deadline || ""} onChange={(e) => setForm({ ...form, return_deadline: e.target.value || null })} />
        <input className="tdg-planner-input" value={form.hiding_place} onChange={(e) => setForm({ ...form, hiding_place: e.target.value.slice(0, 120) })} placeholder="Hiding place" />
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            await supabase
              .from("christmas_gift_items")
              .update({
                idea: form.idea,
                selected_gift: form.selected_gift,
                url: form.url,
                store: form.store,
                planned_price_minor: form.planned_price_minor,
                actual_price_minor: form.actual_price_minor,
                delivery_on: form.delivery_on,
                return_deadline: form.return_deadline,
                hiding_place: form.hiding_place,
              })
              .eq("id", form.id);
            onSave(form);
          }}
        >
          Save · {currency.toUpperCase()}
        </button>
      </div>
    </div>
  );
}

export function ChristmasPlannerMorePage() {
  useEffect(() => {
    trackPlannerEvent("planner_module_opened", { module: "more" });
  }, []);
  const items = [
    ["/account/christmas/budget", "Budget", "Season totals and simple expenses"],
    ["/account/christmas/calendar", "Calendar", "Tasks, events, deliveries"],
    ["/account/christmas/shopping", "Shopping", "To buy, ordered, arriving, returns"],
    ["/account/christmas/food", "Food", "Eve, Day, parties, drinks"],
    ["/account/christmas/recipes", "Recipes", "Original TDG recipes"],
    ["/account/christmas/grocery", "Grocery", "One list from meals and extras"],
    ["/account/christmas/hosting", "Hosting", "Guests, RSVP, rooms"],
    ["/account/christmas/home", "Home", "Tree, rooms, outdoor lights"],
    ["/account/christmas/travel", "Travel", "Trips and packing — no passport data"],
    ["/account/christmas/cards", "Cards", "Track, then open existing makers"],
    ["/christmas/wishlist", "Wishlist", "Your shareable list — separate from Planner"],
    ["/account/christmas/traditions", "Traditions", "Family, kids, kindness"],
    ["/account/christmas/memories", "Memories", "Notes for next year"],
    ["/account/christmas/club", "Christmas Club", "Countdown community"],
    ["/account/christmas/settings", "Settings", "Currency, hosting, reset"],
  ] as const;
  return (
    <div>
      <h1>More</h1>
      <div className="tdg-planner-more">
        {items.map(([href, label, desc]) => (
          <Link key={href} to={href}>
            <span aria-hidden>✦</span>
            <span>
              <strong>{label}</strong>
              <span className="desc">{desc}</span>
            </span>
            <span aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ChristmasPlannerBudgetPage() {
  const { loading, access, profile, reload } = usePlannerBundle();
  const [rows, setRows] = useState<BudgetEntry[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [total, setTotal] = useState("");
  const [expense, setExpense] = useState({ label: "", category: "other" as BudgetCategory, amount: "" });

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadBudget(profile.id), loadGifts(profile.id)]).then(([b, g]) => {
      setRows(b);
      setGifts(g);
    });
    setTotal(profile.total_budget_minor ? String(profile.total_budget_minor / 100) : "");
    trackPlannerEvent("planner_module_opened", { module: "budget" });
  }, [profile?.id]);

  if (loading) return <p>Loading budget…</p>;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "budget")) {
    return (
      <PlannerPaywall
        feature="budget"
        title="Budget is a paid module"
        body="See planned vs spent without spreadsheet complexity. Gift prices roll in automatically."
      />
    );
  }

  const giftSpent = gifts.reduce((s, g) => s + (g.actual_price_minor || 0), 0);
  const planned = (profile.total_budget_minor || 0) || rows.reduce((s, r) => s + r.planned_minor, 0);
  const spent = rows.reduce((s, r) => s + r.spent_minor, 0) + giftSpent;
  const remaining = planned - spent;

  async function ensureCategory(cat: BudgetCategory) {
    const existing = rows.find((r) => r.category === cat);
    if (existing) return existing;
    const { data } = await supabase
      .from("christmas_budget_entries")
      .insert({ profile_id: profile!.id, category: cat, label: cat, planned_minor: 0, spent_minor: 0, source_type: "manual" })
      .select("*")
      .maybeSingle();
    if (data) setRows((p) => [...p, data as BudgetEntry]);
    return data as BudgetEntry | null;
  }

  return (
    <div>
      <h1>Budget</h1>
      <section className="tdg-planner-section">
        <p className="tdg-planner-muted">Total Christmas budget</p>
        <input
          className="tdg-planner-input"
          type="number"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          onBlur={async () => {
            const minor = Math.max(0, Number(total || 0) * 100);
            await supabase.from("christmas_planner_profiles").update({ total_budget_minor: minor }).eq("id", profile.id);
            trackPlannerEvent("planner_budget_updated", { module: "budget" });
            await reload();
          }}
        />
        <div className="tdg-planner-stats">
          <div className="tdg-planner-stat">
            <span className="tdg-planner-muted">Spent</span>
            <b>{money(spent, profile.currency)}</b>
          </div>
          <div className="tdg-planner-stat">
            <span className="tdg-planner-muted">Remaining</span>
            <b>{money(remaining, profile.currency)}</b>
          </div>
        </div>
        <div className="tdg-planner-bar">
          <span style={{ width: `${planned ? Math.min(100, Math.round((spent / planned) * 100)) : 0}%` }} />
        </div>
      </section>
      {BUDGET_CATEGORIES.map((cat) => {
        const row = rows.find((r) => r.category === cat);
        const extra = cat === "gifts" ? giftSpent : 0;
        return (
          <div key={cat} className="tdg-planner-row">
            <div>
              <strong>{cat}</strong>
              <div className="tdg-planner-muted">
                {money((row?.spent_minor || 0) + extra, profile.currency)} of {money(row?.planned_minor || 0, profile.currency)}
              </div>
            </div>
            <input
              className="tdg-planner-input"
              style={{ width: 120, margin: 0 }}
              type="number"
              placeholder="Cap"
              defaultValue={row?.planned_minor ? row.planned_minor / 100 : ""}
              onBlur={async (e) => {
                const minor = Math.max(0, Number(e.target.value || 0) * 100);
                const current = row || (await ensureCategory(cat));
                if (!current) return;
                await supabase.from("christmas_budget_entries").update({ planned_minor: minor }).eq("id", current.id);
                setRows((p) => p.map((r) => (r.id === current.id ? { ...r, planned_minor: minor } : r)));
                trackPlannerEvent("planner_budget_updated", { module: "budget" });
              }}
            />
          </div>
        );
      })}
      <section className="tdg-planner-section">
        <h2>Add expense</h2>
        <input className="tdg-planner-input" placeholder="What did you buy?" value={expense.label} onChange={(e) => setExpense({ ...expense, label: e.target.value })} />
        <select className="tdg-planner-select" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value as BudgetCategory })}>
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input className="tdg-planner-input" type="number" placeholder="Amount" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            if (!expense.label.trim() || !expense.amount) return;
            const current = rows.find((r) => r.category === expense.category) || (await ensureCategory(expense.category));
            if (!current) return;
            const add = Math.max(0, Number(expense.amount) * 100);
            await supabase.from("christmas_budget_entries").update({ spent_minor: current.spent_minor + add, label: expense.label.slice(0, 80) }).eq("id", current.id);
            setRows((p) => p.map((r) => (r.id === current.id ? { ...r, spent_minor: r.spent_minor + add } : r)));
            setExpense({ label: "", category: expense.category, amount: "" });
            trackPlannerEvent("planner_budget_updated", { module: "budget" });
          }}
        >
          Add expense
        </button>
      </section>
    </div>
  );
}

export function ChristmasPlannerSimpleModule({
  module,
  title,
  feature,
  table,
  fields,
  addLabel,
  event,
}: {
  module: string;
  title: string;
  feature?: "food_planner" | "hosting" | "travel" | "recipes";
  table: string;
  fields: Array<{ key: string; placeholder: string }>;
  addLabel: string;
  event?: "planner_meal_created" | "planner_guest_added" | "planner_activity_scheduled" | "planner_recipe_saved";
}) {
  const { loading, access, profile } = usePlannerBundle();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    void supabase
      .from(table)
      .select("*")
      .eq("profile_id", profile.id)
      .then(({ data }) => setRows((data as Record<string, string>[]) || []));
    trackPlannerEvent("planner_module_opened", { module, feature });
  }, [profile?.id, table, module, feature]);

  if (loading) return <p>Loading…</p>;
  if (!profile) return <PlannerOnboarding />;
  if (feature && !hasFeature(access, feature)) {
    return <PlannerPaywall feature={feature} title={`${title} is included in a paid pack`} body="Unlock this module with the matching planner add-on." />;
  }

  return (
    <div>
      <h1>{title}</h1>
      <div className="tdg-planner-card">
        {fields.map((f) => (
          <input
            key={f.key}
            className="tdg-planner-input"
            placeholder={f.placeholder}
            value={draft[f.key] || ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
          />
        ))}
        <button
          type="button"
          className="tdg-planner-btn primary"
          onClick={async () => {
            const payload: Record<string, unknown> = { profile_id: profile.id };
            const mealSections = new Set(["christmas_eve", "christmas_day", "parties", "breakfast", "desserts", "drinks", "other"]);
            for (const f of fields) {
              let value = (draft[f.key] || "").slice(0, 120);
              if (f.key === "section") value = mealSections.has(value) ? value : "christmas_day";
              if (f.key === "area") {
                const areas = new Set(["tree", "living_room", "dining", "outside", "guest_rooms", "other"]);
                value = areas.has(value) ? value : "other";
              }
              if (f.key === "entry_kind") value = "moment";
              payload[f.key] = value;
            }
            const { data } = await supabase.from(table).insert(payload).select("*").maybeSingle();
            if (data) {
              setRows((p) => [...p, data as Record<string, string>]);
              setDraft({});
              if (event) trackPlannerEvent(event, { module });
            }
          }}
        >
          {addLabel}
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="tdg-planner-card">
          <strong>{row[fields[0].key] || title}</strong>
          <div className="tdg-planner-muted">{fields.slice(1).map((f) => row[f.key]).filter(Boolean).join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

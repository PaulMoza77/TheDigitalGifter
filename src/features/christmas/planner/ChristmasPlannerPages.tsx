import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "./analytics";
import { loadBudget, loadGifts, loadRecipients, loadTasks, PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import { countdownCopy, daysUntilChristmas, isoDate, localDateParts, planModeLabel, resolvePlanMode } from "./date";
import { recommendedToday } from "./planGenerator";
import { computeReadiness } from "./readiness";
import { hasFeature } from "./entitlements";
import { money, PlannerPaywall } from "./Paywall";
import { answerFromContext } from "./assistant";
import { patchTask } from "./api";
import type { BudgetEntry, GiftItem, GiftRecipient, PlannerTask } from "./types";

export default function ChristmasPlannerTodayPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [budget, setBudget] = useState<BudgetEntry[]>([]);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([
      loadTasks(profile.id),
      loadRecipients(profile.id),
      loadGifts(profile.id),
      loadBudget(profile.id),
    ]).then(([t, r, g, b]) => {
      setTasks(t);
      setRecipients(r);
      setGifts(g);
      setBudget(b);
    });
  }, [profile?.id]);

  useEffect(() => {
    if (profile) trackPlannerEvent("planner_dashboard_viewed", { planMode: profile.plan_mode });
  }, [profile?.id]);

  if (loading) {
    return <p className="tdg-planner-muted">Opening your Christmas…</p>;
  }
  if (!profile) return <PlannerOnboarding />;

  const tz = profile.timezone;
  const daysLeft = daysUntilChristmas(new Date(), tz);
  const mode = resolvePlanMode(daysLeft, profile.prepared_level);
  const todayIso = isoDate(localDateParts(new Date(), tz));
  const todayTasks = recommendedToday(tasks, todayIso, 3);
  const readiness = computeReadiness({
    profile,
    tasks,
    recipients,
    gifts,
    mealsCount: 0,
  });
  const giftProgress = recipients.length
    ? gifts.filter((g) => ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(g.status)).length
    : 0;
  const planned = budget.reduce((s, b) => s + b.planned_minor, 0) || profile.total_budget_minor || 0;
  const spent =
    budget.reduce((s, b) => s + b.spent_minor, 0) +
    gifts.reduce((s, g) => s + (g.actual_price_minor || 0), 0);
  const remaining = planned - spent;

  return (
    <div>
      <div className="tdg-planner-top">
        <span className="tdg-planner-brand">Command center</span>
        <Link to="/account/dashboard" className="tdg-planner-muted">
          Account
        </Link>
      </div>
      <header className="tdg-planner-hero">
        <h1>{countdownCopy(daysLeft)}</h1>
        <p className="tdg-planner-ready">Your Christmas is {readiness.percent}% ready</p>
        <div className="tdg-planner-bar" aria-hidden>
          <span style={{ width: `${readiness.percent}%` }} />
        </div>
        <p className="tdg-planner-muted" style={{ marginTop: 8 }}>
          {planModeLabel(mode)} · {readiness.parts.map((p) => `${p.label} ${Math.round(p.score * 100)}%`).join(" · ")}
        </p>
      </header>

      <section className="tdg-planner-card">
        <h2>Today</h2>
        <div className="tdg-planner-list">
          {todayTasks.length === 0 ? (
            <p>You’re clear for today. Add a gift or a custom task when you’re ready.</p>
          ) : (
            todayTasks.map((task) => (
              <div key={task.id} className="tdg-planner-row">
                <div>
                  <strong>{task.title}</strong>
                  <div className="tdg-planner-muted">
                    {task.category} · due {task.due_on}
                  </div>
                </div>
                <button
                  type="button"
                  className="tdg-planner-btn primary"
                  onClick={async () => {
                    await patchTask(task.id, { status: "done", completed_at: new Date().toISOString() } as Partial<PlannerTask>);
                    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)));
                    trackPlannerEvent("planner_task_completed", { module: "today" });
                  }}
                >
                  Done
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="tdg-planner-card">
        <h2>Progress</h2>
        <p>
          Gifts {giftProgress}/{recipients.length || 0} · Budget {money(remaining, profile.currency)} left · Tasks{" "}
          {tasks.filter((t) => t.status === "done").length}/{tasks.filter((t) => t.status !== "skipped").length}
        </p>
        {profile.hosting ? <p className="tdg-planner-muted">Hosting is on — meals count toward readiness.</p> : null}
      </section>

      <section className="tdg-planner-card">
        <h2>Upcoming</h2>
        <div className="tdg-planner-list">
          {tasks
            .filter((t) => t.status === "open" && t.due_on)
            .slice(0, 4)
            .map((t) => (
              <div key={t.id} className="tdg-planner-muted">
                {t.due_on} · {t.title}
              </div>
            ))}
        </div>
      </section>

      <section className="tdg-planner-card">
        <h2>Quick actions</h2>
        <div className="tdg-planner-actions">
          <Link className="tdg-planner-btn primary" to="/account/christmas/gifts">
            Add gift
          </Link>
          <Link className="tdg-planner-btn" to="/account/christmas/plan">
            Add task
          </Link>
          {hasFeature(access, "food_planner") ? (
            <Link className="tdg-planner-btn" to="/account/christmas/food">
              Plan meal
            </Link>
          ) : (
            <Link className="tdg-planner-btn" to="/account/christmas/food">
              Plan meal
            </Link>
          )}
          <Link className="tdg-planner-btn" to="/christmas/gift-finder">
            Gift Finder
          </Link>
          <Link className="tdg-planner-btn" to="/christmas/wishlist">
            Wishlist
          </Link>
        </div>
      </section>

      {!hasFeature(access, "planner_core") ? (
        <PlannerPaywall
          feature="planner_core"
          title="Free planner is ready — Core unlocks the full season"
          body="You have countdown, onboarding, a short plan, and up to 3 gift people. Core adds unlimited gifts, budget, rescue mode, and the date-aware plan."
        />
      ) : null}

      <AssistantCard
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

function AssistantCard(props: Parameters<typeof answerFromContext>[1]) {
  const [q, setQ] = useState("What should I do this weekend?");
  const [a, setA] = useState<string | null>(null);
  return (
    <section className="tdg-planner-card">
      <h2>Ask Christmas AI</h2>
      <p className="tdg-planner-muted">Answers use your planner counts only. Private notes never leave this device in V1.</p>
      <input className="tdg-planner-input" value={q} onChange={(e) => setQ(e.target.value.slice(0, 140))} />
      <button
        type="button"
        className="tdg-planner-btn"
        onClick={() => setA(answerFromContext(q, props).text)}
      >
        Ask
      </button>
      {a ? <p style={{ marginTop: 10 }}>{a}</p> : null}
    </section>
  );
}

export function ChristmasPlannerPlanPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [view, setView] = useState<"today" | "week" | "all" | "calendar">("today");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!profile) return;
    void loadTasks(profile.id).then(setTasks);
    trackPlannerEvent("planner_module_opened", { module: "plan" });
  }, [profile?.id]);

  if (loading) return <p>Loading plan…</p>;
  if (!profile) return <PlannerOnboarding />;

  const tz = profile.timezone;
  const todayIso = isoDate(localDateParts(new Date(), tz));
  const weekEnd = isoDate({
    ...localDateParts(new Date(Date.now() + 7 * 86400000), tz),
  });
  const filtered = tasks.filter((t) => {
    if (view === "today") return t.status === "open" && (t.due_on || todayIso) <= todayIso;
    if (view === "week") return t.status === "open" && (t.due_on || todayIso) <= weekEnd;
    return true;
  });

  async function addCustom() {
    if (!profile || !title.trim()) return;
    const { canAddCustomTask } = await import("./entitlements");
    const gate = canAddCustomTask(
      access,
      tasks.filter((t) => t.origin === "user").length,
      tasks.filter((t) => t.status === "open").length,
    );
    if (!gate.ok) return;
    const { data } = await supabase
      .from("christmas_planner_tasks")
      .insert({
        profile_id: profile.id,
        title: title.trim().slice(0, 160),
        category: "other",
        due_on: todayIso,
        status: "open",
        priority: "normal",
        origin: "user",
      })
      .select("*")
      .maybeSingle();
    if (data) {
      setTasks((prev) => [...prev, data as PlannerTask]);
      setTitle("");
    }
  }

  return (
    <div>
      <h1>Plan</h1>
      <div className="tdg-planner-chips">
        {(["today", "week", "all", "calendar"] as const).map((v) => (
          <button key={v} type="button" className={`tdg-planner-chip ${view === v ? "on" : ""}`} onClick={() => setView(v)}>
            {v === "week" ? "This week" : v === "all" ? "All tasks" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <div className="tdg-planner-card">
        <input className="tdg-planner-input" placeholder="Add a custom task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="tdg-planner-btn primary" onClick={() => void addCustom()}>
          Add task
        </button>
      </div>
      <div className="tdg-planner-list">
        {filtered.map((task) => (
          <div key={task.id} className="tdg-planner-card tdg-planner-row">
            <div>
              <strong>{task.title}</strong>
              <div className="tdg-planner-muted">
                {task.category} · {task.due_on} · {task.status}
              </div>
            </div>
            <div className="tdg-planner-actions">
              <button
                type="button"
                className="tdg-planner-btn primary"
                onClick={async () => {
                  await patchTask(task.id, { status: "done" });
                  setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)));
                  trackPlannerEvent("planner_task_completed", { module: "plan" });
                }}
              >
                Done
              </button>
              <button
                type="button"
                className="tdg-planner-btn"
                onClick={async () => {
                  await patchTask(task.id, { status: "skipped" });
                  setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, status: "skipped" } : t)));
                }}
              >
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChristmasPlannerGiftsPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

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

  async function addPerson() {
    if (!profile || !name.trim()) return;
    const { canAddRecipient } = await import("./entitlements");
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
        relationship: "other",
      })
      .select("*")
      .maybeSingle();
    if (data) {
      setRecipients((p) => [...p, data as GiftRecipient]);
      setActiveId((data as GiftRecipient).id);
      setName("");
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

  return (
    <div>
      <h1>Gifts I’m giving</h1>
      <p className="tdg-planner-muted">This is not your public wishlist. It’s the list of people you need to buy for.</p>
      {!hasFeature(access, "gift_planner") ? (
        <p className="tdg-planner-muted">Free: up to 3 people. Upgrade for the full gift planner.</p>
      ) : null}
      <div className="tdg-planner-card">
        <input className="tdg-planner-input" placeholder="Add a person" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="tdg-planner-btn primary" onClick={() => void addPerson()}>
          Add person
        </button>
      </div>
      <div className="tdg-planner-chips">
        {recipients.map((r) => (
          <button key={r.id} type="button" className={`tdg-planner-chip ${active?.id === r.id ? "on" : ""}`} onClick={() => setActiveId(r.id)}>
            {r.display_name}
          </button>
        ))}
      </div>
      {active ? (
        <div className="tdg-planner-card">
          <h2>{active.display_name}</h2>
          <input className="tdg-planner-input" placeholder="Gift idea" value={idea} onChange={(e) => setIdea(e.target.value)} />
          <div className="tdg-planner-actions">
            <button type="button" className="tdg-planner-btn primary" onClick={() => void addGift()}>
              Add idea
            </button>
            <Link className="tdg-planner-btn" to={`/christmas/gift-finder?plannerRecipient=${active.id}`}>
              Need an idea?
            </Link>
          </div>
          <div className="tdg-planner-list" style={{ marginTop: 12 }}>
            {gifts
              .filter((g) => g.recipient_id === active.id)
              .map((g) => (
                <div key={g.id} className="tdg-planner-row">
                  <div>
                    <strong>{g.selected_gift || g.idea}</strong>
                    <div className="tdg-planner-muted">{g.status}</div>
                  </div>
                  <select
                    className="tdg-planner-select"
                    style={{ width: 140, margin: 0 }}
                    value={g.status}
                    onChange={async (e) => {
                      const status = e.target.value;
                      await supabase.from("christmas_gift_items").update({ status }).eq("id", g.id);
                      setGifts((p) => p.map((x) => (x.id === g.id ? { ...x, status: status as GiftItem["status"] } : x)));
                    }}
                  >
                    {["idea", "planned", "ordered", "arrived", "hidden", "wrapped", "given"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ChristmasPlannerMorePage() {
  useEffect(() => {
    trackPlannerEvent("planner_module_opened", { module: "more" });
  }, []);
  const items = [
    ["/account/christmas/budget", "Budget"],
    ["/account/christmas/calendar", "Calendar"],
    ["/account/christmas/shopping", "Shopping"],
    ["/account/christmas/food", "Food"],
    ["/account/christmas/hosting", "Hosting"],
    ["/account/christmas/home", "Home"],
    ["/account/christmas/travel", "Travel"],
    ["/account/christmas/cards", "Cards"],
    ["/christmas/wishlist", "Wishlist"],
    ["/account/christmas/traditions", "Traditions"],
    ["/account/christmas/memories", "Memories"],
    ["/account/christmas/club", "Christmas Club"],
    ["/account/christmas/settings", "Settings"],
  ] as const;
  return (
    <div>
      <h1>More</h1>
      <div className="tdg-planner-card tdg-planner-more">
        {items.map(([href, label]) => (
          <Link key={href} to={href}>
            {label} <span aria-hidden>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ChristmasPlannerBudgetPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [rows, setRows] = useState<BudgetEntry[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadBudget(profile.id), loadGifts(profile.id)]).then(([b, g]) => {
      setRows(b);
      setGifts(g);
    });
    trackPlannerEvent("planner_module_opened", { module: "budget" });
  }, [profile?.id]);

  if (loading) return <p>Loading budget…</p>;
  if (!profile) return <PlannerOnboarding />;
  if (!hasFeature(access, "budget")) {
    trackPlannerEvent("planner_paywall_viewed", { feature: "budget" });
    return <PlannerPaywall feature="budget" title="Budget is a paid module" body="See planned vs spent without spreadsheet complexity. Gift prices roll in automatically." />;
  }

  const giftSpent = gifts.reduce((s, g) => s + (g.actual_price_minor || g.planned_price_minor || 0), 0);
  const planned = (profile.total_budget_minor || 0) || rows.reduce((s, r) => s + r.planned_minor, 0);
  const spent = rows.reduce((s, r) => s + r.spent_minor, 0) + giftSpent;
  const remaining = planned - spent;

  return (
    <div>
      <h1>Budget</h1>
      <div className="tdg-planner-card">
        <p>
          Planned {money(planned, profile.currency)} · Spent {money(spent, profile.currency)} · Remaining{" "}
          {money(remaining, profile.currency)}
        </p>
        <div className="tdg-planner-bar" style={{ marginTop: 12 }}>
          <span style={{ width: `${planned ? Math.min(100, Math.round((spent / planned) * 100)) : 0}%` }} />
        </div>
      </div>
      {["gifts", "food", "travel", "decor", "events", "clothing", "charity", "other"].map((cat) => {
        const row = rows.find((r) => r.category === cat);
        const extra = cat === "gifts" ? giftSpent : 0;
        return (
          <div key={cat} className="tdg-planner-card tdg-planner-row">
            <div>
              <strong>{cat}</strong>
              <div className="tdg-planner-muted">
                {money((row?.spent_minor || 0) + extra, profile.currency)} of {money(row?.planned_minor || 0, profile.currency)}
              </div>
            </div>
          </div>
        );
      })}
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
    return <PlannerPaywall feature={feature} title={`${title} is included in a paid pack`} body="Unlock this module with the matching planner add-on. Checkout uses the existing Christmas commerce system." />;
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
            const mealSections = new Set([
              "christmas_eve",
              "christmas_day",
              "parties",
              "breakfast",
              "desserts",
              "drinks",
              "other",
            ]);
            for (const f of fields) {
              let value = (draft[f.key] || "").slice(0, 120);
              if (f.key === "section") {
                value = mealSections.has(value) ? value : "christmas_day";
              }
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

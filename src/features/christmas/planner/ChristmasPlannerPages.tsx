import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "./analytics";
import { insertTask, loadGifts, loadTasks } from "./api";
import {
  executePlannerAction,
  invalidatePlannerSnapshot,
  loadDismissedInsightIds,
  loadPlannerWorkspace,
  runPlannerIntelligence,
  type PlannerIntelligence,
} from "./intelligence";
import { PlannerRecommendationSheet, PlannerRescueBanner } from "./intelligence/components";
import {
  countdownCopy,
  daysUntilChristmas,
  formatPlannerDate,
  plannerGreeting,
  taskCategoryLabel,
} from "./date";
import { giftPeopleLimit } from "./giftPeople";
import { plannerTodayIso, plannerWeekEndIso, taskWhen, tasksForView } from "./taskSchedule";
import { recommendedToday } from "./planGenerator";
import { bumpPlannerWorkspace, localReadinessPercent, publishPlannerReadiness } from "./workspaceSync";
import { canAddCustomTask, canAddRecipient, hasFeature } from "./entitlements";
import { computeReadiness } from "./readiness";
import { money, PlannerPaywall } from "./Paywall";
import { useCopilotUi } from "./copilot/CopilotHost";
import {
  PlannerComposer,
  PlannerEmptyState,
  PlannerLoading,
  PlannerModuleLinkRow,
  PlannerPageHeader,
  PlannerProgress,
  PlannerQuickAdd,
  PlannerSeg,
  PlannerSection,
  PlannerSnapshotRow,
  TaskRow,
} from "./plannerUi";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import {
  TASK_CATEGORIES,
  type GiftItem,
  type GiftRecipient,
  type PlannerTask,
  type TaskCategory,
} from "./types";

export default function ChristmasPlannerTodayPage() {
  const { loading, access, profile } = usePlannerBundle();
  const copilot = useCopilotUi();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [intel, setIntel] = useState<PlannerIntelligence | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [quick, setQuick] = useState<"task" | "gift" | "event" | "meal" | null>(null);
  const [draft, setDraft] = useState("");

  async function refreshIntelligence(nextProfile = profile, nextDismissed = dismissed) {
    if (!nextProfile) return;
    invalidatePlannerSnapshot(nextProfile.id);
    const snapshot = await loadPlannerWorkspace(nextProfile);
    const engine = runPlannerIntelligence(snapshot, nextDismissed);
    setIntel(engine);
    publishPlannerReadiness(engine.readiness.percent);
    setTasks(await loadTasks(nextProfile.id));
    setRecipients(
      snapshot.recipients.map((r) => ({
        id: r.id,
        profile_id: nextProfile.id,
        display_name: r.display_name,
        relationship: r.relationship,
        budget_minor: r.budget_minor,
        notes: "",
      })),
    );
    setGifts(await loadGifts(nextProfile.id));
    if (nextProfile.hosting && engine.hostingTaskKeysNeeded.length) {
      await executePlannerAction(
        { userId: nextProfile.user_id, access, profile: nextProfile },
        { type: "ensure_hosting_tasks", payload: {} },
      );
      invalidatePlannerSnapshot(nextProfile.id);
      const again = await loadPlannerWorkspace(nextProfile);
      const refreshed = runPlannerIntelligence(again, nextDismissed);
      setIntel(refreshed);
      publishPlannerReadiness(refreshed.readiness.percent);
      setTasks(await loadTasks(nextProfile.id));
    }
  }

  useEffect(() => {
    if (!profile) return;
    const stored = loadDismissedInsightIds(profile.id, profile.season_year);
    setDismissed(stored);
    void refreshIntelligence(profile, stored);
  }, [profile?.id]);

  useEffect(() => {
    if (profile) {
      trackPlannerEvent("planner_dashboard_viewed", {
        planMode: profile.plan_mode,
        metadata: { module: "today" },
      });
    }
  }, [profile?.id]);

  if (loading) return <PlannerLoading />;
  if (!profile) return <PlannerOnboarding />;

  const tz = profile.timezone;
  const now = new Date();
  const daysLeft = daysUntilChristmas(now, tz);
  const todayIso = plannerTodayIso(now, tz);
  const weekEnd = plannerWeekEndIso(now, tz);
  const readiness = intel?.readiness || computeReadiness({ profile, tasks, recipients, gifts });
  const overdue = tasks.filter((task) => taskWhen(task, todayIso, weekEnd) === "overdue");
  const dueToday = tasks.filter((task) => taskWhen(task, todayIso, weekEnd) === "today");
  const weekTasks = tasks.filter((task) => taskWhen(task, todayIso, weekEnd) === "week");
  const laterTasks = tasks.filter((task) => taskWhen(task, todayIso, weekEnd) === "later" && task.due_on);
  const priorities = recommendedToday([...overdue, ...dueToday, ...weekTasks], todayIso, 3, weekEnd);
  const priorityIds = new Set(priorities.map((task) => task.id));
  const thisWeek = weekTasks.filter((task) => !priorityIds.has(task.id)).slice(0, 3);
  const mealsCount = intel?.snapshot.meals.length || 0;
  const giftsWithoutPlan = Math.max(
    0,
    recipients.length - new Set(gifts.filter((g) => g.status !== "idea").map((g) => g.recipient_id)).size,
  );
  const spent = intel?.budget.spentMinor ?? gifts.reduce((s, g) => s + (g.actual_price_minor || 0), 0);
  const planned = profile.total_budget_minor || intel?.budget.forecastMinor || 0;
  const nextDeadline = [...dueToday, ...weekTasks, ...laterTasks].sort((a, b) => (a.due_on || "").localeCompare(b.due_on || ""))[0] || null;

  async function addQuick(event: FormEvent) {
    event.preventDefault();
    if (!profile || !draft.trim() || !quick) return;
    if (quick === "task") {
      const gate = canAddCustomTask(access, tasks.filter((t) => t.origin === "user").length, tasks.filter((t) => t.status === "open" || t.status === "rescheduled").length);
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
      const gate = canAddRecipient(access, giftPeopleLimit(access, recipients).giftPeople);
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
      await refreshIntelligence();
    }
    setDraft("");
    setQuick(null);
    bumpPlannerWorkspace();
  }

  const primary = intel?.nextBestAction || null;
  const giftPeople = giftPeopleLimit(access, recipients).giftPeople;
  const groceryNeed = (intel?.snapshot.grocery || []).filter((row) => row.status === "need").length;

  return (
    <div className="tdg-planner-today">
      <header className="tdg-planner-hero tdg-home-hero">
        <p className="tdg-planner-kicker">{plannerGreeting(now, tz)}</p>
        <h1>{countdownCopy(daysLeft)}</h1>
        <p className="tdg-planner-ready">{readiness.percent}% planned</p>
        <PlannerProgress value={readiness.percent} />
        <div className="tdg-home-modules">
          <Link to="/account/christmas/gifts">Gifts</Link>
          <Link to="/account/christmas/food">Meals</Link>
          <Link to="/account/christmas/grocery">Grocery</Link>
          <Link to="/account/christmas/plan">Tasks</Link>
          <Link to="/account/christmas/budget">Budget</Link>
        </div>
      </header>

      <div className="tdg-planner-dash">
        <div className="tdg-planner-today-main">
          {intel?.rescue.active ? <PlannerRescueBanner remaining={intel.rescue.essentialRemaining} /> : null}
          {primary ? (
            <section className="tdg-planner-section tdg-intel-nba">
              <p className="tdg-intel-kicker">Next</p>
              <h2>{primary.title}</h2>
              <p className="tdg-planner-muted">{primary.reason}</p>
              {primary.actionType === "review_reschedule" ? (
                <button type="button" className="tdg-planner-btn primary" onClick={() => setRescheduleOpen(true)}>
                  Review date changes
                </button>
              ) : primary.actionType === "ensure_hosting_tasks" ? (
                <button
                  type="button"
                  className="tdg-planner-btn primary"
                  onClick={() => {
                    void executePlannerAction(
                      { userId: profile.user_id, access, profile },
                      { type: "ensure_hosting_tasks", payload: {} },
                    ).then(() => refreshIntelligence());
                  }}
                >
                  Add hosting tasks
                </button>
              ) : (
                <Link className="tdg-planner-btn primary" to={primary.href}>
                  Continue
                </Link>
              )}
            </section>
          ) : (
            <p className="tdg-planner-muted">You are on track. Open a section only if you want to change something.</p>
          )}
          <PlannerSection
            title={overdue.length ? "Overdue and today" : "Today"}
            action={
              <PlannerQuickAdd
                open={quick}
                onOpen={setQuick}
                onClose={() => {
                  setQuick(null);
                  setDraft("");
                }}
                draft={draft}
                onDraft={setDraft}
                onSubmit={(e) => void addQuick(e)}
              />
            }
          >
            {priorities.length === 0 ? (
              <PlannerEmptyState
                title="Nothing is due today."
                body="Add a person, a meal, or a task when you are ready."
                action={
                  <div className="tdg-planner-actions">
                    <Link className="tdg-planner-btn primary" to="/account/christmas/gifts">
                      Add a person
                    </Link>
                    <Link className="tdg-planner-btn" to="/account/christmas/plan">
                      Open tasks
                    </Link>
                  </div>
                }
              />
            ) : (
              <div className="tdg-planner-list">
                {priorities.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onChange={(next) => {
                      const nextTasks = next ? tasks.map((t) => (t.id === next.id ? next : t)) : tasks.filter((t) => t.id !== task.id);
                      setTasks(nextTasks);
                      publishPlannerReadiness(
                        localReadinessPercent({
                          profile,
                          tasks: nextTasks,
                          recipients,
                          gifts,
                          mealsCount,
                        }),
                      );
                      bumpPlannerWorkspace();
                      void refreshIntelligence();
                    }}
                  />
                ))}
              </div>
            )}
          </PlannerSection>

          {thisWeek.length ? (
            <PlannerSection title="This week">
              <ol className="tdg-planner-week">
                {thisWeek.map((task) => (
                  <li key={task.id}>
                    <time dateTime={task.due_on || undefined}>{formatPlannerDate(task.due_on)}</time>
                    <span>{task.title}</span>
                  </li>
                ))}
              </ol>
              {laterTasks.length ? (
                <p className="tdg-planner-muted">{laterTasks.length} more {laterTasks.length === 1 ? "task is" : "tasks are"} later in the season.</p>
              ) : null}
            </PlannerSection>
          ) : null}
        </div>

        <aside className="tdg-planner-snapshot" aria-label="Season overview">
          <h2>This season</h2>
          <PlannerSnapshotRow
            label="Gifts"
            title={giftPeople === 0 ? "No one added yet." : `${giftPeople} ${giftPeople === 1 ? "person" : "people"}`}
            action={giftPeople === 0 ? "Add a person" : "Open gifts"}
            to="/account/christmas/gifts"
          />
          <PlannerSnapshotRow
            label="Budget"
            title={!planned ? "No total yet." : `${money(spent, profile.currency)} spent`}
            action={!planned ? "Set a total" : "Open budget"}
            to="/account/christmas/budget"
          />
          <PlannerSnapshotRow
            label="Meals"
            title={mealsCount === 0 ? "No menu yet." : `${mealsCount} ${mealsCount === 1 ? "meal" : "meals"}`}
            action={mealsCount === 0 ? "Plan a meal" : "Open meals"}
            to="/account/christmas/food"
          />
          <PlannerSnapshotRow
            label="Grocery"
            title={groceryNeed === 0 ? "Nothing left to buy." : `${groceryNeed} still needed`}
            action="Open grocery"
            to="/account/christmas/grocery"
          />
          <PlannerSnapshotRow
            label="Next date"
            title={nextDeadline ? `${formatPlannerDate(nextDeadline.due_on)} · ${nextDeadline.title}` : "No dated tasks yet"}
            action="Open tasks"
            to="/account/christmas/plan"
          />
        </aside>
      </div>

      {!hasFeature(access, "planner_core") ? (
        <PlannerPaywall
          feature="planner_core"
          title="Christmas Planner is $17"
          body="Free includes Today, a short task list, and 3 gift people. Christmas Planner is a one-time $17 payment for the full 2026 season, including meals, grocery, and budget. Cards, photos, and videos are separate. The Christmas Club feed is not included."
        />
      ) : null}

      {rescheduleOpen && intel?.travelConflicts.length ? (
        <PlannerRecommendationSheet
          title="Move these tasks before your trip?"
          body="Nothing changes until you apply. Your dates stay as they are if you keep them."
          rows={intel.travelConflicts.map((c) => ({
            id: c.taskId,
            label: c.title,
            from: c.oldDate || "No date",
            to: c.suggestedDate,
          }))}
          confirmLabel={`Apply ${intel.travelConflicts.length} changes`}
          onCancel={() => setRescheduleOpen(false)}
          onConfirm={() => {
            if (!profile) return;
            void executePlannerAction(
              { userId: profile.user_id, access, profile },
              {
                type: "reschedule_tasks",
                confirm: true,
                payload: {
                  changes: intel.travelConflicts.map((c) => ({ taskId: c.taskId, dueOn: c.suggestedDate })),
                },
              },
            ).then(() => {
              setRescheduleOpen(false);
              void refreshIntelligence();
            });
          }}
        />
      ) : null}

      <section className="tdg-planner-section tdg-copilot-today">
        <h2>Christmas Copilot</h2>
        <p className="tdg-planner-muted">Answers use what you have saved. A suggestion is not saved until you confirm it.</p>
        <div className="tdg-planner-prompt">
          {(giftsWithoutPlan > 0
            ? ["What gifts am I still missing?", "What should I do this weekend?", "What am I forgetting?"]
            : ["What should I do this weekend?", "What am I forgetting?", "Am I over budget?"]
          ).map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="tdg-planner-chip"
              onClick={() => copilot?.openCopilot(prompt, "today")}
            >
              {prompt}
            </button>
          ))}
        </div>
        <button type="button" className="tdg-planner-btn primary" onClick={() => copilot?.openCopilot(undefined, "today")}>
          Ask Copilot
        </button>
      </section>
    </div>
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

  if (loading) return <PlannerLoading label="Loading plan…" />;
  if (!profile) return <PlannerOnboarding />;

  const tz = profile.timezone;
  const now = new Date();
  const todayIso = plannerTodayIso(now, tz);
  const weekEnd = plannerWeekEndIso(now, tz);
  const filtered = tasksForView(tasks, view, todayIso, weekEnd);

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
      bumpPlannerWorkspace();
      trackPlannerEvent("planner_task_added", { module: "plan" });
    }
  }

  const onTaskChange = (task: PlannerTask, next: PlannerTask | null) =>
    setTasks((prev) => (next ? prev.map((t) => (t.id === next.id ? next : t)) : prev.filter((t) => t.id !== task.id)));

  const groups =
    view === "calendar"
      ? null
      : [
          { key: "Overdue", rows: filtered.filter((t) => taskWhen(t, todayIso, weekEnd) === "overdue") },
          { key: "Today", rows: filtered.filter((t) => taskWhen(t, todayIso, weekEnd) === "today") },
          { key: "This week", rows: filtered.filter((t) => taskWhen(t, todayIso, weekEnd) === "week") },
          { key: "Later", rows: filtered.filter((t) => taskWhen(t, todayIso, weekEnd) === "later") },
          { key: "Done", rows: filtered.filter((t) => taskWhen(t, todayIso, weekEnd) === "done") },
        ].filter((g) => g.rows.length);

  const byDateMap = new Map<string, PlannerTask[]>();
  for (const task of filtered) {
    const key = task.due_on || "undated";
    byDateMap.set(key, [...(byDateMap.get(key) || []), task]);
  }
  const byDate = [...byDateMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Tasks" lede="Overdue, today, this week, and later use the same dates as Today." />
      {profile.prepared_level === "rescue" || daysUntilChristmas(new Date(), profile.timezone) <= 7 ? (
        <p className="tdg-intel-kicker" style={{ marginBottom: 12 }}>
          Rescue focus is on - nice-to-have tasks stay listed, just lower.
        </p>
      ) : null}
      <PlannerSeg
        label="Plan views"
        value={view}
        onChange={setView}
        options={[
          { id: "today", label: "Today" },
          { id: "week", label: "This week" },
          { id: "all", label: "All" },
          { id: "calendar", label: "Calendar" },
        ]}
      />
      <PlannerComposer>
        <input className="tdg-planner-input" placeholder="Add a task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="tdg-planner-select" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} aria-label="Category">
          {TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {taskCategoryLabel(c)}
            </option>
          ))}
        </select>
        <button type="button" className="tdg-planner-btn primary" onClick={() => void addCustom()}>
          Add task
        </button>
      </PlannerComposer>
      {filtered.length === 0 ? (
        <PlannerEmptyState
          mark="plan"
          title="No tasks here yet."
          body="Add your own task or switch views to see your full Christmas plan."
        />
      ) : view === "calendar" ? (
        byDate.map(([date, rows]) => (
          <section key={date} className="tdg-planner-section">
            <h2>{date === "undated" ? "Undated" : formatPlannerDate(date)}</h2>
            {rows.map((task) => (
              <TaskRow key={task.id} task={task} onChange={(next) => onTaskChange(task, next)} />
            ))}
          </section>
        ))
      ) : (
        (groups || []).map((group) => (
          <section key={group.key} className="tdg-planner-section tdg-planner-appear">
            <h2>{group.key}</h2>
            {group.rows.map((task) => (
              <TaskRow key={task.id} task={task} onChange={(next) => onTaskChange(task, next)} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

export { ChristmasPlannerGiftsPage } from "./gifts/GiftsPage";

export function ChristmasPlannerMorePage() {
  useEffect(() => {
    trackPlannerEvent("planner_module_opened", { module: "more" });
  }, []);
  const groups = [
    {
      title: "Planning",
      items: [
        ["/account/christmas/budget", "Budget", "Track the season total", "budget"],
        ["/account/christmas/calendar", "Calendar", "See every date, task and delivery", "calendar"],
        ["/account/christmas/shopping", "Gift shopping", "Presents to buy, ordered, arriving, and returns", "shopping"],
      ],
    },
    {
      title: "Home & food",
      items: [
        ["/account/christmas/food", "Meals", "Occasion, guests, recipes, portions, then the menu", "food"],
        ["/account/christmas/recipes", "Recipes", "Save seasonal dishes", "food"],
        ["/account/christmas/grocery", "Grocery", "One food list from the menu. Not gift shopping.", "list"],
        ["/account/christmas/hosting", "Hosting", "Guests, prep and home", "home"],
        ["/account/christmas/home", "Home", "Tree, rooms and lights", "home"],
      ],
    },
    {
      title: "People",
      items: [
        ["/account/christmas/travel", "Travel", "Trips, packing and plans", "travel"],
        ["/account/christmas/cards", "Cards", "Track greetings. Card making is a separate credit.", "star"],
        ["/christmas/wishlist", "Wishlist", "Open your public wishlist", "gift"],
      ],
    },
    {
      title: "Account",
      items: [
        ["/account", "My account", "Credits, orders, and sign-out", "settings"],
        ["/generator", "Create", "Use your AI credits for an image or video", "star"],
      ],
    },
    {
      title: "Season extras",
      items: [
        ["/account/christmas/traditions", "Traditions", "Make time for what matters", "star"],
        ["/account/christmas/memories", "Memories", "Keep the season", "memory"],
        ["/account/christmas/club", "Christmas Club", "Feed is not live and is not part of the $17 planner.", "star"],
        ["/account/christmas/settings", "Settings", "Currency, hosting, reset", "settings"],
      ],
    },
  ] as const;
  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="More" lede="Everything else for your Christmas season." />
      {groups.map((group) => (
        <section key={group.title} className="tdg-planner-section">
          <p className="tdg-planner-kicker">{group.title}</p>
          <div className="tdg-planner-more">
            {group.items.map(([href, label, desc, mark]) => (
              <PlannerModuleLinkRow key={href} to={href} title={label} description={desc} mark={mark} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export { ChristmasPlannerBudgetPage } from "./BudgetPage";


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

  if (loading) return <PlannerLoading />;
  if (!profile) return <PlannerOnboarding />;
  if (feature && !hasFeature(access, feature)) {
    return <PlannerPaywall feature={feature} title={`${title} is part of Christmas Planner`} body="Christmas Planner is $17 once for the 2026 season. Cards, photos, and videos stay separate." />;
  }

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title={title} lede="A quiet place to keep this part of the season." />
      <PlannerComposer>
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
      </PlannerComposer>
      {rows.length === 0 ? (
        <PlannerEmptyState title="Nothing saved here yet." body="Add the first note above. It stays private to this Planner." />
      ) : (
        rows.map((row) => (
          <div key={row.id} className="tdg-planner-card">
            <strong>{row[fields[0].key] || title}</strong>
            <div className="tdg-planner-muted">{fields.slice(1).map((f) => row[f.key]).filter(Boolean).join(" · ")}</div>
          </div>
        ))
      )}
    </div>
  );
}

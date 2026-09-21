import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "./analytics";
import { insertTask, loadGifts, loadRecipients, loadTasks } from "./api";
import {
  executePlannerAction,
  invalidatePlannerSnapshot,
  loadDismissedInsightIds,
  loadPlannerWorkspace,
  runPlannerIntelligence,
  computeRecipientBudgets,
  formatPlannerMoney,
  type PlannerIntelligence,
} from "./intelligence";
import { PlannerRecommendationSheet, PlannerRescueBanner } from "./intelligence/components";
import {
  countdownCopy,
  daysUntilChristmas,
  formatPlannerDate,
  giftStatusLabel,
  plannerGreeting,
  prettyLabel,
  taskCategoryLabel,
} from "./date";
import { giftPeopleLimit, giftPeopleLimitCopy, isHouseholdGiftList } from "./giftPeople";
import { plannerTodayIso, plannerWeekEndIso, taskWhen, tasksForView } from "./taskSchedule";
import { recommendedToday } from "./planGenerator";
import { bumpPlannerWorkspace, localReadinessPercent, publishPlannerReadiness } from "./workspaceSync";
import { canAddCustomTask, canAddRecipient, hasFeature } from "./entitlements";
import { computeReadiness } from "./readiness";
import { GiftConcierge } from "./giftConcierge";
import { PlannerStudioCue, recipientStudioCues } from "./studio/PlannerStudioCue";
import { money, PlannerPaywall } from "./Paywall";
import { PlannerGiftOutboundLink, PlannerGiftPriceLabel } from "./PlannerGiftLink";
import { useCopilotUi } from "./copilot/CopilotHost";
import {
  PlannerComposer,
  PlannerEmptyState,
  PlannerModuleLinkRow,
  PlannerPageHeader,
  PlannerPanel,
  PlannerProgress,
  PlannerQuickAdd,
  PlannerSection,
  PlannerSnapshotRow,
  PlannerStat,
  PlannerStatusChip,
  TaskRow,
} from "./plannerUi";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import {
  GIFT_ITEM_STATUSES,
  TASK_CATEGORIES,
  type GiftItem,
  type GiftItemStatus,
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

  if (loading) return <p className="tdg-planner-muted">Opening your Christmas…</p>;
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

  if (loading) return <p className="tdg-planner-muted">Loading plan…</p>;
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
      <div className="tdg-planner-seg" role="tablist" aria-label="Plan views">
        {(["today", "week", "all", "calendar"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {v === "week" ? "This week" : v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
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

export function ChristmasPlannerGiftsPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [params] = useSearchParams();
  const [recipients, setRecipients] = useState<GiftRecipient[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("family");
  const [ageRange, setAgeRange] = useState("");
  const [interests, setInterests] = useState("");
  const [budget, setBudget] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [editing, setEditing] = useState<GiftItem | null>(null);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);
  const ideaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadRecipients(profile.id), loadGifts(profile.id)]).then(([r, g]) => {
      setRecipients(r);
      setGifts(g);
      const giftId = params.get("gift");
      const fromGift = giftId ? g.find((item) => item.id === giftId) : null;
      const people = r.filter((person) => !isHouseholdGiftList(person));
      const fromPerson = fromGift ? people.find((person) => person.id === fromGift.recipient_id) : null;
      setActiveId(fromPerson?.id || people[0]?.id || null);
      if (fromGift) setEditing(fromGift);
    });
    trackPlannerEvent("planner_module_opened", { module: "gifts" });
  }, [profile?.id]);

  if (loading) return <p className="tdg-planner-muted">Loading gifts…</p>;
  if (!profile) return <PlannerOnboarding />;

  const people = recipients.filter((person) => !isHouseholdGiftList(person));
  const limit = giftPeopleLimit(access, recipients);
  const active = people.find((person) => person.id === activeId) || people[0];

  async function addPerson() {
    if (!profile || !name.trim()) return;
    if (isHouseholdGiftList({ display_name: name })) {
      setPersonError("Household is reserved for general gift shopping. Choose another name, or add that item in Gift shopping.");
      return;
    }
    if (!limit.canAdd) {
      setPersonError(giftPeopleLimitCopy(limit));
      trackPlannerEvent("planner_paywall_viewed", { feature: "gift_planner" });
      return;
    }
    const { data, error } = await supabase
      .from("christmas_gift_recipients")
      .insert({
        profile_id: profile.id,
        display_name: name.trim().slice(0, 80),
        relationship: relation.slice(0, 40) || "family",
        budget_minor: budget ? Math.max(0, Number(budget) * 100) : null,
        notes: [ageRange.trim() && `Age ${ageRange.trim()}`, interests.trim() && `Likes ${interests.trim()}`]
          .filter(Boolean)
          .join(". ")
          .slice(0, 400),
      })
      .select("*")
      .maybeSingle();
    if (error || !data) {
      setPersonError(String(error?.message || "").includes("free_recipient_limit") ? giftPeopleLimitCopy(limit) : "Could not add this person.");
      return;
    }
    setRecipients((p) => [...p, data as GiftRecipient]);
    setActiveId((data as GiftRecipient).id);
    setName("");
    setRelation("family");
    setAgeRange("");
    setInterests("");
    setBudget("");
    setPersonError(null);
    setPersonOpen(false);
    bumpPlannerWorkspace();
    trackPlannerEvent("planner_recipient_added", { countBucket: String(limit.giftPeople + 1) });
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
      bumpPlannerWorkspace();
      trackPlannerEvent("planner_gift_added", { countBucket: "1" });
    }
  }

  const personGifts = gifts.filter((g) => g.recipient_id === active?.id);
  const budgets = computeRecipientBudgets({ recipients, gifts });
  const ideas = gifts.filter((g) => g.status === "idea").length;
  const ordered = gifts.filter((g) => g.status === "ordered").length;
  const wrappedCount = gifts.filter((g) => g.status === "wrapped" || g.status === "given").length;

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Gifts" lede="People first. Each gift shows its status and what it does to their budget.">
        {!limit.paid ? <p className="tdg-planner-muted" data-testid="gift-people-limit">{giftPeopleLimitCopy(limit)}</p> : null}
      </PlannerPageHeader>
      <div className="tdg-planner-summary">
        <PlannerStat label="People" value={String(limit.giftPeople)} hint={limit.giftPeople === 1 ? "on your list" : "on your list"} />
        <PlannerStat label="Ideas" value={String(ideas)} hint="still deciding" />
        <PlannerStat label="Ordered" value={String(ordered)} hint="in motion" />
        <PlannerStat label="Wrapped" value={String(wrappedCount)} hint="ready to give" />
      </div>
      <div className="tdg-planner-split tdg-planner-gifts">
        <div>
          <div className="tdg-planner-actions">
            <button
              type="button"
              className="tdg-planner-btn primary"
              disabled={!limit.canAdd}
              onClick={() => {
                setPersonError(limit.canAdd ? null : giftPeopleLimitCopy(limit));
                if (limit.canAdd) setPersonOpen(true);
              }}
            >
              Add person
            </button>
            <Link className="tdg-planner-btn" to="/account/christmas/shopping">
              Gift shopping
            </Link>
          </div>
          {personError && !personOpen ? <p className="tdg-planner-muted" role="alert">{personError}</p> : null}
          <div className="tdg-planner-people">
            {people.length === 0 ? (
              <PlannerEmptyState
                mark="gift"
                title="Start with one person."
                body="Add who you are buying for. Status and budget stay on their card."
              />
            ) : (
              people.map((r) => {
                const theirs = gifts.filter((g) => g.recipient_id === r.id);
                const planned = theirs.filter((g) => ["planned", "ordered", "arrived", "hidden", "wrapped", "given"].includes(g.status)).length;
                const wrapped = theirs.filter((g) => g.status === "wrapped" || g.status === "given").length;
                const pct = theirs.length ? Math.round((wrapped / theirs.length) * 100) : 0;
                const budgetRow = budgets.find((b) => b.recipientId === r.id);
                return (
                  <button key={r.id} type="button" className={`tdg-planner-person ${active?.id === r.id ? "on" : ""}`} onClick={() => setActiveId(r.id)}>
                    <strong>{r.display_name}</strong>
                    <div className="tdg-planner-muted">{prettyLabel(r.relationship || "Person")}</div>
                    <div className="tdg-planner-gift-meta">
                      <span>{theirs.length} gifts</span>
                      <span>{planned} in motion</span>
                      <span className={`tdg-intel-spend is-${budgetRow?.status || "no_budget"}`}>
                        {budgetRow?.budgetMinor != null
                          ? `${formatPlannerMoney(budgetRow.committedMinor, profile.currency)} of ${formatPlannerMoney(budgetRow.budgetMinor, profile.currency)}`
                          : "No budget"}
                      </span>
                    </div>
                    <PlannerProgress value={pct} compact />
                  </button>
                );
              })
            )}
          </div>
        </div>
        {active ? (
          <PlannerPanel>
            {(() => {
              const row = budgets.find((b) => b.recipientId === active.id);
              const remaining = row?.remainingMinor;
              const usedPct =
                row?.budgetMinor && row.budgetMinor > 0
                  ? Math.min(100, Math.round((row.committedMinor / row.budgetMinor) * 100))
                  : 0;
              return (
                <>
                  <h2>{active.display_name}</h2>
                  <p className="tdg-planner-muted">{prettyLabel(active.relationship || "Family")}</p>
                  <div className="tdg-planner-recipient-summary">
                    <PlannerStat
                      label="Budget"
                      value={row?.budgetMinor != null ? formatPlannerMoney(row.budgetMinor, profile.currency) : "-"}
                      hint="for this person"
                    />
                    <PlannerStat
                      label="Planned"
                      value={formatPlannerMoney(row?.committedMinor || 0, profile.currency)}
                      hint="committed so far"
                    />
                    <PlannerStat
                      label="Remaining"
                      value={remaining == null ? "-" : formatPlannerMoney(Math.max(0, remaining), profile.currency)}
                      hint={remaining != null && remaining < 0 ? "over budget" : "left to spend"}
                    />
                    <PlannerStat label="Gifts" value={String(personGifts.length)} hint={personGifts.length === 1 ? "on their list" : "on their list"} />
                  </div>
                  {row?.budgetMinor != null ? (
                    <div className="tdg-planner-recipient-bar">
                      <PlannerProgress value={usedPct} />
                      <p className="tdg-planner-muted">
                        {formatPlannerMoney(row.committedMinor, profile.currency)} planned of {formatPlannerMoney(row.budgetMinor, profile.currency)}
                        {remaining != null ? ` · ${formatPlannerMoney(Math.max(0, remaining), profile.currency)} remaining` : ""}
                      </p>
                    </div>
                  ) : null}
                </>
              );
            })()}
            <PlannerStudioCue
              cues={recipientStudioCues({ hasChildren: profile.has_children, relationship: active.relationship })}
            />
            <PlannerComposer>
              <input
                ref={ideaRef}
                className="tdg-planner-input"
                placeholder="Gift idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
              />
              <div className="tdg-planner-actions">
                <button type="button" className="tdg-planner-btn primary" onClick={() => void addGift()}>
                  + Add idea
                </button>
                <button type="button" className="tdg-planner-btn" onClick={() => setConciergeOpen(true)}>
                  Find gifts
                </button>
              </div>
            </PlannerComposer>
            {personGifts.length === 0 ? (
              <PlannerEmptyState
                mark="gift"
                title={`Nothing planned for ${active.display_name} yet.`}
                body="Find the first idea or add one yourself."
                action={
                  <div className="tdg-planner-actions">
                    <button type="button" className="tdg-planner-btn primary" onClick={() => setConciergeOpen(true)}>
                      Find an idea
                    </button>
                    <button type="button" className="tdg-planner-btn" onClick={() => ideaRef.current?.focus()}>
                      Add manually
                    </button>
                  </div>
                }
              />
            ) : (
              personGifts.map((g) => (
                <div key={g.id} className="tdg-planner-gift-row">
                  <div>
                    <strong>{g.selected_gift || g.idea}</strong>
                    <div className="tdg-planner-gift-meta">
                      <PlannerStatusChip tone={g.status === "wrapped" || g.status === "given" ? "done" : "gold"}>{giftStatusLabel(g.status)}</PlannerStatusChip>
                      {g.store ? <span>{g.store}</span> : null}
                      <PlannerGiftPriceLabel gift={g} currency={profile.currency} />
                      {g.actual_price_minor ? <span>paid {formatPlannerMoney(g.actual_price_minor, profile.currency)}</span> : null}
                    </div>
                    {g.url ? <PlannerGiftOutboundLink gift={g} source="gifts" /> : null}
                  </div>
                  <select
                    className="tdg-planner-select"
                    style={{ width: 140, margin: 0 }}
                    value={g.status}
                    aria-label={`Status for ${g.selected_gift || g.idea}`}
                    onChange={async (e) => {
                      const status = e.target.value as GiftItemStatus;
                      await supabase.from("christmas_gift_items").update({ status }).eq("id", g.id);
                      const nextGifts = gifts.map((x) => (x.id === g.id ? { ...x, status } : x));
                      setGifts(nextGifts);
                      bumpPlannerWorkspace();
                      trackPlannerEvent("planner_gift_status_changed", { module: "gifts" });
                    }}
                  >
                    {GIFT_ITEM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {giftStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="tdg-planner-linkish" onClick={() => setEditing(g)}>
                    Details
                  </button>
                </div>
              ))
            )}
          </PlannerPanel>
        ) : null}
      </div>
      {personOpen ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="add-person-title">
          <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close add person" onClick={() => setPersonOpen(false)} />
          <form
            className="tdg-planner-sheet-card"
            onSubmit={(event) => {
              event.preventDefault();
              void addPerson();
            }}
          >
            <div className="tdg-planner-sheet-head">
              <h2 id="add-person-title">Add person</h2>
              <button type="button" className="tdg-planner-btn ghost" onClick={() => setPersonOpen(false)}>
                Close
              </button>
            </div>
            <label>
              Name
              <input className="tdg-planner-input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            <label>
              Relationship
              <input className="tdg-planner-input" value={relation} onChange={(e) => setRelation(e.target.value)} />
            </label>
            <label>
              Age range
              <span className="tdg-planner-muted">Optional</span>
              <input className="tdg-planner-input" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
            </label>
            <label>
              Interests
              <span className="tdg-planner-muted">Optional</span>
              <input className="tdg-planner-input" value={interests} onChange={(e) => setInterests(e.target.value)} />
            </label>
            <label>
              Budget
              <span className="tdg-planner-muted">Optional, in {profile.currency.toUpperCase()}</span>
              <input className="tdg-planner-input" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </label>
            {personError ? <p role="alert">{personError}</p> : null}
            <button type="submit" className="tdg-planner-btn primary">
              Save person
            </button>
          </form>
        </div>
      ) : null}
      {active && conciergeOpen ? (
        <GiftConcierge
          open={conciergeOpen}
          recipient={active}
          gifts={gifts}
          profileId={profile.id}
          currency={profile.currency}
          countryCode={profile.country_code}
          locale={profile.locale}
          onClose={() => setConciergeOpen(false)}
          onAdded={(gift) => {
            setGifts((p) => (p.some((x) => x.id === gift.id) ? p : [...p, gift]));
          }}
          onAddManually={() => {
            setConciergeOpen(false);
            requestAnimationFrame(() => ideaRef.current?.focus());
          }}
        />
      ) : null}
      {editing ? (
        <GiftEditor
          gift={editing}
          currency={profile.currency}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setGifts((p) => p.map((x) => (x.id === next.id ? next : x)));
            setEditing(null);
            bumpPlannerWorkspace();
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
        <input className="tdg-planner-input" value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value || null })} placeholder="Product link" />
        {form.url ? <PlannerGiftOutboundLink gift={form} source="gift_editor" /> : null}
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
                source_meta: form.source_meta,
                image_url: form.image_url,
                price_checked_at: form.price_checked_at,
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

  if (loading) return <p>Loading…</p>;
  if (!profile) return <PlannerOnboarding />;
  if (feature && !hasFeature(access, feature)) {
    return <PlannerPaywall feature={feature} title={`${title} is part of Christmas Planner`} body="Christmas Planner is $17 once for the 2026 season. Cards, photos, and videos stay separate." />;
  }

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title={title} lede="A quiet place to keep this part of the season." />
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

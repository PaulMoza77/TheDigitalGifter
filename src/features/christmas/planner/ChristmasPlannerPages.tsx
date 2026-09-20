import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "./analytics";
import { insertTask, loadBudget, loadGifts, loadRecipients, loadTasks } from "./api";
import {
  dismissInsight,
  executePlannerAction,
  invalidatePlannerSnapshot,
  loadDismissedInsightIds,
  loadPlannerWorkspace,
  runPlannerIntelligence,
  computeRecipientBudgets,
  computeBudgetTotals,
  formatPlannerMoney,
  buildPlannerSnapshot,
  type PlannerIntelligence,
} from "./intelligence";
import {
  PlannerAttentionList,
  PlannerNextBestAction,
  PlannerOnTrackState,
  PlannerReadinessBreakdown,
  PlannerRecommendationSheet,
  PlannerRescueBanner,
} from "./intelligence/components";
import {
  countdownCopy,
  daysUntilChristmas,
  formatPlannerDate,
  giftStatusLabel,
  isoDate,
  localDateParts,
  planModeLabel,
  prettyLabel,
  resolvePlanMode,
  taskCategoryLabel,
} from "./date";
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

function buildMiniBudgetSnapshot(profile: import("./types").PlannerProfile, gifts: GiftItem[], rows: BudgetEntry[]) {
  return buildPlannerSnapshot({
    profile,
    tasks: [],
    recipients: [],
    gifts,
    budgetEntries: rows,
  });
}

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
      setIntel(runPlannerIntelligence(again, nextDismissed));
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
  const daysLeft = daysUntilChristmas(new Date(), tz);
  const mode = intel?.snapshot.planMode || resolvePlanMode(daysLeft, profile.prepared_level);
  const todayIso = isoDate(localDateParts(new Date(), tz));
  const readiness = intel?.readiness || computeReadiness({ profile, tasks, recipients, gifts });
  const todayIds = new Set((intel?.todayPriorities || []).map((t) => t.id));
  const todayTasks = (intel?.todayPriorities || [])
    .map((row) => tasks.find((t) => t.id === row.id))
    .filter((t): t is PlannerTask => Boolean(t));
  const thisWeek = tasks
    .filter((t) => t.status === "open" && t.due_on && t.due_on >= todayIso && !todayIds.has(t.id))
    .slice(0, 6);
  const mealsCount = intel?.snapshot.meals.length || 0;
  const plannedGifts = gifts.filter((g) => g.status !== "idea").length;
  const wrapped = gifts.filter((g) => g.status === "wrapped" || g.status === "given").length;
  const giftsWithoutPlan = Math.max(
    0,
    recipients.length - new Set(gifts.filter((g) => g.status !== "idea").map((g) => g.recipient_id)).size,
  );
  const spent = intel?.budget.spentMinor ?? gifts.reduce((s, g) => s + (g.actual_price_minor || 0), 0);
  const remaining = intel?.budget.remainingMinor;
  const planned = profile.total_budget_minor || intel?.budget.forecastMinor || 0;
  const nextDeadline = tasks.find((t) => t.status === "open" && t.due_on) || null;
  const upcomingCount = tasks.filter((t) => t.status === "open" && t.due_on).length;
  const attention = intel?.attention || [];
  const onTrack = Boolean(intel && attention.length === 0 && !intel.rescue.active);

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
      await refreshIntelligence();
    }
    setDraft("");
    setQuick(null);
  }

  const giftHint = recipients.length === 0 ? "No one added yet" : `${plannedGifts} planned · ${wrapped} wrapped`;
  const budgetHint = planned ? `of ${money(planned, profile.currency)}` : "Set a season total";
  const giftValue = recipients.length === 0 ? "—" : `${recipients.length} ${recipients.length === 1 ? "person" : "people"}`;
  const budgetValue = planned ? money(spent, profile.currency) : "—";

  return (
    <div className="tdg-planner-today">
      <header className="tdg-planner-hero">
        <p className="tdg-planner-kicker">{planModeLabel(mode)}</p>
        <h1>{countdownCopy(daysLeft)}</h1>
        <p className="tdg-planner-ready">Your Christmas is {readiness.percent}% ready.</p>
        <PlannerProgress value={readiness.percent} />
        <PlannerReadinessBreakdown readiness={readiness} />
        <div className="tdg-planner-summary">
          <PlannerStat label="Readiness" value={`${readiness.percent}%`} hint="Season progress" />
          <PlannerStat label="Gifts" value={giftValue} hint={giftHint} />
          <PlannerStat label="Budget" value={budgetValue} hint={budgetHint} />
          <PlannerStat label="Upcoming" value={String(upcomingCount)} hint={upcomingCount === 1 ? "dated task" : "dated tasks"} />
        </div>
      </header>

      <div className="tdg-planner-dash">
        <div className="tdg-planner-today-main">
          {intel?.rescue.active ? <PlannerRescueBanner remaining={intel.rescue.essentialRemaining} /> : null}
          <PlannerNextBestAction action={intel?.nextBestAction || null} />
          {onTrack ? <PlannerOnTrackState /> : (
            <PlannerAttentionList
              insights={attention}
              onDismiss={(id) => {
                if (!profile) return;
                const next = dismissInsight(profile.id, profile.season_year, id);
                setDismissed(next);
                void refreshIntelligence(profile, next);
              }}
              onAction={(insight) => {
                if (insight.actionType === "review_reschedule") setRescheduleOpen(true);
                if (insight.actionType === "ensure_hosting_tasks" && profile) {
                  void executePlannerAction(
                    { userId: profile.user_id, access, profile },
                    { type: "ensure_hosting_tasks", payload: {} },
                  ).then(() => refreshIntelligence());
                }
              }}
            />
          )}
          <PlannerSection
            title="Today’s priorities"
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
            {todayTasks.length === 0 ? (
              <PlannerEmptyState
                title="A quiet start — keep the season moving."
                body="Add a gift person, schedule a meal, or drop a task onto today."
                action={
                  <div className="tdg-planner-actions">
                    <Link className="tdg-planner-btn primary" to="/account/christmas/gifts">
                      Start gift list
                    </Link>
                    <Link className="tdg-planner-btn" to="/account/christmas/plan">
                      Open plan
                    </Link>
                  </div>
                }
              />
            ) : (
              <div className="tdg-planner-list">
                {todayTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onChange={(next) => {
                      setTasks((prev) => (next ? prev.map((t) => (t.id === next.id ? next : t)) : prev.filter((t) => t.id !== task.id)));
                      void refreshIntelligence();
                    }}
                  />
                ))}
              </div>
            )}
          </PlannerSection>

          <PlannerSection title="This week">
            {thisWeek.length === 0 ? (
              <p className="tdg-planner-muted">Nothing else dated this week. Priorities above are the whole picture for now.</p>
            ) : (
              <ol className="tdg-planner-week">
                {thisWeek.map((task) => (
                  <li key={task.id}>
                    <time dateTime={task.due_on || undefined}>{formatPlannerDate(task.due_on)}</time>
                    <span>{task.title}</span>
                  </li>
                ))}
              </ol>
            )}
          </PlannerSection>
        </div>

        <aside className="tdg-planner-snapshot" aria-label="Christmas snapshot">
          <h2>Christmas snapshot</h2>
          <PlannerSnapshotRow
            label="Gifts"
            title={recipients.length === 0 ? "No one added yet." : `${recipients.length} ${recipients.length === 1 ? "person" : "people"} planned`}
            action={recipients.length === 0 ? "Start your gift list →" : "Open gifts →"}
            to="/account/christmas/gifts"
          />
          <PlannerSnapshotRow
            label="Budget"
            title={!planned ? "Set your Christmas budget." : intel?.budget.overForecastMinor ? `${formatPlannerMoney(intel.budget.forecastMinor, profile.currency)} forecast` : `${money(spent, profile.currency)} spent`}
            action={!planned ? "Stay in control from day one →" : "Update budget →"}
            to="/account/christmas/budget"
          />
          <PlannerSnapshotRow
            label="Food"
            title={mealsCount === 0 ? "Nothing planned yet." : `${mealsCount} ${mealsCount === 1 ? "meal" : "meals"} planned`}
            action={mealsCount === 0 ? "Start with Christmas Eve →" : "Open food →"}
            to="/account/christmas/food"
          />
          <PlannerSnapshotRow
            label="Hosting"
            title={profile.hosting ? `${intel?.snapshot.guests.reduce((s, g) => s + g.adults + g.kids, 0) || intel?.snapshot.guests.length || 0} guests` : "Not hosting this year"}
            action="Open hosting →"
            to="/account/christmas/hosting"
          />
          <PlannerSnapshotRow
            label="Upcoming"
            title={nextDeadline ? `${formatPlannerDate(nextDeadline.due_on)} — ${nextDeadline.title}` : "No dated tasks yet"}
            action="Open calendar →"
            to="/account/christmas/calendar"
          />
        </aside>
      </div>

      {!hasFeature(access, "planner_core") ? (
        <PlannerPaywall
          feature="planner_core"
          title="Free planner is ready — Core unlocks the full season"
          body="You have countdown, Today, a short plan, and up to 3 gift people. Core adds unlimited gifts, budget, rescue mode, and the date-aware plan."
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
        <p className="tdg-planner-muted">Uses your current plan — Engine facts, then plain language. Notes never go to ads.</p>
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
  const todayIso = isoDate(localDateParts(new Date(), tz));
  const weekEnd = isoDate(localDateParts(new Date(Date.now() + 7 * 86400000), tz));
  const filtered = tasks.filter((t) => {
    if (t.status === "skipped") return false;
    if (view === "today") return (t.due_on || todayIso) <= todayIso;
    if (view === "week") return (t.due_on || todayIso) <= weekEnd;
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

  const onTaskChange = (task: PlannerTask, next: PlannerTask | null) =>
    setTasks((prev) => (next ? prev.map((t) => (t.id === next.id ? next : t)) : prev.filter((t) => t.id !== task.id)));

  const groups =
    view === "calendar"
      ? null
      : [
          { key: "Overdue", rows: filtered.filter((t) => t.status !== "done" && t.due_on && t.due_on < todayIso) },
          { key: "Today", rows: filtered.filter((t) => t.status !== "done" && (t.due_on === todayIso || (!t.due_on && view === "today"))) },
          { key: "Coming up", rows: filtered.filter((t) => t.status !== "done" && t.due_on && t.due_on > todayIso && t.due_on <= weekEnd) },
          { key: "Later", rows: filtered.filter((t) => t.status !== "done" && (!t.due_on || t.due_on > weekEnd) && view === "all") },
          { key: "Done", rows: filtered.filter((t) => t.status === "done") },
        ].filter((g) => g.rows.length);

  const byDateMap = new Map<string, PlannerTask[]>();
  for (const task of filtered) {
    const key = task.due_on || "undated";
    byDateMap.set(key, [...(byDateMap.get(key) || []), task]);
  }
  const byDate = [...byDateMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Plan" lede="Your season, step by step." />
      {profile.prepared_level === "rescue" || daysUntilChristmas(new Date(), profile.timezone) <= 7 ? (
        <p className="tdg-intel-kicker" style={{ marginBottom: 12 }}>
          Rescue focus is on — nice-to-have tasks stay listed, just lower.
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
  const [budget, setBudget] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [idea, setIdea] = useState("");
  const [editing, setEditing] = useState<GiftItem | null>(null);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const ideaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadRecipients(profile.id), loadGifts(profile.id)]).then(([r, g]) => {
      setRecipients(r);
      setGifts(g);
      const giftId = params.get("gift");
      const fromGift = giftId ? g.find((item) => item.id === giftId) : null;
      setActiveId(fromGift?.recipient_id || r[0]?.id || null);
      if (fromGift) setEditing(fromGift);
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
  const budgets = computeRecipientBudgets({ recipients, gifts });
  const ideas = gifts.filter((g) => g.status === "idea").length;
  const ordered = gifts.filter((g) => g.status === "ordered").length;
  const wrappedCount = gifts.filter((g) => g.status === "wrapped" || g.status === "given").length;

  return (
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Gifts" lede="Plan everyone you’re buying for — privately, in one place.">
        {!hasFeature(access, "gift_planner") ? <p className="tdg-planner-muted">Free includes up to 3 people.</p> : null}
      </PlannerPageHeader>
      <div className="tdg-planner-summary">
        <PlannerStat label="People" value={String(recipients.length)} hint={recipients.length === 1 ? "on your list" : "on your list"} />
        <PlannerStat label="Ideas" value={String(ideas)} hint="still deciding" />
        <PlannerStat label="Ordered" value={String(ordered)} hint="in motion" />
        <PlannerStat label="Wrapped" value={String(wrappedCount)} hint="ready to give" />
      </div>
      <div className="tdg-planner-split tdg-planner-gifts">
        <div>
          <PlannerComposer>
            <input className="tdg-planner-input" placeholder="Add a person" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="tdg-planner-input" placeholder="Relationship" value={relation} onChange={(e) => setRelation(e.target.value)} />
            <input className="tdg-planner-input" placeholder="Budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <button type="button" className="tdg-planner-btn primary" disabled={locked && !name} onClick={() => void addPerson()}>
              Add person
            </button>
          </PlannerComposer>
          <div className="tdg-planner-people">
            {recipients.length === 0 ? (
              <PlannerEmptyState
                mark="gift"
                title="Start your gift list with the people who matter most."
                body="Add a name, a relationship, and a budget. Then track each gift from idea to wrapped."
              />
            ) : (
              recipients.map((r) => {
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
                      value={row?.budgetMinor != null ? formatPlannerMoney(row.budgetMinor, profile.currency) : "—"}
                      hint="for this person"
                    />
                    <PlannerStat
                      label="Planned"
                      value={formatPlannerMoney(row?.committedMinor || 0, profile.currency)}
                      hint="committed so far"
                    />
                    <PlannerStat
                      label="Remaining"
                      value={remaining == null ? "—" : formatPlannerMoney(Math.max(0, remaining), profile.currency)}
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
                  Need an idea?
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
                      setGifts((p) => p.map((x) => (x.id === g.id ? { ...x, status } : x)));
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
        ["/account/christmas/shopping", "Shopping", "To buy, ordered, arriving, returns", "shopping"],
      ],
    },
    {
      title: "Home & food",
      items: [
        ["/account/christmas/food", "Food", "Plan meals for Christmas Eve and Day", "food"],
        ["/account/christmas/recipes", "Recipes", "Save seasonal dishes", "food"],
        ["/account/christmas/grocery", "Grocery", "One list from meals and extras", "list"],
        ["/account/christmas/hosting", "Hosting", "Guests, prep and home", "home"],
        ["/account/christmas/home", "Home", "Tree, rooms and lights", "home"],
      ],
    },
    {
      title: "People",
      items: [
        ["/account/christmas/travel", "Travel", "Trips, packing and plans", "travel"],
        ["/account/christmas/cards", "Cards", "Keep greetings on track", "star"],
        ["/christmas/wishlist", "Wishlist", "Open your public wishlist", "gift"],
      ],
    },
    {
      title: "Season extras",
      items: [
        ["/account/christmas/traditions", "Traditions", "Make time for what matters", "star"],
        ["/account/christmas/memories", "Memories", "Keep the season", "memory"],
        ["/account/christmas/club", "Christmas Club", "Countdown community", "star"],
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
      <div className="tdg-planner-page">
        <PlannerPageHeader title="Budget" lede="Keep Christmas spending beautifully under control." />
        <PlannerPaywall
          feature="budget"
          title="Track gifts, meals and extras without spreadsheet chaos."
          body="See planned versus spent as the season unfolds. Gift prices roll in automatically."
        />
      </div>
    );
  }

  const totals = computeBudgetTotals(
    buildMiniBudgetSnapshot(profile, gifts, rows),
  );
  const giftSpent = totals.giftSpentMinor;
  const planned = totals.totalBudgetMinor || totals.forecastMinor;
  const spent = totals.spentMinor;
  const remaining = totals.remainingMinor ?? planned - spent;

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
    <div className="tdg-planner-page">
      <PlannerPageHeader title="Budget" lede="Keep Christmas spending beautifully under control." />
      <div className="tdg-planner-summary">
        <PlannerStat label="Total" value={money(planned, profile.currency)} hint="season budget" />
        <PlannerStat label="Forecast" value={money(totals.forecastMinor, profile.currency)} hint="gifts + other plans" />
        <PlannerStat label="Spent" value={money(spent, profile.currency)} hint="gift actuals + manual" />
        <PlannerStat label="Remaining" value={money(remaining, profile.currency)} hint={remaining < 0 ? "over plan" : "left to spend"} />
        <PlannerStat label="Used" value={`${planned ? Math.min(100, Math.round((spent / planned) * 100)) : 0}%`} hint="of the total" />
      </div>
      <section className="tdg-planner-section">
        <label>
          Total Christmas budget
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
        </label>
        <PlannerProgress value={planned ? Math.min(100, Math.round((spent / planned) * 100)) : 0} />
        <p className="tdg-planner-muted">
          Gift prices roll into spent and forecast automatically. Manual expenses stay separate so the same gift is never counted twice.
        </p>
        {totals.overForecastMinor > 0 ? (
          <p className="tdg-intel-spend is-over">
            Forecast is {money(totals.overForecastMinor, profile.currency)} over your season total.
          </p>
        ) : null}
      </section>
      {BUDGET_CATEGORIES.map((cat) => {
        const row = rows.find((r) => r.category === cat);
        const extra = cat === "gifts" ? totals.giftCommittedMinor : 0;
        const cap = row?.planned_minor || 0;
        const used = cat === "gifts" ? totals.giftCommittedMinor : (row?.spent_minor || 0);
        return (
          <div key={cat} className="tdg-planner-budget-row">
            <div>
              <strong>{prettyLabel(cat)}</strong>
              <div className="tdg-planner-muted">
                {money(used, profile.currency)} of {money(cap, profile.currency)}
              </div>
              <div className="tdg-planner-bar is-compact">
                <span style={{ width: `${cap ? Math.min(100, Math.round((used / cap) * 100)) : 0}%` }} />
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
        <PlannerComposer>
        <input className="tdg-planner-input" placeholder="What did you buy?" value={expense.label} onChange={(e) => setExpense({ ...expense, label: e.target.value })} />
        <select className="tdg-planner-select" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value as BudgetCategory })}>
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {prettyLabel(c)}
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
        </PlannerComposer>
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

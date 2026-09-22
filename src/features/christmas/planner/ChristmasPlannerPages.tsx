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
  plannerGreeting,
} from "./date";
import { giftPeopleLimit } from "./giftPeople";
import { plannerTodayIso, plannerWeekEndIso, taskWhen } from "./taskSchedule";
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
  PlannerSection,
  PlannerSnapshotRow,
  TaskRow,
} from "./plannerUi";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import { type GiftItem, type GiftRecipient, type PlannerTask } from "./types";

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
  const priorities = recommendedToday([...overdue, ...dueToday, ...weekTasks], todayIso, 3, weekEnd);
  const mealsCount = intel?.snapshot.meals.length || 0;
  const giftsWithoutPlan = Math.max(
    0,
    recipients.length - new Set(gifts.filter((g) => g.status !== "idea").map((g) => g.recipient_id)).size,
  );
  const spent = intel?.budget.spentMinor ?? gifts.reduce((s, g) => s + (g.actual_price_minor || 0), 0);
  const planned = profile.total_budget_minor || intel?.budget.forecastMinor || 0;

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
  const isFreshStart = giftPeople === 0 && mealsCount === 0 && !priorities.length;

  return (
    <div className="tdg-planner-today">
      <header className="tdg-home-hero">
        <div className="tdg-home-hero-visual" aria-hidden="true">
          <img src="/christmas/planner/dinner-table.webp" alt="" decoding="async" />
          <div className="tdg-home-hero-veil" />
        </div>
        <div className="tdg-home-hero-copy">
          <p className="tdg-planner-kicker">{plannerGreeting(now, tz)}</p>
          <h1>{countdownCopy(daysLeft)}</h1>
          <p className="tdg-planner-ready">{readiness.percent}% ready for Christmas</p>
          <PlannerProgress value={readiness.percent} />
        </div>
      </header>

      {isFreshStart ? (
        <section className="tdg-home-start">
          <h2>Start with the people you’re buying for.</h2>
          <p className="tdg-planner-muted">A calm Christmas starts with who matters. Add a person, then we’ll help with gifts, meals, and the rest.</p>
          <div className="tdg-planner-actions">
            <Link className="tdg-planner-btn primary" to="/account/christmas/gifts">
              Add people
            </Link>
            <Link className="tdg-planner-btn" to="/account/christmas/plan">
              Open tasks
            </Link>
            {hasFeature(access, "food_planner") ? (
              <Link className="tdg-planner-btn" to="/account/christmas/food">
                Plan a meal
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="tdg-planner-dash">
          <div className="tdg-planner-today-main">
            {intel?.rescue.active ? <PlannerRescueBanner remaining={intel.rescue.essentialRemaining} /> : null}
            {primary ? (
              <section className="tdg-planner-section tdg-intel-nba">
                <p className="tdg-intel-kicker">Next best action</p>
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
            ) : null}

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
                  body="You’re clear for today. Add a person, a meal, or a task when you’re ready."
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
                  {priorities.slice(0, 3).map((task) => (
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
              label="Meals"
              title={mealsCount === 0 ? "No menu yet." : `${mealsCount} ${mealsCount === 1 ? "meal" : "meals"}`}
              action={mealsCount === 0 ? "Plan a meal" : "Open meals"}
              to="/account/christmas/food"
            />
            <PlannerSnapshotRow
              label="Shopping"
              title={groceryNeed === 0 && giftsWithoutPlan === 0 ? "Nothing left to buy." : `${groceryNeed + giftsWithoutPlan} still needed`}
              action="Open shopping"
              to="/account/christmas/shopping"
            />
            <PlannerSnapshotRow
              label="Budget"
              title={!planned ? "No total yet." : `${money(spent, profile.currency)} spent`}
              action={!planned ? "Set a total" : "Open budget"}
              to="/account/christmas/budget"
            />
          </aside>
        </div>
      )}

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

export { ChristmasPlannerPlanPage } from "./PlanPage";

export { ChristmasPlannerGiftsPage } from "./gifts/GiftsPage";

export function ChristmasPlannerMorePage() {
  useEffect(() => {
    trackPlannerEvent("planner_module_opened", { module: "more" });
  }, []);
  const groups = [
    {
      title: "Plan",
      items: [
        ["/account/christmas/calendar", "Calendar", "See every date, task and delivery", "calendar"],
        ["/account/christmas/traditions", "Traditions", "Make time for what matters", "star"],
      ],
    },
    {
      title: "Home",
      items: [
        ["/account/christmas/hosting", "Hosting", "Guests, prep and home", "home"],
        ["/account/christmas/home", "Home", "Tree, rooms and lights", "home"],
        ["/account/christmas/travel", "Travel", "Trips, packing and plans", "travel"],
      ],
    },
    {
      title: "Memories",
      items: [
        ["/account/christmas/cards", "Cards", "Track greetings. Card making is a separate credit.", "star"],
        ["/account/christmas/memories", "Memories", "Keep the season", "memory"],
        ["/christmas/wishlist", "Wishlist", "Open your public wishlist", "gift"],
      ],
    },
    {
      title: "Account",
      items: [
        ["/account/christmas/budget", "Budget", "Track the season total", "budget"],
        ["/account/christmas/grocery", "Grocery", "One food list from the menu", "list"],
        ["/account", "My account", "Credits, orders, and sign-out", "settings"],
        ["/account/christmas/settings", "Settings", "Currency, hosting, reset", "settings"],
        ["/account/christmas/club", "Christmas Club", "Feed is not live and is not part of the $17 planner.", "star"],
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

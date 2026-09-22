import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { trackPlannerEvent } from "./analytics";
import { insertTask, insertTasks, loadEvents, loadGifts, loadTasks } from "./api";
import { daysUntilChristmas, formatPlannerDate, taskCategoryLabel } from "./date";
import { canAddCustomTask } from "./entitlements";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import {
  exploreOnOwnStorageKey,
  findStarterMatch,
  giftIdeaCount,
  itemsToBuyCount,
  missingStarterTasks,
  planProgress,
  STARTER_TASKS,
  type StarterTask,
  type StarterTaskIcon,
} from "./planSuggestions";
import { PlannerComposer, PlannerLoading, TaskRow } from "./plannerUi";
import { plannerTodayIso, plannerWeekEndIso, taskWhen, tasksForView } from "./taskSchedule";
import { bumpPlannerWorkspace } from "./workspaceSync";
import { TASK_CATEGORIES, type GiftItem, type PlannerTask, type TaskCategory } from "./types";

const HERO_SRC = "/assets/christmas/cozy-reel/posters/clip1.jpg";
const DOOR_SRC = "/assets/christmas/luxury-palace/posters/palace_04_entrance.jpg";

export function ChristmasPlannerPlanPage() {
  const { loading, access, profile } = usePlannerBundle();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [eventsCount, setEventsCount] = useState(0);
  const [view, setView] = useState<"today" | "week" | "all" | "calendar">("today");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("other");
  const [exploreOwn, setExploreOwn] = useState(false);
  const [addingAll, setAddingAll] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadTasks(profile.id), loadGifts(profile.id), loadEvents(profile.id)]).then(([nextTasks, nextGifts, nextEvents]) => {
      setTasks(nextTasks);
      setGifts(nextGifts);
      setEventsCount(nextEvents.length);
    });
    setExploreOwn(window.localStorage.getItem(exploreOnOwnStorageKey(profile.id)) === "1");
    trackPlannerEvent("planner_module_opened", { module: "plan" });
  }, [profile?.id]);

  if (loading) return <PlannerLoading label="Loading plan…" />;
  if (!profile) return <PlannerOnboarding />;

  const tz = profile.timezone;
  const now = new Date();
  const todayIso = plannerTodayIso(now, tz);
  const weekEnd = plannerWeekEndIso(now, tz);
  const filtered = tasksForView(tasks, view, todayIso, weekEnd);
  const todayRows = tasks.filter((task) => taskWhen(task, todayIso, weekEnd) === "today" || taskWhen(task, todayIso, weekEnd) === "overdue");
  const progress = planProgress(tasks);
  const missing = missingStarterTasks(tasks);
  const showStarter = !exploreOwn && missing.length > 0;
  const weekdayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz && tz !== "local" ? tz : undefined,
  }).format(now);

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

  function onComposer(event: FormEvent) {
    event.preventDefault();
    void addCustom();
  }

  const onTaskChange = (task: PlannerTask, next: PlannerTask | null) =>
    setTasks((prev) => (next ? prev.map((t) => (t.id === next.id ? next : t)) : prev.filter((t) => t.id !== task.id)));

  async function addStarters(rows: StarterTask[]) {
    if (!profile || !rows.length) return;
    setAddingAll(true);
    const created = await insertTasks(
      rows.map((starter) => ({
        profile_id: profile.id,
        title: starter.title,
        category: starter.category,
        due_on: todayIso,
        status: "open" as const,
        priority: starter.priority,
        notes: starter.description,
        origin: "system" as const,
        template_key: starter.key,
      })),
    );
    if (created.length) {
      setTasks((prev) => [...prev, ...created]);
      bumpPlannerWorkspace();
      trackPlannerEvent("planner_task_added", { module: "plan", countBucket: String(created.length) });
    }
    setAddingAll(false);
  }

  async function addOneStarter(starter: StarterTask) {
    const existing = findStarterMatch(tasks, starter);
    if (existing) return;
    await addStarters([starter]);
  }

  function dismissStarter() {
    if (!profile) return;
    window.localStorage.setItem(exploreOnOwnStorageKey(profile.id), "1");
    setExploreOwn(true);
  }

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
  const sectionTitle = view === "week" ? "This week" : view === "all" ? "All" : view === "calendar" ? "Calendar" : "Today";
  const sectionCount = view === "today" ? todayRows.length : filtered.length;
  const emptyToday = view === "today" && todayRows.length === 0;
  const emptyOther = view !== "today" && filtered.length === 0;

  return (
    <div className="tdg-planner-page tdg-tasks">
      <header className="tdg-tasks-hero">
        <div className="tdg-tasks-hero-copy">
          <h1>Tasks</h1>
          <p>Everything you need to get Christmas done — without the last-minute stress.</p>
        </div>
        <div className="tdg-tasks-hero-art" aria-hidden="true">
          <div className="tdg-tasks-hero-fade" />
          <img src={HERO_SRC} alt="" width={720} height={1280} decoding="async" />
          <p className="tdg-tasks-hero-caption">
            Small steps today
            <br />
            A magical Christmas
            <br />
            tomorrow
            <HeartMark />
          </p>
        </div>
      </header>

      {profile.prepared_level === "rescue" || daysUntilChristmas(new Date(), profile.timezone) <= 7 ? (
        <p className="tdg-intel-kicker">Rescue focus is on - nice-to-have tasks stay listed, just lower.</p>
      ) : null}

      <div className="tdg-tasks-seg" role="tablist" aria-label="Plan views">
        {(["today", "week", "all", "calendar"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {v === "calendar" ? <CalendarDays size={15} strokeWidth={1.8} aria-hidden /> : null}
            {v === "week" ? "This week" : v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <PlannerComposer>
        <form className="tdg-tasks-composer" onSubmit={onComposer}>
          <input
            id="planner-add-task"
            className="tdg-planner-input"
            placeholder="Add a task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select className="tdg-planner-select" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} aria-label="Category">
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {taskCategoryLabel(c)}
              </option>
            ))}
          </select>
          <button type="submit" className="tdg-planner-btn primary tdg-tasks-add">
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            Add task
          </button>
        </form>
      </PlannerComposer>

      <section className="tdg-tasks-stats" aria-label="Christmas plan stats">
        <article className="tdg-tasks-stat tdg-tasks-stat--plan">
          <PlanRing percent={progress.percent} />
          <div>
            <h2>Your Christmas plan</h2>
            <p>
              {progress.done} of {progress.total} tasks completed
            </p>
            <div className="tdg-tasks-stat-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
              <span style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        </article>
        <article className="tdg-tasks-stat">
          <span className="tdg-tasks-stat-ico tdg-tasks-stat-ico--gift">
            <GiftGlyph />
          </span>
          <strong>{giftIdeaCount(gifts)}</strong>
          <span>Gift ideas</span>
        </article>
        <article className="tdg-tasks-stat">
          <span className="tdg-tasks-stat-ico tdg-tasks-stat-ico--shop">
            <CartGlyph />
          </span>
          <strong>{itemsToBuyCount(gifts)}</strong>
          <span>Items to buy</span>
        </article>
        <article className="tdg-tasks-stat">
          <span className="tdg-tasks-stat-ico tdg-tasks-stat-ico--event">
            <EventGlyph />
          </span>
          <strong>{eventsCount}</strong>
          <span>Events planned</span>
        </article>
      </section>

      <div className={`tdg-tasks-mid${showStarter ? "" : " is-rail-only"}`}>
        {showStarter ? (
          <section className="tdg-tasks-start">
            <p className="tdg-tasks-start-kicker">
              <SparkleGlyph /> Get started
            </p>
            <h2>
              Your Christmas plan starts here <TreeGlyph />
            </h2>
            <p className="tdg-tasks-start-lede">Here are a few recommended tasks to help you get organized:</p>
            <ul className="tdg-tasks-suggest">
              {STARTER_TASKS.map((starter) => {
                const existing = findStarterMatch(tasks, starter);
                return (
                  <li key={starter.key}>
                    <button type="button" className="tdg-tasks-suggest-row" onClick={() => void addOneStarter(starter)} disabled={Boolean(existing) || addingAll}>
                      <span className={`tdg-tasks-suggest-check${existing ? " is-on" : ""}`} aria-hidden />
                      <span className={`tdg-tasks-suggest-ico tdg-tasks-suggest-ico--${starter.icon}`}>
                        <StarterGlyph icon={starter.icon} />
                      </span>
                      <span className="tdg-tasks-suggest-copy">
                        <strong>{starter.title}</strong>
                        <span>{starter.description}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.6} className="tdg-tasks-suggest-chevron" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="tdg-tasks-start-actions">
              <button type="button" className="tdg-planner-btn primary" disabled={addingAll || missing.length === 0} onClick={() => void addStarters(missing)}>
                <Plus size={16} strokeWidth={2.4} aria-hidden />
                Add all to my plan
              </button>
              <button type="button" className="tdg-tasks-skip" onClick={dismissStarter}>
                Not now, I’ll explore on my own
              </button>
            </div>
          </section>
        ) : null}

        <aside className="tdg-tasks-rail">
          <blockquote className="tdg-tasks-quote">
            <QuoteGlyph />
            <p>A little progress every day makes a stress-free Christmas.</p>
            <HeartMark />
          </blockquote>
          <figure className="tdg-tasks-door">
            <img src={DOOR_SRC} alt="Lantern-lit Christmas doorway opening onto a decorated tree" width={720} height={1280} decoding="async" />
            <figcaption>
              It’s not just a to-do list.
              <br />
              It’s a more magical Christmas.
            </figcaption>
          </figure>
        </aside>
      </div>

      <section className="tdg-tasks-today" aria-label={sectionTitle}>
        <div className="tdg-tasks-today-head">
          <h2>
            {sectionTitle}
            <span className="tdg-tasks-count">{sectionCount}</span>
          </h2>
          <p>{weekdayLabel}</p>
        </div>
        {emptyToday || emptyOther ? (
          <div className="tdg-tasks-empty">
            <ClipboardGlyph />
            <strong>{emptyToday ? "No tasks for today yet." : "No tasks here yet."}</strong>
            <p>{emptyToday ? "Add a task or use the suggestions above to get started." : "Add your own task or switch views to see your full Christmas plan."}</p>
          </div>
        ) : view === "calendar" ? (
          byDate.map(([date, rows]) => (
            <section key={date} className="tdg-planner-section">
              <h3>{date === "undated" ? "Undated" : formatPlannerDate(date)}</h3>
              {rows.map((task) => (
                <TaskRow key={task.id} task={task} onChange={(next) => onTaskChange(task, next)} />
              ))}
            </section>
          ))
        ) : (
          (groups || []).map((group) => (
            <section key={group.key} className="tdg-planner-section tdg-planner-appear">
              {view === "today" && group.key === "Today" ? null : <h3>{group.key}</h3>}
              {group.rows.map((task) => (
                <TaskRow key={task.id} task={task} onChange={(next) => onTaskChange(task, next)} />
              ))}
            </section>
          ))
        )}
      </section>
    </div>
  );
}

function PlanRing({ percent }: { percent: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percent)) / 100) * c;
  return (
    <svg className="tdg-tasks-ring" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e6ddd2" strokeWidth="5" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="#2a4d3e"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill="#6a5f55">
        {percent}%
      </text>
    </svg>
  );
}

function StarterGlyph({ icon }: { icon: StarterTaskIcon }) {
  if (icon === "budget") return <BudgetGlyph />;
  if (icon === "gift") return <GiftGlyph />;
  if (icon === "travel") return <TravelGlyph />;
  return <HomeGlyph />;
}

function GiftGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 13h16M12 10v10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 10c-2.6-3.4-5.5-3.4-5.5-1.2C6.5 10.4 9 11 12 12c3-1 5.5-1.6 5.5-3.2C17.5 6.6 14.6 6.6 12 10z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CartGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 6h2.2l1.4 10h10.2l1.6-7H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="19" r="1.2" fill="currentColor" />
      <circle cx="17" cy="19" r="1.2" fill="currentColor" />
    </svg>
  );
}

function EventGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 10h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BudgetGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v10M9.5 9.2c.7-1 2-1.5 3.3-1.2 1.6.3 2.2 1.6 1.7 2.7-.5 1.2-2 1.5-3.2 1.8s-2.6.9-2.2 2.2c.4 1.2 2 1.7 3.6 1.3 1.2-.3 2-.9 2.4-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TravelGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 13.5 21 9.5 14 21l-1.6-5.2L3 13.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 9.5 10.2 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function HomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.5 10.5V19h11v-8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 19v-5h4v5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SparkleGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 1.4 9.1 6.2 14 8 9.1 9.8 8 14.6 6.9 9.8 2 8l4.9-1.8z" fill="#b5232e" />
    </svg>
  );
}

function TreeGlyph() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <path d="M9 2 3.5 9h3L3 13h12l-3.5-4h3L9 2z" fill="#2a4d3e" />
      <rect x="8" y="13" width="2" height="3" fill="#6d4c2f" />
    </svg>
  );
}

function HeartMark() {
  return (
    <svg className="tdg-tasks-heart" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 13.4S2.4 9.7 2.4 6.4A3.1 3.1 0 0 1 8 5.2a3.1 3.1 0 0 1 5.6 1.2C13.6 9.7 8 13.4 8 13.4z" fill="#b5232e" />
    </svg>
  );
}

function QuoteGlyph() {
  return (
    <svg className="tdg-tasks-quote-mark" viewBox="0 0 48 36" width="36" height="28" aria-hidden="true">
      <path d="M18 0C8 4 0 14 0 24c0 7 5 12 11 12 6 0 10-4 10-10 0-6-4-9-9-9-1 0-3 0-4 1 2-6 7-12 14-16L18 0zm30 0C38 4 30 14 30 24c0 7 5 12 11 12 6 0 10-4 10-10 0-6-4-9-9-9-1 0-3 0-4 1 2-6 7-12 14-16L48 0z" fill="#c4a574" />
    </svg>
  );
}

function ClipboardGlyph() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-hidden="true">
      <rect x="8" y="6" width="16" height="22" rx="3" stroke="#c4a574" strokeWidth="1.7" />
      <rect x="12" y="3.5" width="8" height="5" rx="1.5" stroke="#c4a574" strokeWidth="1.7" />
      <path d="M12 14h8M12 19h8M12 24h5" stroke="#c4a574" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

import { FormEvent, useEffect, useId, useState, type ComponentType, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { TASK_CATEGORIES, PLANNER_PUBLIC_ROUTE, type PlannerFeatureKey, type PlannerTask, type TaskCategory } from "./types";
import { deleteTask, patchTask } from "./api";
import { trackPlannerEvent } from "./analytics";
import { formatPlannerDate, taskCategoryLabel, taskPriorityLabel } from "./date";
import { PlannerMark, type PlannerMarkKind } from "./plannerMarks";
import { upgradePackageForFeature } from "./entitlements";

export { PlannerMark, type PlannerMarkKind } from "./plannerMarks";

export function PlannerProgress({ value, compact = false }: { value: number; compact?: boolean }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`tdg-planner-bar${compact ? " is-compact" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label="Christmas readiness"
    >
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function PlannerSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tdg-planner-section">
      <div className="tdg-planner-section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PlannerStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="tdg-planner-summary-cell">
      <span className="tdg-planner-kicker">{label}</span>
      <strong>{value}</strong>
      <span>{hint}</span>
    </div>
  );
}

export function PlannerEmptyState({
  title,
  body,
  action,
  mark = "list",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  mark?: PlannerMarkKind;
}) {
  return (
    <div className="tdg-planner-empty">
      <PlannerMark kind={mark} />
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function PlannerPageHeader({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <header className="tdg-planner-page-head">
      <h1>{title}</h1>
      <p>{lede}</p>
      {children}
    </header>
  );
}

export function PlannerStatusChip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "gold" | "done" }) {
  return <span className={`tdg-planner-status${tone === "gold" ? " is-gold" : tone === "done" ? " is-done" : ""}`}>{children}</span>;
}

export function PlannerComposer({ children }: { children: ReactNode }) {
  return <div className="tdg-planner-composer tdg-planner-panel">{children}</div>;
}

export function PlannerPanel({ children }: { children: ReactNode }) {
  return <div className="tdg-planner-panel">{children}</div>;
}

export function PlannerModuleLinkRow({
  to,
  title,
  description,
  mark,
}: {
  to: string;
  title: string;
  description: string;
  mark: PlannerMarkKind;
}) {
  return (
    <Link className="tdg-planner-module-row" to={to}>
      <PlannerMark kind={mark} />
      <span>
        <strong>{title}</strong>
        <span className="desc">{description}</span>
      </span>
      <span className="tdg-planner-chevron" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export function PlannerLockedModule({
  feature,
  title,
  body,
  bullets,
}: {
  feature: PlannerFeatureKey;
  title: string;
  body: string;
  bullets?: string[];
}) {
  const pack = upgradePackageForFeature(feature);
  const to = `${PLANNER_PUBLIC_ROUTE}?package=${encodeURIComponent(pack.packageKey)}#pricing`;
  const mark: PlannerMarkKind =
    feature === "budget" ? "budget" : feature === "food_planner" || feature === "recipes" ? "food" : feature === "hosting" ? "home" : feature === "travel" ? "travel" : "star";
  return (
    <div className="tdg-planner-locked">
      <PlannerMark kind={mark} />
      <h2>{title}</h2>
      <p>{body}</p>
      {bullets?.length ? (
        <ul>
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <Link
        className="tdg-planner-btn primary"
        to={to}
        onClick={() => {
          trackPlannerEvent("planner_upgrade_clicked", { feature, packageKey: pack.packageKey });
        }}
      >
        Unlock this season
      </Link>
    </div>
  );
}

export function PlannerSnapshotRow({
  label,
  title,
  action,
  to,
}: {
  label: string;
  title: string;
  action: string;
  to: string;
}) {
  return (
    <div className="tdg-planner-snap-row">
      <span className="tdg-planner-kicker">{label}</span>
      <p>{title}</p>
      <Link to={to}>{action}</Link>
    </div>
  );
}

export function PlannerSidebarItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  end?: boolean;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
      <Icon size={16} strokeWidth={1.6} aria-hidden />
      {label}
    </NavLink>
  );
}

export function PlannerQuickAdd({
  open,
  onOpen,
  onClose,
  draft,
  onDraft,
  onSubmit,
}: {
  open: "task" | "gift" | "event" | "meal" | null;
  onOpen: (kind: "task" | "gift" | "event" | "meal" | null) => void;
  onClose: () => void;
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const [menu, setMenu] = useState(false);
  const kinds = [
    { key: "task" as const, label: "Task" },
    { key: "gift" as const, label: "Gift" },
    { key: "event" as const, label: "Event" },
    { key: "meal" as const, label: "Meal" },
  ];

  return (
    <div className="tdg-planner-quick">
      <button
        type="button"
        className="tdg-planner-quick-btn"
        aria-expanded={menu || Boolean(open)}
        onClick={() => {
          setMenu((v) => !v);
          if (open) onClose();
        }}
      >
        + Add
      </button>
      {menu && !open ? (
        <div className="tdg-planner-quick-menu" role="menu">
          {kinds.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onOpen(item.key);
                setMenu(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <form className="tdg-planner-quick-form" onSubmit={onSubmit}>
          <label className="tdg-planner-sr" htmlFor="planner-quick-draft">
            Add {open}
          </label>
          <input
            id="planner-quick-draft"
            className="tdg-planner-input"
            autoFocus
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={`Add ${open}`}
          />
          <button type="submit" className="tdg-planner-btn primary">
            Add
          </button>
          <button
            type="button"
            className="tdg-planner-btn ghost"
            onClick={() => {
              onClose();
              setMenu(false);
            }}
          >
            Cancel
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function PlannerTaskRow({
  task,
  onChange,
}: {
  task: PlannerTask;
  onChange: (next: PlannerTask | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due_on || "");
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [priority, setPriority] = useState(task.priority);
  const [notes, setNotes] = useState(task.notes || "");
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function complete() {
    const status = task.status === "done" ? "open" : "done";
    if (status === "done") setLeaving(true);
    await patchTask(task.id, { status, completed_at: status === "done" ? new Date().toISOString() : null } as Partial<PlannerTask>);
    onChange({ ...task, status });
    if (status === "done") trackPlannerEvent("planner_task_completed", { module: "plan" });
  }

  async function skip() {
    await patchTask(task.id, { status: "skipped" });
    onChange({ ...task, status: "skipped" });
    setOpen(false);
  }

  async function save() {
    const moved = Boolean(due && due !== task.due_on);
    await patchTask(task.id, {
      title: title.trim().slice(0, 160) || task.title,
      due_on: due || null,
      category,
      priority,
      notes: notes.slice(0, 2000),
      status: moved ? "rescheduled" : task.status === "rescheduled" ? "open" : task.status,
    });
    if (moved) trackPlannerEvent("planner_task_rescheduled", { module: "plan" });
    onChange({
      ...task,
      title: title.trim().slice(0, 160) || task.title,
      due_on: due || null,
      category,
      priority,
      notes,
      status: "open",
    });
    setOpen(false);
  }

  return (
    <>
      <div className={`tdg-planner-task${task.origin === "system" ? " is-system" : ""}${task.status === "done" || leaving ? " is-done" : ""}`}>
        <button
          type="button"
          className={`tdg-planner-check${task.status === "done" ? " is-on" : ""}`}
          onClick={() => void complete()}
          aria-label={task.status === "done" ? "Mark incomplete" : `Complete ${task.title}`}
          aria-pressed={task.status === "done"}
        >
          {task.status === "done" ? (
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
              <path d="M3.2 8.4 6.1 11.2 12.8 4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>
        <button type="button" className="tdg-planner-task-body" onClick={() => setOpen(true)} id={titleId}>
          <div className="tdg-planner-task-title">{task.title}</div>
          <div className="tdg-planner-task-meta">
            <PlannerStatusChip>{taskCategoryLabel(task.category)}</PlannerStatusChip>
            <span>{formatPlannerDate(task.due_on)}</span>
            {task.priority === "high" ? <PlannerStatusChip tone="gold">{taskPriorityLabel(task.priority)}</PlannerStatusChip> : null}
          </div>
        </button>
        <button type="button" className="tdg-planner-task-more" onClick={() => setOpen(true)} aria-label={`Edit ${task.title}`}>
          •••
        </button>
      </div>
      {open ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-edit`}>
          <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="tdg-planner-sheet-card">
            <div className="tdg-planner-sheet-head">
              <h2 id={`${titleId}-edit`}>Edit task</h2>
              <button type="button" className="tdg-planner-btn ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <label>
              Title
              <input className="tdg-planner-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Category
              <select className="tdg-planner-select" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {taskCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input className="tdg-planner-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label>
              Priority
              <select className="tdg-planner-select" value={priority} onChange={(e) => setPriority(e.target.value as PlannerTask["priority"])}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              Notes
              <textarea className="tdg-planner-area" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
            </label>
            <div className="tdg-planner-actions">
              <button type="button" className="tdg-planner-btn primary" onClick={() => void save()}>
                {due && due !== task.due_on ? "Reschedule" : "Save"}
              </button>
              <button type="button" className="tdg-planner-btn" onClick={() => void complete()}>
                {task.status === "done" ? "Reopen" : "Mark complete"}
              </button>
              <button type="button" className="tdg-planner-btn" onClick={() => void skip()}>
                Skip this
              </button>
              {task.origin === "user" ? (
                <button
                  type="button"
                  className="tdg-planner-btn danger"
                  onClick={async () => {
                    await deleteTask(task.id);
                    onChange(null);
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** @deprecated use PlannerTaskRow */
export const TaskRow = PlannerTaskRow;

export const ASSISTANT_PROMPTS = [
  "What should I do this weekend?",
  "What gifts am I still missing?",
  "Am I over budget?",
  "What should I prep tomorrow?",
  "Create a dinner plan for 8.",
  "Give me a rescue plan.",
];

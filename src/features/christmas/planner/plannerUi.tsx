import { FormEvent, useEffect, useId, useState, type ButtonHTMLAttributes, type ComponentType, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { TASK_CATEGORIES, type PlannerFeatureKey, type PlannerTask, type TaskCategory } from "./types";
import { deleteTask, patchTask } from "./api";
import { bumpPlannerWorkspace } from "./workspaceSync";
import { trackPlannerEvent } from "./analytics";
import { formatPlannerDate, taskCategoryLabel, taskPriorityLabel } from "./date";
import { PlannerMark, type PlannerMarkKind } from "./plannerMarks";
import { FoundingPassUnlockButton } from "./FoundingPassUnlock";

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

export function PlannerPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["tdg-planner-page", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function PlannerLoading({ label = "Opening your Christmas…" }: { label?: string }) {
  return (
    <p className="tdg-planner-muted tdg-planner-loading" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function PlannerPageHeader({
  title,
  lede,
  kicker,
  children,
}: {
  title: string;
  lede: string;
  kicker?: string;
  children?: ReactNode;
}) {
  return (
    <header className="tdg-planner-page-head">
      {kicker ? <p className="tdg-planner-kicker tdg-planner-kicker--accent">{kicker}</p> : null}
      <h1>{title}</h1>
      <p>{lede}</p>
      {children}
    </header>
  );
}

export function PlannerButton({
  variant = "default",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" }) {
  return (
    <button
      type={type}
      className={["tdg-planner-btn", variant === "default" ? "" : variant, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function PlannerField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <label className="tdg-planner-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function PlannerCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["tdg-planner-card", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function PlannerSeg<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string }>;
  label?: string;
}) {
  return (
    <div className="tdg-planner-seg" role="tablist" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={value === opt.id ? "on" : ""}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function PlannerSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="tdg-planner-sheet-card">
        <div className="tdg-planner-sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="tdg-planner-btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PlannerErrorState({
  title = "Something went quiet.",
  body = "Try again in a moment. Your plan is still here.",
  action,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
}) {
  return <PlannerEmptyState mark="star" title={title} body={body} action={action} />;
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
      <FoundingPassUnlockButton feature={feature} />
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
    <NavLink to={to} end={end} title={label} className={({ isActive }) => (isActive ? "active" : "")}>
      <Icon size={18} strokeWidth={1.6} aria-hidden />
      <span className="tdg-planner-side-text">{label}</span>
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
    bumpPlannerWorkspace();
    if (status === "done") trackPlannerEvent("planner_task_completed", { module: "plan" });
  }

  async function skip() {
    await patchTask(task.id, { status: "skipped" });
    onChange({ ...task, status: "skipped" });
    bumpPlannerWorkspace();
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
      status: moved ? "rescheduled" : task.status === "rescheduled" ? "open" : task.status,
    });
    bumpPlannerWorkspace();
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
        <PlannerSheet title="Edit task" onClose={() => setOpen(false)}>
            <PlannerField label="Title">
              <input className="tdg-planner-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </PlannerField>
            <PlannerField label="Category">
              <select className="tdg-planner-select" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {taskCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </PlannerField>
            <PlannerField label="Due date">
              <input className="tdg-planner-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </PlannerField>
            <PlannerField label="Priority">
              <select className="tdg-planner-select" value={priority} onChange={(e) => setPriority(e.target.value as PlannerTask["priority"])}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </PlannerField>
            <PlannerField label="Notes">
              <textarea className="tdg-planner-area" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
            </PlannerField>
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
                    bumpPlannerWorkspace();
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
        </PlannerSheet>
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

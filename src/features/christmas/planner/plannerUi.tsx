import { useState } from "react";
import { TASK_CATEGORIES, type PlannerTask, type TaskCategory } from "./types";
import { deleteTask, patchTask } from "./api";
import { trackPlannerEvent } from "./analytics";

export function TaskRow({
  task,
  onChange,
}: {
  task: PlannerTask;
  onChange: (next: PlannerTask | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due_on || "");
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [priority, setPriority] = useState(task.priority);
  const [notes, setNotes] = useState(task.notes || "");

  async function complete() {
    const status = task.status === "done" ? "open" : "done";
    await patchTask(task.id, { status, completed_at: status === "done" ? new Date().toISOString() : null } as Partial<PlannerTask>);
    onChange({ ...task, status });
    if (status === "done") trackPlannerEvent("planner_task_completed", { module: "plan" });
  }

  async function skip() {
    await patchTask(task.id, { status: "skipped" });
    onChange({ ...task, status: "skipped" });
  }

  async function save() {
    await patchTask(task.id, {
      title: title.trim().slice(0, 160) || task.title,
      due_on: due || null,
      category,
      priority,
      notes: notes.slice(0, 2000),
      status: due && due !== task.due_on ? "rescheduled" : task.status === "rescheduled" ? "open" : task.status,
    });
    if (due && due !== task.due_on) trackPlannerEvent("planner_task_rescheduled", { module: "plan" });
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
    <div className={`tdg-planner-task${task.origin === "system" ? " is-system" : ""}`}>
      <button type="button" className={`tdg-planner-check${task.status === "done" ? " is-on" : ""}`} onClick={() => void complete()} aria-label={task.status === "done" ? "Reopen" : "Complete"}>
        {task.status === "done" ? "✓" : ""}
      </button>
      <div>
        <div className="tdg-planner-task-title">{task.title}</div>
        <div className="tdg-planner-muted">
          {task.category} · {task.due_on || "No date"} · {task.priority}
          {task.status !== "open" ? ` · ${task.status}` : ""}
        </div>
        {open ? (
          <div style={{ marginTop: 10 }}>
            <input className="tdg-planner-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="tdg-planner-select" value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input className="tdg-planner-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <select className="tdg-planner-select" value={priority} onChange={(e) => setPriority(e.target.value as PlannerTask["priority"])}>
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </select>
            <textarea className="tdg-planner-area" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
            <div className="tdg-planner-actions">
              <button type="button" className="tdg-planner-btn primary" onClick={() => void save()}>
                Save
              </button>
              <button type="button" className="tdg-planner-btn" onClick={() => void skip()}>
                Skip
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
        ) : null}
      </div>
      <button type="button" className="tdg-planner-linkish" onClick={() => setOpen((v) => !v)}>
        {open ? "Close" : "Edit"}
      </button>
    </div>
  );
}

export const ASSISTANT_PROMPTS = [
  "What should I do this weekend?",
  "What gifts am I still missing?",
  "Am I over budget?",
  "What should I prep tomorrow?",
  "Create a dinner plan for 8.",
  "Give me a rescue plan.",
];

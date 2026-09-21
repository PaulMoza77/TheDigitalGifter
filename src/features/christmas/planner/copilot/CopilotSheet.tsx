import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trackPlannerEvent } from "../analytics";
import { executePlannerAction, loadDismissedInsightIds, loadPlannerWorkspace, runPlannerIntelligence } from "../intelligence";
import type { PlannerIntelligence } from "../intelligence/types";
import { usePlannerBundle } from "../Onboarding";
import { ASSISTANT_PROMPTS } from "../plannerUi";
import { askCopilot, copilotEnabled, tryApplyCopilotPlan, type CopilotCard, type CopilotResponse } from "./ask";

function CopilotCardView({ card }: { card: CopilotCard }) {
  if (card.type === "insight") {
    return (
      <div className="tdg-copilot-card">
        <strong>{card.title}</strong>
        <p>{card.body}</p>
        {card.href ? (
          <Link className="tdg-planner-linkish" to={card.href}>
            Open module
          </Link>
        ) : null}
      </div>
    );
  }
  if (card.type === "task_list") {
    return (
      <div className="tdg-copilot-card">
        <strong>{card.title}</strong>
        <ul>
          {card.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (card.type === "budget_summary") {
    return (
      <div className="tdg-copilot-card">
        <strong>Budget</strong>
        <p>
          {card.spent} spent of {card.planned} · {card.remaining} left
        </p>
      </div>
    );
  }
  return (
    <div className="tdg-copilot-card">
      <strong>{card.title}</strong>
      <p>{card.body}</p>
    </div>
  );
}

export function CopilotSheet({
  open,
  seed,
  module,
  onClose,
  onSeedConsumed,
}: {
  open: boolean;
  seed: string | null;
  module: string;
  onClose: () => void;
  onSeedConsumed: () => void;
}) {
  const { profile, access } = usePlannerBundle();
  const [question, setQuestion] = useState("What should I do this weekend?");
  const [reply, setReply] = useState<CopilotResponse | null>(null);
  const [intel, setIntel] = useState<PlannerIntelligence | null>(null);
  const [applyNote, setApplyNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile) return;
    trackPlannerEvent("copilot_opened", { module });
    void (async () => {
      const snapshot = await loadPlannerWorkspace(profile);
      const dismissed = loadDismissedInsightIds(profile.id, profile.season_year);
      setIntel(runPlannerIntelligence(snapshot, dismissed));
    })();
  }, [open, profile, module]);

  useEffect(() => {
    if (!open || !seed || !intel) return;
    const q = seed;
    setQuestion(q);
    const response = askCopilot(q, intel);
    setReply(response);
    setApplyNote(null);
    trackPlannerEvent("copilot_turn", {
      module,
      metadata: { intent: response.modelPath, count_bucket: String(response.cards.length) },
    });
    onSeedConsumed();
  }, [open, seed, intel, module, onSeedConsumed]);

  const prompts = useMemo(() => [...ASSISTANT_PROMPTS, "What can I safely ignore?"], []);

  function ask(next = question) {
    if (!intel) return;
    const q = next.trim().slice(0, 240);
    if (!q) return;
    const response = askCopilot(q, intel);
    setReply(response);
    setApplyNote(null);
    trackPlannerEvent("copilot_turn", {
      module,
      metadata: { intent: response.modelPath, count_bucket: String(response.cards.length) },
    });
  }

  if (!open || !copilotEnabled()) return null;

  return (
    <div className="tdg-copilot-root" role="dialog" aria-modal="true" aria-labelledby="tdg-copilot-title">
      <button type="button" className="tdg-copilot-backdrop" aria-label="Close Christmas Copilot" onClick={onClose} />
      <section className="tdg-copilot-sheet">
        <header className="tdg-copilot-head">
          <div>
            <p className="tdg-planner-brand">Christmas Copilot</p>
            <h2 id="tdg-copilot-title">Using your current Christmas plan</h2>
            {intel ? (
              <p className="tdg-planner-muted">
                {intel.readiness.percent}% ready · {intel.snapshot.daysLeft} days left · Engine facts - notes stay in the planner
              </p>
            ) : (
              <p className="tdg-planner-muted">Reading your plan…</p>
            )}
          </div>
          <button type="button" className="tdg-planner-linkish" onClick={onClose}>
            <X size={18} aria-hidden />
            Close
          </button>
        </header>

        <div className="tdg-copilot-prompts">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="tdg-planner-chip"
              onClick={() => {
                setQuestion(prompt);
                if (intel) ask(prompt);
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="tdg-copilot-composer">
          <input
            className="tdg-planner-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 240))}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            placeholder="Ask about today, gifts, budget, dinner…"
            aria-label="Ask Christmas Copilot"
          />
          <button type="button" className="tdg-planner-btn primary" onClick={() => ask()} disabled={!intel}>
            Ask
          </button>
        </div>

        {reply ? (
          <div className="tdg-copilot-reply">
            <p>{reply.message}</p>
            {reply.cards.map((card, i) => (
              <CopilotCardView key={`${card.type}-${i}`} card={card} />
            ))}
            {reply.actionPlan?.steps.length ? (
              <div className="tdg-copilot-confirm">
                <p>Preview - nothing is written yet:</p>
                <ul>
                  {reply.actionPlan.steps.map((step) => (
                    <li key={step.preview}>{step.preview}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="tdg-planner-btn primary"
                  onClick={() => {
                    if (!profile || !intel || !reply.actionPlan) return;
                    void (async () => {
                      const result = await tryApplyCopilotPlan({
                        plan: reply.actionPlan,
                        confirm: true,
                        snapshotVersion: reply.snapshotVersion,
                        execute: (request) =>
                          executePlannerAction(
                            { userId: profile.user_id, access, profile },
                            request,
                          ),
                      });
                      setApplyNote(result.ok ? `Applied ${result.applied} change${result.applied === 1 ? "" : "s"}` : result.message);
                    })();
                  }}
                >
                  Confirm and apply
                </button>
                {applyNote ? <p className="tdg-planner-muted">{applyNote}</p> : null}
              </div>
            ) : reply.unsupported?.reason === "no_tool" ? (
              <div className="tdg-copilot-confirm">
                <p>I can show this on the plan. I will not invent live prices or write without a preview.</p>
                {applyNote ? <p className="tdg-planner-muted">{applyNote}</p> : null}
              </div>
            ) : null}
            {reply.followUpOptions.length ? (
              <div className="tdg-copilot-prompts">
                {reply.followUpOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="tdg-planner-chip"
                    onClick={() => {
                      setQuestion(opt);
                      ask(opt);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function CopilotLaunchButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  if (!copilotEnabled()) return null;
  return (
    <button type="button" className={`tdg-copilot-launch${compact ? " is-fab" : ""}`} onClick={onClick}>
      <Sparkles size={compact ? 18 : 16} aria-hidden />
      {compact ? <span className="tdg-planner-sr">Ask Christmas Copilot</span> : "Ask Copilot"}
    </button>
  );
}

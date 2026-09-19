import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { loadBudget, loadGifts, loadRecipients, loadTasks } from "../api";
import { trackPlannerEvent } from "../analytics";
import { daysUntilChristmas, isoDate, localDateParts, resolvePlanMode } from "../date";
import { buildIntelligence, type IntelligenceBundle } from "../intelligence";
import { usePlannerBundle } from "../Onboarding";
import { computeReadiness } from "../readiness";
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
  const { profile } = usePlannerBundle();
  const [question, setQuestion] = useState("What should I do this weekend?");
  const [reply, setReply] = useState<CopilotResponse | null>(null);
  const [bundle, setBundle] = useState<IntelligenceBundle | null>(null);
  const [applyNote, setApplyNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile) return;
    trackPlannerEvent("copilot_opened", { module });
    const tz = profile.timezone;
    const todayIso = isoDate(localDateParts(new Date(), tz));
    void Promise.all([
      loadTasks(profile.id),
      loadRecipients(profile.id),
      loadGifts(profile.id),
      loadBudget(profile.id),
      supabase.from("christmas_meals").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
      supabase
        .from("christmas_grocery_items")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("status", "need"),
      supabase
        .from("christmas_trips")
        .select("start_on")
        .eq("profile_id", profile.id)
        .order("start_on", { ascending: true })
        .limit(1),
    ]).then(([tasks, recipients, gifts, budget, meals, grocery, trips]) => {
      const daysLeft = daysUntilChristmas(new Date(), tz);
      const planMode = resolvePlanMode(daysLeft, profile.prepared_level);
      const planned = budget.reduce((s, b) => s + b.planned_minor, 0) || profile.total_budget_minor || 0;
      const spent =
        budget.reduce((s, b) => s + b.spent_minor, 0) + gifts.reduce((s, g) => s + (g.actual_price_minor || 0), 0);
      const readiness = computeReadiness({
        profile,
        tasks,
        recipients,
        gifts,
        mealsCount: meals.count || 0,
      });
      setBundle(
        buildIntelligence({
          seasonYear: profile.season_year,
          todayIso,
          daysLeft,
          planMode,
          readinessPercent: readiness.percent,
          hosting: profile.hosting,
          travelling: profile.travelling,
          hasChildren: profile.has_children,
          currency: profile.currency,
          tasks,
          recipients,
          gifts,
          budgetPlannedMinor: planned,
          budgetSpentMinor: spent,
          mealsCount: meals.count || 0,
          groceryNeedCount: grocery.count || 0,
          tripStartOn: (trips.data?.[0] as { start_on?: string | null } | undefined)?.start_on || null,
        }),
      );
    });
  }, [open, profile?.id, module]);

  useEffect(() => {
    if (!open || !seed || !bundle) return;
    const q = seed;
    setQuestion(q);
    const response = askCopilot(q, bundle);
    setReply(response);
    setApplyNote(null);
    trackPlannerEvent("copilot_turn", {
      module,
      metadata: { intent: response.modelPath, count_bucket: String(response.cards.length) },
    });
    onSeedConsumed();
  }, [open, seed, bundle, module, onSeedConsumed]);

  const prompts = useMemo(() => {
    const extra = bundle?.snapshot.hosting ? [] : [];
    return [...ASSISTANT_PROMPTS, "What can I safely ignore?", ...extra];
  }, [bundle]);

  function ask(next = question) {
    if (!bundle) return;
    const q = next.trim().slice(0, 240);
    if (!q) return;
    const response = askCopilot(q, bundle);
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
            {bundle ? (
              <p className="tdg-planner-muted">
                {bundle.snapshot.readinessPercent}% ready · {bundle.snapshot.daysLeft} days left · counts only — notes stay in the planner
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
                if (bundle) ask(prompt);
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
          <button type="button" className="tdg-planner-btn primary" onClick={() => ask()} disabled={!bundle}>
            Ask
          </button>
        </div>

        {reply ? (
          <div className="tdg-copilot-reply">
            <p>{reply.message}</p>
            {reply.cards.map((card, i) => (
              <CopilotCardView key={`${card.type}-${i}`} card={card} />
            ))}
            {reply.unsupported?.reason === "no_tool" ? (
              <div className="tdg-copilot-confirm">
                <p>I can prepare this change later. Nothing was written.</p>
                <button
                  type="button"
                  className="tdg-planner-btn"
                  onClick={() => {
                    const result = tryApplyCopilotPlan();
                    setApplyNote(result.ok ? `Applied ${result.applied} changes` : result.message);
                  }}
                >
                  Apply is not available yet
                </button>
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

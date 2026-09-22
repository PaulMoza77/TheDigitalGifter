import { Gift, Lightbulb, Send, ShoppingBag, Sparkles, UtensilsCrossed, Wallet, X } from "lucide-react";
import { Link } from "react-router-dom";
import { usePrefersReducedMotion } from "@/features/christmas/landing/usePrefersReducedMotion";
import type { CopilotCard, CopilotResponse } from "./ask";
import type { CopilotNextWin, CopilotSuggestion } from "./context";
import type { PlannerIntelligence } from "../intelligence/types";

export const COPILOT_PHOTO = "/christmas/planner/copilot-cozy.webp";
export const COPILOT_FIRE_WEBM = "/christmas/planner/copilot-fire.webm";
export const COPILOT_FIRE_MP4 = "/christmas/planner/copilot-fire.mp4";

export type CopilotTurn = {
  id: string;
  question: string;
  reply: CopilotResponse;
};

function SuggestionIcon({ icon }: { icon: CopilotSuggestion["icon"] }) {
  const props = { size: 16, strokeWidth: 1.7, "aria-hidden": true as const };
  switch (icon) {
    case "gift":
      return <Gift {...props} />;
    case "budget":
      return <Wallet {...props} />;
    case "meal":
      return <UtensilsCrossed {...props} />;
    case "cart":
      return <ShoppingBag {...props} />;
    case "task":
      return <Lightbulb {...props} />;
    default:
      return <Sparkles {...props} />;
  }
}

function CopilotCardView({ card }: { card: CopilotCard }) {
  if (card.type === "insight") {
    return (
      <div className="tdg-xmas-copilot-card">
        <strong>{card.title}</strong>
        <p>{card.body}</p>
        {card.href ? (
          <Link className="tdg-xmas-copilot-link" to={card.href}>
            Open module
          </Link>
        ) : null}
      </div>
    );
  }
  if (card.type === "task_list") {
    return (
      <div className="tdg-xmas-copilot-card">
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
      <div className="tdg-xmas-copilot-card">
        <strong>Budget</strong>
        <p>
          {card.spent} spent of {card.planned} · {card.remaining} left
        </p>
      </div>
    );
  }
  return (
    <div className="tdg-xmas-copilot-card">
      <strong>{card.title}</strong>
      <p>{card.body}</p>
    </div>
  );
}

export function ChristmasCopilotPanel({
  mode,
  intel,
  suggestions,
  nextWin,
  turns,
  question,
  applyNote,
  busy,
  onQuestionChange,
  onAsk,
  onClose,
  onApply,
}: {
  mode: "docked" | "drawer";
  intel: PlannerIntelligence | null;
  suggestions: CopilotSuggestion[];
  nextWin: CopilotNextWin;
  turns: CopilotTurn[];
  question: string;
  applyNote: string | null;
  busy?: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: (prompt?: string) => void;
  onClose?: () => void;
  onApply?: (turn: CopilotTurn) => void;
}) {
  const hasConversation = turns.length > 0;
  const latest = turns[turns.length - 1] || null;
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section
      className={`tdg-xmas-copilot tdg-xmas-copilot--${mode}`}
      aria-label="Christmas Copilot"
      data-testid="christmas-copilot-panel"
    >
      <div
        className="tdg-xmas-copilot-photo"
        aria-hidden="true"
        style={{ backgroundImage: `url(${COPILOT_PHOTO})` }}
      >
        {!prefersReducedMotion ? (
          <video
            className="tdg-xmas-copilot-fire"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            tabIndex={-1}
          >
            <source src={COPILOT_FIRE_WEBM} type="video/webm" />
            <source src={COPILOT_FIRE_MP4} type="video/mp4" />
          </video>
        ) : null}
        <div className="tdg-xmas-copilot-veil" />
      </div>

      <header className="tdg-xmas-copilot-head">
        <div>
          <p className="tdg-xmas-copilot-brand">
            <Sparkles size={16} strokeWidth={1.8} aria-hidden />
            Christmas Copilot
          </p>
          <p className="tdg-xmas-copilot-sub">A little help. A little Christmas magic.</p>
          {intel ? (
            <p className="tdg-xmas-copilot-meta">
              {intel.readiness.percent}% ready · {intel.snapshot.daysLeft} days left
            </p>
          ) : (
            <p className="tdg-xmas-copilot-meta">Reading your plan…</p>
          )}
        </div>
        {mode === "drawer" && onClose ? (
          <button type="button" className="tdg-xmas-copilot-close" onClick={onClose} aria-label="Close Christmas Copilot">
            <X size={18} aria-hidden />
          </button>
        ) : null}
      </header>

      <div className="tdg-xmas-copilot-scroll">
        {!hasConversation ? (
          <>
            <div className="tdg-xmas-copilot-suggestions" role="list">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="tdg-xmas-copilot-chip"
                  role="listitem"
                  disabled={!intel || busy}
                  onClick={() => onAsk(item.prompt)}
                >
                  <SuggestionIcon icon={item.icon} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="tdg-xmas-copilot-win">
              <p className="tdg-xmas-copilot-win-kicker">{nextWin.title}</p>
              <p className="tdg-xmas-copilot-win-body">{nextWin.body}</p>
              <button
                type="button"
                className="tdg-xmas-copilot-win-cta"
                disabled={!intel || busy}
                onClick={() => onAsk(nextWin.prompt)}
              >
                {nextWin.cta}
              </button>
            </div>
          </>
        ) : (
          <div className="tdg-xmas-copilot-thread" aria-live="polite">
            {turns.map((turn) => (
              <div key={turn.id} className="tdg-xmas-copilot-turn">
                <div className="tdg-xmas-copilot-bubble is-user">
                  <p>{turn.question}</p>
                </div>
                <div className="tdg-xmas-copilot-bubble is-assistant">
                  <p>{turn.reply.message}</p>
                  {turn.reply.cards.map((card, i) => (
                    <CopilotCardView key={`${turn.id}-${card.type}-${i}`} card={card} />
                  ))}
                  {turn.reply.followUpOptions.length ? (
                    <div className="tdg-xmas-copilot-followups">
                      {turn.reply.followUpOptions.map((opt) => (
                        <button key={opt} type="button" className="tdg-xmas-copilot-chip is-compact" onClick={() => onAsk(opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {latest?.reply.actionPlan?.steps.length && onApply ? (
              <div className="tdg-xmas-copilot-confirm">
                <p>Suggestion only. Nothing is saved until you confirm.</p>
                <ul>
                  {latest.reply.actionPlan.steps.map((step) => (
                    <li key={step.preview}>{step.preview}</li>
                  ))}
                </ul>
                <button type="button" className="tdg-xmas-copilot-win-cta" onClick={() => onApply(latest)}>
                  Confirm and apply
                </button>
                {applyNote ? <p className="tdg-xmas-copilot-meta">{applyNote}</p> : null}
              </div>
            ) : applyNote ? (
              <p className="tdg-xmas-copilot-meta">{applyNote}</p>
            ) : null}
          </div>
        )}
      </div>

      <form
        className="tdg-xmas-copilot-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onAsk();
        }}
      >
        <label className="tdg-planner-sr" htmlFor="tdg-xmas-copilot-input">
          Ask your Christmas Copilot
        </label>
        <input
          id="tdg-xmas-copilot-input"
          className="tdg-xmas-copilot-input"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value.slice(0, 240))}
          placeholder="Ask your Christmas Copilot..."
          disabled={!intel || busy}
          autoComplete="off"
        />
        <button
          type="submit"
          className="tdg-xmas-copilot-send"
          disabled={!intel || busy || !question.trim()}
          aria-label="Send"
        >
          <Send size={16} strokeWidth={2} aria-hidden />
        </button>
      </form>
    </section>
  );
}

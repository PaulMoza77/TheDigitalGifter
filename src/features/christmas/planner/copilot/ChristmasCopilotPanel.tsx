import { Gift, Lightbulb, Send, ShoppingBag, Sparkles, UtensilsCrossed, Wallet, X } from "lucide-react";
import type { RefObject } from "react";
import { Link } from "react-router-dom";
import type { CopilotCard, CopilotResponse } from "./ask";
import { COPILOT_PANEL_PHOTO, type CopilotNextWin, type CopilotSuggestion, type CopilotSuggestionIcon } from "./context";

export type CopilotTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: CopilotResponse;
};

function SuggestionIcon({ icon }: { icon: CopilotSuggestionIcon }) {
  const props = { size: 16, strokeWidth: 1.8, "aria-hidden": true as const };
  if (icon === "gift") return <Gift {...props} />;
  if (icon === "budget") return <Wallet {...props} />;
  if (icon === "food") return <UtensilsCrossed {...props} />;
  if (icon === "shop") return <ShoppingBag {...props} />;
  if (icon === "task") return <Sparkles {...props} />;
  return <Lightbulb {...props} />;
}

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

export function ChristmasCopilotPanel({
  variant,
  suggestions,
  nextWin,
  messages,
  question,
  onQuestion,
  onAsk,
  onClose,
  applyNote,
  onApply,
  busy,
  inputRef,
}: {
  variant: "rail" | "sheet";
  suggestions: CopilotSuggestion[];
  nextWin: CopilotNextWin;
  messages: CopilotTurn[];
  question: string;
  onQuestion: (value: string) => void;
  onAsk: (prompt?: string) => void;
  onClose?: () => void;
  applyNote: string | null;
  onApply: () => void;
  busy: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const last = messages.filter((m) => m.role === "assistant").at(-1);
  const showIdle = messages.length === 0;

  return (
    <section
      className={`tdg-copilot-panel is-${variant}`}
      aria-labelledby="tdg-copilot-title"
      data-testid="christmas-copilot-panel"
    >
      <div className="tdg-copilot-panel-photo" aria-hidden="true" style={{ backgroundImage: `url(${COPILOT_PANEL_PHOTO})` }} />
      <div className="tdg-copilot-panel-veil" aria-hidden="true" />
      <div className="tdg-copilot-panel-inner">
        <header className="tdg-copilot-panel-head">
          <div>
            <h2 id="tdg-copilot-title">
              <Sparkles size={18} strokeWidth={1.8} aria-hidden /> Christmas Copilot
            </h2>
            <p>A little help. A little Christmas magic.</p>
          </div>
          {variant === "sheet" && onClose ? (
            <button type="button" className="tdg-copilot-panel-close" onClick={onClose} aria-label="Close Christmas Copilot">
              <X size={18} />
            </button>
          ) : null}
        </header>

        <div className="tdg-copilot-panel-scroll">
          {showIdle ? (
            <>
              <div className="tdg-copilot-suggest">
                {suggestions.map((row) => (
                  <button key={row.id} type="button" onClick={() => onAsk(row.prompt)}>
                    <SuggestionIcon icon={row.icon} />
                    <span>{row.label}</span>
                  </button>
                ))}
              </div>
              <div className="tdg-copilot-nextwin">
                <p className="tdg-copilot-nextwin-kicker">{nextWin.kicker}</p>
                <p className="tdg-copilot-nextwin-title">{nextWin.title}</p>
                <button type="button" className="tdg-planner-btn primary" onClick={() => onAsk(nextWin.prompt)}>
                  {nextWin.cta}
                </button>
              </div>
            </>
          ) : (
            <div className="tdg-copilot-thread" aria-live="polite">
              {messages.map((turn) => (
                <div key={turn.id} className={`tdg-copilot-bubble is-${turn.role}`}>
                  <p>{turn.text}</p>
                  {turn.response?.cards.map((card, i) => (
                    <CopilotCardView key={`${turn.id}-${i}`} card={card} />
                  ))}
                </div>
              ))}
              {last?.response?.actionPlan?.steps.length ? (
                <div className="tdg-copilot-confirm">
                  <p>Suggestion only. Nothing is saved until you confirm.</p>
                  <ul>
                    {last.response.actionPlan.steps.map((step) => (
                      <li key={step.preview}>{step.preview}</li>
                    ))}
                  </ul>
                  <button type="button" className="tdg-planner-btn primary" onClick={onApply}>
                    Confirm and apply
                  </button>
                  {applyNote ? <p>{applyNote}</p> : null}
                </div>
              ) : last?.response?.unsupported?.reason === "no_tool" ? (
                <div className="tdg-copilot-confirm">
                  <p>I can show this on the plan. I will not invent live prices or write without a preview.</p>
                  {applyNote ? <p>{applyNote}</p> : null}
                </div>
              ) : applyNote ? (
                <p className="tdg-copilot-apply-note">{applyNote}</p>
              ) : null}
              {last?.response?.followUpOptions.length ? (
                <div className="tdg-copilot-followups">
                  {last.response.followUpOptions.map((opt) => (
                    <button key={opt} type="button" onClick={() => onAsk(opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form
          className="tdg-copilot-dock"
          onSubmit={(event) => {
            event.preventDefault();
            onAsk();
          }}
        >
          <label className="tdg-planner-sr" htmlFor="christmas-copilot-input">
            Ask Christmas Copilot
          </label>
          <input
            id="christmas-copilot-input"
            ref={inputRef}
            value={question}
            onChange={(e) => onQuestion(e.target.value.slice(0, 240))}
            placeholder="Ask your Christmas Copilot..."
            autoComplete="off"
            enterKeyHint="send"
          />
          <button type="submit" className="tdg-copilot-send" disabled={busy || !question.trim()} aria-label="Send">
            <Send size={16} strokeWidth={2} />
          </button>
        </form>
      </div>
    </section>
  );
}

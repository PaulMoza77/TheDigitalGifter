import { Link } from "react-router-dom";
import type { NextBestAction, PlannerInsight } from "./types";
import type { ReadinessBreakdown } from "./readinessIntelligence";

export function PlannerInsightCard({
  insight,
  onDismiss,
  onAction,
}: {
  insight: PlannerInsight;
  onDismiss?: (id: string) => void;
  onAction?: (insight: PlannerInsight) => void;
}) {
  const href = typeof insight.actionPayload.href === "string" ? insight.actionPayload.href : null;
  return (
    <article className={`tdg-intel-card tdg-intel-${insight.severity}`}>
      <p className="tdg-intel-kicker">{insight.category}</p>
      <h3>{insight.title}</h3>
      <p>{insight.body}</p>
      <p className="tdg-planner-muted tdg-intel-reason">{insight.reason}</p>
      <div className="tdg-planner-actions">
        {href ? (
          <Link className="tdg-planner-btn primary" to={href} onClick={() => onAction?.(insight)}>
            {insight.recommendedAction}
          </Link>
        ) : (
          <button type="button" className="tdg-planner-btn primary" onClick={() => onAction?.(insight)}>
            {insight.recommendedAction}
          </button>
        )}
        {insight.dismissible && onDismiss ? (
          <button type="button" className="tdg-planner-linkish" onClick={() => onDismiss(insight.id)}>
            Dismiss
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function PlannerAttentionList({
  insights,
  onDismiss,
  onAction,
}: {
  insights: PlannerInsight[];
  onDismiss?: (id: string) => void;
  onAction?: (insight: PlannerInsight) => void;
}) {
  if (!insights.length) return null;
  return (
    <section className="tdg-planner-section tdg-intel-attention">
      <h2>Needs attention</h2>
      {insights.map((insight) => (
        <PlannerInsightCard key={insight.id} insight={insight} onDismiss={onDismiss} onAction={onAction} />
      ))}
    </section>
  );
}

export function PlannerNextBestAction({ action }: { action: NextBestAction | null }) {
  if (!action) return null;
  return (
    <section className="tdg-planner-section tdg-intel-nba">
      <p className="tdg-intel-kicker">Next best action</p>
      <h2>{action.title}</h2>
      <p className="tdg-planner-muted">{action.reason}</p>
      <Link className="tdg-planner-btn primary" to={action.href}>
        Continue
      </Link>
    </section>
  );
}

export function PlannerOnTrackState() {
  return (
    <section className="tdg-planner-section tdg-intel-calm">
      <h2>You’re on track</h2>
      <p>Nothing urgent needs your attention today.</p>
    </section>
  );
}

export function PlannerReadinessBreakdown({ readiness }: { readiness: ReadinessBreakdown }) {
  return (
    <div className="tdg-intel-ready">
      {readiness.parts.map((part) => (
        <div key={part.key} className="tdg-intel-ready-row">
          <span>{part.label}</span>
          <b>{Math.round(part.score * 100)}%</b>
        </div>
      ))}
    </div>
  );
}

export function PlannerRecommendationSheet({
  title,
  body,
  rows,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  rows: Array<{ id: string; label: string; from: string; to: string }>;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="tdg-planner-sheet">
      <button type="button" className="tdg-planner-sheet-backdrop" onClick={onCancel} aria-label="Close" />
      <div className="tdg-planner-sheet-card">
        <div className="tdg-planner-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="tdg-planner-linkish" onClick={onCancel}>
            Keep current dates
          </button>
        </div>
        <p className="tdg-planner-muted">{body}</p>
        {rows.map((row) => (
          <div key={row.id} className="tdg-planner-row">
            <div>
              <strong>{row.label}</strong>
              <div className="tdg-planner-muted">
                {row.from || "No date"} → {row.to}
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="tdg-planner-btn primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

export function PlannerRescueBanner({ remaining }: { remaining: number }) {
  return (
    <section className="tdg-planner-section tdg-intel-rescue">
      <p className="tdg-intel-kicker">Christmas Rescue Mode</p>
      <h2>{remaining} essential {remaining === 1 ? "thing remains" : "things remain"}.</h2>
      <p>Let’s focus only on what still matters. Nice-to-have tasks stay on the plan, just quieter.</p>
    </section>
  );
}

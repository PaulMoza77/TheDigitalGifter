import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useGiftFinder } from "../../giftFinder/useGiftFinder";
import type { GiftIdea } from "../../giftFinder/logic";
import { ideaPriceBucket } from "../../giftFinder/logic";
import { trackPlannerEvent } from "../analytics";
import { formatPlannerMoney, invalidatePlannerSnapshot } from "../intelligence";
import type { GiftItem, GiftRecipient } from "../types";
import { addFinderIdeaToPlanner } from "./addIdea";
import {
  CONCIERGE_PRICE_CHIPS,
  CONCIERGE_VIBE_CHIPS,
  buildConciergeFinderInput,
  existingGiftTitlesForRecipient,
  generalizedRelationshipCategory,
  recipientSpendContext,
  suggestionBudgetFit,
  typicalPriceLabel,
  type ConciergeDraft,
} from "./context";
import "./giftConcierge.css";

type Props = {
  open: boolean;
  recipient: GiftRecipient;
  gifts: GiftItem[];
  profileId: string;
  currency: string;
  countryCode?: string | null;
  locale?: string;
  onClose: () => void;
  onAdded: (gift: GiftItem) => void;
  onAddManually: () => void;
};

export function GiftConcierge({
  open,
  recipient,
  gifts,
  profileId,
  currency,
  countryCode,
  locale,
  onClose,
  onAdded,
  onAddManually,
}: Props) {
  const titleId = useId();
  const spend = recipientSpendContext(recipient, gifts);
  const existingTitles = existingGiftTitlesForRecipient(gifts, recipient.id);
  const finder = useGiftFinder();
  const finderReset = finder.reset;
  const [draft, setDraft] = useState<ConciergeDraft>({
    interests: "",
    vibeKeys: [],
    priceKey: null,
    customBudget: "",
  });
  const [avoid, setAvoid] = useState<string[]>([]);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const addingLock = useRef(false);
  const openedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      openedFor.current = null;
      return;
    }
    if (openedFor.current === recipient.id) return;
    openedFor.current = recipient.id;
    finderReset();
    setDraft({ interests: "", vibeKeys: [], priceKey: null, customBudget: "" });
    setAvoid([]);
    trackPlannerEvent("gift_concierge_opened", {
      module: "gifts",
      metadata: {
        relationship_category: generalizedRelationshipCategory(recipient.relationship),
        source: "planner",
      },
    });
  }, [open, recipient.id, recipient.relationship, finderReset]);

  const remainingLabel =
    spend.remainingMinor == null ? null : formatPlannerMoney(Math.max(0, spend.remainingMinor), currency);
  const budgetLabel = spend.budgetMinor == null ? null : formatPlannerMoney(spend.budgetMinor, currency);

  const loadingCopy = useMemo(
    () => `Finding thoughtful ideas for ${recipient.display_name}…`,
    [recipient.display_name],
  );

  async function generate(likeIdea?: GiftIdea | null) {
    const input = buildConciergeFinderInput({
      recipient,
      gifts,
      currency,
      locale,
      countryCode,
      draft,
      likeIdea: likeIdea || null,
      avoidTitles: avoid,
    });
    try {
      const result = await finder.generate(
        { ...input, forceNew: Boolean(likeIdea) || input.forceNew },
        [...existingTitles, ...avoid],
      );
      trackPlannerEvent(likeIdea ? "gift_concierge_refined" : "gift_concierge_generated", {
        module: "gifts",
        metadata: {
          relationship_category: generalizedRelationshipCategory(recipient.relationship),
          price_bucket: input.budgetKey,
          suggestion_count: result.ideas.length,
          source: likeIdea ? "more_like_this" : "planner",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      trackPlannerEvent("gift_concierge_failed", {
        module: "gifts",
        metadata: {
          source: "planner",
          reason: msg.includes("rate_limited") ? "rate_limited" : "generation",
        },
      });
    }
  }

  async function addIdea(idea: GiftIdea) {
    const key = idea.result_key || idea.id || idea.title;
    if (addingLock.current) return;
    addingLock.current = true;
    setAddingKey(key);
    try {
      const result = await addFinderIdeaToPlanner({
        profileId,
        recipientId: recipient.id,
        idea,
        existing: gifts,
      });
      invalidatePlannerSnapshot();
      onAdded(result.gift);
      trackPlannerEvent("gift_concierge_suggestion_added", {
        module: "gifts",
        metadata: {
          relationship_category: generalizedRelationshipCategory(recipient.relationship),
          price_bucket: ideaPriceBucket(idea),
          source: "gift_finder",
          duplicate: result.duplicate,
        },
      });
      trackPlannerEvent("planner_gift_added", { module: "gifts", countBucket: "1", metadata: { source: "gift_finder" } });
    } finally {
      addingLock.current = false;
      setAddingKey(null);
    }
  }

  function toggleVibe(key: string) {
    setDraft((prev) => ({
      ...prev,
      vibeKeys: prev.vibeKeys.includes(key) ? prev.vibeKeys.filter((k) => k !== key) : [...prev.vibeKeys, key],
    }));
  }

  if (!open) return null;

  return (
    <div className="tdg-concierge" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="tdg-concierge-backdrop" onClick={onClose} aria-label="Close gift ideas" />
      <aside className="tdg-concierge-panel">
        <header className="tdg-concierge-head">
          <div>
            <p className="tdg-planner-kicker">Gift Concierge</p>
            <h2 id={titleId}>Gift ideas for {recipient.display_name}</h2>
            <p className="tdg-concierge-sub">
              {recipient.relationship ? `${prettyRel(recipient.relationship)}` : "Recipient"}
              {budgetLabel ? ` · ${budgetLabel} budget` : ""}
              {remainingLabel && spend.budgetMinor != null ? ` · ${remainingLabel} remaining` : ""}
            </p>
          </div>
          <button type="button" className="tdg-concierge-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <div className="tdg-concierge-body">
          {finder.phase === "idle" || finder.phase === "error" ? (
            <div className="tdg-concierge-intro">
              <h3>Need inspiration for {recipient.display_name}?</h3>
              <dl className="tdg-concierge-facts">
                <div>
                  <dt>Relationship</dt>
                  <dd>{prettyRel(recipient.relationship || "Family")}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>{budgetLabel || "Optional"}</dd>
                </div>
                {remainingLabel ? (
                  <div>
                    <dt>Remaining</dt>
                    <dd>{remainingLabel}</dd>
                  </div>
                ) : null}
              </dl>
              {spend.budgetMinor == null ? (
                <label className="tdg-concierge-label">
                  Budget for this gift
                  <input
                    className="tdg-planner-input"
                    inputMode="decimal"
                    placeholder="€"
                    value={draft.customBudget}
                    onChange={(e) => setDraft((p) => ({ ...p, priceKey: "custom", customBudget: e.target.value }))}
                  />
                </label>
              ) : null}
              <label className="tdg-concierge-label">
                What are they into?
                <input
                  className="tdg-planner-input"
                  placeholder="Add interests for better matches"
                  value={draft.interests}
                  onChange={(e) => setDraft((p) => ({ ...p, interests: e.target.value.slice(0, 120) }))}
                />
              </label>
              <div className="tdg-concierge-chips" aria-label="Tone">
                {CONCIERGE_VIBE_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={`tdg-concierge-chip ${draft.vibeKeys.includes(chip.key) ? "on" : ""}`}
                    aria-pressed={draft.vibeKeys.includes(chip.key)}
                    onClick={() => toggleVibe(chip.key)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="tdg-concierge-chips" aria-label="Price">
                {CONCIERGE_PRICE_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={`tdg-concierge-chip ${draft.priceKey === chip.key ? "on" : ""}`}
                    aria-pressed={draft.priceKey === chip.key}
                    onClick={() => setDraft((p) => ({ ...p, priceKey: p.priceKey === chip.key ? null : chip.key }))}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              {draft.priceKey === "custom" && spend.budgetMinor != null ? (
                <input
                  className="tdg-planner-input"
                  inputMode="decimal"
                  placeholder="Custom amount"
                  value={draft.customBudget}
                  onChange={(e) => setDraft((p) => ({ ...p, customBudget: e.target.value }))}
                />
              ) : null}
              {finder.phase === "error" ? (
                <div className="tdg-concierge-error" role="alert">
                  <p>We couldn’t find ideas just now.</p>
                  <div className="tdg-planner-actions">
                    <button type="button" className="tdg-planner-btn primary" onClick={() => void generate()}>
                      Try again
                    </button>
                    <button type="button" className="tdg-planner-btn" onClick={onAddManually}>
                      Add an idea manually
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="tdg-planner-btn primary tdg-concierge-cta" onClick={() => void generate()}>
                  Find ideas
                </button>
              )}
            </div>
          ) : null}

          {finder.phase === "loading" ? (
            <div className="tdg-concierge-loading" aria-live="polite">
              <p>{loadingCopy}</p>
              <div className="tdg-concierge-skeleton" />
              <div className="tdg-concierge-skeleton" />
              <div className="tdg-concierge-skeleton" />
            </div>
          ) : null}

          {finder.phase === "results" ? (
            <div className="tdg-concierge-results">
              {finder.ideas.map((idea) => {
                const key = idea.result_key || idea.id || idea.title;
                const fit = suggestionBudgetFit(idea, spend.remainingMinor);
                const price = typicalPriceLabel(idea);
                const justAdded = gifts.some(
                  (g) => (g.source_ref && g.source_ref === (idea.result_key || idea.id)) || g.idea === idea.title,
                );
                return (
                  <article key={key} className="tdg-concierge-row">
                    <div>
                      <h3>{idea.title}</h3>
                      <p className="tdg-concierge-reason">Good fit because {trimReason(idea.reason)}</p>
                      <p className="tdg-concierge-meta">
                        <span className="tdg-concierge-idea-tag">Idea</span>
                        {idea.gift_type || idea.category ? <span>{idea.gift_type || idea.category}</span> : null}
                        {price ? <span>{price}</span> : null}
                      </p>
                      {fit === "fits" && remainingLabel ? (
                        <p className="tdg-concierge-fit is-ok">Fits your {remainingLabel} remaining budget</p>
                      ) : null}
                      {fit === "above" && remainingLabel ? (
                        <p className="tdg-concierge-fit is-over">Above {recipient.display_name}’s remaining budget</p>
                      ) : null}
                    </div>
                    <div className="tdg-concierge-row-actions">
                      <button
                        type="button"
                        className="tdg-planner-btn primary"
                        disabled={Boolean(addingKey)}
                        onClick={() => void addIdea(idea)}
                      >
                        {justAdded ? "Added ✓" : addingKey === key ? "Adding…" : `Add to ${recipient.display_name}`}
                      </button>
                      <button type="button" className="tdg-planner-linkish" onClick={() => void generate(idea)}>
                        More like this
                      </button>
                      <button
                        type="button"
                        className="tdg-planner-linkish"
                        onClick={() => {
                          setAvoid((p) => [...p, idea.title]);
                          finder.dismissIdea(idea);
                        }}
                      >
                        Not for them
                      </button>
                    </div>
                    {justAdded ? (
                      <p className="tdg-concierge-added" role="status">
                        Added to {recipient.display_name} ✓
                      </p>
                    ) : null}
                  </article>
                );
              })}
              <div className="tdg-planner-actions tdg-concierge-foot">
                <button type="button" className="tdg-planner-btn" onClick={() => void generate()}>
                  Find more
                </button>
                <button type="button" className="tdg-planner-btn" onClick={onClose}>
                  View {recipient.display_name}’s gifts
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function prettyRel(value: string): string {
  const v = value.trim();
  if (!v) return "Family";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function trimReason(reason: string): string {
  const t = reason.trim();
  if (!t) return "it matches the brief you already have in the Planner.";
  return t.replace(/^good fit because\s+/i, "");
}

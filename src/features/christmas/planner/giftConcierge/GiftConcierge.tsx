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
import {
  AffiliateProductImage,
} from "../../affiliateProducts/AffiliateProductImage";
import { AffiliateDisclosure } from "../../affiliateProducts/AffiliateDisclosure";
import { addAffiliateProductToPlanner } from "../../affiliateProducts/addProduct";
import {
  deliveryWarning,
  fetchAffiliateProductStatus,
  getOrCreateAffiliateReferenceId,
  liveShoppingUnavailableCopy,
  overBudgetDeltaMinor,
  plannerGiftOutboundUrl,
  productFitsRemaining,
} from "../../affiliateProducts/client";
import { priceBucketFromMinor, type AffiliateProduct } from "../../affiliateProducts/helpers";
import { useAffiliateProductSearch } from "../../affiliateProducts/useAffiliateProductSearch";
import "./giftConcierge.css";

type ConciergeTab = "ideas" | "shop";

export type ConciergeIntent = {
  kind: "find_similar";
  query: string;
  category?: string | null;
} | null;

type Props = {
  open: boolean;
  recipient: GiftRecipient;
  gifts: GiftItem[];
  profileId: string;
  currency: string;
  countryCode?: string | null;
  locale?: string;
  intent?: ConciergeIntent;
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
  intent = null,
  onClose,
  onAdded,
  onAddManually,
}: Props) {
  const titleId = useId();
  const spend = recipientSpendContext(recipient, gifts);
  const existingTitles = existingGiftTitlesForRecipient(gifts, recipient.id);
  const finder = useGiftFinder();
  const finderReset = finder.reset;
  const shop = useAffiliateProductSearch();
  const [draft, setDraft] = useState<ConciergeDraft>({
    interests: "",
    vibeKeys: [],
    priceKey: null,
    customBudget: "",
  });
  const [avoid, setAvoid] = useState<string[]>([]);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [tab, setTab] = useState<ConciergeTab>("ideas");
  const [shopEnabled, setShopEnabled] = useState(false);
  const [shopQuery, setShopQuery] = useState("");
  const [shopSource, setShopSource] = useState<"idea" | "recipient_search">("recipient_search");
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
    if (openedFor.current === recipient.id && !intent) return;
    openedFor.current = recipient.id;
    finderReset();
    shop.reset();
    setDraft({ interests: "", vibeKeys: [], priceKey: null, customBudget: "" });
    setAvoid([]);
    const similar = intent?.kind === "find_similar";
    setTab(similar ? "shop" : "ideas");
    setShopQuery(similar ? intent.query : "");
    setShopSource(similar ? "idea" : "recipient_search");
    trackPlannerEvent("gift_concierge_opened", {
      module: "gifts",
      metadata: {
        relationship_category: generalizedRelationshipCategory(recipient.relationship),
        source: similar ? "find_similar" : "planner",
      },
    });
    void fetchAffiliateProductStatus().then((status) => {
      setShopEnabled(Boolean(status.enabled));
      if (similar) {
        if (status.enabled) {
          void runShopSearch({
            query: intent.query,
            source: "idea",
            ideaTitle: intent.query,
            searchQuery: intent.category || intent.query,
          });
        } else {
          shop.setPhase("disabled");
        }
      }
    });
  }, [open, recipient.id, recipient.relationship, finderReset, shop.reset, intent?.kind, intent?.query]);

  const remainingLabel =
    spend.remainingMinor == null ? null : formatPlannerMoney(Math.max(0, spend.remainingMinor), currency);
  const budgetLabel = spend.budgetMinor == null ? null : formatPlannerMoney(spend.budgetMinor, currency);
  const christmasOn = `${new Date().getFullYear()}-12-25`;

  const loadingCopy = useMemo(
    () => `Finding thoughtful ideas for ${recipient.display_name}…`,
    [recipient.display_name],
  );
  const shopLoadingCopy = useMemo(
    () => `Finding real products for ${recipient.display_name}…`,
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

  function shopContextInput(overrides?: { query?: string; source?: "idea" | "recipient_search"; ideaTitle?: string; searchQuery?: string }) {
    return {
      query: overrides?.query ?? shopQuery,
      source: overrides?.source ?? shopSource,
      countryCode,
      locale,
      currency,
      priceMaxMinor: spend.remainingMinor != null && spend.remainingMinor > 0 ? spend.remainingMinor : null,
      ideaTitle: overrides?.ideaTitle,
      searchQuery: overrides?.searchQuery,
      interests: draft.interests,
      vibeKeys: draft.vibeKeys,
      relationshipCategory: generalizedRelationshipCategory(recipient.relationship),
    };
  }

  async function runShopSearch(overrides?: {
    query?: string;
    source?: "idea" | "recipient_search";
    ideaTitle?: string;
    searchQuery?: string;
  }) {
    const source = overrides?.source ?? shopSource;
    trackPlannerEvent("affiliate_products_opened", {
      module: "gifts",
      metadata: { provider: "ebay", source },
    });
    trackPlannerEvent("affiliate_product_search", {
      module: "gifts",
      metadata: {
        provider: "ebay",
        source,
        price_bucket: priceBucketFromMinor(spend.remainingMinor),
      },
    });
    try {
      const result = await shop.search(shopContextInput(overrides));
      if (!result.enabled) {
        return;
      }
      if (!result.ok) {
        trackPlannerEvent("affiliate_product_search_failed", {
          module: "gifts",
          metadata: { provider: result.provider || "ebay", source, reason: result.reason || "provider_unavailable" },
        });
        return;
      }
      trackPlannerEvent("affiliate_product_results_viewed", {
        module: "gifts",
        metadata: {
          provider: result.provider || "ebay",
          marketplace: result.marketplace || undefined,
          result_count: result.products.length,
          source,
          affiliate_reference_id: getOrCreateAffiliateReferenceId(),
        },
      });
    } catch {
      trackPlannerEvent("affiliate_product_search_failed", {
        module: "gifts",
        metadata: { provider: "ebay", source, reason: "provider_unavailable" },
      });
    }
  }

  function shopThisIdea(idea: GiftIdea) {
    const q = (idea.search_query || idea.title).slice(0, 80);
    setShopQuery(q);
    setShopSource("idea");
    setTab("shop");
    if (!shopEnabled) {
      shop.setPhase("disabled");
      return;
    }
    void runShopSearch({ query: q, source: "idea", ideaTitle: idea.title, searchQuery: idea.search_query });
  }

  async function addProduct(product: AffiliateProduct) {
    const key = `${product.provider}:${product.externalProductId}`;
    if (addingLock.current) return;
    addingLock.current = true;
    setAddingKey(key);
    try {
      const result = await addAffiliateProductToPlanner({
        profileId,
        recipientId: recipient.id,
        product,
        existing: gifts,
      });
      invalidatePlannerSnapshot();
      onAdded(result.gift);
      trackPlannerEvent("affiliate_product_added_to_planner", {
        module: "gifts",
        metadata: {
          provider: product.provider,
          source: shopSource,
          duplicate: result.duplicate,
          price_bucket: priceBucketFromMinor(Math.round(product.price * 100)),
        },
      });
      trackPlannerEvent("planner_gift_added", {
        module: "gifts",
        countBucket: "1",
        metadata: { source: "affiliate_product" },
      });
    } finally {
      addingLock.current = false;
      setAddingKey(null);
    }
  }

  function openAffiliate(product: AffiliateProduct) {
    const href = plannerGiftOutboundUrl({ url: product.affiliateUrl });
    if (!href) return;
    trackPlannerEvent("affiliate_product_clicked", {
      module: "gifts",
      metadata: {
        provider: product.provider,
        source: shopSource,
        price_bucket: priceBucketFromMinor(Math.round(product.price * 100)),
      },
    });
    window.open(href, "_blank", "noopener,noreferrer");
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

        {shopEnabled ? (
          <div className="tdg-concierge-tabs" role="tablist" aria-label="Gift Concierge">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "ideas"}
              className={`tdg-concierge-tab ${tab === "ideas" ? "on" : ""}`}
              onClick={() => setTab("ideas")}
            >
              Ideas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "shop"}
              className={`tdg-concierge-tab ${tab === "shop" ? "on" : ""}`}
              onClick={() => {
                setTab("shop");
                if (shop.phase === "idle") void runShopSearch({ source: "recipient_search" });
              }}
            >
              Shop real products
            </button>
          </div>
        ) : null}

        <div className="tdg-concierge-body">
          {tab === "ideas" ? (
            <>
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
                      {shopEnabled ? (
                        <button type="button" className="tdg-planner-btn" onClick={() => shopThisIdea(idea)}>
                          Shop this idea
                        </button>
                      ) : null}
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
            </>
          ) : (
            <ShopPanel
              recipientName={recipient.display_name}
              remainingLabel={remainingLabel}
              remainingMinor={spend.remainingMinor}
              currency={currency}
              christmasOn={christmasOn}
              query={shopQuery}
              onQuery={(v) => setShopQuery(v.slice(0, 80))}
              loadingCopy={shopLoadingCopy}
              phase={shop.phase}
              reason={shop.reason}
              products={shop.products}
              addingKey={addingKey}
              gifts={gifts}
              onSearch={() => void runShopSearch({ query: shopQuery, source: shopSource })}
              onRetry={() => void runShopSearch()}
              onBackIdeas={() => setTab("ideas")}
              onAdd={addProduct}
              onView={openAffiliate}
              onMoreLike={(product) => {
                setShopQuery(product.title.slice(0, 80));
                setShopSource("idea");
                void runShopSearch({ query: product.title.slice(0, 80), source: "idea", ideaTitle: product.title });
              }}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function ShopPanel({
  recipientName,
  remainingLabel,
  remainingMinor,
  currency,
  christmasOn,
  query,
  onQuery,
  loadingCopy,
  phase,
  reason,
  products,
  addingKey,
  gifts,
  onSearch,
  onRetry,
  onBackIdeas,
  onAdd,
  onView,
  onMoreLike,
}: {
  recipientName: string;
  remainingLabel: string | null;
  remainingMinor: number | null;
  currency: string;
  christmasOn: string;
  query: string;
  onQuery: (v: string) => void;
  loadingCopy: string;
  phase: string;
  reason: string | null;
  products: AffiliateProduct[];
  addingKey: string | null;
  gifts: GiftItem[];
  onSearch: () => void;
  onRetry: () => void;
  onBackIdeas: () => void;
  onAdd: (p: AffiliateProduct) => void;
  onView: (p: AffiliateProduct) => void;
  onMoreLike: (p: AffiliateProduct) => void;
}) {
  return (
    <div className="tdg-concierge-shop">
      <label className="tdg-concierge-label">
        Search products
        <input
          className="tdg-planner-input"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          placeholder="engraved jewelry"
        />
      </label>
      <button type="button" className="tdg-planner-btn primary tdg-concierge-cta" onClick={onSearch}>
        Search
      </button>

      {phase === "loading" ? (
        <div className="tdg-concierge-loading" aria-live="polite">
          <p>{loadingCopy}</p>
          <div className="tdg-concierge-skeleton tdg-aff-skel" />
          <div className="tdg-concierge-skeleton tdg-aff-skel" />
          <div className="tdg-concierge-skeleton tdg-aff-skel" />
          <div className="tdg-concierge-skeleton tdg-aff-skel" />
        </div>
      ) : null}

      {phase === "error" || phase === "disabled" ? (
        <div className="tdg-concierge-error" role="alert">
          <p>
            {phase === "disabled"
              ? liveShoppingUnavailableCopy(reason)
              : "We couldn’t load live products right now."}
          </p>
          <div className="tdg-planner-actions">
            {phase === "error" ? (
              <button type="button" className="tdg-planner-btn primary" onClick={onRetry}>
                Try again
              </button>
            ) : null}
            <button type="button" className="tdg-planner-btn" onClick={onBackIdeas}>
              Back to gift ideas
            </button>
          </div>
        </div>
      ) : null}

      {phase === "results" ? (
        <div className="tdg-concierge-results">
          {products.length === 0 ? (
            <p className="tdg-planner-muted">No live products matched this search. Try a simpler phrase.</p>
          ) : (
            products.map((product) => {
              const key = `${product.provider}:${product.externalProductId}`;
              const justAdded = gifts.some(
                (g) => g.source_ref === key || g.url === product.affiliateUrl,
              );
              const fit = productFitsRemaining(product.price, remainingMinor);
              const over = overBudgetDeltaMinor(product.price, remainingMinor);
              const price = formatProductPrice(product.price, product.currency, currency);
              const warn = deliveryWarning({ deliveryEnd: product.deliveryEnd, christmasOn });
              return (
                <article key={key} className="tdg-concierge-row tdg-aff-row">
                  <AffiliateProductImage product={product} />
                  <div className="tdg-aff-copy">
                    <h3>{product.title}</h3>
                    <p className="tdg-concierge-meta">
                      <span>{price}</span>
                      <span>{product.merchant}</span>
                      {product.condition ? <span>{product.condition}</span> : null}
                    </p>
                    {product.deliveryStart || product.deliveryEnd ? (
                      <p className="tdg-concierge-meta">
                        Arrives {product.deliveryStart || ""}
                        {product.deliveryEnd && product.deliveryStart !== product.deliveryEnd
                          ? `–${product.deliveryEnd}`
                          : product.deliveryEnd && !product.deliveryStart
                            ? product.deliveryEnd
                            : ""}
                      </p>
                    ) : null}
                    {warn === "after_christmas" ? (
                      <p className="tdg-concierge-fit is-over">May arrive after Christmas</p>
                    ) : null}
                    {warn === "after_leave" ? (
                      <p className="tdg-concierge-fit is-over">May arrive after you leave.</p>
                    ) : null}
                    {fit === "fits" && remainingLabel ? (
                      <p className="tdg-concierge-fit is-ok">Fits your {remainingLabel} remaining budget</p>
                    ) : null}
                    {fit === "over" && over != null && remainingLabel ? (
                      <p className="tdg-concierge-fit is-over">
                        {formatPlannerMoney(over, currency)} over remaining budget
                      </p>
                    ) : null}
                    <div className="tdg-concierge-row-actions">
                      <button
                        type="button"
                        className="tdg-planner-btn primary"
                        disabled={Boolean(addingKey)}
                        onClick={() => void onAdd(product)}
                      >
                        {justAdded ? "Added ✓" : addingKey === key ? "Adding…" : `Add to ${recipientName}`}
                      </button>
                      <button type="button" className="tdg-planner-linkish" onClick={() => onView(product)}>
                        View product ↗
                      </button>
                      <button type="button" className="tdg-planner-linkish" onClick={() => onMoreLike(product)}>
                        More like this
                      </button>
                    </div>
                    {justAdded ? (
                      <p className="tdg-concierge-added" role="status">
                        Added to {recipientName} ✓
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
          <AffiliateDisclosure />
        </div>
      ) : null}
    </div>
  );
}

function formatProductPrice(amount: number, productCurrency: string, fallback: string): string {
  const code = (productCurrency || fallback || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
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

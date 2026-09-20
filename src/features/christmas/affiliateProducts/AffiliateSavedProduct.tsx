import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "../planner/analytics";
import { formatPlannerMoney } from "../planner/intelligence";
import type { GiftItem } from "../planner/types";
import { AffiliateDisclosure } from "./AffiliateDisclosure";
import { AffiliateProductImage } from "./AffiliateProductImage";
import { refreshAffiliateGiftPrice } from "./client";
import {
  affiliateFreshnessState,
  exceedsRemainingBudget,
  freshnessCheckedLabel,
  liveShoppingUnavailableCopy,
  plannerGiftOutboundUrl,
  priceChangeCopy,
  shouldPromptPriceCheck,
} from "./helpers";
import { PlannerGiftOutboundLink } from "../planner/PlannerGiftLink";

function meta(gift: GiftItem): Record<string, unknown> {
  return gift.source_meta && typeof gift.source_meta === "object" ? (gift.source_meta as Record<string, unknown>) : {};
}

function addedMinor(gift: GiftItem): number | null {
  const m = meta(gift);
  if (typeof m.addedPriceMinor === "number") return m.addedPriceMinor;
  return gift.planned_price_minor;
}

function currentMinor(gift: GiftItem): number | null {
  const m = meta(gift);
  if (typeof m.lastPriceMinor === "number") return m.lastPriceMinor;
  return gift.planned_price_minor;
}

export function AffiliateSavedProductPanel({
  gift,
  currency,
  remainingMinor,
  onChange,
  onFindSimilar,
}: {
  gift: GiftItem;
  currency: string;
  remainingMinor: number | null;
  onChange: (next: GiftItem) => void;
  onFindSimilar: (gift: GiftItem) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  if (gift.source_type !== "affiliate_product") return null;

  const extras = meta(gift);
  const availability = String(extras.availability || "");
  const unavailable = availability === "unavailable";
  const freshness = affiliateFreshnessState(gift.price_checked_at);
  const checked = freshnessCheckedLabel(gift.price_checked_at);
  const href = plannerGiftOutboundUrl(gift);
  const added = addedMinor(gift);
  const current = currentMinor(gift);
  const format = (minor: number) => formatPlannerMoney(minor, currency);
  const change = priceChangeCopy({ addedMinor: added, currentMinor: current, format });
  const over = exceedsRemainingBudget(current, remainingMinor, gift.planned_price_minor);
  const provider = String(extras.provider || gift.store || "Partner");
  const delivery = String(extras.deliveryEnd || gift.delivery_on || "");

  async function checkPrice() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await refreshAffiliateGiftPrice(gift.id);
      if (!result.enabled) {
        setNotice(liveShoppingUnavailableCopy(result.reason));
        return;
      }
      if (result.gift) {
        onChange(result.gift);
        if (result.unavailable) setNotice("This product may no longer be available.");
      } else if (result.unavailable) {
        onChange({
          ...gift,
          source_meta: { ...extras, availability: "unavailable" },
          price_checked_at: new Date().toISOString(),
        });
        setNotice("This product may no longer be available.");
      }
    } catch {
      setNotice(liveShoppingUnavailableCopy("provider_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function keepInPlan() {
    setNotice(null);
  }

  async function removeLink() {
    const nextMeta = { ...extras, linkRemoved: true };
    await supabase.from("christmas_gift_items").update({ url: null, source_meta: nextMeta }).eq("id", gift.id);
    onChange({ ...gift, url: null, source_meta: nextMeta });
  }

  return (
    <div className="tdg-aff-saved">
      <div className="tdg-aff-saved-row">
        <AffiliateProductImage product={{ title: gift.selected_gift || gift.idea, imageUrl: gift.image_url || undefined }} />
        <div>
          <p className="tdg-aff-saved-meta">
            <span>{provider}</span>
            {added != null ? <span>{format(added)} when added</span> : null}
          </p>
          {change ? (
            <p className="tdg-aff-saved-change">
              {change.summary}
              {change.deltaLabel ? ` · ${change.deltaLabel}` : ""}
            </p>
          ) : null}
          {checked ? <p className="tdg-planner-muted">{checked}</p> : null}
          {shouldPromptPriceCheck(freshness) ? (
            <button type="button" className="tdg-planner-btn" disabled={busy} onClick={() => void checkPrice()}>
              {busy ? "Checking…" : "Check current price"}
            </button>
          ) : (
            <button type="button" className="tdg-planner-linkish" disabled={busy} onClick={() => void checkPrice()}>
              Check current price
            </button>
          )}
          {delivery ? <p className="tdg-planner-muted">Delivery {delivery}</p> : null}
          {availability && availability !== "unknown" && !unavailable ? (
            <p className="tdg-planner-muted">{availability.replace("_", " ")}</p>
          ) : null}
          {href ? <PlannerGiftOutboundLink gift={gift} source="gift_editor" /> : null}
        </div>
      </div>
      {over?.over ? (
        <p className="tdg-concierge-fit is-over" role="status">
          This now exceeds the remaining budget by {format(over.overByMinor)}.
        </p>
      ) : null}
      {unavailable ? (
        <div className="tdg-aff-unavail" role="status">
          <p>This product may no longer be available.</p>
          <div className="tdg-planner-actions">
            <button
              type="button"
              className="tdg-planner-btn primary"
              onClick={() => {
                trackPlannerEvent("affiliate_product_find_similar", {
                  module: "gifts",
                  metadata: { provider, source: "find_similar" },
                });
                onFindSimilar(gift);
              }}
            >
              Find similar
            </button>
            <button type="button" className="tdg-planner-btn" onClick={() => void keepInPlan()}>
              Keep in plan
            </button>
            <button type="button" className="tdg-planner-linkish" onClick={() => void removeLink()}>
              Remove link
            </button>
          </div>
        </div>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <AffiliateDisclosure />
    </div>
  );
}

export function findSimilarQuery(gift: GiftItem): string {
  const extras = meta(gift);
  const category = String(extras.category || "").trim();
  const title = (gift.selected_gift || gift.idea || "").trim();
  return (category ? `${title} ${category}` : title).slice(0, 80);
}

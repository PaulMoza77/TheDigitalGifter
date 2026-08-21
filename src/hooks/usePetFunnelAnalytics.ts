import * as React from "react";
import { supabase } from "@/lib/supabase";
import {
  attributionFallbackLabel,
  biggestFunnelDrop,
  buildFunnelSteps,
  buildKpis,
  countsFromRows,
  emptyStepCounts,
  funnelWarnings,
  percent,
  rangeForPreset,
  type AttributionBreakdownRow,
  type DatePreset,
  type PetFunnelAnalyticsReport,
  type SpeciesBreakdownRow,
} from "@/features/pet/funnelDashboard";

type RpcRow = Record<string, unknown>;

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapBreakdown(row: RpcRow, kind: "campaign" | "ad"): AttributionBreakdownRow {
  const sourceGroup = row.source_group === "meta" || row.source_group === "other" ? row.source_group : "unattributed";
  const fallback = attributionFallbackLabel({
    utmSource: sourceGroup === "unattributed" ? null : String(row.campaign || ""),
    campaignId: sourceGroup === "meta" ? String(row.campaign || "") : null,
  });
  const lpv = asNumber(row.lpv);
  const purchase = asNumber(row.purchase_count);
  return {
    campaign: String(row.campaign || fallback.label),
    adSet: String(row.ad_set || "—"),
    ad: String(row.ad || (kind === "ad" ? fallback.label : "—")),
    sourceGroup,
    lpv,
    name: asNumber(row.name_count),
    upload: asNumber(row.upload_count),
    review: asNumber(row.review_count),
    checkout: asNumber(row.checkout_count),
    purchase,
    revenueCents: asNumber(row.revenue_cents),
    cvr: percent(purchase, lpv),
    spend: null,
    cpa: null,
    roas: null,
  };
}

function mapSpecies(row: RpcRow): SpeciesBreakdownRow | null {
  const species = row.species;
  if (species !== "dog" && species !== "cat" && species !== "other") return null;
  const lpv = asNumber(row.lpv);
  const purchase = asNumber(row.purchase_count);
  return {
    species,
    lpv,
    checkout: asNumber(row.checkout_count),
    purchase,
    cvr: percent(purchase, lpv),
    revenueCents: asNumber(row.revenue_cents),
  };
}

export function usePetFunnelAnalytics(preset: DatePreset, custom?: { from: string; to: string }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [report, setReport] = React.useState<PetFunnelAnalyticsReport | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    const range = rangeForPreset(preset, new Date(), custom);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_pet_funnel_analytics", {
        p_from: range.from.toISOString(),
        p_to: range.to.toISOString(),
        p_prev_from: range.previousFrom.toISOString(),
        p_prev_to: range.previousTo.toISOString(),
      });
      if (rpcError) throw new Error(rpcError.message);
      const payload = (data || {}) as RpcRow;
      const counts = countsFromRows((payload.steps as RpcRow[]) || []);
      const previousCounts = countsFromRows((payload.previous_steps as RpcRow[]) || []);
      const steps = buildFunnelSteps(counts);
      const previousSteps = buildFunnelSteps(previousCounts);
      const firstEventAt = payload.first_event_at ? String(payload.first_event_at) : null;
      const ads = ((payload.ads as RpcRow[]) || []).map((row) => mapBreakdown(row, "ad"));
      const mapped: PetFunnelAnalyticsReport = {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        firstEventAt,
        steps,
        previousSteps,
        kpis: buildKpis(counts, asNumber(payload.revenue_cents), asNumber(payload.previous_revenue_cents)),
        campaigns: ((payload.campaigns as RpcRow[]) || []).map((row) => mapBreakdown(row, "campaign")),
        ads,
        species: ((payload.species as RpcRow[]) || []).map(mapSpecies).filter((row): row is SpeciesBreakdownRow => Boolean(row)),
        devices: ((payload.devices as RpcRow[]) || []).map((row) => ({
          deviceType: String(row.device_type || "unknown"),
          lpv: asNumber(row.lpv),
          checkout: asNumber(row.checkout_count),
          purchase: asNumber(row.purchase_count),
        })),
        recent: ((payload.recent as RpcRow[]) || []).map((row) => ({
          createdAt: String(row.created_at || ""),
          eventName: String(row.event_name || ""),
          species: row.species ? String(row.species) : null,
          sessionShort: String(row.session_short || ""),
          amountCents: row.amount_cents == null ? null : asNumber(row.amount_cents),
        })),
        warnings: funnelWarnings({ steps, firstEventAt, ads }),
        biggestDrop: biggestFunnelDrop(steps),
        spendAvailable: false,
      };
      setReport(mapped);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load funnel analytics");
    } finally {
      setLoading(false);
    }
  }, [preset, custom?.from, custom?.to]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, report, refresh };
}

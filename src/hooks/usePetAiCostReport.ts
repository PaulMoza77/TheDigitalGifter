import * as React from "react";
import { supabase } from "@/lib/supabase";
import type { AdminDateRange } from "@/hooks/useAdminOverview";
import type { AdminAiCostReport } from "@/features/pet/aiCost";

export function usePetAiCostReport(range: AdminDateRange) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [report, setReport] = React.useState<AdminAiCostReport | null>(null);

  const from = range.from;
  const to = range.to;

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<AdminAiCostReport & { error?: string }>(
        "pet-admin",
        { body: { action: "costSummary", from, to } },
      );
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.cards || !data.breakdown) {
        throw new Error("AI cost report was empty");
      }
      setReport({
        scope: data.scope,
        currency: "usd",
        billingUrl: data.billingUrl,
        tooltip: data.tooltip,
        disclaimer: data.disclaimer,
        cards: data.cards,
        breakdown: data.breakdown,
        currentTariff: data.currentTariff,
      });
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load AI costs");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, report, refresh };
}

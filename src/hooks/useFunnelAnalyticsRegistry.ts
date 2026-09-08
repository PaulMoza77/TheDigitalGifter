import * as React from "react";
import {
  loadFunnelAnalyticsRegistry,
  type FunnelRegistryReport,
} from "@/features/funnel-analytics/funnelAnalyticsService";

export function useFunnelAnalyticsRegistry() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [report, setReport] = React.useState<FunnelRegistryReport | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await loadFunnelAnalyticsRegistry();
      setReport(next);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load funnel registry");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, report, refresh };
}

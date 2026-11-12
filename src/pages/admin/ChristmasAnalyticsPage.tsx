import { useMemo, useState } from "react";
import { useChristmasAdminData } from "./christmas/useChristmasAdminData";
import FlavoursAnalyticsView from "./christmas/analytics/FlavoursAnalyticsView";
import { buildAnalyticsReport } from "./christmas/analytics/analyticsReport";

export default function ChristmasAnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [page, setPage] = useState("");
  const data = useChristmasAdminData(days);
  const report = useMemo(
    () => buildAnalyticsReport(data.events, data.orders, days, page),
    [data.events, data.orders, days, page],
  );
  const allPages = useMemo(
    () =>
      [
        ...new Set(
          data.events
            .filter(
              (e) =>
                !e.is_test &&
                e.environment !== "test" &&
                e.pathname &&
                !e.pathname.startsWith("/admin"),
            )
            .map((e) => e.pathname!.split(/[?#]/)[0]),
        ),
      ]
        .sort()
        .map((path) => ({ path })),
    [data.events],
  );
  return (
    <FlavoursAnalyticsView
      data={data.error || (data.loading && !data.loadedAt) ? null : report}
      days={days}
      page={page}
      allPages={allPages}
      loading={data.loading}
      error={data.error}
      warnings={[
        ...data.softWarnings,
        "Vizitatorii unici și durata nu sunt măsurate în această sursă. Funnel-ul și conversia folosesc sesiunile legate; comenzile și venitul includ toate plățile confirmate din interval. Sursele includ numai comenzile cu sesiune asociată.",
      ]}
      onDaysChange={setDays}
      onPageChange={setPage}
      onRefresh={() => void data.load()}
    />
  );
}

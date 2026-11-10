import type { Integration, ReportRange } from "./santaAnalyticsModel.ts";

/** Server-only connector export. Exact-range matching prevents rolling-window fiction.
 * No public ingestion endpoint; refresh through authenticated operator deployment only.
 */
export function snapshotForRange(
  raw: string,
  range: ReportRange,
): { ga4?: Integration; meta?: Integration } {
  if (raw.length > 256000) throw new Error("snapshot_too_large");
  const input = JSON.parse(raw);
  if (
    input.version !== 1 ||
    input.propertyId !== "550164226" ||
    input.accountId !== "act_1877103439548293" ||
    input.campaignId !== "120255274308780066" ||
    input.timeZone !== range.timeZone
  )
    throw new Error("snapshot_scope_invalid");
  if (input.start !== range.start || input.end !== range.end) return {};
  const validate = (value: Integration | undefined) => {
    if (!value) return undefined;
    if (
      value.status !== "snapshot" ||
      !value.updatedAt ||
      !Number.isFinite(Date.parse(value.updatedAt)) ||
      Date.parse(value.updatedAt) > Date.now() + 60000
    )
      throw new Error("snapshot_timestamp_invalid");
    if (!Array.isArray(value.metrics) || value.metrics.length > 30)
      throw new Error("snapshot_metrics_invalid");
    for (const m of value.metrics)
      if (m.value !== null && (!Number.isFinite(m.value) || m.value < 0))
        throw new Error("snapshot_value_invalid");
    for (const rows of [value.traffic, value.devices, value.daily])
      if (rows && (!Array.isArray(rows) || rows.length > 2000))
        throw new Error("snapshot_rows_invalid");
    return value;
  };
  return { ga4: validate(input.ga4), meta: validate(input.meta) };
}

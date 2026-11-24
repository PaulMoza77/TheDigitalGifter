import type { FilmRenderResult, MediaCostModel } from "./types.ts";

/**
 * Cost model scaffold — only measured fields are filled.
 * Dollar estimates stay null until VPS/labor rates are authorized.
 */
export function buildMediaCostModel(result: FilmRenderResult | null): MediaCostModel {
  return {
    note: "Measured render metrics only. Currency estimates intentionally null until ops rates are configured.",
    vpsComputeCentsEstimate: null,
    manualSongLaborCentsEstimate: null,
    storageCentsEstimate: null,
    measuredRenderMs: result?.renderMs ?? null,
    measuredOutputBytes: result?.fileSizeBytes ?? null,
    measuredPeakRssMb: result?.peakRssMb ?? null,
  };
}

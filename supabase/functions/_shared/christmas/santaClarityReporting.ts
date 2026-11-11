import type { Integration } from "./santaAnalyticsModel.ts";

type Env = (key: string) => string | undefined;
const source = "Clarity · y3y98n4wks";
const missing = (detail: string): Integration => ({
  source,
  status: "unavailable",
  detail,
  updatedAt: null,
  metrics: [],
});

/** Project-wide rolling window, deliberately never merged into the Santa funnel. */
export function parseClarityReport(
  payload: unknown,
  updatedAt: string,
): Integration {
  if (!Array.isArray(payload)) throw new Error("invalid_clarity_report");
  const traffic = payload.find((row) => row?.metricName === "Traffic");
  if (!Array.isArray(traffic?.information) || traffic.information.length !== 1)
    throw new Error("invalid_clarity_traffic");
  const row = traffic.information[0];
  const fields = [
    ["totalSessionCount", "clarity_sessions", "Vizite în întregul site"],
    ["totalBotSessionCount", "clarity_bots", "Vizite identificate ca boți"],
  ];
  const metrics = fields.map(([field, id, label]) => {
    const raw = row[field];
    if (
      raw == null ||
      raw === "" ||
      !Number.isFinite(Number(raw)) ||
      Number(raw) < 0
    )
      throw new Error("invalid_clarity_metric");
    return {
      id,
      label,
      value: Number(raw),
      unit: "count" as const,
      source,
      definition:
        "Întregul proiect Clarity, ultimele 72 de ore UTC la momentul actualizării. Nu reprezintă doar pagina Apel cu Moșu.",
      updatedAt,
    };
  });
  return {
    source,
    status: "connected",
    detail:
      "Întregul site · ultimele 72 de ore UTC. Actualizare cel mult o dată la 6 ore, independent de filtrul de perioadă.",
    updatedAt,
    metrics,
  };
}

export async function clarityReport(
  env: Env,
  service: any,
): Promise<Integration> {
  const token = env("SANTA_CLARITY_EXPORT_TOKEN");
  if (!token)
    return missing(
      "Lipsește accesul de citire Clarity: SANTA_CLARITY_EXPORT_TOKEN. Codul de tracking nu confirmă primirea datelor.",
    );
  if (!service)
    return missing("Stocarea raportului Clarity nu este disponibilă.");
  // Atomic database lease survives worker restarts and serializes requests across workers.
  const lease = await service.rpc("claim_santa_clarity_report");
  if (lease.error)
    return missing("Stocarea raportului Clarity necesită configurare.");
  const { claimed, report } = lease.data || {};
  if (!claimed)
    return report || missing("Prima actualizare Clarity este în curs.");
  let result: Integration;
  try {
    const response = await fetch(
      "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3",
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    result = parseClarityReport(
      await response.json(),
      new Date().toISOString(),
    );
  } catch {
    // Never expose provider responses or credentials. Failures retain the lease to protect quota.
    result = {
      ...missing(
        "Clarity nu a furnizat un raport valid. Verifică accesul proiectului; următoarea încercare automată este peste 6 ore.",
      ),
      status: "error",
    };
  }
  const saved = await service
    .from("santa_clarity_report_cache")
    .update({ report: result })
    .eq("id", true);
  if (saved.error)
    return {
      ...result,
      detail: result.detail + " Raportul nu a putut fi salvat.",
    };
  return result;
}

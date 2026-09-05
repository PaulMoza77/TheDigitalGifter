/**
 * Christmas V2 delivery email EN/RO copy (Node/API).
 * Locale must come from stored order/user — never webhook Accept-Language alone.
 * Keep subjects/CTAs aligned with src/features/christmas/i18n email.* keys.
 */

export type ChristmasEmailLocale = "en" | "ro";

export function normalizeEmailLocale(
  value: string | null | undefined,
): ChristmasEmailLocale {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "ro" || raw.startsWith("ro")) return "ro";
  return "en";
}

export function christmasV2DeliveryEmailCopy(
  locale: ChristmasEmailLocale,
  input: {
    packKey: "starter" | "magic" | "ultimate";
    packName: string;
    imageCount: number;
    videoCount: number;
  },
): { subject: string; body: string; cta: string; footer: string } {
  const isRo = locale === "ro";
  const subject =
    input.packKey === "magic"
      ? isRo
        ? "Pachetul Magic de Crăciun este gata"
        : "Your Christmas Magic Pack is ready"
      : input.packKey === "ultimate"
        ? isRo
          ? "Pachetul Ultimate de Crăciun este gata"
          : "Your Ultimate Christmas Pack is ready"
        : isRo
          ? "Pozele tale de Crăciun sunt gata"
          : "Your Christmas photos are ready";

  const videoClause =
    input.videoCount > 0
      ? isRo
        ? ` și ${input.videoCount} videoclipuri AI scurte`
        : ` and ${input.videoCount} short AI video${input.videoCount > 1 ? "s" : ""}`
      : "";

  const body = isRo
    ? `${input.packName} include ${input.imageCount} poze de Crăciun${videoClause}.`
    : `${input.packName} includes ${input.imageCount} Christmas photos${videoClause}.`;

  return {
    subject,
    body,
    cta: isRo ? "Vezi rezultatele" : "View your results",
    footer: isRo
      ? "Digital Gifter · Fără abonament"
      : "Digital Gifter · No subscription",
  };
}

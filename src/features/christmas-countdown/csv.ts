export const CHRISTMAS_SIGNUP_CSV_COLUMNS = [
  "email",
  "signup_method",
  "joined_at",
  "source",
  "medium",
  "campaign",
  "referrer",
  "user_status",
  "returning",
] as const;

export type ChristmasSignupCsvRow = {
  email: string;
  signup_method: string;
  created_at: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: string | null;
  user_id?: string | null;
  last_seen_at?: string | null;
};

function esc(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function christmasSignupCsv(rows: ChristmasSignupCsvRow[]): string {
  const header = CHRISTMAS_SIGNUP_CSV_COLUMNS.join(",");
  const lines = rows.map((row) =>
    [
      row.email,
      row.signup_method,
      row.created_at || "",
      row.source || "",
      row.medium || "",
      row.campaign || "",
      row.referrer || "",
      row.user_id ? "account" : "email-only",
      (() => {
        const created = Date.parse(String(row.created_at || ""));
        const seen = Date.parse(String(row.last_seen_at || ""));
        return Number.isFinite(created) && Number.isFinite(seen) && seen - created > 12 * 60 * 60 * 1000
          ? "returning"
          : "new";
      })(),
    ]
      .map(esc)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

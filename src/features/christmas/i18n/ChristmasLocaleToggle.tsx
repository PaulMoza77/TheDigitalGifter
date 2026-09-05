import type { ChristmasLocale } from "../catalog";

type Props = {
  locale: ChristmasLocale;
  onChange: (locale: ChristmasLocale) => void;
  className?: string;
  /** Dark account surfaces */
  tone?: "light" | "dark";
};

export function ChristmasLocaleToggle({
  locale,
  onChange,
  className = "",
  tone = "light",
}: Props) {
  const base =
    tone === "dark"
      ? "border-white/15 text-zinc-300"
      : "border-slate-300 text-slate-700";
  const active =
    tone === "dark"
      ? "bg-white/15 text-white"
      : "bg-slate-900 text-white border-slate-900";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border p-0.5 text-xs font-medium ${base} ${className}`}
      role="group"
      aria-label="Language"
    >
      {(["en", "ro"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={`rounded-full px-2.5 py-1 transition ${
            locale === code ? active : "hover:opacity-80"
          }`}
          aria-pressed={locale === code}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

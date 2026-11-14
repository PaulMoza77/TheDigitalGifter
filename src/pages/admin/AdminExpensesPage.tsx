import { useMemo } from "react";
import { ExternalLink, Wallet } from "lucide-react";

/**
 * The Digital Gifter — Expenses / Cheltuieli entry point.
 *
 * Authoritative ledger for V1 lives in MOZAS (`mozas_expenses` for business
 * slug `thedigitalgifter`). This page does NOT create a second TDG expenses DB.
 * Opening the calculator requires a separate Mozas AdminGate session (no auth bypass).
 */
function resolveMozasBase(): string {
  return (
    import.meta.env.VITE_MOZAS_ADMIN_URL ||
    import.meta.env.VITE_MOZAS_FINANCE_URL ||
    "https://themozas.com"
  )
    .toString()
    .trim()
    .replace(/\/$/, "");
}

function resolveMozasExpensesUrls() {
  const base = resolveMozasBase();
  const calculatorPath = "/admin/tdg/expenses";
  const calculatorUrl = `${base}${calculatorPath}`;
  // Deep-link through Mozas login with next= — AdminGate still enforces Mozas auth.
  const loginUrl = `${base}/admin/login?next=${encodeURIComponent(calculatorPath)}`;
  return { base, calculatorUrl, loginUrl };
}

export default function AdminExpensesPage() {
  const { calculatorUrl, loginUrl } = useMemo(() => resolveMozasExpensesUrls(), []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Business · Finance
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-50">
          <Wallet className="h-6 w-6 text-emerald-400" />
          Expenses / Cheltuieli
        </h1>
        <p className="mt-1 text-sm text-slate-500 sm:hidden">Mobile nav · same destination</p>
        <p className="text-sm leading-relaxed text-slate-400">
          Persistent expense calculator for The Digital Gifter is managed in the MOZAS Finance Hub
          (single ledger). TDG admin stays authenticated here; Mozas requires its own owner/admin
          sign-in — credentials are never shared or bypassed. Use the login deep-link so{" "}
          <code className="text-xs">next=/admin/tdg/expenses</code> is preserved after Mozas auth.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-semibold text-slate-100">Open calculator</h2>
        <p className="mt-2 text-sm text-slate-400">
          Calculator: <code className="text-xs text-emerald-300">{calculatorUrl}</code>
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Auth deep-link: <code className="text-xs text-emerald-300">{loginUrl}</code>
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href={loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            data-testid="tdg-open-mozas-expenses"
          >
            Sign in to MOZAS → expenses
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href={calculatorUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            data-testid="tdg-open-mozas-expenses-direct"
          >
            Direct calculator (if already signed in)
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400">
        <h2 className="font-semibold text-slate-200">What this opens</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Create / edit / delete expenses with period filters and category cards</li>
          <li>Historical TDG seed (3155 USD) with unknown dates and estimate flags preserved</li>
          <li>No automatic recurring VPS charges</li>
          <li>Income from Stripe/orders is audited separately — not invented here</li>
        </ul>
      </section>
    </div>
  );
}
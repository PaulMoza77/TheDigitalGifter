import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "./analytics";
import {
  deleteBudgetExpense,
  insertBudgetExpense,
  loadBudget,
  loadGifts,
  patchBudgetExpense,
  setPlannerTotalBudget,
  upsertCategoryBudget,
} from "./api";
import { FoundingPassUnlockButton } from "./FoundingPassUnlock";
import {
  buildPlannerSnapshot,
  computeBudgetTotals,
  expenseLinesFromEntries,
  formatPlannerMoney,
  groceryEstimatedCostMinor,
  isAllocationRow,
  suggestedAllocations,
  collectBudgetCopy,
} from "./intelligence";
import type { BudgetExpenseLine } from "./intelligence/budgetIntelligence";
import { hasFeature } from "./entitlements";
import { PlannerOnboarding, usePlannerBundle } from "./Onboarding";
import { PlannerPageHeader, PlannerProgress } from "./plannerUi";
import {
  BUDGET_CATEGORY_LABELS,
  BUDGET_DASHBOARD_CATEGORIES,
  PLANNER_CURRENCIES,
  type BudgetDashboardCategory,
  type BudgetEntry,
  type GiftItem,
  type PlannerProfile,
} from "./types";

function snapshotOf(profile: PlannerProfile, gifts: GiftItem[], rows: BudgetEntry[]) {
  return buildPlannerSnapshot({
    profile,
    tasks: [],
    recipients: [],
    gifts,
    budgetEntries: rows,
  });
}

function majorInput(minor: number): string {
  if (!minor) return "";
  return String(minor / 100);
}

function parseMajor(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

type ExpenseDraft = {
  id?: string;
  label: string;
  category: BudgetDashboardCategory;
  amount: string;
  status: "planned" | "paid";
  note: string;
};

const EMPTY_EXPENSE: ExpenseDraft = {
  label: "",
  category: "other",
  amount: "",
  status: "paid",
  note: "",
};

export function ChristmasPlannerBudgetPage() {
  const { loading, access, profile, reload } = usePlannerBundle();
  const entitled = hasFeature(access, "budget");
  const [rows, setRows] = useState<BudgetEntry[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState("");
  const [setupAmount, setSetupAmount] = useState("");
  const [setupCurrency, setSetupCurrency] = useState("eur");
  const [useSuggested, setUseSuggested] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expense, setExpense] = useState<ExpenseDraft>(EMPTY_EXPENSE);
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadBudget(profile.id), loadGifts(profile.id)]).then(([b, g]) => {
      setRows(b);
      setGifts(g);
    });
    setTotalDraft(profile.total_budget_minor ? String(profile.total_budget_minor / 100) : "");
    setSetupAmount(profile.total_budget_minor ? String(profile.total_budget_minor / 100) : "");
    setSetupCurrency(profile.currency || "eur");
    trackPlannerEvent("planner_module_opened", { module: "budget" });
  }, [profile?.id]);

  const snapshot = useMemo(
    () => (profile ? snapshotOf(profile, gifts, rows) : null),
    [profile, gifts, rows],
  );
  const totals = snapshot ? computeBudgetTotals(snapshot) : null;
  const expenses = useMemo(() => (snapshot ? expenseLinesFromEntries(snapshot.budgetEntries) : []), [snapshot]);
  const copy = snapshot && totals ? collectBudgetCopy(snapshot, totals) : [];
  const currency = profile?.currency || "eur";
  const configured = Boolean(profile?.total_budget_minor && profile.total_budget_minor > 0);

  async function saveTotal(minor: number) {
    if (!profile) return;
    await setPlannerTotalBudget(profile.id, minor);
    trackPlannerEvent("planner_budget_updated", { module: "budget" });
    await reload();
  }

  async function createBudget(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    const minor = parseMajor(setupAmount);
    if (minor <= 0) return;
    setBusy(true);
    try {
      if (setupCurrency !== profile.currency) {
        await supabase.from("christmas_planner_profiles").update({ currency: setupCurrency }).eq("id", profile.id);
      }
      await saveTotal(minor);
      if (useSuggested) {
        const suggested = suggestedAllocations(minor);
        for (const row of suggested) {
          const existing = rows.find((r) => r.category === row.category && isAllocationRow({
            id: r.id,
            category: r.category,
            label: r.label,
            planned_minor: r.planned_minor,
            spent_minor: r.spent_minor,
            source_type: r.source_type,
          }));
          const saved = await upsertCategoryBudget({
            profileId: profile.id,
            existingId: existing?.id,
            category: row.category,
            plannedMinor: row.minor,
          });
          if (saved) {
            setRows((prev) => {
              const without = prev.filter((r) => r.id !== saved.id);
              return [...without, saved];
            });
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveCap(category: BudgetDashboardCategory, value: string) {
    if (!profile) return;
    const minor = parseMajor(value);
    const existing = rows.find((r) => r.category === category && isAllocationRow({
      id: r.id,
      category: r.category,
      label: r.label,
      planned_minor: r.planned_minor,
      spent_minor: r.spent_minor,
      source_type: r.source_type,
    }));
    const saved = await upsertCategoryBudget({
      profileId: profile.id,
      existingId: existing?.id,
      category,
      plannedMinor: minor,
    });
    if (saved) {
      setRows((prev) => {
        const rest = prev.filter((r) => r.id !== saved.id);
        return [...rest, saved];
      });
      trackPlannerEvent("planner_budget_updated", { module: "budget", metadata: { category } });
    }
  }

  async function saveExpense() {
    if (!profile || !expense.label.trim() || !expense.amount) return;
    const amountMinor = parseMajor(expense.amount);
    if (amountMinor <= 0) return;
    if (expense.id && !expense.id.includes(":legacy")) {
      const saved = await patchBudgetExpense(expense.id, {
        label: expense.label,
        category: expense.category,
        amountMinor,
        status: expense.status,
        note: expense.note,
      });
      if (saved) setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    } else {
      const saved = await insertBudgetExpense({
        profileId: profile.id,
        category: expense.category,
        label: expense.label,
        amountMinor,
        status: expense.status,
        note: expense.note,
      });
      if (saved) setRows((prev) => [...prev, saved]);
    }
    trackPlannerEvent("planner_budget_updated", { module: "budget" });
    setExpense(EMPTY_EXPENSE);
    setExpenseOpen(false);
  }

  async function removeExpense(line: BudgetExpenseLine) {
    if (line.id.includes(":legacy")) {
      const realId = line.id.split(":")[0];
      await patchBudgetExpense(realId, { amountMinor: 0, status: "planned", note: "" });
      setRows((prev) => prev.map((r) => (r.id === realId ? { ...r, spent_minor: 0 } : r)));
      return;
    }
    await deleteBudgetExpense(line.id);
    setRows((prev) => prev.filter((r) => r.id !== line.id));
    trackPlannerEvent("planner_budget_updated", { module: "budget" });
  }

  if (loading) return <p>Loading budget…</p>;
  if (!profile) return <PlannerOnboarding />;

  const money = (minor: number) => formatPlannerMoney(minor, currency);
  const total = totals?.totalBudgetMinor || 0;
  const spent = totals?.spentMinor || 0;
  const planned = totals?.plannedOutstandingMinor || 0;
  const remaining = totals?.remainingMinor ?? 0;
  const spentPct = total ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const plannedPct = total ? Math.min(100 - spentPct, Math.round((planned / total) * 100)) : 0;

  if (!configured) {
    const suggested = suggestedAllocations(parseMajor(setupAmount));
    return (
      <div className="tdg-planner-page tdg-budget-page">
        <PlannerPageHeader
          title="Christmas Budget"
          lede="Keep Christmas spending beautifully under control."
        />
        <form className="tdg-budget-setup" onSubmit={(e) => void createBudget(e)}>
          <p className="tdg-planner-kicker">Let’s set your Christmas budget</p>
          <h2>How much would you like to spend on Christmas this year?</h2>
          <label>
            Amount
            <input
              className="tdg-planner-input tdg-budget-amount"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={setupAmount}
              onChange={(e) => setSetupAmount(e.target.value)}
              placeholder="1500"
            />
          </label>
          <label>
            Currency
            <select className="tdg-planner-select" value={setupCurrency} onChange={(e) => setSetupCurrency(e.target.value)}>
              {PLANNER_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="tdg-budget-suggest">
            <input type="checkbox" checked={useSuggested} onChange={(e) => setUseSuggested(e.target.checked)} />
            Suggested split
          </label>
          {useSuggested && parseMajor(setupAmount) > 0 ? (
            <ul className="tdg-budget-suggest-list">
              {suggested.map((row) => (
                <li key={row.category}>
                  <span>{row.label}</span>
                  <strong>{money(row.minor)}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          {totals && (totals.giftCommittedMinor > 0 || totals.spentMinor > 0) ? (
            <p className="tdg-planner-muted">
              From your gift list so far: {money(totals.giftSpentMinor)} spent, {money(totals.giftPlannedMinor)} planned.
            </p>
          ) : null}
          <button type="submit" className="tdg-planner-btn primary" disabled={busy || parseMajor(setupAmount) <= 0}>
            Create my budget
          </button>
          {!entitled ? (
            <div className="tdg-budget-unlock">
              <p className="tdg-planner-muted">Preview your numbers, then unlock the full Budget planner.</p>
              <FoundingPassUnlockButton feature="budget" />
            </div>
          ) : null}
        </form>
      </div>
    );
  }

  const groceryKnown = groceryEstimatedCostMinor(snapshot!) != null;

  return (
    <div className="tdg-planner-page tdg-budget-page">
      <header className="tdg-budget-head">
        <div>
          <p className="tdg-planner-kicker">Christmas Budget</p>
          <h1>{money(total)}</h1>
          <p className="tdg-planner-muted">Total Christmas budget</p>
        </div>
        {entitled ? (
          editingTotal ? (
            <form
              className="tdg-budget-edit-total"
              onSubmit={(e) => {
                e.preventDefault();
                void saveTotal(parseMajor(totalDraft)).then(() => setEditingTotal(false));
              }}
            >
              <input
                className="tdg-planner-input"
                type="number"
                min="0"
                value={totalDraft}
                onChange={(e) => setTotalDraft(e.target.value)}
                aria-label="Total Christmas budget"
              />
              <button type="submit" className="tdg-planner-btn primary">
                Save
              </button>
            </form>
          ) : (
            <button type="button" className="tdg-planner-btn ghost" onClick={() => setEditingTotal(true)}>
              Edit total budget
            </button>
          )
        ) : null}
      </header>

      <section className="tdg-budget-hero" aria-label="Budget summary">
        <div className="tdg-budget-metrics">
          <div>
            <span className="tdg-planner-kicker">Spent</span>
            <strong>{money(spent)}</strong>
          </div>
          <div>
            <span className="tdg-planner-kicker">Planned</span>
            <strong>{money(planned)}</strong>
          </div>
          <div>
            <span className="tdg-planner-kicker">Remaining</span>
            <strong className={remaining < 0 ? "is-over" : ""}>{money(remaining)}</strong>
          </div>
        </div>
        <div className="tdg-budget-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={spentPct}>
          <span className="is-spent" style={{ width: `${spentPct}%` }} />
          <span className="is-planned" style={{ width: `${plannedPct}%`, left: `${spentPct}%` }} />
        </div>
        <p className="tdg-planner-muted">
          {money(spent)} spent · {money(planned)} planned · {remaining < 0 ? `${money(Math.abs(remaining))} over` : `${money(remaining)} remaining`}
        </p>
      </section>

      {copy.length ? (
        <ul className="tdg-budget-insights">
          {copy.slice(0, 4).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      {!entitled ? (
        <div className="tdg-budget-unlock tdg-budget-unlock--banner">
          <p>This is your personalized Christmas budget preview. Unlock the full planner to edit categories and expenses.</p>
          <FoundingPassUnlockButton feature="budget" />
        </div>
      ) : null}

      <section className="tdg-budget-cats">
        <h2>Where it goes</h2>
        {totals?.categoryRows.map((row) => (
          <div key={row.category} className="tdg-planner-budget-row">
            <div>
              <strong>{row.label}</strong>
              <div className="tdg-planner-muted">
                Budget {money(row.budgetMinor)} · Spent {money(row.spentMinor)} · Remaining {money(row.remainingMinor)}
              </div>
              <PlannerProgress
                value={row.budgetMinor ? Math.min(100, Math.round((row.spentMinor / row.budgetMinor) * 100)) : 0}
                compact
              />
              {row.category === "food" && !groceryKnown ? (
                entitled ? (
                  <button
                    type="button"
                    className="tdg-planner-linkish"
                    onClick={() => {
                      setExpense({ ...EMPTY_EXPENSE, category: "food", status: "planned", label: "Estimated grocery cost" });
                      setExpenseOpen(true);
                    }}
                  >
                    Add estimated grocery cost
                  </button>
                ) : (
                  <p className="tdg-planner-muted">Add estimated grocery cost once Budget is unlocked.</p>
                )
              ) : null}
            </div>
            {entitled ? (
              <input
                className="tdg-planner-input"
                style={{ width: 120, margin: 0 }}
                type="number"
                min="0"
                aria-label={`${row.label} budget`}
                value={capDrafts[row.category] ?? majorInput(row.budgetMinor)}
                onChange={(e) => setCapDrafts((d) => ({ ...d, [row.category]: e.target.value }))}
                onBlur={(e) => void saveCap(row.category as BudgetDashboardCategory, e.target.value)}
              />
            ) : null}
          </div>
        ))}
      </section>

      <section className="tdg-budget-expenses">
        <div className="tdg-planner-section-head">
          <h2>Recent and planned</h2>
        </div>
        {expenses.length === 0 && gifts.filter((g) => (g.planned_price_minor || 0) > 0 || (g.actual_price_minor || 0) > 0).length === 0 ? (
          <p className="tdg-planner-muted">No extras yet. Gift prices appear here automatically as you plan and buy.</p>
        ) : (
          <ul className="tdg-budget-expense-list">
            {gifts
              .filter((g) => {
                const snap = snapshotOf(profile, [g], []);
                return computeBudgetTotals(snap).giftCommittedMinor > 0;
              })
              .slice(0, 8)
              .map((g) => {
                const spentGift = ["ordered", "arrived", "hidden", "wrapped", "given"].includes(g.status) && (g.actual_price_minor || 0) > 0;
                const amount = spentGift ? g.actual_price_minor || 0 : g.planned_price_minor || 0;
                return (
                  <li key={`gift-${g.id}`}>
                    <span>
                      <strong>{g.selected_gift || g.idea}</strong>
                      <span className="tdg-planner-muted"> Gifts · {spentGift ? "Paid" : "Planned"}</span>
                    </span>
                    <strong>{money(amount)}</strong>
                  </li>
                );
              })}
            {expenses.map((line) => (
              <li key={line.id}>
                <span>
                  <strong>{line.label}</strong>
                  <span className="tdg-planner-muted">
                    {" "}
                    {BUDGET_CATEGORY_LABELS[line.category]} · {line.status === "paid" ? "Paid" : "Planned"}
                    {line.note ? ` · ${line.note}` : ""}
                  </span>
                </span>
                <span className="tdg-budget-expense-amt">
                  <strong>{money(line.amountMinor)}</strong>
                  {entitled && !line.id.includes(":legacy") ? (
                    <>
                      <button
                        type="button"
                        className="tdg-planner-btn ghost"
                        onClick={() => {
                          setExpense({
                            id: line.id,
                            label: line.label,
                            category: line.dashboardCategory,
                            amount: String(line.amountMinor / 100),
                            status: line.status,
                            note: line.note,
                          });
                          setExpenseOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="tdg-planner-btn danger" onClick={() => void removeExpense(line)}>
                        Delete
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {entitled ? (
        <div className="tdg-budget-fab">
          <button
            type="button"
            className="tdg-planner-btn primary"
            onClick={() => {
              setExpense(EMPTY_EXPENSE);
              setExpenseOpen(true);
            }}
          >
            Add expense
          </button>
        </div>
      ) : null}

      {expenseOpen && entitled ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="budget-expense-title">
          <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close" onClick={() => setExpenseOpen(false)} />
          <div className="tdg-planner-sheet-card">
            <div className="tdg-planner-sheet-head">
              <h2 id="budget-expense-title">{expense.id ? "Edit expense" : "Add expense"}</h2>
              <button type="button" className="tdg-planner-btn ghost" onClick={() => setExpenseOpen(false)}>
                Close
              </button>
            </div>
            <label>
              Name
              <input
                className="tdg-planner-input"
                value={expense.label}
                onChange={(e) => setExpense({ ...expense, label: e.target.value })}
                placeholder="Christmas tree"
              />
            </label>
            <label>
              Category
              <select
                className="tdg-planner-select"
                value={expense.category}
                onChange={(e) => setExpense({ ...expense, category: e.target.value as BudgetDashboardCategory })}
              >
                {BUDGET_DASHBOARD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {BUDGET_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                className="tdg-planner-input"
                type="number"
                min="0"
                step="0.01"
                value={expense.amount}
                onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
              />
            </label>
            <label>
              Status
              <select
                className="tdg-planner-select"
                value={expense.status}
                onChange={(e) => setExpense({ ...expense, status: e.target.value as "planned" | "paid" })}
              >
                <option value="planned">Planned</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label>
              Note
              <textarea
                className="tdg-planner-area"
                value={expense.note}
                onChange={(e) => setExpense({ ...expense, note: e.target.value })}
                placeholder="Optional"
              />
            </label>
            <div className="tdg-planner-actions">
              <button type="button" className="tdg-planner-btn primary" onClick={() => void saveExpense()}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

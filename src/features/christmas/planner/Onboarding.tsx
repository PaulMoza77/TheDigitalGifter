import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { trackPlannerEvent } from "./analytics";
import { fetchPlannerAccess, insertTasks, loadProfile, upsertProfile } from "./api";
import { daysUntilChristmas, localDateParts, resolvePlanMode, upcomingChristmasYear } from "./date";
import { generateInitialPlan } from "./planGenerator";
import type { PlannerAccess, PlannerProfile, PreparedLevel } from "./types";

const COUNTRIES = ["US", "GB", "IE", "DE", "FR", "ES", "IT", "NL", "PL", "RO", "CA", "AU"];
const CURRENCIES = ["eur", "usd", "gbp", "ron"];

export function PlannerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    country_code: "US",
    currency: "eur",
    household_label: "",
    recipient_count_approx: 4,
    total_budget_minor: 80000,
    hosting: false,
    travelling: false,
    has_children: false,
    prepared_level: "starting" as PreparedLevel,
    known_dates: "",
  });

  useEffect(() => {
    trackPlannerEvent("planner_onboarding_started");
  }, []);

  const questions = useMemo(
    () => [
      {
        title: "Where are you planning Christmas?",
        body: (
          <select
            className="tdg-planner-select"
            value={form.country_code}
            onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ),
      },
      {
        title: "Preferred currency",
        body: (
          <select
            className="tdg-planner-select"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        ),
      },
      {
        title: "Who are you planning for?",
        body: (
          <input
            className="tdg-planner-input"
            placeholder="Our household, my parents, the kids…"
            value={form.household_label}
            onChange={(e) => setForm((f) => ({ ...f, household_label: e.target.value.slice(0, 80) }))}
          />
        ),
      },
      {
        title: "About how many people are you gifting?",
        body: (
          <input
            className="tdg-planner-input"
            type="number"
            min={0}
            max={80}
            value={form.recipient_count_approx}
            onChange={(e) =>
              setForm((f) => ({ ...f, recipient_count_approx: Number(e.target.value || 0) }))
            }
          />
        ),
      },
      {
        title: "Total Christmas budget",
        body: (
          <input
            className="tdg-planner-input"
            type="number"
            min={0}
            value={Math.round(form.total_budget_minor / 100)}
            onChange={(e) =>
              setForm((f) => ({ ...f, total_budget_minor: Math.max(0, Number(e.target.value || 0)) * 100 }))
            }
          />
        ),
      },
      {
        title: "Are you hosting?",
        body: (
          <div className="tdg-planner-chips">
            <button type="button" className={`tdg-planner-chip ${form.hosting ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, hosting: true }))}>
              Yes
            </button>
            <button type="button" className={`tdg-planner-chip ${!form.hosting ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, hosting: false }))}>
              No
            </button>
          </div>
        ),
      },
      {
        title: "Are you travelling?",
        body: (
          <div className="tdg-planner-chips">
            <button type="button" className={`tdg-planner-chip ${form.travelling ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, travelling: true }))}>
              Yes
            </button>
            <button type="button" className={`tdg-planner-chip ${!form.travelling ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, travelling: false }))}>
              No
            </button>
          </div>
        ),
      },
      {
        title: "Children in the household?",
        body: (
          <div className="tdg-planner-chips">
            <button type="button" className={`tdg-planner-chip ${form.has_children ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, has_children: true }))}>
              Yes
            </button>
            <button type="button" className={`tdg-planner-chip ${!form.has_children ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, has_children: false }))}>
              No
            </button>
          </div>
        ),
      },
      {
        title: "How prepared are you already?",
        body: (
          <div className="tdg-planner-chips">
            {(["starting", "some", "mostly", "rescue"] as const).map((level) => (
              <button
                key={level}
                type="button"
                className={`tdg-planner-chip ${form.prepared_level === level ? "on" : ""}`}
                onClick={() => setForm((f) => ({ ...f, prepared_level: level }))}
              >
                {level}
              </button>
            ))}
          </div>
        ),
      },
      {
        title: "Any major dates already known?",
        body: (
          <input
            className="tdg-planner-input"
            placeholder="School play Dec 12, flight Dec 23…"
            value={form.known_dates}
            onChange={(e) => setForm((f) => ({ ...f, known_dates: e.target.value.slice(0, 160) }))}
          />
        ),
      },
    ],
    [form],
  );

  async function finish() {
    setBusy(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("Please sign in to save your plan.");
      setBusy(false);
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const season = upcomingChristmasYear(new Date(), tz);
    const daysLeft = daysUntilChristmas(new Date(), tz);
    const mode = resolvePlanMode(daysLeft, form.prepared_level);
    const known = form.known_dates.trim()
      ? [{ label: form.known_dates.trim().slice(0, 80), on: "" }]
      : [];
    const profile = await upsertProfile({
      user_id: user.id,
      season_year: season,
      country_code: form.country_code,
      currency: form.currency,
      timezone: tz,
      household_label: form.household_label,
      recipient_count_approx: form.recipient_count_approx,
      total_budget_minor: form.total_budget_minor,
      hosting: form.hosting,
      travelling: form.travelling,
      has_children: form.has_children,
      prepared_level: form.prepared_level,
      known_dates: known,
      onboarding_completed_at: new Date().toISOString(),
      plan_mode: mode,
      locale: "en",
    });
    if (!profile) {
      setError("Could not save your planner. Try again.");
      setBusy(false);
      return;
    }
    const today = localDateParts(new Date(), tz);
    const generated = generateInitialPlan({
      today,
      christmas: { year: season, month: 12, day: 25 },
      mode,
      hosting: form.hosting,
      travelling: form.travelling,
      hasChildren: form.has_children,
      giftCount: form.recipient_count_approx,
      prepared: form.prepared_level,
    });
    await insertTasks(
      generated.map((t) => ({
        ...t,
        profile_id: profile.id,
        notes: t.notes,
        origin: "system",
        template_key: t.template_key,
        status: "open",
      })),
    );
    if (form.total_budget_minor > 0) {
      await supabase.from("christmas_budget_entries").insert({
        profile_id: profile.id,
        category: "gifts",
        label: "Gifts",
        planned_minor: Math.round(form.total_budget_minor * 0.6),
        spent_minor: 0,
        source_type: "system",
      });
      trackPlannerEvent("planner_budget_set", { countBucket: "set" });
    }
    trackPlannerEvent("planner_onboarding_completed", { planMode: mode });
    navigate("/account/christmas", { replace: true });
  }

  const q = questions[step];

  return (
    <div>
      <div className="tdg-planner-top">
        <span className="tdg-planner-brand">Christmas Planner</span>
        <span className="tdg-planner-muted">{step + 1}/{questions.length}</span>
      </div>
      <h1>3 minutes and your Christmas is organized.</h1>
      <p className="tdg-planner-muted">We’ll build a plan that matches today’s date — not a generic checklist.</p>
      <div className="tdg-planner-card" style={{ marginTop: 18 }}>
        <h2>{q.title}</h2>
        {q.body}
        {error ? <p className="tdg-planner-muted">{error}</p> : null}
        <div className="tdg-planner-actions">
          {step > 0 ? (
            <button type="button" className="tdg-planner-btn" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : (
            <Link className="tdg-planner-btn" to="/account/dashboard">
              Account
            </Link>
          )}
          {step < questions.length - 1 ? (
            <button type="button" className="tdg-planner-btn primary" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button type="button" className="tdg-planner-btn primary" disabled={busy} onClick={() => void finish()}>
              {busy ? "Creating plan…" : "Create my plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export type PlannerBundle = {
  access: PlannerAccess | null;
  profile: PlannerProfile;
};

export function usePlannerBundle() {
  const [state, setState] = useState<{
    loading: boolean;
    access: PlannerAccess | null;
    profile: PlannerProfile | null;
  }>({ loading: true, access: null, profile: null });

  async function reload() {
    const access = await fetchPlannerAccess();
    const season = access?.season_year || upcomingChristmasYear(new Date());
    const profile = await loadProfile(season);
    setState({ loading: false, access, profile });
  }

  useEffect(() => {
    void reload();
  }, []);

  return { ...state, reload };
}

export { loadBudget, loadGifts, loadRecipients, loadTasks } from "./api";

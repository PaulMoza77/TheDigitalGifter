import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, Gift, LayoutList, MoreHorizontal, Sparkles, TreePine } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import { useEffect, useMemo, useState } from "react";
import { countdownCopy, daysUntilChristmas } from "./date";
import { computeReadiness } from "./readiness";
import { loadBudget, loadGifts, loadRecipients, loadTasks } from "./api";
import { PlannerOnboarding, PlannerBundleProvider, usePlannerBundle } from "./Onboarding";
import "./plannerApp.css";

const SIDE = [
  { to: "/account/christmas", label: "Today", icon: TreePine, end: true as const },
  { to: "/account/christmas/plan", label: "Plan", icon: LayoutList },
  { to: "/account/christmas/gifts", label: "Gifts", icon: Gift },
  { to: "/account/christmas/budget", label: "Budget", icon: Sparkles },
  { to: "/account/christmas/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/account/christmas/more", label: "More", icon: MoreHorizontal },
];

export default function ChristmasPlannerLayout() {
  return (
    <PlannerBundleProvider>
      <PlannerAppShell />
    </PlannerBundleProvider>
  );
}

function PlannerAppShell() {
  const location = useLocation();
  const { loading, profile } = usePlannerBundle();
  const [readiness, setReadiness] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<Array<{ id: string; title: string; due_on: string | null }>>([]);

  const daysLeft = useMemo(() => daysUntilChristmas(new Date(), profile?.timezone), [profile?.timezone]);

  useEffect(() => {
    if (!profile) return;
    void Promise.all([loadTasks(profile.id), loadRecipients(profile.id), loadGifts(profile.id), loadBudget(profile.id)]).then(
      ([tasks, recipients, gifts]) => {
        setReadiness(
          computeReadiness({
            profile,
            tasks,
            recipients,
            gifts,
          }).percent,
        );
        setUpcoming(
          tasks
            .filter((t) => t.status === "open")
            .slice(0, 5)
            .map((t) => ({ id: t.id, title: t.title, due_on: t.due_on })),
        );
      },
    );
  }, [profile, location.pathname]);

  return (
    <div className="tdg-planner-app">
      <PageHead title="Christmas Planner" description="Your private Christmas command center." noindex exactTitle />
      <div className="tdg-planner-frame">
        <header className="tdg-planner-header">
          <strong>Christmas Planner</strong>
          <div className="tdg-planner-header-meta">
            <span>{countdownCopy(daysLeft)}</span>
            {readiness != null ? (
              <span className="tdg-planner-ready-mini">
                {readiness}%
                <span className="tdg-planner-bar" aria-hidden>
                  <span style={{ width: `${readiness}%` }} />
                </span>
              </span>
            ) : null}
            <a href="/account/dashboard">Account</a>
          </div>
        </header>
        <div className="tdg-planner-body">
          <aside className="tdg-planner-side" aria-label="Planner modules">
            <div className="tdg-planner-side-label">Plan</div>
            {SIDE.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item ? Boolean(item.end) : false}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <item.icon size={16} aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </aside>
          <main className="tdg-planner-main">
            {loading ? <p className="tdg-planner-muted">Opening your Christmas…</p> : !profile ? <PlannerOnboarding /> : <Outlet />}
          </main>
          <aside className="tdg-planner-context" aria-label="Upcoming">
            <h2>Next up</h2>
            {upcoming.length === 0 ? (
              <p className="tdg-planner-muted">Nothing waiting. Add a task when you’re ready.</p>
            ) : (
              upcoming.map((row) => (
                <div key={row.id} className="tdg-planner-row">
                  <div>
                    <div className="tdg-planner-task-title">{row.title}</div>
                    <div className="tdg-planner-muted">{row.due_on || "No date"}</div>
                  </div>
                </div>
              ))
            )}
          </aside>
        </div>
        <nav className="tdg-planner-nav" aria-label="Christmas planner">
          <NavLink to="/account/christmas" end className={({ isActive }) => (isActive ? "active" : "")}>
            Today
          </NavLink>
          <NavLink to="/account/christmas/plan" className={({ isActive }) => (isActive ? "active" : "")}>
            Plan
          </NavLink>
          <NavLink to="/account/christmas/gifts" className={({ isActive }) => (isActive ? "active" : "")}>
            Gifts
          </NavLink>
          <NavLink to="/account/christmas/more" className={({ isActive }) => (isActive ? "active" : "")}>
            More
          </NavLink>
        </nav>
      </div>
    </div>
  );
}

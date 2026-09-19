import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, Gift, LayoutList, ListTodo, MoreHorizontal, Settings, UserRound, Wallet } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import { useEffect, useMemo, useState } from "react";
import { countdownCopy, daysUntilChristmas } from "./date";
import { computeReadiness } from "./readiness";
import { loadPlannerWorkspace } from "./intelligence";
import { PlannerOnboarding, PlannerBundleProvider, usePlannerBundle } from "./Onboarding";
import { CopilotHost, useCopilotUi } from "./copilot/CopilotHost";
import { CopilotLaunchButton } from "./copilot/CopilotSheet";
import { PlannerProgress, PlannerSidebarItem } from "./plannerUi";
import "./plannerApp.css";

const SIDE = [
  { to: "/account/christmas", label: "Today", icon: ListTodo, end: true as const },
  { to: "/account/christmas/plan", label: "Plan", icon: LayoutList },
  { to: "/account/christmas/gifts", label: "Gifts", icon: Gift },
  { to: "/account/christmas/budget", label: "Budget", icon: Wallet },
  { to: "/account/christmas/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/account/christmas/more", label: "More", icon: MoreHorizontal },
];

const MOBILE_NAV = [
  { to: "/account/christmas", label: "Today", icon: ListTodo, end: true as const },
  { to: "/account/christmas/plan", label: "Plan", icon: LayoutList },
  { to: "/account/christmas/gifts", label: "Gifts", icon: Gift },
  { to: "/account/christmas/more", label: "More", icon: MoreHorizontal },
];

export default function ChristmasPlannerLayout() {
  return (
    <PlannerBundleProvider>
      <CopilotHost>
        <PlannerAppShell />
      </CopilotHost>
    </PlannerBundleProvider>
  );
}

function PlannerAppShell() {
  const location = useLocation();
  const { loading, profile } = usePlannerBundle();
  const copilot = useCopilotUi();
  const [readiness, setReadiness] = useState<number | null>(null);

  const daysLeft = useMemo(() => daysUntilChristmas(new Date(), profile?.timezone), [profile?.timezone]);

  useEffect(() => {
    if (!profile) return;
    void loadPlannerWorkspace(profile).then((snapshot) => {
      setReadiness(
        computeReadiness({
          profile,
          tasks: snapshot.tasks,
          recipients: snapshot.recipients,
          gifts: snapshot.gifts,
          cardsNeeded: snapshot.cards.length,
          cardsPrepared: snapshot.cards.filter((c) => c.status === "prepared" || c.status === "sent").length,
          mealsCount: snapshot.meals.length,
        }).percent,
      );
    });
  }, [profile, location.pathname]);

  return (
    <div className="tdg-planner-app">
      <PageHead title="Christmas Planner" description="Your private Christmas command center." noindex exactTitle />
      <div className="tdg-planner-frame">
        <header className="tdg-planner-header">
          <a className="tdg-planner-logo" href="/christmas" aria-label="The Digital Gifter">
            <img src="/TheDigitalGifter.png" alt="" width={36} height={36} decoding="async" />
            <span>The Digital Gifter</span>
          </a>
          <p className="tdg-planner-header-count">{countdownCopy(daysLeft)}</p>
          <div className="tdg-planner-header-meta">
            {readiness != null ? (
              <span className="tdg-planner-ready-mini">
                <span>
                  {readiness}% <span className="tdg-planner-ready-mini-label">ready</span>
                </span>
                <PlannerProgress value={readiness} compact />
              </span>
            ) : null}
            {profile ? <CopilotLaunchButton onClick={() => copilot?.openCopilot(undefined, "header")} /> : null}
            <a href="/account/dashboard">Account</a>
          </div>
        </header>
        <aside className="tdg-planner-side" aria-label="Planner modules">
          <div className="tdg-planner-side-brand">
            <strong>Christmas Planner</strong>
          </div>
          <nav className="tdg-planner-side-nav">
            {SIDE.map((item) => (
              <PlannerSidebarItem
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                end={"end" in item ? Boolean(item.end) : false}
              />
            ))}
          </nav>
          <div className="tdg-planner-side-foot">
            <NavLink to="/account/christmas/settings" className={({ isActive }) => (isActive ? "active" : "")}>
              <Settings size={16} strokeWidth={1.6} aria-hidden />
              Settings
            </NavLink>
            <a href="/account/dashboard">
              <UserRound size={16} strokeWidth={1.6} aria-hidden />
              Account
            </a>
          </div>
        </aside>
        <main className="tdg-planner-main">
          {loading ? <p className="tdg-planner-muted">Opening your Christmas…</p> : !profile ? <PlannerOnboarding /> : <Outlet />}
        </main>
        <nav className="tdg-planner-nav" aria-label="Christmas planner">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? Boolean(item.end) : false}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <item.icon size={18} strokeWidth={1.6} aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

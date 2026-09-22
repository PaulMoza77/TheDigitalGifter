import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Gift,
  Home,
  LayoutList,
  MoreHorizontal,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { PageHead } from "@/components/PageHead";
import { useEffect, useMemo, useState } from "react";
import { countdownCopy, daysUntilChristmas } from "./date";
import { loadPlannerWorkspace, runPlannerIntelligence } from "./intelligence";
import { invalidatePlannerSnapshot } from "./intelligence/loadSnapshot";
import { onPlannerWorkspaceBump, subscribePlannerReadiness } from "./workspaceSync";
import { claimPlannerOrder } from "./api";
import { readPlannerOrderRecovery } from "./guest";
import { PlannerOnboarding, PlannerBundleProvider, usePlannerBundle } from "./Onboarding";
import { ChristmasCopilotRail, CopilotHost, useCopilotUi } from "./copilot/CopilotHost";
import { PlannerLoading, PlannerProgress, PlannerSidebarItem } from "./plannerUi";
import { PlannerGiftMark, PlannerTreeMark } from "./plannerMarks";
import { PlannerAccountChrome } from "./PlannerAccountChrome";
import "./plannerApp.css";

const SIDE = [
  { to: "/account/christmas", label: "Home", icon: Home, end: true as const },
  { to: "/account/christmas/calendar", label: "Today", icon: CalendarDays },
  { to: "/account/christmas/plan", label: "Plan", icon: LayoutList },
  { to: "/account/christmas/gifts", label: "Gifts", icon: Gift },
  { to: "/account/christmas/food", label: "Meals", icon: UtensilsCrossed },
  { to: "/account/christmas/recipes", label: "Recipes", icon: BookOpen },
  { to: "/account/christmas/shopping", label: "Shopping", icon: ShoppingBag },
  { to: "/account/christmas/more", label: "More", icon: MoreHorizontal },
];

export default function ChristmasPlannerLayout() {
  return (
    <PlannerBundleProvider>
      <div className="tdg-planner-app">
        <CopilotHost>
          <PlannerAppShell />
        </CopilotHost>
      </div>
    </PlannerBundleProvider>
  );
}

function PlannerAppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, profile, access, reload } = usePlannerBundle();
  const copilot = useCopilotUi();
  const [readiness, setReadiness] = useState<number | null>(null);

  const daysLeft = useMemo(() => daysUntilChristmas(new Date(), profile?.timezone), [profile?.timezone]);
  const frameClass =
    copilot?.enabled && copilot.desktop ? "tdg-planner-frame tdg-planner-frame--copilot" : "tdg-planner-frame";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("checkout") !== "success") return;
    const token = params.get("token") || readPlannerOrderRecovery()?.publicToken || "";
    let cancelled = false;
    void (async () => {
      if (token) {
        try {
          await claimPlannerOrder(token);
        } catch {
          // Webhook may already have attached entitlements to this account.
        }
      }
      if (cancelled) return;
      await reload();
      navigate(location.pathname, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, reload]);

  useEffect(() => subscribePlannerReadiness(setReadiness), []);

  useEffect(() => {
    if (!profile) return;
    const current = profile;
    let cancelled = false;
    async function reconcile() {
      invalidatePlannerSnapshot(current.id);
      const snapshot = await loadPlannerWorkspace(current);
      if (cancelled) return;
      setReadiness(runPlannerIntelligence(snapshot).readiness.percent);
    }
    void reconcile();
    const stop = onPlannerWorkspaceBump(() => {
      void reconcile();
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [profile, location.pathname]);

  return (
    <>
      <PageHead title="Christmas Planner" description="Your private Christmas command center." noindex nofollow exactTitle />
      <div className={frameClass}>
        <header className="tdg-planner-header">
          <a className="tdg-planner-logo" href="/account/christmas" aria-label="Christmas Planner">
            <img src="/TheDigitalGifter.png" alt="" width={36} height={36} decoding="async" />
            <PlannerGiftMark size={34} />
            <span>Christmas Planner</span>
          </a>
          <p className="tdg-planner-header-count">
            {daysLeft > 1 ? (
              <>
                <strong>{daysLeft}</strong> days until Christmas <PlannerTreeMark size={14} />
              </>
            ) : (
              countdownCopy(daysLeft)
            )}
          </p>
          <div className="tdg-planner-header-meta">
            {readiness != null ? (
              <span className="tdg-planner-ready-mini">
                <span>
                  {readiness}% <span className="tdg-planner-ready-mini-label">ready</span>
                </span>
                <PlannerProgress value={readiness} compact />
              </span>
            ) : null}
            <PlannerHeaderTools />
            <PlannerAccountChrome />
          </div>
        </header>
        <aside className="tdg-planner-side" aria-label="Planner modules">
          <div className="tdg-planner-side-brand">
            <PlannerGiftMark size={44} />
            <strong>Christmas Planner</strong>
            <i className="tdg-planner-side-flourish" aria-hidden="true" />
            <span>Your calm Christmas starts here.</span>
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
            <button type="button" className="tdg-planner-side-copilot" onClick={() => copilot?.openCopilot(undefined, "sidebar")}>
              <Sparkles size={16} strokeWidth={1.7} aria-hidden />
              AI Copilot
            </button>
            <a href="/account">
              <UserRound size={16} strokeWidth={1.6} aria-hidden />
              Account
            </a>
          </div>
        </aside>
        <main className="tdg-planner-main">
          {access?.access_source === "qa_grant" ? (
            <details className="tdg-planner-qa-note" data-testid="planner-qa-access">
              <summary>QA ACCESS</summary>
              <p>Test access is on for this account. It is not a Stripe payment.</p>
            </details>
          ) : null}
          {loading ? <PlannerLoading /> : !profile ? <PlannerOnboarding /> : <Outlet />}
        </main>
        <ChristmasCopilotRail />
        <nav className="tdg-planner-nav" aria-label="Christmas planner">
          <NavLink to="/account/christmas" end className={({ isActive }) => (isActive ? "active" : "")}>
            <Home size={18} strokeWidth={1.7} aria-hidden />
            Home
          </NavLink>
          <NavLink to="/account/christmas/plan" className={({ isActive }) => (isActive ? "active" : "")}>
            <LayoutList size={18} strokeWidth={1.7} aria-hidden />
            Plan
          </NavLink>
          <button type="button" className="tdg-planner-nav-copilot" onClick={() => copilot?.openCopilot(undefined, "nav")}>
            <Sparkles size={18} strokeWidth={1.7} aria-hidden />
            AI Copilot
          </button>
          <NavLink to="/account/christmas/shopping" className={({ isActive }) => (isActive ? "active" : "")}>
            <ShoppingBag size={18} strokeWidth={1.7} aria-hidden />
            Shopping
          </NavLink>
          <NavLink to="/account/christmas/more" className={({ isActive }) => (isActive ? "active" : "")}>
            <MoreHorizontal size={18} strokeWidth={1.7} aria-hidden />
            More
          </NavLink>
        </nav>
      </div>
    </>
  );
}

function PlannerHeaderTools() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notesOpen, setNotesOpen] = useState(false);

  function onSearch() {
    if (location.pathname.startsWith("/account/christmas/plan")) {
      const input = document.getElementById("planner-add-task") as HTMLInputElement | null;
      input?.focus();
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    navigate("/account/christmas/gifts");
  }

  return (
    <div className="tdg-planner-header-tools">
      <button type="button" className="tdg-planner-header-icon" aria-label="Search" onClick={onSearch}>
        <Search size={18} strokeWidth={1.7} />
      </button>
      <button
        type="button"
        className="tdg-planner-header-icon"
        aria-label="Notifications"
        aria-expanded={notesOpen}
        onClick={() => setNotesOpen((v) => !v)}
      >
        <Bell size={18} strokeWidth={1.7} />
      </button>
      {notesOpen ? (
        <div className="tdg-planner-notes-pop" role="status">
          You’re all caught up. New reminders will appear here.
        </div>
      ) : null}
    </div>
  );
}

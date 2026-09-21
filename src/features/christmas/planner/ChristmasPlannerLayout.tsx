import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Gift,
  Home,
  LayoutList,
  ListTodo,
  MoreHorizontal,
  Settings,
  ShoppingBag,
  Sparkles,
  TreePine,
  UtensilsCrossed,
} from "lucide-react";
import { PageHead } from "@/components/PageHead";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, type ComponentType } from "react";
import { claimPlannerOrder } from "./api";
import { CopilotHost, useCopilotUi } from "./copilot/CopilotHost";
import { firstNameFromAuthUser } from "./entitlements";
import { readPlannerOrderRecovery } from "./guest";
import { PlannerOnboarding, PlannerBundleProvider, usePlannerBundle } from "./Onboarding";
import { moreRouteActive, SIDEBAR_MORE, SIDEBAR_PRIMARY } from "./shell/modules";
import "./plannerApp.css";

const SIDE_ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>> = {
  home: Home,
  today: ListTodo,
  plan: LayoutList,
  gifts: Gift,
  meals: UtensilsCrossed,
  recipes: BookOpen,
  shopping: ShoppingBag,
};

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
  const { loading, profile, reload } = usePlannerBundle();
  const copilot = useCopilotUi();
  const { user } = useAuth();
  const firstName = firstNameFromAuthUser(user);
  const avatar =
    (typeof user?.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url) ||
    (typeof user?.user_metadata?.picture === "string" && user.user_metadata.picture) ||
    "";
  const initial = (firstName || "Y").slice(0, 1).toUpperCase();
  const moreOpenDefault = moreRouteActive(location.pathname);
  const [moreOpen, setMoreOpen] = useState(moreOpenDefault);
  const isHub = location.pathname === "/account/christmas";

  useEffect(() => {
    if (moreOpenDefault) setMoreOpen(true);
  }, [moreOpenDefault]);

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

  return (
    <>
      <PageHead title="Christmas Planner" description="Your private Christmas command center." noindex nofollow exactTitle />
      <div className="tdg-planner-frame">
        <aside className="tdg-planner-side" aria-label="Planner modules">
          <div className="tdg-planner-side-brand">
            <TreePine size={22} strokeWidth={1.7} aria-hidden />
            <strong>Christmas Planner</strong>
          </div>
          <nav className="tdg-planner-side-nav">
            {SIDEBAR_PRIMARY.map((item) => {
              const Icon = SIDE_ICONS[item.id] || Home;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? Boolean(item.end) : false}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <Icon size={16} strokeWidth={1.6} aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
            <div className={`tdg-planner-more-group${moreOpen || moreOpenDefault ? " is-open" : ""}`}>
              <button
                type="button"
                className={moreOpenDefault ? "active" : ""}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <MoreHorizontal size={16} strokeWidth={1.6} aria-hidden />
                More
              </button>
              {moreOpen ? (
                <div className="tdg-planner-more-links">
                  {SIDEBAR_MORE.map((item) => (
                    <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="tdg-planner-side-idea"
              onClick={() => copilot?.openCopilot(undefined, "sidebar")}
            >
              <Sparkles size={16} strokeWidth={1.6} aria-hidden />
              Need an idea?
            </button>
          </nav>
          <div className="tdg-planner-side-foot">
            <NavLink to="/account/christmas/settings" className={({ isActive }) => (isActive ? "active" : "")}>
              {avatar ? <img src={avatar} alt="" width={28} height={28} /> : <span className="tdg-planner-avatar">{initial}</span>}
              <span className="tdg-planner-side-user">
                <strong>{firstName || "You"}</strong>
                <span>Account &amp; settings</span>
              </span>
              <Settings size={14} strokeWidth={1.6} aria-hidden />
            </NavLink>
          </div>
        </aside>
        <main className="tdg-planner-main">
          {!isHub ? (
            <header className="tdg-planner-mobile-top">
              <span>
                <TreePine size={18} strokeWidth={1.7} aria-hidden />
                Christmas Planner
              </span>
              <a href="/account/dashboard" aria-label="Account">
                {avatar ? <img src={avatar} alt="" width={28} height={28} /> : <span className="tdg-planner-avatar">{initial}</span>}
              </a>
            </header>
          ) : (
            <header className="tdg-planner-mobile-top tdg-planner-hub-mobile-top">
              <span>
                <TreePine size={18} strokeWidth={1.7} aria-hidden />
                Christmas Planner
              </span>
              <a href="/account/dashboard" aria-label="Account">
                {avatar ? <img src={avatar} alt="" width={28} height={28} /> : <span className="tdg-planner-avatar">{initial}</span>}
              </a>
            </header>
          )}
          {loading ? <p className="tdg-planner-muted">Opening your Christmas…</p> : !profile ? <PlannerOnboarding /> : <Outlet />}
        </main>
        <nav className="tdg-planner-nav" aria-label="Christmas planner">
          <NavLink to="/account/christmas" end className={({ isActive }) => (isActive ? "active" : "")}>
            <Home size={18} strokeWidth={1.6} aria-hidden />
            Home
          </NavLink>
          <NavLink to="/account/christmas/plan" className={({ isActive }) => (isActive ? "active" : "")}>
            <LayoutList size={18} strokeWidth={1.6} aria-hidden />
            Plan
          </NavLink>
          <button type="button" className="tdg-planner-nav-copilot" onClick={() => copilot?.openCopilot(undefined, "mobile-nav")}>
            <Sparkles size={18} strokeWidth={1.6} aria-hidden />
            AI Copilot
          </button>
          <NavLink to="/account/christmas/shopping" className={({ isActive }) => (isActive ? "active" : "")}>
            <ShoppingBag size={18} strokeWidth={1.6} aria-hidden />
            Shopping
          </NavLink>
          <NavLink to="/account/christmas/more" className={({ isActive }) => (isActive ? "active" : "")}>
            <MoreHorizontal size={18} strokeWidth={1.6} aria-hidden />
            More
          </NavLink>
        </nav>
      </div>
    </>
  );
}

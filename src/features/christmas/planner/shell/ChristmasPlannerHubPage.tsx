import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { trackPlannerEvent } from "../analytics";
import { dayGreeting } from "../date";
import { firstNameFromAuthUser } from "../entitlements";
import { FoundingPassUnlockButton } from "../FoundingPassUnlock";
import {
  invalidatePlannerSnapshot,
  loadPlannerWorkspace,
  runPlannerIntelligence,
  type PlannerIntelligence,
} from "../intelligence";
import { PlannerOnboarding, usePlannerBundle } from "../Onboarding";
import { buildModuleCards, collectHomeNextActions, homeProgressFromReadiness, showPlannerUpgrade, type ModuleCardModel } from "./homeStats";
import { PlannerHomeRail } from "./PlannerHomeRail";
import { PlannerModuleGrid } from "./PlannerModuleCard";
import { PlannerSearch } from "./PlannerSearch";

export default function ChristmasPlannerHubPage() {
  const { loading, access, profile } = usePlannerBundle();
  const { user } = useAuth();
  const [intel, setIntel] = useState<PlannerIntelligence | null>(null);
  const [unlock, setUnlock] = useState<ModuleCardModel | null>(null);

  useEffect(() => {
    if (!profile) return;
    trackPlannerEvent("planner_dashboard_viewed", {
      planMode: profile.plan_mode,
      metadata: { module: "home" },
    });
    invalidatePlannerSnapshot(profile.id);
    void loadPlannerWorkspace(profile).then((snapshot) => {
      setIntel(runPlannerIntelligence(snapshot, []));
    });
  }, [profile?.id]);

  const firstName = firstNameFromAuthUser(user);
  const greeting = profile ? dayGreeting(new Date(), profile.timezone, firstName) : dayGreeting(new Date(), undefined, firstName);

  const cards = useMemo(() => {
    if (!intel) return [];
    return buildModuleCards({
      snapshot: intel.snapshot,
      access,
      spentMinor: intel.budget.spentMinor,
    });
  }, [intel, access]);

  const nextActions = useMemo(() => (intel ? collectHomeNextActions({ snapshot: intel.snapshot, intel }) : []), [intel]);
  const progress = homeProgressFromReadiness(intel?.readiness.percent || 0, cards);
  const upgrade = showPlannerUpgrade(access);

  if (loading) return <p className="tdg-planner-muted">Opening your Christmas…</p>;
  if (!profile) return <PlannerOnboarding />;
  if (!intel) return <p className="tdg-planner-muted">Opening your Christmas…</p>;

  return (
    <div className="tdg-planner-hub">
      <header className="tdg-planner-hub-head">
        <div className="tdg-planner-hub-hello">
          <h1>{greeting}</h1>
          <p>A calmer, happier Christmas is just a few clicks away. 🎄</p>
        </div>
        <PlannerSearch compact />
      </header>

      <div className="tdg-planner-hub-body">
        <PlannerModuleGrid cards={cards} onUnlock={setUnlock} />
        <PlannerHomeRail
          showUpgrade={upgrade}
          progress={progress}
          nextActions={nextActions}
          daysLeft={intel?.snapshot.daysLeft ?? 0}
        />
      </div>

      <p className="tdg-planner-hub-mobile-today">
        <Link to="/account/christmas/today">Today’s next steps</Link>
      </p>

      {unlock ? (
        <div className="tdg-planner-sheet" role="dialog" aria-modal="true" aria-labelledby="planner-unlock-title">
          <button type="button" className="tdg-planner-sheet-backdrop" aria-label="Close" onClick={() => setUnlock(null)} />
          <div className="tdg-planner-sheet-card">
            <h2 id="planner-unlock-title">Unlock {unlock.title}</h2>
            <p>This opens the existing Complete Planner checkout. No extra product is created.</p>
            <FoundingPassUnlockButton feature={unlock.feature || "planner_core"} label={`Unlock ${unlock.title}`} />
            <Link className="tdg-planner-btn" to={unlock.href} onClick={() => setUnlock(null)}>
              View {unlock.title}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

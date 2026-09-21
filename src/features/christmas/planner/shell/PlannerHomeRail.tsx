import { Link } from "react-router-dom";
import { FoundingPassUnlockButton } from "../FoundingPassUnlock";
import { countdownCopy } from "../date";
import type { HomeNextAction, HomeProgressModel } from "./homeStats";
import { PlannerProgressRing } from "./PlannerProgressRing";

export function PlannerHomeRail({
  showUpgrade,
  progress,
  nextActions,
  daysLeft,
}: {
  showUpgrade: boolean;
  progress: HomeProgressModel;
  nextActions: HomeNextAction[];
  daysLeft: number;
}) {
  return (
    <aside className="tdg-planner-home-rail" aria-label="Your Christmas">
      <div className="tdg-planner-rail-hero">
        <p>
          Your Christmas.
          <br />
          Simpler.
          <br />
          Happier.
          <br />
          Magical. <span aria-hidden>❤️</span>
        </p>
      </div>

      <section className="tdg-planner-rail-card">
        <p className="tdg-planner-rail-kicker">Your Progress</p>
        <div className="tdg-planner-rail-progress">
          <PlannerProgressRing percent={progress.percent} done={progress.done} total={progress.total} />
          <ul>
            {nextActions.length ? (
              nextActions.map((item) => (
                <li key={`${item.href}:${item.label}`}>
                  <Link to={item.href}>{item.label}</Link>
                </li>
              ))
            ) : (
              <li className="is-quiet">You are on track</li>
            )}
            {progress.percent < 100 && nextActions.length < 3 ? (
              <li className="is-quiet">{progress.percent}% planned</li>
            ) : null}
          </ul>
        </div>
      </section>

      {showUpgrade ? (
        <section className="tdg-planner-upgrade-card">
          <div className="tdg-planner-upgrade-visual" aria-hidden />
          <h2>Make this Christmas unforgettable.</h2>
          <FoundingPassUnlockButton feature="planner_core" label="Unlock Complete Planner" />
          <ul>
            <li>Unlock all features</li>
            <li>Festive recipes</li>
            <li>Travel &amp; experiences</li>
            <li>And so much more…</li>
          </ul>
        </section>
      ) : (
        <section className="tdg-planner-rail-card tdg-planner-rail-next">
          <p className="tdg-planner-rail-kicker">Christmas countdown</p>
          <strong>{countdownCopy(daysLeft)}</strong>
          {nextActions[0] ? (
            <Link className="tdg-planner-btn primary" to={nextActions[0].href}>
              {nextActions[0].label}
            </Link>
          ) : (
            <Link className="tdg-planner-btn primary" to="/account/christmas/today">
              Open Today
            </Link>
          )}
        </section>
      )}
    </aside>
  );
}

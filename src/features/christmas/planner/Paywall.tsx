import { Link } from "react-router-dom";
import { PLANNER_PUBLIC_ROUTE, type PlannerFeatureKey } from "./types";
import { trackPlannerEvent } from "./analytics";
import { upgradePackageForFeature } from "./entitlements";

export function PlannerPaywall({
  feature,
  title,
  body,
}: {
  feature: PlannerFeatureKey;
  title: string;
  body: string;
}) {
  const pack = upgradePackageForFeature(feature);
  return (
    <div className="tdg-planner-card tdg-planner-lock">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="tdg-planner-actions" style={{ marginTop: 12 }}>
        <Link
          className="tdg-planner-btn primary"
          to={`${PLANNER_PUBLIC_ROUTE}#pricing`}
          onClick={() => {
            trackPlannerEvent("planner_upgrade_clicked", { feature });
          }}
        >
          See plans
        </Link>
        <span className="tdg-planner-muted">
          Unlocks {pack.productKey.replace("christmas_planner_", "")} · {pack.packageKey}
        </span>
      </div>
    </div>
  );
}

export function money(minor: number | null | undefined, currency: string): string {
  const n = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toFixed(0)} ${currency.toUpperCase()}`;
  }
}

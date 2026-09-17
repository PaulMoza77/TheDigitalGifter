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
  const to = `${PLANNER_PUBLIC_ROUTE}?package=${encodeURIComponent(pack.packageKey)}#pricing`;
  return (
    <div className="tdg-planner-card tdg-planner-lock">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="tdg-planner-actions" style={{ marginTop: 12 }}>
        <Link
          className="tdg-planner-btn primary"
          to={to}
          onClick={() => {
            trackPlannerEvent("planner_upgrade_clicked", { feature, packageKey: pack.packageKey });
          }}
        >
          Unlock{" "}
          {pack.packageKey.startsWith("addon_")
            ? pack.packageKey.replace("addon_", "").replace(/_/g, " ")
            : "this season"}
        </Link>
      </div>
    </div>
  );
}

export function money(minor: number | null | undefined, currency: string): string {
  const n = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "eur").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${(currency || "eur").toUpperCase()}`;
  }
}

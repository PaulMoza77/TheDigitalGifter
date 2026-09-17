import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackChristmasEvent } from "@/features/christmas/analytics";
import { PLANNER_PRODUCT_KEY } from "@/features/christmas/planner/commerce";
import { fetchMyPlannerEntitlements } from "@/features/christmas/planner/api";

export default function AccountChristmasPage() {
  const [keys, setKeys] = useState<string[]>([]);
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void trackChristmasEvent("planner_opened", {
      productKey: PLANNER_PRODUCT_KEY,
      pathname: "/account/christmas",
    });
    void fetchMyPlannerEntitlements()
      .then((rows) => {
        setKeys(rows.map((row) => row.entitlement_key));
        setTier(rows.find((row) => row.tier)?.tier || null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-6 text-zinc-100">
      <PageHead title="Christmas Planner" description="Your Christmas Planner access." exactTitle noindex />
      <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Christmas Planner</p>
      <h1 className="mt-2 font-serif text-3xl">Your Planner is being prepared</h1>
      <p className="mt-3 max-w-2xl text-zinc-300">
        Access is unlocked on this account. The interactive Planner workspace — countdown, tasks, gifts, budget, meals, and
        more — ships in the next Christmas Planner task.
      </p>
      {loading ? <p className="mt-4 text-sm text-zinc-400">Checking entitlements…</p> : null}
      {!loading && keys.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">
          No Planner purchase on this account yet.{" "}
          <Link className="underline" to="/christmas/planner">
            Get Christmas Planner
          </Link>
        </p>
      ) : null}
      {tier ? <p className="mt-4 text-amber-100">Unlocked tier: {tier.replace("_", " ")}</p> : null}
      {keys.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
          {keys.map((key) => (
            <li key={key} className="rounded-xl border border-white/10 px-3 py-2">
              {key.replace("planner.", "").replaceAll("_", " ")}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { supabase } from "@/lib/supabase";
import { useUserCreditsQuery } from "@/data";
import { fetchPlannerAccess } from "@/features/christmas/planner/api";
import { PLANNER_BONUS_EVENT_TYPE, PLANNER_PURCHASE_BONUS_CREDITS } from "@/features/christmas/planner/bonusCredits";
import { PLANNER_ACCOUNT_ROUTE } from "@/features/christmas/planner/types";
import "@/features/christmas/planner/planner.css";

type WelcomeState = "processing" | "ready" | "timeout";

async function fetchBonusGranted(): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;
  if (!user) return false;
  const email = (user.email || "").trim().toLowerCase();
  const { data } = await supabase
    .from("credits_ledger")
    .select("id")
    .eq("event_type", PLANNER_BONUS_EVENT_TYPE)
    .eq("user_id", user.id)
    .limit(1);
  if ((data || []).length > 0) return true;
  if (!email) return false;
  const { data: byEmail } = await supabase
    .from("credits_ledger")
    .select("id")
    .eq("event_type", PLANNER_BONUS_EVENT_TYPE)
    .eq("user_convex_id", email)
    .limit(1);
  return (byEmail || []).length > 0;
}

export default function PlannerPurchaseWelcomePage() {
  const [state, setState] = useState<WelcomeState>("processing");
  const [paid, setPaid] = useState(false);
  const [bonus, setBonus] = useState(false);
  const { data: credits = 0, refetch } = useUserCreditsQuery();
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      attempts.current += 1;
      try {
        const [access, granted] = await Promise.all([fetchPlannerAccess(), fetchBonusGranted()]);
        if (cancelled) return;
        const entitled = Boolean(access?.paid && access.payment_fulfilled !== false && access.access_source !== "qa_grant");
        setPaid(entitled);
        setBonus(granted);
        void refetch();
        if (entitled && granted) {
          setState("ready");
          return;
        }
      } catch {
        /* keep processing */
      }
      if (attempts.current >= 12) {
        setState((prev) => (prev === "ready" ? prev : "timeout"));
        return;
      }
      window.setTimeout(() => {
        if (!cancelled) void poll();
      }, 2000);
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  const confirmed = state === "ready";

  return (
    <div className="tdg-planner" style={{ minHeight: "100dvh", padding: "2rem 1.25rem 6rem" }} data-testid="planner-welcome">
      <PageHead title="Your Christmas Planner is ready" description="Purchase confirmation for Christmas Planner 2026." noindex exactTitle />
      <p className="tdg-planner__kicker">The Digital Gifter</p>
      {confirmed ? (
        <>
          <h1>Your Christmas Planner is ready.</h1>
          <ul className="tdg-pl__offer-ticks" style={{ marginTop: 24 }}>
            <li>Christmas Planner 2026 · Active</li>
            <li>One-time purchase confirmed</li>
            <li>+{PLANNER_PURCHASE_BONUS_CREDITS} AI bonus credits added</li>
            <li>Current total credit balance: {Number(credits || 0)}</li>
          </ul>
          <div style={{ height: 20 }} />
          <Link className="tdg-planner__btn" to={PLANNER_ACCOUNT_ROUTE}>
            Open my Christmas Planner
          </Link>
          <div className="tdg-pl__cta-row">
            <Link className="tdg-planner__btn tdg-planner__btn--ghost" to="/generator?category=image">
              Create an image
            </Link>
            <Link className="tdg-planner__btn tdg-planner__btn--ghost" to="/generator?category=video">
              Create a video
            </Link>
            <Link className="tdg-planner__btn tdg-planner__btn--ghost" to="/account">
              View my account
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1>We’re confirming your payment…</h1>
          <p className="tdg-planner__lede">
            Access and bonus credits appear only after the payment is verified. This usually takes a few seconds.
          </p>
          {paid && !bonus ? <p>Planner access is on. Credits are still arriving.</p> : null}
          <div style={{ height: 16 }} />
          <button
            type="button"
            className="tdg-planner__btn"
            onClick={() => {
              attempts.current = 0;
              setState("processing");
              window.location.reload();
            }}
          >
            Refresh status
          </button>
          {state === "timeout" ? (
            <p className="tdg-planner__micro" style={{ marginTop: 16 }}>
              Still waiting? Safe to retry, or contact{" "}
              <Link to="/support">support</Link>.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

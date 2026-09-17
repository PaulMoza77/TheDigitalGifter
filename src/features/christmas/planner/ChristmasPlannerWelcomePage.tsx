import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { supabase } from "@/lib/supabase";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";
import { trackChristmasEvent } from "../analytics";
import { PLANNER_ACCOUNT_ROUTE, PLANNER_PRODUCT_KEY } from "./commerce";
import { claimPlannerOrder, fetchPlannerOrder } from "./api";
import { readPlannerOrderRecovery } from "./guest";
import { trackPlannerMetaPurchase } from "./meta";
import "./planner.css";

export default function ChristmasPlannerWelcomePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "missing">("loading");
  const [claimed, setClaimed] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const token = params.get("token") || readPlannerOrderRecovery()?.publicToken || "";

  useEffect(() => {
    void trackChristmasEvent("planner_welcome_view", {
      productKey: PLANNER_PRODUCT_KEY,
      pathname: "/christmas/planner/welcome",
    });
    let cancelled = false;
    async function load() {
      if (!token) {
        setStatus("missing");
        return;
      }
      try {
        const order = await fetchPlannerOrder(token);
        if (cancelled) return;
        if (order.paymentStatus === "paid") {
          setStatus("paid");
          setClaimed(order.claimed);
          trackPlannerMetaPurchase(order.orderId, order.amountCents, order.currency);
          void trackChristmasEvent("planner_purchase", {
            productKey: PLANNER_PRODUCT_KEY,
            packageKey: order.packageKey,
            orderId: order.orderId,
            amountCents: order.amountCents,
            pathname: "/christmas/planner/welcome",
          });
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            await claim(token);
          } else {
            setNeedsAuth(true);
          }
        } else {
          setStatus("pending");
        }
      } catch {
        if (!cancelled) setStatus("missing");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function claim(publicToken: string) {
    try {
      void trackChristmasEvent("planner_claim_started", {
        productKey: PLANNER_PRODUCT_KEY,
        pathname: "/christmas/planner/welcome",
      });
      const result = await claimPlannerOrder(publicToken);
      setClaimed(true);
      setNeedsAuth(false);
      void trackChristmasEvent("planner_claim_completed", {
        productKey: PLANNER_PRODUCT_KEY,
        orderId: result.orderId,
        pathname: "/christmas/planner/welcome",
        metadata: { already: result.already },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth_required") setNeedsAuth(true);
      else if (code === "already_claimed") setMessage("This purchase is already attached to another account. Sign in with that account.");
      else setMessage(err instanceof Error ? err.message : "Could not attach your Planner.");
    }
  }

  async function onSignIn(event: FormEvent) {
    event.preventDefault();
    rememberAuthReturnTo("/christmas/planner/welcome");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const created = await supabase.auth.signUp({ email, password });
      if (created.error) {
        setMessage(created.error.message);
        return;
      }
    }
    if (token) await claim(token);
  }

  async function onGoogle() {
    rememberAuthReturnTo("/christmas/planner/welcome");
    const base = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${base}/auth/callback` },
    });
  }

  return (
    <div className="tdg-planner" style={{ minHeight: "100dvh", padding: "2rem 1.25rem 6rem" }}>
      <PageHead
        title="Your Christmas Planner is ready"
        description="Purchase confirmed. Continue to your Christmas Planner."
        url="https://www.thedigitalgifter.com/christmas/planner/welcome"
        exactTitle
        noindex
      />
      <p className="tdg-planner__kicker">The Digital Gifter</p>
      {status === "loading" ? <p>Checking your purchase…</p> : null}
      {status === "pending" ? <p>Payment is still confirming. Refresh this page in a moment — your purchase is saved.</p> : null}
      {status === "missing" ? (
        <p>
          We could not find a Planner purchase in this browser. Open the link from your email, or return to the Planner
          offer.
        </p>
        <div style={{ height: 16 }} />
        <Link className="tdg-planner__btn" to="/christmas/planner">
          Return to the Planner offer
        </Link>
      ) : null}
      {status === "paid" ? (
        <>
          <h1>Your Christmas Planner is ready 🎄</h1>
          <p className="tdg-planner__lede">Your access is unlocked. The full Planner experience is being prepared in your account.</p>
          {needsAuth ? (
            <div className="tdg-planner__checkout" style={{ maxWidth: 420, marginTop: 24 }}>
              <h2>Create account / Sign in</h2>
              <p>Attach this purchase to your account so it is waiting when the Planner app and web workspace open.</p>
              <form onSubmit={(event) => void onSignIn(event)}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                <div style={{ height: 10 }} />
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                <div style={{ height: 12 }} />
                <button type="submit" className="tdg-planner__btn">
                  Continue
                </button>
              </form>
              <div style={{ height: 12 }} />
              <button type="button" className="tdg-planner__btn" onClick={() => void onGoogle()}>
                Continue with Google
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="tdg-planner__btn"
              onClick={() => {
                void trackChristmasEvent("planner_opened", {
                  productKey: PLANNER_PRODUCT_KEY,
                  pathname: PLANNER_ACCOUNT_ROUTE,
                });
                navigate(PLANNER_ACCOUNT_ROUTE);
              }}
            >
              Continue to my Planner
            </button>
          )}
        </>
      ) : null}
      {claimed ? <p className="tdg-planner__micro">Purchase attached to your account.</p> : null}
      {message ? <p role="alert">{message}</p> : null}
    </div>
  );
}

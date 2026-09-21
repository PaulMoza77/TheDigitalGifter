import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { supabase } from "@/lib/supabase";
import { createAccountWithEmailPassword, signInWithEmailPassword } from "@/lib/auth/emailPassword";
import { startGoogleSignIn } from "@/lib/auth/googleOAuth";
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
  const [busy, setBusy] = useState<"signin" | "signup" | "google" | null>(null);
  const token = params.get("token") || readPlannerOrderRecovery()?.publicToken || "";

  useEffect(() => {
    void trackChristmasEvent("planner_welcome_view", {
      productKey: PLANNER_PRODUCT_KEY,
      pathname: "/christmas/planner/welcome",
      metadata: { funnel_variant: "compact_personalized_v1" },
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
            metadata: { funnel_variant: "compact_personalized_v1" },
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
        metadata: { funnel_variant: "compact_personalized_v1" },
      });
      const result = await claimPlannerOrder(publicToken);
      setClaimed(true);
      setNeedsAuth(false);
      void trackChristmasEvent("planner_claim_completed", {
        productKey: PLANNER_PRODUCT_KEY,
        orderId: result.orderId,
        pathname: "/christmas/planner/welcome",
        metadata: { already: result.already, funnel_variant: "compact_personalized_v1" },
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
    setBusy("signin");
    setMessage(null);
    const result = await signInWithEmailPassword(supabase, email, password);
    if (!result.ok) {
      setMessage(result.error);
      setBusy(null);
      return;
    }
    if (token) await claim(token);
    setBusy(null);
  }

  async function onCreateAccount() {
    setBusy("signup");
    setMessage(null);
    const result = await createAccountWithEmailPassword(supabase, email, password);
    if (!result.ok) {
      setMessage(result.error);
      setBusy(null);
      return;
    }
    if (result.needsConfirmation) {
      setMessage("Check your email to confirm the account, then sign in.");
      setBusy(null);
      return;
    }
    if (token) await claim(token);
    setBusy(null);
  }

  async function onGoogle() {
    setBusy("google");
    setMessage(null);
    try {
      await startGoogleSignIn("/christmas/planner/welcome");
    } catch (err) {
      setBusy(null);
      setMessage(err instanceof Error ? err.message : "Google sign-in is unavailable.");
    }
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
        <>
          <p>
            We could not find a Planner purchase in this browser. Open the link from your email, or return to the
            Planner offer.
          </p>
          <div style={{ height: 16 }} />
          <Link className="tdg-planner__btn" to="/christmas/planner">
            Return to the Planner offer
          </Link>
        </>
      ) : null}
      {status === "paid" ? (
        <>
          <h1>Your Christmas Planner is ready 🎄</h1>
          <p className="tdg-planner__lede">Your access is unlocked. The full Planner experience is being prepared in your account.</p>
          {needsAuth ? (
            <div className="tdg-planner__checkout" style={{ maxWidth: 420, marginTop: 24 }}>
              <h2>Sign in or create an account</h2>
              <p>Attach this purchase to your account so it is waiting when the Planner app and web workspace open.</p>
              <form onSubmit={(event) => void onSignIn(event)}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                <div style={{ height: 10 }} />
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
                <div style={{ height: 12 }} />
                <button type="submit" className="tdg-planner__btn" disabled={busy !== null}>
                  {busy === "signin" ? "Signing in…" : "Sign in"}
                </button>
              </form>
              <div style={{ height: 10 }} />
              <button
                type="button"
                className="tdg-planner__btn"
                disabled={busy !== null}
                onClick={() => void onCreateAccount()}
              >
                {busy === "signup" ? "Creating account…" : "Create account"}
              </button>
              <div style={{ height: 12 }} />
              <button type="button" className="tdg-planner__btn" disabled={busy !== null} onClick={() => void onGoogle()}>
                {busy === "google" ? "Waiting for Google…" : "Continue with Google"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="tdg-planner__btn"
              onClick={() => {
                const returnTo = params.get("return_to") || "";
                const next =
                  returnTo.startsWith("/account/christmas") && !returnTo.startsWith("//")
                    ? returnTo.split("?")[0]
                    : PLANNER_ACCOUNT_ROUTE;
                void trackChristmasEvent("planner_opened", {
                  productKey: PLANNER_PRODUCT_KEY,
                  pathname: next,
                });
                navigate(next);
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

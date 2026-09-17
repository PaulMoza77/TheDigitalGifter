import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { trackPlannerEvent } from "./analytics";
import { fetchPlannerAccess, readPlannerOrder } from "./api";
import { PLANNER_ACCOUNT_ROUTE, PLANNER_WELCOME_ROUTE } from "./types";
import "./planner.css";

export default function ChristmasPlannerWelcomePage() {
  const [params] = useSearchParams();
  const { session, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState<"loading" | "signed_out" | "claimed" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    trackPlannerEvent("planner_welcome_view", {
      metadata: { checkout: params.get("checkout") || "" },
    });
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const stored = readPlannerOrder();
      if (!session) {
        if (!cancelled) setStatus("signed_out");
        return;
      }
      trackPlannerEvent("planner_claim_started");
      const { error } = await supabase.rpc("claim_christmas_planner_grants_for_user");
      if (error && !cancelled) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      await fetchPlannerAccess();
      if (!cancelled) {
        setStatus("claimed");
        trackPlannerEvent("planner_claim_completed", {
          orderId: typeof stored?.orderId === "string" ? stored.orderId : null,
        });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function emailAuth(mode: "in" | "up") {
    const clean = email.trim().toLowerCase();
    if (!clean || !password) {
      setMessage("Enter email and password.");
      return;
    }
    rememberAuthReturnTo(PLANNER_WELCOME_ROUTE);
    const fn =
      mode === "up"
        ? supabase.auth.signUp({
            email: clean,
            password,
            options: { emailRedirectTo: `${window.location.origin}${PLANNER_WELCOME_ROUTE}` },
          })
        : supabase.auth.signInWithPassword({ email: clean, password });
    const { error } = await fn;
    if (error) setMessage(error.message);
  }

  return (
    <div className="tdg-planner tdg-planner-funnel">
      <ChristmasPageHead path="/christmas/planner" noindex />
      <div className="tdg-planner-shell">
        <p className="tdg-planner-brand">Christmas Planner</p>
        <h1>Your Christmas Planner is ready 🎄</h1>
        <p className="tdg-planner-lede">
          Your purchase stays with this browser and this email — even if you close the tab, finish Google sign-in, or
          open the recovery email later.
        </p>
        {status === "loading" ? <p className="tdg-planner-muted">Checking your access…</p> : null}
        {message ? <p role="alert">{message}</p> : null}
        {status === "signed_out" ? (
          <div className="tdg-planner-card" style={{ marginTop: 18 }}>
            <div className="tdg-planner-actions">
              <button
                type="button"
                className="tdg-planner-btn primary"
                onClick={() => {
                  rememberAuthReturnTo(PLANNER_WELCOME_ROUTE);
                  void signInWithGoogle({ redirectTo: `${window.location.origin}/auth/callback` });
                }}
              >
                Continue with Google
              </button>
            </div>
            <input
              className="tdg-planner-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="tdg-planner-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="tdg-planner-actions">
              <button type="button" className="tdg-planner-btn primary" onClick={() => void emailAuth("in")}>
                Sign in
              </button>
              <button type="button" className="tdg-planner-btn" onClick={() => void emailAuth("up")}>
                Create account
              </button>
            </div>
          </div>
        ) : null}
        {status === "claimed" || status === "error" ? (
          <div className="tdg-planner-actions" style={{ marginTop: 20 }}>
            <Link className="tdg-planner-btn primary" to={PLANNER_ACCOUNT_ROUTE}>
              Continue to my Planner
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

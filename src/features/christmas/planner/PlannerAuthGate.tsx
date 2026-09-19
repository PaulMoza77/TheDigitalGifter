import { FormEvent, useEffect, useState } from "react";
import { PageHead } from "@/components/PageHead";
import { supabase } from "@/lib/supabase";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";
import { FONT_HREF } from "../landing/assets";
import { PLANNER_ACCOUNT_ROUTE } from "./types";
import "./plannerApp.css";

function GoogleMark() {
  return (
    <svg className="tdg-planner-google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function ensurePlannerFonts() {
  if (document.querySelector(`link[data-planner-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-planner-fonts", "1");
  document.head.appendChild(link);
}

export default function PlannerAuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    ensurePlannerFonts();
  }, []);

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    rememberAuthReturnTo(PLANNER_ACCOUNT_ROUTE);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const created = await supabase.auth.signUp({ email, password });
      if (created.error) {
        setMessage(created.error.message);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    window.location.assign(PLANNER_ACCOUNT_ROUTE);
  }

  async function onGoogle() {
    setGoogleBusy(true);
    setMessage(null);
    rememberAuthReturnTo(PLANNER_ACCOUNT_ROUTE);
    const base = window.location.origin;
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${base}/auth/callback` },
      });
    } catch (err) {
      setGoogleBusy(false);
      setMessage(err instanceof Error ? err.message : "Google sign-in is unavailable.");
    }
  }

  return (
    <div className="tdg-planner-app tdg-planner-app--auth">
      <PageHead title="Christmas Planner" description="Sign in to open your private Christmas Planner." noindex exactTitle />
      <div className="tdg-planner-auth">
        <p className="tdg-planner-brand">Christmas Planner</p>
        <h1>Your Christmas Plan is ready.</h1>
        <p className="tdg-planner-auth-lede">
          Sign in to open the private Planner. Your answers stay on this device until then.
        </p>

        <button
          type="button"
          className="tdg-planner-google"
          onClick={() => void onGoogle()}
          disabled={googleBusy || busy}
        >
          <GoogleMark />
          {googleBusy ? "Continuing with Google…" : "Continue with Google"}
        </button>

        <div className="tdg-planner-auth-divider" role="separator">
          <span>or email</span>
        </div>

        <form className="tdg-planner-auth-form" onSubmit={(e) => void onEmail(e)}>
          <label htmlFor="planner-auth-email">Email</label>
          <input
            id="planner-auth-email"
            className="tdg-planner-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
          <label htmlFor="planner-auth-password">Password</label>
          <input
            id="planner-auth-password"
            className="tdg-planner-input"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          {message ? (
            <p className="tdg-planner-auth-error" role="alert">
              {message}
            </p>
          ) : null}
          <button type="submit" className="tdg-planner-btn primary" disabled={busy || googleBusy}>
            {busy ? "Opening…" : "Open my Christmas Planner"}
          </button>
        </form>
      </div>
    </div>
  );
}

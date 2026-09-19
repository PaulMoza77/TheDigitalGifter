import { FormEvent, useState } from "react";
import { PageHead } from "@/components/PageHead";
import { supabase } from "@/lib/supabase";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";
import { PLANNER_ACCOUNT_ROUTE } from "./types";
import "./plannerApp.css";

export default function PlannerAuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    rememberAuthReturnTo(PLANNER_ACCOUNT_ROUTE);
    const base = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${base}/auth/callback` },
    });
  }

  return (
    <div className="tdg-planner-app">
      <PageHead title="Christmas Planner" description="Sign in to open your private Christmas Planner." noindex exactTitle />
      <div className="tdg-planner-auth">
        <p className="tdg-planner-brand">Christmas Planner</p>
        <h1>Your Christmas Plan is ready.</h1>
        <p className="tdg-planner-muted" style={{ margin: "8px 0 18px" }}>
          Sign in or create an account to open the private Planner. Quiz answers stay on this device until then.
        </p>
        <form onSubmit={(e) => void onEmail(e)}>
          <input className="tdg-planner-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="tdg-planner-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          {message ? <p className="tdg-planner-muted">{message}</p> : null}
          <button type="submit" className="tdg-planner-btn primary" disabled={busy}>
            {busy ? "Continuing…" : "Open my Christmas Planner"}
          </button>
        </form>
        <div style={{ height: 12 }} />
        <button type="button" className="tdg-planner-btn" onClick={() => void onGoogle()}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

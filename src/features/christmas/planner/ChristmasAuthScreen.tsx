import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { supabase } from "@/lib/supabase";
import { createAccountWithEmailPassword, signInWithEmailPassword } from "@/lib/auth/emailPassword";
import { startGoogleSignIn } from "@/lib/auth/googleOAuth";
import { authErrorMessage } from "@/lib/auth/oauthReturn";
import { isSafeAuthReturnPath, rememberAuthReturnTo } from "@/lib/auth/returnTo";
import { resolvePostAuthDestination } from "@/lib/auth/postAuth";
import { FONT_HREF } from "@/features/christmas/landing/assets";
import "@/features/christmas/planner/plannerApp.css";

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

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  return isSafeAuthReturnPath(decoded) ? decoded : null;
}

export default function ChristmasAuthScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(authErrorMessage(params.get("auth_error")));
  const [busy, setBusy] = useState<"signin" | "signup" | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    ensurePlannerFonts();
    if (next) rememberAuthReturnTo(next);
  }, [next]);

  async function finish() {
    const dest = await resolvePostAuthDestination(next || "/account");
    navigate(dest, { replace: true });
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
    await finish();
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
    await finish();
  }

  async function onGoogle() {
    setGoogleBusy(true);
    setMessage(null);
    try {
      await startGoogleSignIn(next || "/account");
    } catch (err) {
      setGoogleBusy(false);
      setMessage(err instanceof Error ? err.message : "Google sign-in is unavailable.");
    }
  }

  const formBusy = busy !== null;

  return (
    <div className="tdg-planner-app tdg-planner-app--auth" data-testid="christmas-auth-screen">
      <PageHead
        title="Welcome back to Christmas"
        description="Sign in to open your planner, view your purchases, and use your AI credits."
        noindex
        nofollow
        exactTitle
      />
      <div className="tdg-planner-auth">
        <p className="tdg-planner-brand">Christmas Planner</p>
        <h1>Welcome back to Christmas.</h1>
        <p className="tdg-planner-auth-lede">
          Sign in to open your planner, view your purchases, and use your AI credits.
        </p>

        <button
          type="button"
          className="tdg-planner-google"
          onClick={() => void onGoogle()}
          disabled={googleBusy || formBusy}
        >
          <GoogleMark />
          {googleBusy ? "Waiting for Google…" : "Continue with Google"}
        </button>
        {googleBusy ? (
          <p className="tdg-planner-auth-hint">
            Google can take several seconds to open. Keep this tab open after you pick an account.
          </p>
        ) : null}

        <div className="tdg-planner-auth-divider" role="separator">
          <span>or email</span>
        </div>

        <form className="tdg-planner-auth-form" onSubmit={(e) => void onSignIn(e)}>
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
          <div className="tdg-planner-auth-actions">
            <button type="submit" className="tdg-planner-btn primary" disabled={formBusy || googleBusy}>
              {busy === "signin" ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              className="tdg-planner-btn ghost"
              disabled={formBusy || googleBusy}
              onClick={() => void onCreateAccount()}
            >
              {busy === "signup" ? "Creating account…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

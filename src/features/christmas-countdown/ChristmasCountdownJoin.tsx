import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getChristmasFunnelSessionId, trackChristmasEvent, trackChristmasEventOnce } from "@/features/christmas/analytics";
import {
  CHRISTMAS_COUNTDOWN_DEFAULTS,
  type ChristmasCountdownPublicConfig,
} from "@/features/christmas-countdown/defaults";
import { christmasAuthCallbackUrl, rememberChristmasJoinPending } from "@/features/christmas-countdown/joinAuth";
import { attributionForSignup } from "@/features/christmas-countdown/utm";

function pad(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

function remainingParts(targetIso: string, now: number) {
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) return null;
  const diff = target - now;
  if (diff <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const seconds = Math.floor(diff / 1000);
  return {
    done: false,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

async function registerSignup(input: {
  email: string;
  signupMethod: "email" | "google";
  userId?: string | null;
  marketingOptIn: boolean;
  campaignYear: number;
}) {
  const attr = attributionForSignup();
  const { data, error } = await supabase.rpc("register_christmas_countdown_signup", {
    p_email: input.email,
    p_signup_method: input.signupMethod,
    p_user_id: input.userId ?? null,
    p_source: attr.source,
    p_medium: attr.medium,
    p_campaign: attr.campaign,
    p_utm_content: attr.content,
    p_utm_term: attr.term,
    p_referrer: attr.referrer,
    p_landing_page: attr.landingPage || "/christmas",
    p_funnel_session_id: getChristmasFunnelSessionId(),
    p_marketing_opt_in: input.marketingOptIn,
    p_campaign_year: input.campaignYear,
  });
  if (error) throw error;
  return data as { ok?: boolean; created?: boolean; duplicate?: boolean } | null;
}

export function ChristmasCountdownJoin({
  config,
}: {
  config: ChristmasCountdownPublicConfig;
}) {
  const { user, signInWithGoogle } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const parts = useMemo(
    () => remainingParts(config.countdownTargetAt || CHRISTMAS_COUNTDOWN_DEFAULTS.countdownTargetAt, now),
    [config.countdownTargetAt, now],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const completeGoogle = useCallback(async () => {
    if (!user?.email) return;
    setSubmitting(true);
    try {
      await registerSignup({
        email: user.email,
        signupMethod: "google",
        userId: user.id,
        marketingOptIn: optIn,
        campaignYear: config.campaignYear,
      });
      void trackChristmasEvent("christmas_google_auth_completed", {
        productKey: "christmas_countdown",
        pathname: "/christmas",
      });
      void trackChristmasEventOnce("christmas_join_completed", {
        productKey: "christmas_countdown",
        pathname: "/christmas",
        metadata: { signup_method: "google" },
      });
      setJoined(true);
    } catch (err) {
      console.error("[ChristmasCountdownJoin] google complete failed", err);
      toast.error("Could not finish Google signup. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [config.campaignYear, optIn, user?.email, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("join") === "google" && user?.email && !joined) {
      void completeGoogle();
    }
  }, [completeGoogle, joined, user?.email]);

  if (!config.pageActive && !config.signupActive) return null;

  const boxes = parts
    ? [
        { label: "Days", value: pad(parts.days) },
        { label: "Hours", value: pad(parts.hours) },
        { label: "Minutes", value: pad(parts.minutes) },
        { label: "Seconds", value: pad(parts.seconds) },
      ]
    : [];

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-white/15 bg-white/5 p-5 text-left shadow-[0_16px_50px_rgba(0,0,0,.25)]">
      {config.pageActive && parts ? (
        parts.done ? (
          <p className="text-center text-sm text-[#ffd976]">{config.reachedMessage}</p>
        ) : (
          <div>
            <p className="text-center text-xs uppercase tracking-[0.25em] text-white/60">Countdown to Christmas</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {boxes.map((box) => (
                <div key={box.label} className="rounded-2xl border border-white/10 bg-black/30 px-2 py-3 text-center">
                  <div className="text-xl font-bold tabular-nums text-[#fffef5] sm:text-2xl">{box.value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-white/50">{box.label}</div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : null}

      {config.signupActive ? (
        joined ? (
          <p className="mt-5 text-center text-sm text-[#dfe6f1]">{config.successMessage}</p>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const clean = email.trim().toLowerCase();
              if (!clean) {
                toast.error("Enter your email to join.");
                return;
              }
              void trackChristmasEventOnce("christmas_join_started", {
                productKey: "christmas_countdown",
                pathname: "/christmas",
              });
              setSubmitting(true);
              void registerSignup({
                email: clean,
                signupMethod: "email",
                userId: user?.id ?? null,
                marketingOptIn: optIn,
                campaignYear: config.campaignYear,
              })
                .then(() => {
                  void trackChristmasEventOnce("christmas_join_completed", {
                    productKey: "christmas_countdown",
                    pathname: "/christmas",
                    metadata: { signup_method: "email" },
                  });
                  setJoined(true);
                })
                .catch((err) => {
                  console.error("[ChristmasCountdownJoin] email signup failed", err);
                  toast.error("Could not join right now. Please try again.");
                })
                .finally(() => setSubmitting(false));
            }}
          >
            <label className="block text-sm font-medium text-[#fffef5]">
              Join the Christmas list
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() =>
                  void trackChristmasEventOnce("christmas_join_started", {
                    productKey: "christmas_countdown",
                    pathname: "/christmas",
                  })
                }
                placeholder="you@email.com"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#ffd976]/50"
                autoComplete="email"
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-white/60">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="mt-0.5"
              />
              Email me Christmas updates. Unchecked means we only store your signup for this countdown.
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-2xl bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] px-4 py-3 text-sm font-bold text-[#1a1a1a] disabled:opacity-60"
              >
                {submitting ? "Joining…" : "Join with email"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  void trackChristmasEventOnce("christmas_join_started", {
                    productKey: "christmas_countdown",
                    pathname: "/christmas",
                  });
                  void trackChristmasEvent("christmas_google_auth_started", {
                    productKey: "christmas_countdown",
                    pathname: "/christmas",
                  });
                  rememberChristmasJoinPending();
                  void signInWithGoogle({ redirectTo: christmasAuthCallbackUrl() }).catch((err) => {
                    console.error("[ChristmasCountdownJoin] google start failed", err);
                    toast.error("Google sign-in failed.");
                  });
                }}
                className="flex-1 rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 disabled:opacity-60"
              >
                Continue with Google
              </button>
            </div>
          </form>
        )
      ) : null}
    </div>
  );
}

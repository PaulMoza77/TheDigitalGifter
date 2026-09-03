import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import {
  getOrCreateFreeGiftGuestToken,
  treeFunnel,
} from "./tree/treeApi";
import { adventDoorState, adventDayParts } from "./tree/treeLogic";

type RewardRow = {
  day: number;
  title: string;
  description: string;
  reward_type: string;
  active: boolean;
  claimed: boolean;
};

type AdventStatus = {
  ok: boolean;
  season_year: number;
  timezone_policy: string;
  engine_ready: boolean;
  production_claims_live: boolean;
  advent_enabled: boolean;
  calendar: {
    year: number;
    month: number;
    day: number;
    eligible_day: number | null;
    before_season: boolean;
    after_season: boolean;
  };
  rewards: RewardRow[];
  auth_required_for_claim: boolean;
};

export default function ChristmasAdventPage() {
  const [status, setStatus] = useState<AdventStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<{
    title: string;
    description?: string;
    entitlement_key?: string | null;
  } | null>(null);
  const [freeGift, setFreeGift] = useState<{
    title: string;
    description?: string;
    message?: string | null;
    already?: boolean;
  } | null>(null);
  const [authed, setAuthed] = useState(false);
  const pageViewed = useRef(false);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const data = await treeFunnel<AdventStatus>({ action: "adventStatus" });
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Advent");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_page_view", {
      productKey: "christmas_advent",
      pathname: "/christmas/advent",
    });
    void refresh();
    void supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session?.user));
    });
  }, []);

  async function claimDay(day: number) {
    setBusy(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in to claim today's reward.");
        return;
      }
      const data = await treeFunnel<{
        ok: boolean;
        title: string;
        description?: string;
        entitlement_key?: string | null;
        already?: boolean;
      }>(
        { action: "claimAdvent", day },
        token,
      );
      setClaimResult({
        title: data.title,
        description: data.description,
        entitlement_key: data.entitlement_key,
      });
      void trackChristmasEvent("reward_claimed", {
        productKey: "christmas_advent",
        pathname: "/christmas/advent",
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  async function claimFreeGift() {
    setBusy(true);
    setError(null);
    try {
      const guest = getOrCreateFreeGiftGuestToken();
      const data = await treeFunnel<{
        ok: boolean;
        already?: boolean;
        gift: { title: string; description?: string; message?: string | null };
      }>({
        action: "claimFreeGift",
        guest_token: guest,
      });
      setFreeGift({
        title: data.gift.title,
        description: data.gift.description,
        message: data.gift.message,
        already: data.already,
      });
      void trackChristmasEvent("free_gift_claimed", {
        productKey: "christmas_advent",
        pathname: "/christmas/advent",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Free gift unavailable";
      setError(
        msg.includes("free_gift_disabled")
          ? "Free Christmas Gift opens closer to the season."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  const localParts = adventDayParts(new Date(), status?.season_year || 2026);
  const calendar = status?.calendar || {
    eligible_day: localParts.eligibleDay,
    before_season: localParts.beforeSeason,
    after_season: localParts.afterSeason,
    year: localParts.year,
    month: localParts.month,
    day: localParts.day,
  };
  const rewards = status?.rewards || Array.from({ length: 24 }, (_, i) => ({
    day: i + 1,
    title: `Day ${i + 1}`,
    description: "",
    reward_type: "surprise_message",
    active: false,
    claimed: false,
  }));

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden"
      style={{
        background: "linear-gradient(165deg,#1b1020 0%,#0e1a24 50%,#132018 100%)",
        color: "#f6f0e6",
      }}
    >
      <PageHead
        title="Christmas Advent Calendar"
        description="Open a daily Christmas door from December 1. Sign in to claim rewards when the season is live."
      />

      <div className="mx-auto max-w-lg px-4 pb-20 pt-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-rose-200/70">
          The Digital Gifter
        </p>
        <h1 className="mt-2 text-center font-serif text-3xl text-rose-50">Advent Calendar</h1>
        <p className="mt-2 text-center text-sm text-rose-100/75">
          {calendar.before_season
            ? "Advent begins December 1."
            : calendar.after_season
              ? "This season’s Advent has ended. See you next year."
              : "Open today’s door for a Christmas reward."}
        </p>

        {status ? (
          <p className="mt-3 text-center text-[11px] text-rose-100/50">
            Engine ready · claims{" "}
            {status.production_claims_live ? "live" : "not live yet"} ·{" "}
            {status.timezone_policy}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md bg-red-900/40 px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <ol className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Advent doors">
          {rewards.map((r) => {
            const door = adventDoorState({
              day: r.day,
              eligibleDay: calendar.eligible_day,
              claimed: r.claimed,
              beforeSeason: calendar.before_season,
              afterSeason: calendar.after_season,
            });
            const isToday = door === "available";
            return (
              <li key={r.day}>
                <button
                  type="button"
                  disabled={busy || door !== "available" || !status?.advent_enabled}
                  aria-label={`Day ${r.day}, ${door}`}
                  onClick={() => void claimDay(r.day)}
                  className={`flex h-14 w-full flex-col items-center justify-center rounded-md border text-sm transition ${
                    isToday
                      ? "border-amber-300 bg-amber-200/90 text-slate-900"
                      : door === "claimed"
                        ? "border-emerald-500/40 bg-emerald-900/40 text-emerald-100"
                        : "border-white/10 bg-white/5 text-rose-100/70"
                  } disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <span className="font-semibold">{r.day}</span>
                  <span className="text-[9px] uppercase tracking-wide">
                    {door === "claimed"
                      ? "Opened"
                      : door === "available"
                        ? "Today"
                        : door === "preseason"
                          ? "Soon"
                          : door === "missed"
                            ? "Missed"
                            : "Locked"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {!authed ? (
          <p className="mt-6 text-center text-sm text-rose-100/80">
            Sign in to claim today’s reward when Advent is live.{" "}
            <Link className="underline" to="/account">
              Sign in
            </Link>
          </p>
        ) : null}

        <section className="mt-10 rounded-md border border-white/15 p-4" aria-label="Free Christmas Gift">
          <h2 className="font-serif text-lg">Get Your Christmas Gift</h2>
          <p className="mt-1 text-sm text-rose-100/70">
            A free seasonal surprise — no cash credits for anonymous visitors.
          </p>
          <button
            type="button"
            className="mt-4 w-full rounded-md bg-rose-200 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
            disabled={busy}
            onClick={() => void claimFreeGift()}
          >
            Open free gift
          </button>
          {freeGift ? (
            <div className="mt-3 text-sm text-rose-50">
              <p className="font-medium">{freeGift.title}</p>
              {freeGift.description ? <p className="mt-1 opacity-80">{freeGift.description}</p> : null}
              {freeGift.message ? <p className="mt-1 opacity-80">{freeGift.message}</p> : null}
              {freeGift.already ? (
                <p className="mt-1 text-xs opacity-60">Same gift on refresh — no reroll.</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <p className="mt-10 text-center text-sm">
          <Link className="underline" to="/christmas/tree">
            Build your Christmas Tree
          </Link>
          {" · "}
          <Link className="underline" to="/christmas">
            Christmas hub
          </Link>
        </p>
      </div>

      {claimResult ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Reward claimed"
        >
          <div className="w-full max-w-md rounded-lg bg-[#1e1524] p-6">
            <h2 className="font-serif text-xl">{claimResult.title}</h2>
            {claimResult.description ? (
              <p className="mt-3 text-sm text-rose-100/85">{claimResult.description}</p>
            ) : null}
            {claimResult.entitlement_key ? (
              <p className="mt-2 text-xs text-rose-100/60">
                Unlocked: {claimResult.entitlement_key.replace(/_/g, " ")}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-6 w-full rounded-md bg-rose-200 py-2.5 text-sm font-semibold text-slate-900"
              onClick={() => setClaimResult(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

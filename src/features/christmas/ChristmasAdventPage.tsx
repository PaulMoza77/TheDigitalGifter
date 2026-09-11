import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { parseChristmasLocalePath } from "@/features/christmas/seo/localeRouting";
import { normalizeWave1GenerationLocale } from "@/features/christmas/i18n/wave1Locale";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import {
  adventT,
  doorStateLabel,
  formatAdventStartDate,
  type AdventLocale,
} from "./advent/adventCopy";
import {
  adventSeasonStartMs,
  nextBucharestMidnightMs,
  padCountdownValue,
  remainingUntil,
} from "./advent/countdown";
import {
  getOrCreateFreeGiftGuestToken,
  treeFunnel,
} from "./tree/treeApi";
import { adventDoorState, adventDayParts } from "./tree/treeLogic";
import {
  ADVENT_SEO_DEPTH,
  ChristmasProductSeoDepth,
} from "./seo/ChristmasProductSeoDepth";

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

const COUNTDOWN_UNITS = [
  { key: "days" as const, labelKey: "countdown.days" },
  { key: "hours" as const, labelKey: "countdown.hours" },
  { key: "minutes" as const, labelKey: "countdown.minutes" },
  { key: "seconds" as const, labelKey: "countdown.seconds" },
];

export default function ChristmasAdventPage() {
  const location = useLocation();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(location.pathname).locale,
  ) as AdventLocale;
  const t = (key: string, vars?: Record<string, string>) => adventT(key, locale, vars);

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
  const [now, setNow] = useState(() => new Date());
  const pageViewed = useRef(false);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const data = await treeFunnel<AdventStatus>({ action: "adventStatus" });
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.load"));
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function claimDay(day: number) {
    setBusy(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError(t("cta.signInError"));
        return;
      }
      const data = await treeFunnel<{
        ok: boolean;
        title: string;
        description?: string;
        entitlement_key?: string | null;
        already?: boolean;
      }>({ action: "claimAdvent", day }, token);
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
      setError(e instanceof Error ? e.message : t("error.claim"));
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
      const msg = e instanceof Error ? e.message : t("free.error");
      setError(msg.includes("free_gift_disabled") ? t("free.disabled") : msg);
    } finally {
      setBusy(false);
    }
  }

  const seasonYear = status?.season_year || 2026;
  const localParts = adventDayParts(now, seasonYear);
  const calendar = status?.calendar || {
    eligible_day: localParts.eligibleDay,
    before_season: localParts.beforeSeason,
    after_season: localParts.afterSeason,
    year: localParts.year,
    month: localParts.month,
    day: localParts.day,
  };
  const rewards =
    status?.rewards ||
    Array.from({ length: 24 }, (_, i) => ({
      day: i + 1,
      title: t("day.title", { day: String(i + 1) }),
      description: "",
      reward_type: "surprise_message",
      active: false,
      claimed: false,
    }));

  const todayClaimed = rewards.some(
    (r) => r.day === calendar.eligible_day && r.claimed,
  );

  const countdownTarget = useMemo(() => {
    if (calendar.before_season) return adventSeasonStartMs(seasonYear);
    if (calendar.after_season) return null;
    if (todayClaimed || calendar.eligible_day == null) return nextBucharestMidnightMs(now);
    return null;
  }, [calendar.before_season, calendar.after_season, calendar.eligible_day, seasonYear, todayClaimed, now]);

  const countdown = countdownTarget != null ? remainingUntil(countdownTarget, now) : null;
  const countdownUntilKey = calendar.before_season
    ? "countdown.untilAdvent"
    : "countdown.untilTomorrow";

  const lede = calendar.before_season
    ? t("lede.preseason", { date: formatAdventStartDate(locale, seasonYear) })
    : calendar.after_season
      ? t("lede.ended")
      : t("lede.openToday");

  const todayAvailable =
    !calendar.before_season &&
    !calendar.after_season &&
    calendar.eligible_day != null &&
    !todayClaimed;

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden"
      lang={locale}
      style={{
        background: "linear-gradient(165deg,#1b1020 0%,#0e1a24 50%,#132018 100%)",
        color: "#f6f0e6",
      }}
    >
      <ChristmasPageHead path="/christmas/advent" />

      <div className="mx-auto max-w-lg px-4 pb-20 pt-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-rose-200/70">
          {t("brand")}
        </p>
        <h1 className="mt-2 text-center font-serif text-3xl text-rose-50">{t("title")}</h1>
        <p className="mt-2 text-center text-sm text-rose-100/75">{lede}</p>

        {countdown && !countdown.expired ? (
          <div
            className="mt-6 text-center"
            role="timer"
            aria-live="polite"
            aria-label={`${countdown.days} ${t("countdown.days")}, ${countdown.hours} ${t("countdown.hours")}, ${countdown.minutes} ${t("countdown.minutes")}, ${countdown.seconds} ${t("countdown.seconds")} ${t(countdownUntilKey)}`}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-rose-100/55">
              {t(countdownUntilKey)}
            </p>
            <div className="mt-2 flex justify-center gap-3">
              {COUNTDOWN_UNITS.map((u) => (
                <div key={u.key} className="min-w-[3.25rem]">
                  <div className="font-serif text-2xl tabular-nums text-rose-50">
                    {padCountdownValue(countdown[u.key])}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-rose-100/60">
                    {t(u.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {todayAvailable ? (
          <div className="mt-6 text-center">
            <p className="text-xs uppercase tracking-wide text-amber-200/80">
              {t("cta.availableToday")}
            </p>
            <button
              type="button"
              className="mt-2 w-full rounded-md bg-amber-200 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
              disabled={busy || !status?.advent_enabled}
              onClick={() => {
                if (calendar.eligible_day != null) void claimDay(calendar.eligible_day);
              }}
            >
              {t("cta.openToday")}
            </button>
          </div>
        ) : null}

        {!calendar.before_season &&
        !calendar.after_season &&
        todayClaimed ? (
          <p className="mt-4 text-center text-sm text-rose-100/80">{t("cta.comeBackTomorrow")}</p>
        ) : null}

        {status ? (
          <p className="mt-3 text-center text-[11px] text-rose-100/50">
            {t("status.engine", {
              claims: status.production_claims_live ? t("status.live") : t("status.notLive"),
              tz: status.timezone_policy,
            })}
          </p>
        ) : null}

        {busy && !status ? (
          <p className="mt-4 text-center text-sm text-rose-100/70">{t("loading")}</p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md bg-red-900/40 px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <ol className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label={t("doors.aria")}>
          {rewards.map((r) => {
            const door = adventDoorState({
              day: r.day,
              eligibleDay: calendar.eligible_day,
              claimed: r.claimed,
              beforeSeason: calendar.before_season,
              afterSeason: calendar.after_season,
            });
            const isToday = door === "available";
            const label = doorStateLabel(door, locale);
            return (
              <li key={r.day}>
                <button
                  type="button"
                  disabled={busy || door !== "available" || !status?.advent_enabled}
                  aria-label={t("door.aria", { day: String(r.day), state: label })}
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
                  <span className="text-[9px] uppercase tracking-wide">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {!authed ? (
          <p className="mt-6 text-center text-sm text-rose-100/80">
            {t("cta.signInClaim")}{" "}
            <Link className="underline" to="/account">
              {t("cta.signIn")}
            </Link>
          </p>
        ) : null}

        <section className="mt-10 rounded-md border border-white/15 p-4" aria-label={t("free.aria")}>
          <h2 className="font-serif text-lg">{t("free.heading")}</h2>
          <p className="mt-1 text-sm text-rose-100/70">{t("free.lede")}</p>
          <button
            type="button"
            className="mt-4 w-full rounded-md bg-rose-200 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
            disabled={busy}
            onClick={() => void claimFreeGift()}
          >
            {t("cta.openFree")}
          </button>
          {freeGift ? (
            <div className="mt-3 text-sm text-rose-50">
              <p className="font-medium">{freeGift.title}</p>
              {freeGift.description ? <p className="mt-1 opacity-80">{freeGift.description}</p> : null}
              {freeGift.message ? <p className="mt-1 opacity-80">{freeGift.message}</p> : null}
              {freeGift.already ? (
                <p className="mt-1 text-xs opacity-60">{t("free.already")}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <p className="mt-10 text-center text-sm">
          <Link className="underline" to="/christmas/tree">
            {t("nav.tree")}
          </Link>
          {" · "}
          <Link className="underline" to="/christmas">
            {t("nav.hub")}
          </Link>
        </p>

        <ChristmasProductSeoDepth content={ADVENT_SEO_DEPTH} tone="dark" />
      </div>

      {claimResult ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t("reward.aria")}
        >
          <div className="w-full max-w-md rounded-lg bg-[#1e1524] p-6">
            <h2 className="font-serif text-xl">{claimResult.title}</h2>
            {claimResult.description ? (
              <p className="mt-3 text-sm text-rose-100/85">{claimResult.description}</p>
            ) : null}
            {claimResult.entitlement_key ? (
              <p className="mt-2 text-xs text-rose-100/60">
                {t("reward.unlocked", {
                  label: claimResult.entitlement_key.replace(/_/g, " "),
                })}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-6 w-full rounded-md bg-rose-200 py-2.5 text-sm font-semibold text-slate-900"
              onClick={() => setClaimResult(null)}
            >
              {t("cta.close")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

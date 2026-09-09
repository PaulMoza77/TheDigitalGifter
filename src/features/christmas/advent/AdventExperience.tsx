import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "../analytics";
import { getOrCreateFreeGiftGuestToken, treeFunnel } from "../tree/treeApi";
import {
  adventCountdownParts,
  adventDayParts,
  adventDoorState,
  canClaimAdventDoor,
  msUntilAdventStart,
  type AdventDoorState,
} from "../tree/treeLogic";
import { ADVENT_ASSETS, ADVENT_FONT_HREF } from "./assets";
import {
  loadMuted,
  loadOpenedDoors,
  parseSimDate,
  persistMuted,
  persistOpenedDoor,
  playDoorChime,
} from "./adventClient";
import { AdventDoor } from "./AdventDoor";
import { ADVENT_FAQS, adventT, ADVENT_DEFAULT_LOCALE, ADVENT_LOCALE_DIR } from "./copy";
import { adventJsonLd, adventSeo, upsertJsonLd } from "./seo";
import "./AdventCalendar.css";

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

type RevealPayload = {
  day: number;
  title: string;
  description?: string;
  entitlement_key?: string | null;
  kind: "advent" | "free_gift" | "revisit" | "preview";
  already?: boolean;
  needsAuth?: boolean;
};

const FLAKES = Array.from({ length: 22 }, (_, i) => {
  const n = i + 1;
  return {
    id: i,
    left: ((n * 41) % 100) + (n % 4) * 0.2,
    size: 2 + (n % 3),
    duration: 12 + (n % 7) * 1.5,
    delay: -((n * 1.35) % 16),
    opacity: 0.18 + (n % 5) * 0.07,
    drift: (n % 2 === 0 ? 1 : -1) * (10 + (n % 5) * 4),
  };
});

function ensureFont() {
  if (typeof document === "undefined") return;
  if (document.getElementById("advent-fonts")) return;
  const link = document.createElement("link");
  link.id = "advent-fonts";
  link.rel = "stylesheet";
  link.href = ADVENT_FONT_HREF;
  document.head.appendChild(link);
}

export function AdventExperience() {
  const locale = ADVENT_DEFAULT_LOCALE;
  const [searchParams] = useSearchParams();
  const seo = useMemo(() => adventSeo(locale), [locale]);
  const [status, setStatus] = useState<AdventStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [openedLocal, setOpenedLocal] = useState<Set<number>>(() => new Set());
  const [openingDay, setOpeningDay] = useState<number | null>(null);
  const [hint, setHint] = useState<{ title: string; body: string } | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const pageViewed = useRef(false);
  const hintTimer = useRef<number | null>(null);

  const seasonYear = status?.season_year || 2026;
  const simDate = useMemo(() => {
    const fromQuery = parseSimDate(`?${searchParams.toString()}`);
    if (fromQuery) return fromQuery;
    if (typeof window !== "undefined") {
      return parseSimDate(window.location.search);
    }
    return null;
  }, [searchParams]);

  const calendar = useMemo(() => {
    if (simDate) {
      const parts = adventDayParts(simDate, seasonYear);
      return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        eligible_day: parts.eligibleDay,
        before_season: parts.beforeSeason,
        after_season: parts.afterSeason,
      };
    }
    if (status?.calendar) return status.calendar;
    const parts = adventDayParts(new Date(), seasonYear);
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      eligible_day: parts.eligibleDay,
      before_season: parts.beforeSeason,
      after_season: parts.afterSeason,
    };
  }, [seasonYear, simDate, status?.calendar]);

  const rewards = useMemo(() => {
    if (status?.rewards?.length) return status.rewards;
    return Array.from({ length: 24 }, (_, i) => ({
      day: i + 1,
      title: `Day ${i + 1}`,
      description: "",
      reward_type: "surprise_message",
      active: false,
      claimed: false,
    }));
  }, [status?.rewards]);

  const openedCount = useMemo(() => {
    const claimed = rewards.filter((r) => r.claimed).length;
    let localExtra = 0;
    for (const d of openedLocal) {
      const row = rewards.find((r) => r.day === d);
      if (row && !row.claimed) localExtra += 1;
    }
    return Math.min(24, claimed + localExtra);
  }, [openedLocal, rewards]);

  const countdown = useMemo(() => {
    if (!calendar.before_season) return null;
    const ms = msUntilAdventStart(new Date(nowTick), seasonYear);
    return adventCountdownParts(ms);
  }, [calendar.before_season, nowTick, seasonYear]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await treeFunnel<AdventStatus>({ action: "adventStatus" });
      setStatus(data);
    } catch {
      // Keep local calendar fallback — room still worth visiting.
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    ensureFont();
    setMuted(loadMuted());
    upsertJsonLd("tdg-advent-jsonld", adventJsonLd(locale));
    return () => {
      const el = document.getElementById("tdg-advent-jsonld");
      if (el) el.remove();
    };
  }, [locale]);

  useEffect(() => {
    setOpenedLocal(loadOpenedDoors(seasonYear));
  }, [seasonYear]);

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_advent_page_view", {
      productKey: "christmas_advent",
      pathname: "/christmas/advent",
      metadata: { season_year: seasonYear },
    });
    void trackChristmasEvent("christmas_page_view", {
      productKey: "christmas_advent",
      pathname: "/christmas/advent",
    });
    void refresh();
    void supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session?.user));
    });
  }, [refresh, seasonYear]);

  useEffect(() => {
    if (!calendar.before_season) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [calendar.before_season]);

  const showHint = useCallback((title: string, body: string) => {
    setHint({ title, body });
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 4200);
  }, []);

  const markOpened = useCallback(
    (day: number) => {
      persistOpenedDoor(seasonYear, day);
      setOpenedLocal((prev) => {
        const next = new Set(prev);
        next.add(day);
        return next;
      });
    },
    [seasonYear],
  );

  const doorStateFor = useCallback(
    (day: number, claimed: boolean): AdventDoorState =>
      adventDoorState({
        day,
        eligibleDay: calendar.eligible_day,
        claimed,
        beforeSeason: calendar.before_season,
        afterSeason: calendar.after_season,
      }),
    [calendar],
  );

  const openReveal = useCallback(
    async (day: number, reward: RewardRow, state: AdventDoorState) => {
      setOpeningDay(day);
      playDoorChime(muted);
      void trackChristmasEvent("christmas_advent_door_opened", {
        productKey: "christmas_advent",
        pathname: "/christmas/advent",
        metadata: { day, state },
      });

      await new Promise((r) => window.setTimeout(r, 780));
      markOpened(day);

      // Already claimed / previously opened — revisit without re-claiming
      if (reward.claimed || state === "claimed" || openedLocal.has(day)) {
        setReveal({
          day,
          title: reward.title || adventT("reveal.revisit", locale),
          description: reward.description || adventT("reveal.already", locale),
          kind: "revisit",
          already: true,
        });
        void trackChristmasEvent("christmas_advent_reward_viewed", {
          productKey: "christmas_advent",
          pathname: "/christmas/advent",
          metadata: { day, kind: "revisit" },
        });
        setOpeningDay(null);
        return;
      }

      // Authenticated claim path when eligible
      if (authed && canClaimAdventDoor(state) && status?.advent_enabled) {
        try {
          const data = await treeFunnel<{
            ok: boolean;
            title: string;
            description?: string;
            entitlement_key?: string | null;
            already?: boolean;
          }>({ action: "claimAdvent", day }, (await supabase.auth.getSession()).data.session?.access_token);
          setReveal({
            day,
            title: data.title || adventT("reveal.found", locale),
            description: data.description,
            entitlement_key: data.entitlement_key,
            kind: "advent",
            already: data.already,
          });
          void trackChristmasEvent("christmas_advent_reward_claimed", {
            productKey: "christmas_advent",
            pathname: "/christmas/advent",
            metadata: { day, already: Boolean(data.already) },
          });
          void trackChristmasEvent("reward_claimed", {
            productKey: "christmas_advent",
            pathname: "/christmas/advent",
          });
          await refresh();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("advent_disabled") || msg.includes("inactive_reward")) {
            setReveal({
              day,
              title: adventT("reveal.found", locale),
              description: adventT("reveal.seasonSoon", locale),
              kind: "preview",
            });
          } else {
            showHint(adventT("error.generic", locale), "");
          }
        }
        setOpeningDay(null);
        return;
      }

      // Guest / free seasonal surprise — integrated into the door reveal
      if (canClaimAdventDoor(state) || calendar.before_season === false) {
        if (!status?.advent_enabled && !canClaimAdventDoor(state)) {
          setReveal({
            day,
            title: adventT("reveal.found", locale),
            description: adventT("reveal.seasonSoon", locale),
            kind: "preview",
          });
          setOpeningDay(null);
          return;
        }

        // Prefer free gift for today's door; catch-up shows catalog surprise for guests
        if (!authed) {
          if (state === "available") {
            try {
              const guest = getOrCreateFreeGiftGuestToken();
              const data = await treeFunnel<{
                ok: boolean;
                already?: boolean;
                gift: { title: string; description?: string; message?: string | null };
              }>({ action: "claimFreeGift", guest_token: guest });
              setReveal({
                day,
                title: data.gift.title || adventT("reveal.found", locale),
                description:
                  data.gift.description ||
                  data.gift.message ||
                  adventT("reveal.guestReady", locale),
                kind: "free_gift",
                already: data.already,
                needsAuth: false,
              });
              void trackChristmasEvent("christmas_advent_reward_claimed", {
                productKey: "christmas_advent",
                pathname: "/christmas/advent",
                metadata: { day, kind: "free_gift", already: Boolean(data.already) },
              });
              void trackChristmasEvent("free_gift_claimed", {
                productKey: "christmas_advent",
                pathname: "/christmas/advent",
              });
            } catch {
              setReveal({
                day,
                title: adventT("reveal.found", locale),
                description: adventT("reveal.guestReady", locale),
                kind: "preview",
                needsAuth: true,
              });
            }
          } else {
            setReveal({
              day,
              title: reward.title || adventT("reveal.found", locale),
              description: reward.description || adventT("reveal.guestReady", locale),
              kind: "preview",
              needsAuth: true,
            });
          }
          void trackChristmasEvent("christmas_advent_reward_viewed", {
            productKey: "christmas_advent",
            pathname: "/christmas/advent",
            metadata: { day },
          });
          setOpeningDay(null);
          return;
        }

        // Authed but advent flag off — soft preview
        setReveal({
          day,
          title: reward.title || adventT("reveal.found", locale),
          description: reward.description || adventT("reveal.seasonSoon", locale),
          kind: "preview",
          needsAuth: false,
        });
        void trackChristmasEvent("christmas_advent_reward_viewed", {
          productKey: "christmas_advent",
          pathname: "/christmas/advent",
          metadata: { day, kind: "preview" },
        });
      }

      setOpeningDay(null);
    },
    [
      authed,
      calendar.before_season,
      locale,
      markOpened,
      muted,
      refresh,
      showHint,
      openedLocal,
      status?.advent_enabled,
    ],
  );

  const onDoorSelect = useCallback(
    (day: number) => {
      if (busy || openingDay != null) return;
      const reward = rewards.find((r) => r.day === day) || {
        day,
        title: "",
        description: "",
        reward_type: "surprise_message",
        active: false,
        claimed: openedLocal.has(day),
      };
      const claimed = reward.claimed || openedLocal.has(day);
      const state = doorStateFor(day, reward.claimed);

      void trackChristmasEvent("christmas_advent_door_clicked", {
        productKey: "christmas_advent",
        pathname: "/christmas/advent",
        metadata: { day, state },
      });

      if (state === "preseason") {
        void trackChristmasEvent("christmas_advent_locked_door_clicked", {
          productKey: "christmas_advent",
          pathname: "/christmas/advent",
          metadata: { day, state },
        });
        showHint(adventT("door.locked.title", locale), adventT("door.preseason.body", locale));
        return;
      }
      if (state === "future") {
        void trackChristmasEvent("christmas_advent_locked_door_clicked", {
          productKey: "christmas_advent",
          pathname: "/christmas/advent",
          metadata: { day, state },
        });
        showHint(
          adventT("door.locked.title", locale),
          adventT("door.locked.body", locale, { day }),
        );
        return;
      }
      if (state === "ended" && !claimed) {
        void trackChristmasEvent("christmas_advent_locked_door_clicked", {
          productKey: "christmas_advent",
          pathname: "/christmas/advent",
          metadata: { day, state },
        });
        showHint(adventT("after.title", locale), adventT("door.ended.body", locale));
        return;
      }

      void openReveal(day, { ...reward, claimed: reward.claimed }, state);
    },
    [busy, doorStateFor, locale, openReveal, openedLocal, openingDay, rewards, showHint],
  );

  const shareSurprise = useCallback(async () => {
    void trackChristmasEvent("christmas_advent_share_clicked", {
      productKey: "christmas_advent",
      pathname: "/christmas/advent",
      metadata: { day: reveal?.day ?? null },
    });
    const text = `${adventT("reveal.shareText", locale)} 🎄\n${adventT("reveal.shareCta", locale)}: ${seo.url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: adventT("seo.h1", locale), text, url: seo.url });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      showHint(adventT("reveal.share", locale), adventT("reveal.shareCta", locale));
    } catch {
      showHint(adventT("reveal.share", locale), seo.url);
    }
  }, [locale, reveal?.day, seo.url, showHint]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      persistMuted(next);
      return next;
    });
  };

  return (
    <div
      className="advent-page"
      dir={ADVENT_LOCALE_DIR[locale] || "ltr"}
      lang={locale}
      data-advent-sim={simDate ? searchParams.get("sim") : undefined}
      data-advent-day={calendar.eligible_day ?? (calendar.before_season ? "pre" : calendar.after_season ? "after" : "none")}
    >
      <PageHead
        title={seo.title}
        description={seo.description}
        image={seo.image}
        url={seo.url}
        exactTitle
      />

      <nav className="advent-nav" aria-label="Breadcrumb">
        <Link to="/christmas">{adventT("nav.home", locale)}</Link>
      </nav>

      <button type="button" className="advent-sound" onClick={toggleMute}>
        {muted ? adventT("sound.unmute", locale) : adventT("sound.mute", locale)}
      </button>

      <section className="advent-room" aria-label={adventT("seo.h1", locale)}>
        <div className="advent-room__bg" aria-hidden="true">
          <img
            src={ADVENT_ASSETS.room}
            alt=""
            width={1536}
            height={1024}
            decoding="async"
            fetchPriority="high"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = ADVENT_ASSETS.roomFallback;
            }}
          />
          <div className="advent-room__vignette" />
          <div className="advent-room__glow" />
          <div className="advent-snow">
            {FLAKES.map((flake) => (
              <span
                key={flake.id}
                className="advent-flake"
                style={{
                  left: `${flake.left}%`,
                  width: flake.size,
                  height: flake.size,
                  opacity: flake.opacity,
                  animationDuration: `${flake.duration}s`,
                  animationDelay: `${flake.delay}s`,
                  ["--drift" as string]: `${flake.drift}px`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="advent-room__content">
          <header className="advent-header">
            <p className="advent-kicker">{adventT("brand.kicker", locale)}</p>
            <h1>{adventT("hero.h1", locale)}</h1>
            <p className="advent-lede">{adventT("hero.lede", locale)}</p>
            <p className="advent-secondary">{adventT("hero.secondary", locale)}</p>
            {openedCount > 0 && !calendar.before_season ? (
              <p className="advent-progress">
                {adventT("progress", locale, { opened: openedCount })}
              </p>
            ) : null}
            {calendar.before_season && countdown ? (
              <div className="advent-pre">
                <h2>{adventT("pre.title", locale)}</h2>
                <p className="advent-countdown" aria-live="polite">
                  {adventT("pre.countdown", locale, {
                    days: String(countdown.days).padStart(2, "0"),
                    hours: String(countdown.hours).padStart(2, "0"),
                    minutes: String(countdown.minutes).padStart(2, "0"),
                  })}
                </p>
                <p className="advent-secondary">{adventT("pre.hint", locale)}</p>
              </div>
            ) : null}
            {calendar.after_season ? (
              <div className="advent-pre">
                <h2>{adventT("after.title", locale)}</h2>
                <p className="advent-secondary">{adventT("after.lede", locale)}</p>
              </div>
            ) : null}
          </header>

          <div className="advent-board">
            <ol className="advent-grid" aria-label="Advent doors">
              {rewards.map((r) => {
                const state = doorStateFor(r.day, r.claimed);
                return (
                  <AdventDoor
                    key={r.day}
                    day={r.day}
                    state={state}
                    opening={openingDay === r.day}
                    openedVisually={r.claimed || openedLocal.has(r.day)}
                    locale={locale}
                    onSelect={onDoorSelect}
                  />
                );
              })}
            </ol>
          </div>

          <div className="advent-hint" aria-live="polite">
            {hint ? (
              <>
                <strong>{hint.title}</strong>
                {hint.body}
              </>
            ) : calendar.eligible_day && !calendar.before_season && !calendar.after_season ? (
              <span>{adventT("door.hover.today", locale)}</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="advent-below">
        <div className="advent-editorial">
          <h2>{adventT("editorial.h2", locale)}</h2>
          <p>{adventT("editorial.lede", locale)}</p>
          <div className="advent-links">
            <Link
              to="/christmas/tree"
              onClick={() =>
                void trackChristmasEvent("christmas_advent_tree_cross_sell_clicked", {
                  productKey: "christmas_advent",
                  pathname: "/christmas/advent",
                })
              }
            >
              {adventT("editorial.tree", locale)} →
            </Link>
            <Link to="/christmas">{adventT("editorial.hub", locale)} →</Link>
          </div>
        </div>

        <div className="advent-geo">
          <h2>{adventT("geo.h2", locale)}</h2>
          <p>{adventT("geo.lede", locale)}</p>
          <div className="advent-faq">
            {ADVENT_FAQS.map((item) => (
              <details key={item.qKey}>
                <summary>{adventT(item.qKey, locale)}</summary>
                <p>{adventT(item.aKey, locale)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {reveal ? (
        <div
          className="advent-reveal"
          role="dialog"
          aria-modal="true"
          aria-label={reveal.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setReveal(null);
          }}
        >
          <div className="advent-reveal__card">
            <h2>{reveal.kind === "revisit" ? reveal.title : adventT("reveal.found", locale)}</h2>
            {reveal.kind !== "revisit" ? (
              <p>
                <strong>{reveal.title}</strong>
              </p>
            ) : null}
            {reveal.description ? <p>{reveal.description}</p> : null}
            {reveal.already ? <p>{adventT("reveal.already", locale)}</p> : null}
            <div className="advent-reveal__actions">
              {reveal.needsAuth ? (
                <Link className="advent-btn advent-btn--primary" to="/account">
                  {adventT("reveal.save", locale)}
                </Link>
              ) : (
                <Link className="advent-btn advent-btn--primary" to="/generator?occasion=christmas">
                  {adventT("reveal.openGift", locale)}
                </Link>
              )}
              <button type="button" className="advent-btn advent-btn--ghost" onClick={() => void shareSurprise()}>
                {adventT("reveal.share", locale)}
              </button>
              <button type="button" className="advent-btn advent-btn--soft" onClick={() => setReveal(null)}>
                {adventT("reveal.close", locale)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AdventExperience;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "../analytics";
import { ChristmasPresent } from "./ChristmasPresent";
import { ChristmasTreeScene } from "./ChristmasTreeScene";
import { PrizeRail } from "./PrizeRail";
import {
  canOpenGift,
  readGiftTreeState,
  resolvedRewardFromState,
  writeGiftTreeState,
  type GiftTreePersistedState,
} from "./giftState";
import {
  GIFT_TREE_PAID_OFFERS,
  GIFT_TREE_PRODUCT_KEY,
  type GiftTreeRewardDef,
} from "./rewardCatalog";
import { presentLayout, pickWeightedReward } from "./rewardEngine";
import { RewardRevealModal } from "./RewardRevealModal";
import {
  claimGiftTreeOnServer,
  openGiftTreeOnServer,
  rewardFromServerPayload,
} from "./giftTreeApi";
import {
  BOX_THEMES,
  CTA_STYLES,
  DEFAULT_BOX_THEME,
  DEFAULT_CTA_STYLE,
  DEFAULT_SCENE_MOOD,
  SCENE_MOODS,
  type GiftBoxTheme,
  type GiftCtaStyle,
  type GiftSceneMood,
} from "./sceneMoods";

const OPEN_MS = 1100;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export default function ChristmasGiftsPage() {
  const navigate = useNavigate();
  const presents = useMemo(() => presentLayout(6), []);
  const [state, setState] = useState<GiftTreePersistedState>(() => readGiftTreeState());
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);
  const [reward, setReward] = useState<GiftTreeRewardDef | null>(() =>
    resolvedRewardFromState(readGiftTreeState()),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimHint, setClaimHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [compact, setCompact] = useState(false);
  const [mood, setMood] = useState<GiftSceneMood>(DEFAULT_SCENE_MOOD);
  const [ctaStyle, setCtaStyle] = useState<GiftCtaStyle>(DEFAULT_CTA_STYLE);
  const [boxTheme, setBoxTheme] = useState<GiftBoxTheme>(DEFAULT_BOX_THEME);
  const [showVariants, setShowVariants] = useState(false);
  const viewed = useRef(false);
  const anotherViewed = useRef(false);

  const freeUsed = Boolean(state.openedAt);
  const canOpen = canOpenGift(state);
  const cta = CTA_STYLES[ctaStyle];

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    const syncCompact = () => setCompact(window.innerWidth < 768);
    syncCompact();
    window.addEventListener("resize", syncCompact);
    captureFunnelAttribution(window.location.search);
    void supabase.auth.getSession().then(({ data }) => {
      const isAuthed = Boolean(data.session?.user);
      setAuthed(isAuthed);
      if (!viewed.current) {
        viewed.current = true;
        void trackChristmasEvent("christmas_gift_tree_view", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { authenticated: isAuthed },
        });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(Boolean(session?.user));
    });
    return () => {
      window.removeEventListener("resize", syncCompact);
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (freeUsed && !canOpen && !anotherViewed.current) {
      anotherViewed.current = true;
      void trackChristmasEvent("christmas_open_another_gift_viewed", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
      });
    }
  }, [freeUsed, canOpen]);

  const persist = useCallback((next: GiftTreePersistedState) => {
    setState(next);
    writeGiftTreeState(next);
  }, []);

  const runOpen = useCallback(
    async (presentId: string) => {
      if (openingId || !canOpenGift(state)) return;
      setError(null);
      setSelectedId(presentId);
      setOpeningId(presentId);
      setBurst(false);
      void trackChristmasEvent("christmas_present_selected", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { present_id: presentId, authenticated: authed },
      });
      void trackChristmasEvent("christmas_gift_open_started", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { present_id: presentId },
      });

      const animDelay = reduceMotion ? 180 : OPEN_MS;
      let serverResult: Awaited<ReturnType<typeof openGiftTreeOnServer>> | null = null;
      let localFallback: GiftTreeRewardDef | null = null;

      try {
        serverResult = await openGiftTreeOnServer({ presentId });
      } catch (e) {
        localFallback = pickWeightedReward();
        setClaimHint(
          e instanceof Error
            ? "Saved on this device. Sign in later to sync durable rewards."
            : "Saved on this device.",
        );
      }

      window.setTimeout(() => {
        setBurst(true);
        const resolved = serverResult
          ? rewardFromServerPayload(serverResult.reward)
          : localFallback;
        if (!resolved) {
          setError("Something went wrong opening your gift.");
          setOpeningId(null);
          return;
        }
        const next: GiftTreePersistedState = {
          ...state,
          presentId,
          rewardId: resolved.id,
          claimId: serverResult?.claim_id || state.claimId,
          openedAt: new Date().toISOString(),
          claimed: Boolean(serverResult?.already && state.claimed),
          creditsGranted: (serverResult?.credits_granted || 0) > 0,
          extraOpens: state.extraOpens,
        };
        if (!state.openedAt && resolved.type === "gift_token") {
          next.extraOpens = state.extraOpens + 1;
        } else if (state.openedAt) {
          next.extraOpens = Math.max(0, state.extraOpens - 1);
          if (resolved.type === "gift_token") next.extraOpens += 1;
        }
        persist(next);
        setReward(resolved);
        setModalOpen(true);
        setOpeningId(null);
        void trackChristmasEvent("christmas_reward_revealed", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: {
            reward_id: resolved.id,
            reward_type: resolved.type,
            present_id: presentId,
            authenticated: authed,
            server: Boolean(serverResult),
          },
        });
      }, animDelay);
    },
    [authed, openingId, persist, reduceMotion, state],
  );

  const onPrimaryCta = useCallback(() => {
    if (!canOpen) {
      setClaimHint("Your free Christmas gift is already open — more openings coming soon.");
      return;
    }
    if (selectedId) {
      void runOpen(selectedId);
      return;
    }
    const first = presents[2] ?? presents[0];
    if (first) {
      setSelectedId(first.id);
      void runOpen(first.id);
    }
  }, [canOpen, presents, runOpen, selectedId]);

  const onClaim = useCallback(async () => {
    if (!reward) return;
    setClaiming(true);
    setClaimHint(null);
    void trackChristmasEvent("christmas_reward_claim_started", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
      metadata: { reward_id: reward.id, reward_type: reward.type, authenticated: authed },
    });

    try {
      if (reward.requiresAuthToGrant && !authed) {
        const returnTo = encodeURIComponent("/christmas/gifts?claim=1");
        navigate(`/account?next=${returnTo}`);
        return;
      }

      if (state.claimId || authed) {
        try {
          const claimed = await claimGiftTreeOnServer({ claimId: state.claimId });
          persist({
            ...state,
            claimed: true,
            creditsGranted: claimed.credits_granted > 0 || state.creditsGranted,
          });
        } catch {
          persist({ ...state, claimed: true });
        }
      } else {
        persist({ ...state, claimed: true });
      }

      void trackChristmasEvent("christmas_reward_claimed", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { reward_id: reward.id, reward_type: reward.type, authenticated: authed },
      });

      if (reward.type === "gift_token") {
        setModalOpen(false);
        setClaimHint("Extra gift unlocked — tap another present.");
        return;
      }

      navigate(reward.claimPath);
    } finally {
      setClaiming(false);
    }
  }, [authed, navigate, persist, reward, state]);

  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("claim") === "1" && reward && state.openedAt && !state.creditsGranted) {
      setModalOpen(true);
      setClaimHint("You're signed in — claim your Christmas credits.");
    }
  }, [authed, reward, state.creditsGranted, state.openedAt]);

  function presentState(id: string): "available" | "opening" | "opened" | "locked" {
    if (openingId === id) return "opening";
    if (state.presentId === id) return "opened";
    if (!canOpen) return "locked";
    return "available";
  }

  return (
    <>
      <PageHead
        exactTitle
        title="Get Your Christmas Gift | The Digital Gifter"
        description="Choose a present under the Christmas tree and reveal a premium Digital Gifter Christmas surprise."
        url="https://www.thedigitalgifter.com/christmas/gifts"
      />

      <main className="relative h-[calc(100dvh-5rem)] max-h-[calc(100dvh-5rem)] overflow-hidden text-rose-50">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 50% 0%, ${SCENE_MOODS[mood].accentGlow} 0%, transparent 42%),
              linear-gradient(180deg, #120c10 0%, #1a1214 40%, #0c1014 100%)
            `,
          }}
        />

        {!reduceMotion ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-amber-100/70"
                style={{
                  width: 1.5 + (i % 3),
                  height: 1.5 + (i % 3),
                  left: `${(i * 19) % 100}%`,
                  top: `-${(i * 11) % 20}%`,
                  opacity: 0.15 + (i % 4) * 0.08,
                  animation: `gt-sparkle ${12 + (i % 5) * 2}s linear ${i * 0.35}s infinite`,
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="relative mx-auto flex h-full max-w-6xl flex-col px-3 pb-[5.75rem] pt-3 sm:px-5 sm:pb-24 sm:pt-4">
          {/* Branding + copy */}
          <header className="relative z-30 mx-auto w-full max-w-xl shrink-0 text-center">
            <div className="mb-1.5 flex items-center justify-center gap-2.5">
              <img
                src="/TheDigitalGifter.png"
                alt=""
                className="h-8 w-8 rounded-full object-cover ring-1 ring-amber-200/35"
              />
              <p className="font-serif text-lg tracking-wide text-amber-50 sm:text-xl">
                The Digital Gifter
              </p>
            </div>
            <h1 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/70 sm:text-xs">
              Choose a gift under the tree
            </h1>
            <p className="mt-1 text-sm text-rose-100/70 sm:text-[15px]">
              {freeUsed
                ? "Your Christmas surprise is ready."
                : "Tap a gift to reveal your surprise"}
            </p>
          </header>

          {/* Scene + rails */}
          <div className="relative z-10 mt-2 flex min-h-0 flex-1 items-stretch gap-3">
            {!compact ? (
              <PrizeRail side="left" className="hidden w-[148px] shrink-0 lg:block" />
            ) : null}

            <section
              className="relative mx-auto min-h-0 w-full max-w-xl flex-1"
              aria-label="Christmas suite and presents"
            >
              <ChristmasTreeScene
                mood={mood}
                reduceMotion={reduceMotion}
                className="absolute inset-0"
              />

              <div className="absolute inset-x-[4%] bottom-[3%] z-30 h-[34%] sm:h-[32%]">
                {presents.map((p) => (
                  <ChristmasPresent
                    key={p.id}
                    present={p}
                    state={presentState(p.id)}
                    selected={selectedId === p.id}
                    scale={compact ? 0.82 : 0.95}
                    reduceMotion={reduceMotion}
                    boxTheme={boxTheme}
                    onSelect={(id) => {
                      setSelectedId(id);
                      if (canOpen) void runOpen(id);
                    }}
                  />
                ))}
              </div>

              {burst && !reduceMotion ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-40"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 72%, rgba(255,220,150,0.4), transparent 40%)",
                    animation: "gt-burst 700ms ease-out forwards",
                  }}
                />
              ) : null}
            </section>

            {!compact ? (
              <PrizeRail side="right" className="hidden w-[148px] shrink-0 lg:block" />
            ) : null}
          </div>

          {compact ? (
            <PrizeRail compact className="relative z-20 mt-1.5 shrink-0" />
          ) : null}

          {error ? (
            <p className="relative z-20 mt-2 text-center text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}

          {freeUsed && !canOpen ? (
            <section className="relative z-20 mx-auto mt-2 max-w-md shrink-0 text-center">
              <p className="font-serif text-lg text-amber-50">Want to open another gift?</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {GIFT_TREE_PAID_OFFERS.map((offer) => (
                  <button
                    key={offer.packageKey}
                    type="button"
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-rose-50/85"
                    onClick={() => {
                      void trackChristmasEvent("christmas_open_another_gift_clicked", {
                        productKey: GIFT_TREE_PRODUCT_KEY,
                        pathname: "/christmas/gifts",
                        metadata: { package_key: offer.packageKey, purchasable: false },
                      });
                      setClaimHint(
                        "Extra gift openings are coming soon — your first gift is already yours.",
                      );
                    }}
                  >
                    {offer.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="relative z-20 mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setShowVariants((v) => !v)}
              className="text-[10px] uppercase tracking-[0.16em] text-amber-100/40 hover:text-amber-100/70"
            >
              {showVariants ? "Hide looks" : "Compare looks"}
            </button>
          </div>

          {showVariants ? (
            <div className="relative z-30 mx-auto mt-2 grid max-w-xl grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 text-[10px] backdrop-blur-md">
              <label className="space-y-1">
                <span className="text-amber-100/50">Room</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-amber-50"
                  value={mood}
                  onChange={(e) => setMood(e.target.value as GiftSceneMood)}
                >
                  {Object.values(SCENE_MOODS).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-amber-100/50">CTA</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-amber-50"
                  value={ctaStyle}
                  onChange={(e) => setCtaStyle(e.target.value as GiftCtaStyle)}
                >
                  {(Object.keys(CTA_STYLES) as GiftCtaStyle[]).map((k) => (
                    <option key={k} value={k}>
                      {CTA_STYLES[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-amber-100/50">Gifts</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-amber-50"
                  value={boxTheme}
                  onChange={(e) => setBoxTheme(e.target.value as GiftBoxTheme)}
                >
                  {(Object.keys(BOX_THEMES) as GiftBoxTheme[]).map((k) => (
                    <option key={k} value={k}>
                      {BOX_THEMES[k].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <footer className="relative z-20 mt-auto hidden shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-[10px] text-rose-100/40 sm:flex sm:text-[11px]">
            <Link className="hover:text-rose-100/65" to="/christmas">
              Christmas hub
            </Link>
            <Link className="hover:text-rose-100/65" to="/christmas/tree">
              Build a tree
            </Link>
            <Link className="hover:text-rose-100/65" to="/christmas/advent">
              Advent
            </Link>
            <Link className="hover:text-rose-100/65" to="/christmas/photo-generator">
              Portraits
            </Link>
          </footer>
        </div>

        {/* Sticky bottom CTA */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8">
          <div className="pointer-events-auto mx-auto max-w-md">
            <button
              type="button"
              disabled={Boolean(openingId)}
              onClick={onPrimaryCta}
              className={`flex w-full flex-col items-center justify-center rounded-full px-6 py-3.5 transition active:scale-[0.98] disabled:opacity-70 ${cta.className}`}
            >
              <span className="text-[15px] font-semibold tracking-wide">
                {freeUsed && !canOpen
                  ? "Gift Opened"
                  : selectedId
                    ? "Open Selected Gift"
                    : "Choose Your Gift"}
              </span>
              <span className={`text-[11px] font-medium ${cta.subClassName}`}>
                {freeUsed && !canOpen
                  ? "Come back for more Christmas magic"
                  : "Tap a present or start here"}
              </span>
            </button>
            {claimHint ? (
              <p className="mt-2 text-center text-[11px] text-amber-100/70" role="status">
                {claimHint}
              </p>
            ) : null}
          </div>
        </div>
      </main>

      {reward ? (
        <RewardRevealModal
          reward={reward}
          open={modalOpen}
          authenticated={authed}
          claiming={claiming}
          claimHint={claimHint}
          onClaim={() => void onClaim()}
          onClose={() => setModalOpen(false)}
          showOpenAnother={reward.type === "gift_token" || canOpen}
          onOpenAnother={() => {
            setModalOpen(false);
            void trackChristmasEvent("christmas_open_another_gift_clicked", {
              productKey: GIFT_TREE_PRODUCT_KEY,
              pathname: "/christmas/gifts",
              metadata: { source: "modal" },
            });
          }}
        />
      ) : null}

      <style>{`
        @keyframes gt-sparkle {
          from { transform: translateY(0); opacity: 0.2; }
          to { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes gt-burst {
          from { opacity: 0.9; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gt-sparkle"], [style*="gt-burst"] { animation: none !important; }
        }
      `}</style>
    </>
  );
}

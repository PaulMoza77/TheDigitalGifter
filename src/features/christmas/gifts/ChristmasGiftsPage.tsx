import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "../analytics";
import { ChristmasPresent } from "./ChristmasPresent";
import { ChristmasTreeScene } from "./ChristmasTreeScene";
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
import { presentLayout } from "./rewardEngine";
import { RewardRevealModal } from "./RewardRevealModal";
import {
  claimGiftTreeOnServer,
  openGiftTreeOnServer,
  rewardFromServerPayload,
} from "./giftTreeApi";
import { pickWeightedReward } from "./rewardEngine";

const OPEN_MS = 1100;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export default function ChristmasGiftsPage() {
  const navigate = useNavigate();
  const presents = useMemo(() => presentLayout(8), []);
  const [state, setState] = useState<GiftTreePersistedState>(() => readGiftTreeState());
  const [openingId, setOpeningId] = useState<string | null>(null);
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
  const viewed = useRef(false);
  const anotherViewed = useRef(false);

  const freeUsed = Boolean(state.openedAt);
  const canOpen = canOpenGift(state);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    const syncCompact = () => setCompact(window.innerWidth < 420);
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
    if (freeUsed && canOpen === false && !anotherViewed.current) {
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
        // Soft fallback for offline/edge downtime — local reveal only, no durable credits.
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
          extraOpens:
            resolved.type === "gift_token"
              ? state.extraOpens + 1
              : Math.max(0, state.extraOpens - (state.openedAt ? 1 : 0)),
        };
        // First free open shouldn't consume an extra token.
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
          // Non-credit rewards can still navigate with local entitlement.
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

  // Resume claim after login
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
        description="Pick a present under the Christmas tree and reveal a magical Digital Gifter Christmas reward."
        url="https://www.thedigitalgifter.com/christmas/gifts"
      />

      <main
        className="relative min-h-[100dvh] overflow-x-hidden text-rose-50"
        style={{
          background:
            "radial-gradient(ellipse at 50% 18%, #3a1d2a 0%, #141c24 42%, #0a1210 78%), linear-gradient(180deg, #1b1020 0%, #0e1a24 55%, #132018 100%)",
        }}
      >
        {/* Atmospheric particles */}
        {!reduceMotion ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white/70"
                style={{
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  left: `${(i * 17) % 100}%`,
                  top: `-${(i * 13) % 30}%`,
                  opacity: 0.25 + (i % 4) * 0.1,
                  animation: `gt-snow ${10 + (i % 6) * 2}s linear ${i * 0.4}s infinite`,
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-4 pb-10 pt-8 sm:px-6">
          <header className="relative z-20 mx-auto max-w-xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/75">
              A little Christmas magic is waiting for you
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-amber-50 sm:text-5xl">
              Get Your Christmas Gift
            </h1>
            <p className="mt-3 text-sm text-rose-100/75 sm:text-base">
              Choose a present under the tree and discover what&apos;s waiting inside.
            </p>
            {!freeUsed ? (
              <p className="mt-4 text-xs text-amber-100/65">Tap a gift to open it ✨</p>
            ) : null}
          </header>

          <section
            className="relative z-10 mx-auto mt-2 w-full max-w-xl flex-1 sm:mt-4 sm:max-w-2xl"
            aria-label="Christmas tree and presents"
          >
            <ChristmasTreeScene
              reduceMotion={reduceMotion}
              className="relative z-0 w-full translate-y-2 sm:translate-y-0"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
              style={{ height: "38%" }}
              aria-hidden
            >
              <div
                className="absolute inset-x-[6%] bottom-[8%] h-[55%]"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 80%, rgba(20,40,30,0.55), transparent 70%)",
                }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 z-20 h-[42%] sm:h-[38%]">
              {presents.map((p) => (
                <ChristmasPresent
                  key={p.id}
                  present={p}
                  state={presentState(p.id)}
                  scale={compact ? 0.85 : 1}
                  reduceMotion={reduceMotion}
                  onSelect={(id) => void runOpen(id)}
                />
              ))}
            </div>
            {burst && !reduceMotion ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-30"
                style={{
                  background:
                    "radial-gradient(circle at 50% 70%, rgba(255,230,150,0.35), transparent 42%)",
                  animation: "gt-burst 700ms ease-out forwards",
                }}
              />
            ) : null}
          </section>

          {error ? (
            <p className="relative z-20 mt-4 text-center text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}

          {freeUsed && !canOpen ? (
            <section className="relative z-20 mx-auto mt-8 max-w-md text-center">
              <h2 className="font-serif text-2xl text-amber-50">Want to open another gift?</h2>
              <p className="mt-2 text-sm text-rose-100/70">
                There&apos;s more Christmas magic under the tree.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                {GIFT_TREE_PAID_OFFERS.map((offer) => (
                  <button
                    key={offer.packageKey}
                    type="button"
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-rose-50/90"
                    onClick={() => {
                      void trackChristmasEvent("christmas_open_another_gift_clicked", {
                        productKey: GIFT_TREE_PRODUCT_KEY,
                        pathname: "/christmas/gifts",
                        packageKey: offer.packageKey,
                        metadata: { purchasable: false },
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
              {claimHint ? (
                <p className="mt-3 text-xs text-amber-100/70" role="status">
                  {claimHint}
                </p>
              ) : null}
            </section>
          ) : null}

          <footer className="relative z-20 mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-xs text-rose-100/55">
            <Link className="underline-offset-4 hover:underline" to="/christmas">
              Christmas hub
            </Link>
            <Link className="underline-offset-4 hover:underline" to="/christmas/tree">
              Build a Christmas Tree
            </Link>
            <Link className="underline-offset-4 hover:underline" to="/christmas/advent">
              Advent Calendar
            </Link>
            <Link className="underline-offset-4 hover:underline" to="/christmas/photo-generator">
              Christmas Portraits
            </Link>
          </footer>
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
        @keyframes gt-snow {
          from { transform: translateY(0); }
          to { transform: translateY(110vh); }
        }
        @keyframes gt-burst {
          from { opacity: 0.9; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gt-snow"], [style*="gt-burst"] { animation: none !important; }
        }
      `}</style>
    </>
  );
}

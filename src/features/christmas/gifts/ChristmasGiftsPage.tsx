import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { startChristmasCheckout } from "../photoApi";
import { trackChristmasEvent } from "../analytics";
import { ChristmasPresent } from "./ChristmasPresent";
import { ChristmasTreeScene } from "./ChristmasTreeScene";
import { MoreChancesModal } from "./MoreChancesModal";
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

const OPEN_MS = 1100;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export default function ChristmasGiftsPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<GiftTreePersistedState>(() => readGiftTreeState());
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);
  const [reward, setReward] = useState<GiftTreeRewardDef | null>(() =>
    resolvedRewardFromState(readGiftTreeState()),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [seeAllOpen, setSeeAllOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [claimHint, setClaimHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isMobileScene, setIsMobileScene] = useState(false);
  const [attentionId, setAttentionId] = useState<string | null>(null);
  const presents = useMemo(
    () => presentLayout(isMobileScene ? 6 : 7, isMobileScene ? "mobile" : "desktop"),
    [isMobileScene],
  );
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    packageKey: string;
  } | null>(null);
  const viewed = useRef(false);
  const anotherViewed = useRef(false);
  const paidReturnHandled = useRef(false);

  const freeUsed = Boolean(state.openedAt);
  const canOpen = canOpenGift(state);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    setIsMobileScene(window.matchMedia("(max-width: 767px)").matches);
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

  // One subtle idle nudge on an unopened present every 8–15s
  useEffect(() => {
    if (reduceMotion || !canOpen) return;
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
      const wait = 8000 + Math.floor(Math.random() * 7000);
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const available = presents.filter(
          (p) => p.id !== openingId && p.id !== state.presentId,
        );
        if (available.length > 0) {
          const pick = available[Math.floor(Math.random() * available.length)]!;
          setAttentionId(pick.id);
          window.setTimeout(() => {
            if (!cancelled) setAttentionId(null);
          }, 1200);
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [reduceMotion, canOpen, presents, openingId, state.presentId]);

  useEffect(() => {
    if (paidReturnHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gift_chances") !== "1") return;
    paidReturnHandled.current = true;
    const packageKey = params.get("package") || "open_another";
    const offer = GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === packageKey);
    const granted = offer?.opensGranted ?? 1;
    const next: GiftTreePersistedState = {
      ...state,
      extraOpens: state.extraOpens + granted,
    };
    setState(next);
    writeGiftTreeState(next);
    setClaimHint(`Payment received — ${granted} extra gift${granted > 1 ? "s" : ""} unlocked.`);
    setMoreOpen(false);
    setCheckout(null);
    params.delete("gift_chances");
    params.delete("package");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [state]);

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
      const openSlot = state.openedAt ? Math.max(1, state.extraOpens) : 0;

      try {
        serverResult = await openGiftTreeOnServer({ presentId, openSlot });
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

  const requestOpen = useCallback(
    (presentId: string) => {
      setSelectedId(presentId);
      if (!canOpenGift(state)) {
        setMoreOpen(true);
        void trackChristmasEvent("christmas_open_another_gift_viewed", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { source: "present_tap" },
        });
        return;
      }
      void runOpen(presentId);
    },
    [runOpen, state],
  );

  const onPrimaryCta = useCallback(() => {
    if (!canOpen) {
      setMoreOpen(true);
      return;
    }
    if (selectedId) {
      void runOpen(selectedId);
      return;
    }
    const first = presents[2] ?? presents[0];
    if (first) requestOpen(first.id);
  }, [canOpen, presents, requestOpen, runOpen, selectedId]);

  const onPurchase = useCallback(async (packageKey: string) => {
    setPurchasing(true);
    setPurchaseError(null);
    void trackChristmasEvent("christmas_open_another_gift_clicked", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
      metadata: { package_key: packageKey, purchasable: true },
    });
    try {
      const result = await startChristmasCheckout({
        product_key: GIFT_TREE_PRODUCT_KEY,
        package_key: packageKey,
        amount_cents: 1,
        currency: "usd",
        landing_path: "/christmas/gifts",
        source_route: "/christmas/gifts",
        success_url: `${window.location.origin}/christmas/gifts?gift_chances=1&package=${encodeURIComponent(packageKey)}`,
        cancel_url: `${window.location.origin}/christmas/gifts?gift_chances=cancel`,
      });
      setCheckout({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
        amountCents: result.amountCents,
        currency: result.currency,
        packageKey,
      });
      setMoreOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout.";
      setPurchaseError(
        /not enabled|checkout_disabled|disabled/i.test(msg)
          ? "Checkout is warming up — try again shortly."
          : msg,
      );
    } finally {
      setPurchasing(false);
    }
  }, []);

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
        navigate(`/account?next=${encodeURIComponent("/christmas/gifts?claim=1")}`);
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
        description="Open a present under the Christmas tree and reveal a premium Digital Gifter Christmas surprise."
        url="https://www.thedigitalgifter.com/christmas/gifts"
      />

      <div className="relative h-[calc(100dvh-4.05rem)] max-h-[calc(100dvh-4.05rem)] overflow-hidden text-rose-50">
        {/* Scene ends above the CTA band so the button never covers photo gifts */}
        <ChristmasTreeScene
          reduceMotion={reduceMotion}
          className="absolute inset-x-0 top-0 bottom-[5.85rem] sm:bottom-[5.5rem]"
          onBreakpointChange={setIsMobileScene}
        >
          <section className="absolute inset-0" aria-label="Christmas presents">
            {presents.map((p) => (
              <ChristmasPresent
                key={p.id}
                present={p}
                state={presentState(p.id)}
                selected={selectedId === p.id}
                attention={attentionId === p.id}
                reduceMotion={reduceMotion}
                onSelect={requestOpen}
              />
            ))}
            {burst && !reduceMotion ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 78%, rgba(255,220,150,0.35), transparent 38%)",
                  animation: "gt-burst 700ms ease-out forwards",
                }}
              />
            ) : null}
          </section>
        </ChristmasTreeScene>

        {/* Brand lives in the site header on this route — no floating chip over the tree */}

        {error ? (
          <p
            className="absolute inset-x-0 bottom-[5.1rem] z-[6] text-center text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {/* CTA band under the scene — rug / floor, never over the gift pile */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] flex h-[5.85rem] items-end px-4 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1 sm:h-[5.5rem]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(8,6,5,0.55) 42%, rgba(8,6,5,0.82) 100%)",
            }}
          />
          <div className="pointer-events-auto relative mx-auto flex w-[calc(100%-32px)] max-w-[360px] flex-col items-center sm:w-full">
            <button
              type="button"
              disabled={Boolean(openingId)}
              onClick={onPrimaryCta}
              className="gt-cta relative flex min-h-[44px] w-full flex-col items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#f6e7c0] via-[#e4c57a] to-[#c9a35a] px-6 py-1.5 text-[#2a1c0e] shadow-[0_14px_44px_rgba(201,163,90,0.42)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
            >
              <span className="relative z-[1] text-[15px] font-semibold tracking-wide sm:text-base">
                {openingId
                  ? "Opening…"
                  : freeUsed && !canOpen
                    ? "Get More Chances"
                    : "Choose Your Gift"}
              </span>
              <span className="relative z-[1] text-[11px] font-medium text-[#4a3820]/75">
                {freeUsed && !canOpen
                  ? "Unlock another present under the tree"
                  : "Tap a present under the tree"}
              </span>
            </button>

            {claimHint ? (
              <p className="mt-1 text-center text-[11px] text-amber-100/75" role="status">
                {claimHint}
              </p>
            ) : null}

            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10px] text-white/55 sm:text-[11px]">
              <button
                type="button"
                onClick={() => setSeeAllOpen(true)}
                className="font-medium tracking-wide text-amber-200/80 underline-offset-2 hover:text-amber-100 hover:underline"
              >
                Surprises
              </button>
              <span aria-hidden className="text-white/35">·</span>
              <nav
                aria-label="Christmas links"
                className="contents"
              >
                <Link className="hover:text-white/80" to="/christmas">
                  Christmas Hub
                </Link>
                <span aria-hidden>|</span>
                <Link className="hover:text-white/80" to="/christmas/tree">
                  Build a Tree
                </Link>
                <span aria-hidden>|</span>
                <Link className="hover:text-white/80" to="/christmas/advent">
                  Advent
                </Link>
                <span aria-hidden>|</span>
                <Link className="hover:text-white/80" to="/christmas/photo-generator">
                  Portraits
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {reward ? (
        <RewardRevealModal
          reward={reward}
          open={modalOpen}
          authenticated={authed}
          claiming={claiming}
          claimHint={claimHint}
          onClaim={() => void onClaim()}
          onClose={() => setModalOpen(false)}
          showOpenAnother={reward.type === "gift_token" || canOpen || freeUsed}
          onOpenAnother={() => {
            setModalOpen(false);
            if (!canOpen) setMoreOpen(true);
          }}
        />
      ) : null}

      <MoreChancesModal
        open={moreOpen}
        purchasing={purchasing}
        error={purchaseError}
        onClose={() => setMoreOpen(false)}
        onPurchase={(key) => void onPurchase(key)}
      />

      {seeAllOpen ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close rewards"
            className="absolute inset-0 bg-black/70"
            onClick={() => setSeeAllOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-amber-200/20 bg-[#16120f]/95 p-4 backdrop-blur-xl">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">
              Possible surprises
            </p>
            <PrizeRail side="all" className="!static w-full" />
            <button
              type="button"
              className="mt-3 w-full text-center text-xs text-amber-100/60"
              onClick={() => setSeeAllOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {checkout ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-amber-200/20 bg-[#14110e] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-serif text-xl text-amber-50">Complete payment</p>
              <button
                type="button"
                className="text-xs text-amber-100/60"
                onClick={() => setCheckout(null)}
              >
                Cancel
              </button>
            </div>
            <CustomStripeCheckout
              clientSecret={checkout.clientSecret}
              publishableKey={checkout.publishableKey}
              dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
            />
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes gt-burst {
          from { opacity: 0.9; }
          to { opacity: 0; }
        }
        .gt-cta::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            transparent 30%,
            rgba(255,255,255,0.35) 48%,
            transparent 62%
          );
          transform: translateX(-120%);
          pointer-events: none;
        }
        @media (hover: hover) and (pointer: fine) {
          .gt-cta:hover::after {
            animation: gt-cta-sheen 900ms ease-out 1;
          }
        }
        @keyframes gt-cta-sheen {
          from { transform: translateX(-120%); }
          to { transform: translateX(120%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-cta::after { display: none; }
        }
      `}</style>
    </>
  );
}

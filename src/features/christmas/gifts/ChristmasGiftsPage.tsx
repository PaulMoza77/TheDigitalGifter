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
import { GiftOpenCeremony } from "./GiftOpenCeremony";
import { MoreChancesModal } from "./MoreChancesModal";
import { PrizeRail } from "./PrizeRail";
import {
  canOpenGift,
  getOrCreateGiftTreeGuestToken,
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
import { RewardRevealModal, type RewardRevealStep } from "./RewardRevealModal";
import {
  claimGiftEmailOnServer,
  getGiftTreeStatus,
  openGiftTreeOnServer,
  rewardFromServerPayload,
} from "./giftTreeApi";

const OPEN_MS = 2600;
/** Approved gift-open clip — do not replace. */
const GIFT_OPEN_CLIP = "/christmas/gifts/gift-open.mp4";

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
  const [revealStep, setRevealStep] = useState<RewardRevealStep>("reveal");
  const [claimEmail, setClaimEmail] = useState("");
  const [showTapHint, setShowTapHint] = useState(true);
  const [remainingOpens, setRemainingOpens] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isMobileScene, setIsMobileScene] = useState(false);
  const [attentionId, setAttentionId] = useState<string | null>(null);
  const presents = useMemo(
    () => presentLayout(isMobileScene ? 7 : 8, isMobileScene ? "mobile" : "desktop"),
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
  const promptViewed = useRef(false);
  const anotherViewed = useRef(false);
  const paidReturnHandled = useRef(false);

  const persist = useCallback((next: GiftTreePersistedState) => {
    setState(next);
    writeGiftTreeState(next);
  }, []);

  const syncStatus = useCallback(async () => {
    try {
      const status = await getGiftTreeStatus();
      setRemainingOpens(status.remaining_opens || 0);
      if (status.remaining_opens > 0) {
        persist({ ...readGiftTreeState(), extraOpens: status.remaining_opens });
      }
      if (status.free_claimed_today) setShowTapHint(false);
      return status;
    } catch {
      return null;
    }
  }, [persist]);

  useEffect(() => {
    void syncStatus();
  }, [syncStatus]);

  const freeUsed = Boolean(state.openedAt);
  const canOpen = canOpenGift(state);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    setIsMobileScene(window.matchMedia("(max-width: 767px)").matches);
    const warm = document.createElement("link");
    warm.rel = "preload";
    warm.as = "video";
    warm.href = GIFT_OPEN_CLIP;
    warm.type = "video/mp4";
    warm.setAttribute("data-gt-open-clip", "1");
    if (!document.querySelector('link[data-gt-open-clip="1"]')) {
      document.head.appendChild(warm);
    }
    void fetch(GIFT_OPEN_CLIP, { credentials: "same-origin" }).catch(() => undefined);
    captureFunnelAttribution(window.location.search);
    void supabase.auth.getSession().then(({ data }) => {
      const isAuthed = Boolean(data.session?.user);
      setAuthed(isAuthed);
      if (data.session?.user?.email) setClaimEmail(data.session.user.email);
      if (!viewed.current) {
        viewed.current = true;
        void trackChristmasEvent("christmas_gift_tree_view", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { authenticated: isAuthed },
        });
        void trackChristmasEvent("christmas_tree_view", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { authenticated: isAuthed },
        });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(Boolean(session?.user));
      if (session?.user?.email) setClaimEmail(session.user.email);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!showTapHint || freeUsed || promptViewed.current) return;
    promptViewed.current = true;
    void trackChristmasEvent("christmas_free_gift_prompt_view", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
    });
  }, [showTapHint, freeUsed]);

  useEffect(() => {
    if (freeUsed && !canOpen && !anotherViewed.current) {
      anotherViewed.current = true;
      void trackChristmasEvent("christmas_extra_gift_offer_view", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { source: "locked_tree" },
      });
    }
  }, [freeUsed, canOpen]);

  useEffect(() => {
    if (reduceMotion || !canOpen) return;
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
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
      }, 8000 + Math.floor(Math.random() * 7000));
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
    void trackChristmasEvent("christmas_extra_gift_purchase", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
      packageKey,
    });
    void syncStatus().then((status) => {
      const opens = status?.remaining_opens ?? 0;
      setClaimHint(
        opens > 0
          ? `🎁 ${opens} more gift${opens === 1 ? "" : "s"} ${opens === 1 ? "is" : "are"} waiting for you`
          : "Payment received — your gifts will appear shortly. Tap a present.",
      );
      setMoreOpen(false);
      setCheckout(null);
      setModalOpen(false);
      setRevealStep("reveal");
    });
    params.delete("gift_chances");
    params.delete("package");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [syncStatus]);

  const runOpen = useCallback(
    async (presentId: string) => {
      if (openingId || !canOpenGift(state)) return;
      setError(null);
      setSelectedId(presentId);
      setOpeningId(presentId);
      setBurst(false);
      setShowTapHint(false);

      const openSlot = state.openedAt ? Math.max(1, state.extraOpens) : 0;
      void trackChristmasEvent("christmas_gift_tap", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { present_id: presentId, open_slot: openSlot, authenticated: authed },
      });
      void trackChristmasEvent("christmas_gift_open_started", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { present_id: presentId },
      });
      if (openSlot > 0) {
        void trackChristmasEvent("christmas_paid_gift_open", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { present_id: presentId, open_slot: openSlot },
        });
      }

      const animDelay = reduceMotion ? 180 : OPEN_MS;
      let serverResult: Awaited<ReturnType<typeof openGiftTreeOnServer>> | null = null;
      let localFallback: GiftTreeRewardDef | null = null;

      try {
        serverResult = await openGiftTreeOnServer({ presentId, openSlot });
      } catch {
        localFallback = pickWeightedReward();
        setClaimHint("Saved on this device. Enter your email to keep it permanently.");
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
          openedAt: state.openedAt || new Date().toISOString(),
          claimed: Boolean(serverResult?.already && state.claimed),
          creditsGranted: (serverResult?.credits_granted || 0) > 0 || state.creditsGranted,
          extraOpens: state.extraOpens,
        };
        if (!state.openedAt && resolved.type === "gift_token") {
          next.extraOpens = state.extraOpens + 1;
        } else if (state.openedAt) {
          next.extraOpens = Math.max(0, state.extraOpens - 1);
          if (resolved.type === "gift_token") next.extraOpens += 1;
        }
        if (typeof serverResult?.remaining_opens === "number") {
          next.extraOpens = serverResult.remaining_opens;
          setRemainingOpens(serverResult.remaining_opens);
        }

        persist(next);
        setReward(resolved);
        setRevealStep("reveal");
        setModalOpen(true);
        setOpeningId(null);

        void trackChristmasEvent("christmas_reward_reveal", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: {
            reward_id: resolved.id,
            reward_type: resolved.type,
            present_id: presentId,
            server: Boolean(serverResult),
          },
        });
        void trackChristmasEvent("christmas_reward_revealed", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { reward_id: resolved.id, reward_type: resolved.type },
        });
        void trackChristmasEvent("christmas_free_reward_assigned", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { reward_id: resolved.id, reward_type: resolved.type, open_slot: openSlot },
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
        void trackChristmasEvent("christmas_extra_gift_offer_view", {
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

  const onPurchase = useCallback(async (packageKey: string) => {
    setPurchasing(true);
    setPurchaseError(null);
    setRevealStep("checkout");
    void trackChristmasEvent("christmas_extra_gift_pack_select", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
      packageKey,
    });
    void trackChristmasEvent("christmas_extra_gift_payment_start", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
      packageKey,
    });
    void trackChristmasEvent("christmas_open_another_gift_clicked", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
      packageKey,
    });
    try {
      const guestToken = getOrCreateGiftTreeGuestToken();
      const result = await startChristmasCheckout({
        product_key: GIFT_TREE_PRODUCT_KEY,
        package_key: packageKey,
        amount_cents: 1,
        currency: "usd",
        landing_path: "/christmas/gifts",
        source_route: "/christmas/gifts",
        guest_token: guestToken,
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
      void trackChristmasEvent("christmas_express_checkout_available", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        packageKey,
        amountCents: result.amountCents,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout.";
      setPurchaseError(
        /not enabled|checkout_disabled|disabled/i.test(msg)
          ? "Checkout is warming up — try again shortly."
          : msg,
      );
      void trackChristmasEvent("christmas_extra_gift_payment_failed", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        packageKey,
        metadata: { reason: msg.slice(0, 120) },
      });
    } finally {
      setPurchasing(false);
    }
  }, []);

  const onSendGift = useCallback(async () => {
    if (!reward) return;
    if (revealStep === "reveal") {
      setRevealStep("email");
      void trackChristmasEvent("christmas_email_claim_view", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { reward_id: reward.id },
      });
      return;
    }
    if (revealStep !== "email") return;
    const email = claimEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setClaimHint("Enter a valid email so we can save your gift.");
      return;
    }
    setClaiming(true);
    setClaimHint(null);
    void trackChristmasEvent("christmas_email_claim_submit", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
      metadata: { reward_id: reward.id, authenticated: authed },
    });
    try {
      const claimed = await claimGiftEmailOnServer({
        claimId: state.claimId || "",
        email,
      });
      const next: GiftTreePersistedState = {
        ...state,
        claimed: true,
        creditsGranted: claimed.credits_granted > 0 || state.creditsGranted,
        extraOpens:
          typeof claimed.remaining_opens === "number"
            ? claimed.remaining_opens
            : state.extraOpens,
      };
      persist(next);
      if (typeof claimed.remaining_opens === "number") {
        setRemainingOpens(claimed.remaining_opens);
      }
      setRevealStep("saved");
      void trackChristmasEvent("christmas_email_claim_success", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: "/christmas/gifts",
        metadata: { reward_id: reward.id, email_sent: claimed.email_sent },
      });
      window.setTimeout(() => {
        setRevealStep("upsell");
        void trackChristmasEvent("christmas_extra_gift_offer_view", {
          productKey: GIFT_TREE_PRODUCT_KEY,
          pathname: "/christmas/gifts",
          metadata: { source: "post_claim" },
        });
      }, 1200);
    } catch (e) {
      setClaimHint(e instanceof Error ? e.message : "Could not save your gift email.");
    } finally {
      setClaiming(false);
    }
  }, [authed, claimEmail, persist, revealStep, reward, state]);

  const onSkipUpsell = useCallback(() => {
    void trackChristmasEvent("christmas_offer_skip", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: "/christmas/gifts",
    });
    setModalOpen(false);
    setCheckout(null);
    setRevealStep("reveal");
    setClaimHint("Your free gift is already yours — tap another present anytime.");
  }, []);

  function presentState(id: string): "available" | "opening" | "opened" | "locked" {
    if (openingId === id) return "opening";
    if (state.presentId === id) return "opened";
    if (!canOpen) return "locked";
    return "available";
  }

  const waitingOpens = remainingOpens || state.extraOpens;

  return (
    <>
      <PageHead
        exactTitle
        title="Get Your Christmas Gift | The Digital Gifter"
        description="Open a present under the Christmas tree and reveal a premium Digital Gifter Christmas surprise."
        url="https://www.thedigitalgifter.com/christmas/gifts"
      />

      <div className="relative h-[calc(100dvh-4.05rem)] max-h-[calc(100dvh-4.05rem)] overflow-hidden text-rose-50">
        <ChristmasTreeScene
          reduceMotion={reduceMotion}
          className="absolute inset-x-0 top-0 bottom-[7.6rem] sm:bottom-[7.15rem]"
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

        {error ? (
          <p
            className="absolute inset-x-0 bottom-[6.85rem] z-[6] text-center text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] flex h-[7.6rem] items-end px-4 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1 sm:h-[7.15rem]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(8,6,5,0.55) 42%, rgba(8,6,5,0.82) 100%)",
            }}
          />
          <div className="pointer-events-auto relative mx-auto flex w-[calc(100%-32px)] max-w-[360px] flex-col items-center sm:w-full">
            {showTapHint && !freeUsed ? (
              <div
                className="pointer-events-none mb-2 rounded-full border border-amber-100/20 px-4 py-2 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                style={{
                  background: "linear-gradient(180deg, rgba(48,32,28,0.55), rgba(22,24,30,0.6))",
                  backdropFilter: "blur(10px)",
                  animation: reduceMotion ? undefined : "gt-hint-float 3.2s ease-in-out infinite",
                }}
              >
                <p className="text-[12px] font-semibold tracking-wide text-amber-50 sm:text-[13px]">
                  {isMobileScene ? "🎁 Tap a gift" : "🎁 Your free Christmas gift is waiting"}
                </p>
                {!isMobileScene ? (
                  <p className="text-[10px] text-amber-100/70 sm:text-[11px]">Tap a present to open it</p>
                ) : null}
              </div>
            ) : null}

            {freeUsed && !canOpen ? (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="relative flex min-h-[40px] w-full flex-col items-center justify-center overflow-hidden rounded-full border border-amber-100/25 bg-white/10 px-5 py-1.5 text-amber-50 backdrop-blur-md transition hover:bg-white/15 active:scale-[0.98]"
              >
                <span className="text-[13px] font-semibold tracking-wide">Want to open another?</span>
                <span className="text-[10px] text-amber-100/70">Optional · your free gift is already yours</span>
              </button>
            ) : waitingOpens > 0 ? (
              <p
                className="rounded-full border border-amber-100/20 bg-black/25 px-4 py-1.5 text-[11px] text-amber-100/85 backdrop-blur-md"
                role="status"
              >
                🎁 {waitingOpens} gift{waitingOpens === 1 ? "" : "s"} waiting — tap a present
              </p>
            ) : null}

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
              <span aria-hidden className="text-white/35">
                ·
              </span>
              <Link className="hover:text-white/80" to="/account/gifts">
                My Gifts
              </Link>
              <span aria-hidden>|</span>
              <Link className="hover:text-white/80" to="/christmas">
                Christmas Hub
              </Link>
            </div>
          </div>
        </div>
      </div>

      <GiftOpenCeremony open={Boolean(openingId)} reduceMotion={reduceMotion} clipSrc={GIFT_OPEN_CLIP} />

      {reward ? (
        <RewardRevealModal
          reward={reward}
          open={modalOpen}
          step={revealStep}
          email={claimEmail}
          claiming={claiming}
          purchasing={purchasing}
          claimHint={claimHint}
          purchaseError={purchaseError}
          remainingOpens={waitingOpens}
          checkout={checkout}
          onEmailChange={setClaimEmail}
          onSendGift={() => void onSendGift()}
          onSkipUpsell={onSkipUpsell}
          onSelectPack={(key) => void onPurchase(key)}
          onCloseCheckout={() => {
            setCheckout(null);
            setRevealStep("upsell");
          }}
          onClose={() => setModalOpen(false)}
          onCreateNow={() => navigate(reward.claimPath)}
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

      {checkout && revealStep !== "checkout" ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-amber-200/20 bg-[#14110e] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-serif text-xl text-amber-50">Complete payment</p>
              <button type="button" className="text-xs text-amber-100/60" onClick={() => setCheckout(null)}>
                Cancel
              </button>
            </div>
            <CustomStripeCheckout
              clientSecret={checkout.clientSecret}
              publishableKey={checkout.publishableKey}
              dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
            />
            <p className="mt-2 text-center text-[11px] text-amber-100/60">
              {GIFT_TREE_PAID_OFFERS.find((o) => o.packageKey === checkout.packageKey)?.label || "Extra gifts"}
            </p>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes gt-burst {
          from { opacity: 0.9; }
          to { opacity: 0; }
        }
        @keyframes gt-hint-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </>
  );
}

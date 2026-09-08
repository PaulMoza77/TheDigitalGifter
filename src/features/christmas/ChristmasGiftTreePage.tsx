import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import { CHRISTMAS_CATALOG_SEED, findProduct } from "./catalog";
import { ChristmasTreeVisual } from "./tree/ChristmasTreeVisual";
import { defaultDecorations } from "./tree/treeApi";
import {
  giftTreeFunnel,
  getOrCreateGiftTreeGuestToken,
  startGiftTreeCheckout,
  type GiftTreePack,
  type GiftTreeReward,
  type GiftTreeStatus,
} from "./giftTree/giftTreeApi";
import {
  denyOpenCopy,
  GIFT_TREE_BOX_COUNT,
  GIFT_TREE_BOX_POSITIONS,
  GIFT_TREE_PRODUCT_KEY,
  GIFT_TREE_ROUTE,
  giftTreeBoxSlots,
  sanitizeGiftTreeAnalytics,
} from "./giftTree/giftTreeLogic";

const PRODUCT = findProduct(CHRISTMAS_CATALOG_SEED, GIFT_TREE_PRODUCT_KEY);
const BOX_COLORS = [
  "linear-gradient(145deg,#e74c3c,#922b21)",
  "linear-gradient(145deg,#d4af37,#8a6d1a)",
  "linear-gradient(145deg,#2ecc71,#1a6b3a)",
  "linear-gradient(145deg,#5dade2,#1a5276)",
  "linear-gradient(145deg,#f8f9f9,#aeb6bf)",
  "linear-gradient(145deg,#c0392b,#6e1b14)",
  "linear-gradient(145deg,#f1c40f,#9a7b0a)",
  "linear-gradient(145deg,#27ae60,#145a32)",
  "linear-gradient(145deg,#8e44ad,#4a235a)",
];

export default function ChristmasGiftTreePage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<GiftTreeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<GiftTreeReward | null>(null);
  const [openedSlots, setOpenedSlots] = useState<number[]>([]);
  const [email, setEmail] = useState("");
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    orderId: string;
    packageKey: string;
  } | null>(null);
  const pageViewed = useRef(false);
  const packSeen = useRef(false);
  const checkoutLock = useRef(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await giftTreeFunnel<GiftTreeStatus>({
        action: "status",
        guest_token: getOrCreateGiftTreeGuestToken(),
      });
      setStatus(data);
      const slots = (data.opens || [])
        .map((open) => open.box_slot)
        .filter((slot): slot is number => slot != null);
      setOpenedSlots(slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Gift Tree");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("gift_tree_view", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: GIFT_TREE_ROUTE,
      metadata: sanitizeGiftTreeAnalytics({ surface: "chance_funnel" }),
    });
    void refresh();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user && data.session.user.email) {
        setEmail(data.session.user.email);
      }
    });
  }, [refresh]);

  useEffect(() => {
    if (params.get("checkout") === "success") {
      void refresh();
    }
  }, [params, refresh]);

  useEffect(() => {
    if (!status || packSeen.current) return;
    packSeen.current = true;
    void trackChristmasEvent("gift_tree_pack_seen", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: GIFT_TREE_ROUTE,
    });
  }, [status]);

  async function openSlot(slot: number) {
    if (busy || openedSlots.includes(slot)) return;
    setBusy(true);
    setError(null);
    void trackChristmasEvent("gift_tree_open_started", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      pathname: GIFT_TREE_ROUTE,
      metadata: sanitizeGiftTreeAnalytics({ box_slot: slot }),
    });
    try {
      const data = await giftTreeFunnel<{
        ok: boolean;
        already?: boolean;
        open_kind: string;
        reward: GiftTreeReward;
        error?: string;
      }>({
        action: "openGift",
        guest_token: getOrCreateGiftTreeGuestToken(),
        box_slot: slot,
      });
      if (!data.reward?.reward_key) {
        throw new Error("Server did not return a catalog reward");
      }
      setReveal(data.reward);
      setOpenedSlots((prev) => (prev.includes(slot) ? prev : [...prev, slot]));
      void trackChristmasEvent("gift_tree_opened", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: GIFT_TREE_ROUTE,
        metadata: sanitizeGiftTreeAnalytics({
          open_kind: data.open_kind,
          reward_type: data.reward.reward_type,
        }),
      });
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : "open_failed";
      setError(denyOpenCopy(code));
      void trackChristmasEvent("gift_tree_open_denied", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        pathname: GIFT_TREE_ROUTE,
        metadata: sanitizeGiftTreeAnalytics({ reason: code }),
      });
      if (code === "need_pack" || code === "opens_disabled" || code === "no_opens") {
        document.getElementById("gift-tree-packs")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function buyPack(pack: GiftTreePack) {
    if (!pack.purchasable) {
      setError("This pack is not purchasable yet. Live prices are a founder launch gate.");
      return;
    }
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setBusy(true);
    setError(null);
    void trackChristmasEvent("gift_tree_checkout_started", {
      productKey: GIFT_TREE_PRODUCT_KEY,
      packageKey: pack.package_key,
      pathname: GIFT_TREE_ROUTE,
      amountCents: pack.price_cents,
    });
    try {
      const session = await startGiftTreeCheckout({
        product_key: GIFT_TREE_PRODUCT_KEY,
        package_key: pack.package_key,
        email,
        gift_tree_guest_token: getOrCreateGiftTreeGuestToken(),
        amount_cents: 1,
        landing_path: GIFT_TREE_ROUTE,
        success_url: `${window.location.origin}${GIFT_TREE_ROUTE}?checkout=success`,
      });
      setCheckout({
        clientSecret: session.clientSecret,
        publishableKey: session.publishableKey,
        amountCents: session.amountCents,
        orderId: session.orderId,
        packageKey: pack.package_key,
      });
      void trackChristmasEvent("payment_sheet_opened", {
        productKey: GIFT_TREE_PRODUCT_KEY,
        packageKey: pack.package_key,
        orderId: session.orderId,
        amountCents: session.amountCents,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Checkout failed";
      setError(
        msg.includes("checkout_disabled") || msg.includes("not_purchasable")
          ? "Paid Gift Tree packs are not live yet. Checkout stays off until a production price is configured."
          : msg,
      );
    } finally {
      checkoutLock.current = false;
      setBusy(false);
    }
  }

  const remaining = status?.remaining_opens ?? 0;
  const packs = status?.packs?.length
    ? status.packs
    : PRODUCT?.packages.map((pkg) => ({
        package_key: pkg.packageKey,
        package_name: pkg.packageName,
        description: pkg.description,
        price_cents: pkg.priceCents,
        currency: pkg.currency,
        active: pkg.active,
        purchasable: pkg.purchasable,
        opens: Number(pkg.metadata?.opens) || 0,
      })) || [];

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden"
      style={{
        background: "linear-gradient(165deg,#1b1020 0%,#0e1a24 50%,#132018 100%)",
        color: "#f6f0e6",
      }}
    >
      <PageHead
        title="Christmas Gift Tree"
        description="Open gifts on your chance tree. Catalog rewards from The Digital Gifter — separate from the shareable Christmas tree."
      />

      <div className="mx-auto max-w-lg px-4 pb-24 pt-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-rose-200/70">
          The Digital Gifter
        </p>
        <h1 className="mt-2 text-center font-serif text-3xl text-rose-50">Christmas Gift Tree</h1>
        <p className="mt-2 text-center text-sm text-rose-100/75">
          Tap a gift on the tree. Outcomes come from the catalog — this page never invents a prize.
        </p>
        <p className="mt-3 text-center text-xs text-amber-100/65">
          This is your chance tree, not the shareable tree you decorate for friends.{" "}
          <Link className="underline" to="/christmas/tree">
            Open /christmas/tree
          </Link>
        </p>

        <div className="relative mx-auto mt-6 max-w-[320px]">
          <ChristmasTreeVisual style="magical" decorations={defaultDecorations()} />
          <ul className="pointer-events-none absolute inset-0" aria-label="Gifts on the chance tree">
            {giftTreeBoxSlots(GIFT_TREE_BOX_COUNT).map((slot) => {
              const opened = openedSlots.includes(slot);
              const pos = GIFT_TREE_BOX_POSITIONS[slot] || { left: "50%", top: "50%" };
              return (
                <li
                  key={slot}
                  className="pointer-events-auto absolute"
                  style={{ left: pos.left, top: pos.top, transform: "translate(-50%, -50%)" }}
                >
                  <button
                    type="button"
                    disabled={busy || opened}
                    aria-label={
                      opened
                        ? `Opened gift ${slot + 1}`
                        : remaining > 0
                          ? `Open gift ${slot + 1}`
                          : `Gift ${slot + 1} locked — get more chances`
                    }
                    onClick={() => void openSlot(slot)}
                    className="h-11 w-11 rounded-md border border-amber-200/40 shadow-md transition hover:scale-110 disabled:opacity-45 sm:h-12 sm:w-12"
                    style={{ background: BOX_COLORS[slot % BOX_COLORS.length] }}
                  />
                </li>
              );
            })}
          </ul>
        </div>

        <p className="mt-4 text-center text-sm text-amber-100/80">
          {status
            ? `${status.remaining_free_opens} free · ${status.remaining_paid_opens} paid opens left`
            : busy
              ? "Loading your tree…"
              : "Preparing your private session…"}
        </p>
        {status && !status.production_opens_live && status.remaining_paid_opens === 0 ? (
          <p className="mt-2 text-center text-xs text-amber-200/70">
            Free opens stay gated until CHRISTMAS_GIFT_TREE_ENABLED is on. Paid opens still grant after
            a live Stripe webhook.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-100" role="alert">
            {error}
          </p>
        ) : null}

        {reveal ? (
          <section
            className="mt-6 rounded-xl border border-amber-200/20 bg-white/5 p-4"
            aria-live="polite"
          >
            <p className="text-xs uppercase tracking-wide text-amber-200/70">Catalog reward</p>
            <h3 className="mt-1 font-serif text-xl text-rose-50">{reveal.title}</h3>
            <p className="mt-2 text-sm text-rose-100/80">
              {reveal.message || reveal.description}
            </p>
            <p className="mt-2 text-xs text-amber-100/60">
              {reveal.reward_type}
              {reveal.entitlement_key ? ` · ${reveal.entitlement_key}` : ""}
              {reveal.credits_granted ? ` · ${reveal.credits_granted} ledger credits` : ""}
            </p>
          </section>
        ) : null}

        {status?.opens?.length ? (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-rose-100/90">Opened this season</h2>
            <ul className="mt-2 space-y-2 text-sm text-rose-100/75">
              {status.opens.map((open) => (
                <li key={open.id}>
                  {open.title} · {open.open_kind}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="gift-tree-packs" className="mt-10 space-y-4" aria-label="Gift open packs">
          <h2 className="text-sm font-medium text-rose-100/90">More opens</h2>
          <label className="block text-xs text-amber-100/70">
            Email for receipt (optional — required for pack confirmation email)
            <input
              className="mt-1 w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm text-rose-50"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <ul className="space-y-3">
            {packs.map((pack) => (
              <li
                key={pack.package_key}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-rose-50">{pack.package_name}</p>
                    <p className="mt-1 text-xs text-rose-100/70">{pack.description}</p>
                  </div>
                  <span className="text-xs text-amber-100/70">
                    {pack.purchasable && pack.price_cents > 0
                      ? `${(pack.price_cents / 100).toFixed(2)} ${pack.currency.toUpperCase()}`
                      : "Not live"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy || !pack.purchasable}
                  onClick={() => void buyPack(pack)}
                  className="mt-3 w-full rounded-md bg-amber-200 px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
                >
                  {pack.purchasable
                    ? `Get ${pack.opens} more chance${pack.opens === 1 ? "" : "s"}`
                    : "Pack not purchasable"}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-100/60">
            Apple Pay, Google Pay, and card appear in Stripe Checkout Elements after a live pack is
            enabled. Physical Safari Apple Pay QA is a founder gate — this page does not fake wallet
            success.
          </p>
        </section>

        {checkout ? (
          <section className="mt-6 space-y-3 rounded-xl border border-amber-200/20 bg-white p-4 text-slate-900">
            <h2 className="text-lg font-medium">Secure payment</h2>
            <CustomStripeCheckout
              clientSecret={checkout.clientSecret}
              publishableKey={checkout.publishableKey}
              dueDisplay={`$${(checkout.amountCents / 100).toFixed(2)}`}
              email={email}
            />
          </section>
        ) : null}

        <p className="mt-10 text-center text-xs text-rose-100/50">
          <Link className="underline" to="/christmas">
            Back to Christmas
          </Link>
          {" · "}
          <Link className="underline" to="/christmas/advent">
            Advent
          </Link>
        </p>
      </div>
    </div>
  );
}

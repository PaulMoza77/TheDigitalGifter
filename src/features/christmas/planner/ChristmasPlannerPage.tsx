import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";
import { useAuth } from "@/contexts/AuthContext";
import { CHRISTMAS_CATALOG_SEED, findProduct } from "../catalog";
import { FONT_HREF } from "../landing/assets";
import { PLANNER_PRODUCT_KEY, plannerPublicCatalog } from "./commerce";
import {
  fetchPlannerAccess,
  fetchPlannerCatalog,
  startPlannerCheckout,
  type PlannerCatalog,
} from "./api";
import {
  BUDGET_DEMO,
  BUDGET_DEMO_REMAINING,
  GIFT_DEMO_PEOPLE,
  GIFT_DEMO_STATUSES,
  PLANNER_FAQS,
  PLANNER_HOW_STEPS,
  PLANNER_INCLUDED_GROUPS,
  type GiftDemoStatus,
} from "./copy";
import {
  FOUNDING_PASS_CURRENCY,
  FOUNDING_PASS_PACKAGE_KEY,
  FOUNDING_PASS_PRICE_CENTS,
  FOUNDING_PASS_PRICE_LABEL,
  PLANNER_ACCOUNT_ROUTE,
  PLANNER_WELCOME_ROUTE,
} from "./types";
import {
  getOrCreatePlannerGuestToken,
  persistPlannerOrderRecovery,
  readPlannerOrderRecovery,
} from "./guest";
import { plannerJsonLd, plannerSeo, upsertJsonLd } from "./seo";
import { trackPlannerMetaInitiateCheckout } from "./meta";
import { getChristmasFunnelSessionId, trackPlannerFunnel } from "./funnelTrack";
import { PlannerHeroScene } from "./PlannerHeroScene";
import "./planner.css";

const CustomStripeCheckout = lazy(() =>
  import("@/features/pet/components/CustomStripeCheckout").then((mod) => ({
    default: mod.CustomStripeCheckout,
  })),
);

const PURCHASE_INTENT_KEY = "tdg.christmas.planner.purchaseIntent.v1";

type DemoTab = "gifts" | "budget" | "meals";

const DEMO_TABS: Array<[DemoTab, string]> = [
  ["gifts", "Gifts"],
  ["budget", "Budget"],
  ["meals", "Meals & shopping"],
];

const STRIPE_LIGHT = {
  colorPrimary: "#6b1420",
  colorBackground: "#fffaf1",
  colorText: "#14080b",
  colorTextSecondary: "#3a241c",
  colorDanger: "#8b1a1a",
  borderRadius: "12px",
  fontFamily: 'system-ui, "Segoe UI", sans-serif',
  fontSizeBase: "16px",
} as const;

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format((Number(cents) || 0) / 100);
  } catch {
    return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
  }
}

function moneyUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function seedCatalog(): PlannerCatalog {
  const product = findProduct(CHRISTMAS_CATALOG_SEED, PLANNER_PRODUCT_KEY)!;
  const pub = plannerPublicCatalog(product);
  return {
    productKey: pub.productKey,
    name: pub.name,
    description: pub.description,
    checkoutLive: false,
    seasonYear: pub.seasonYear,
    packages: pub.packages.map((pkg) => ({
      packageKey: pkg.packageKey,
      packageName: pkg.packageName,
      description: pkg.description,
      currency: pkg.currency,
      priceCents: pkg.priceCents,
      compareAtCents: pkg.compareAtCents,
      purchasable: pkg.purchasable,
      features: pkg.features,
      badge: pkg.badge,
      highlight: pkg.highlight,
      entitlements: pkg.entitlements,
    })),
    addons: pub.addons,
  };
}

function ensureFonts() {
  if (document.querySelector(`link[data-planner-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-planner-fonts", "1");
  document.head.appendChild(link);
}

function rememberPurchaseIntent() {
  try {
    window.sessionStorage.setItem(
      PURCHASE_INTENT_KEY,
      JSON.stringify({ packageKey: FOUNDING_PASS_PACKAGE_KEY, at: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

function takePurchaseIntent(): boolean {
  try {
    const raw = window.sessionStorage.getItem(PURCHASE_INTENT_KEY);
    window.sessionStorage.removeItem(PURCHASE_INTENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { packageKey?: string; at?: number };
    if (parsed.packageKey !== FOUNDING_PASS_PACKAGE_KEY) return false;
    if (typeof parsed.at === "number" && Date.now() - parsed.at > 1000 * 60 * 60) return false;
    return true;
  } catch {
    return false;
  }
}

function nextStatus(current: GiftDemoStatus): GiftDemoStatus {
  const i = GIFT_DEMO_STATUSES.indexOf(current);
  return GIFT_DEMO_STATUSES[(i + 1) % GIFT_DEMO_STATUSES.length];
}

function statusLabel(status: GiftDemoStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function PlannerDemoPanel({
  tab,
  onTab,
  gifts,
  onCycleGift,
  compact,
}: {
  tab: DemoTab;
  onTab: (id: DemoTab) => void;
  gifts: Array<{ name: string; gift: string; status: GiftDemoStatus }>;
  onCycleGift: (name: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`tdg-pl__panel${compact ? " tdg-pl__panel--compact" : ""}`} aria-label="Planner example">
      <div className="tdg-pl__panel-head">
        <span>Christmas Planner</span>
        <span className="tdg-pl__example">Example plan</span>
      </div>
      <div className="tdg-pl__tabs" role="tablist" aria-label="Planner demonstration">
        {DEMO_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tdg-pl__tab${tab === id ? " is-on" : ""}`}
            onClick={() => onTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "gifts" ? (
        <div className="tdg-pl__body">
          <p className="tdg-pl__hint">Tap a status to advance it.</p>
          <ul className="tdg-pl__list">
            {gifts.map((person) => (
              <li key={person.name}>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.gift}</span>
                </div>
                <button
                  type="button"
                  className="tdg-pl__status"
                  aria-label={`Change status for ${person.name}, currently ${statusLabel(person.status)}`}
                  onClick={() => onCycleGift(person.name)}
                >
                  {statusLabel(person.status)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "budget" ? (
        <div className="tdg-pl__body">
          <div className="tdg-pl__budget-total">
            <span>Season budget</span>
            <strong>{moneyUsd(BUDGET_DEMO.season)}</strong>
          </div>
          <ul className="tdg-pl__list tdg-pl__list--budget">
            <li>
              <div>
                <strong>Gifts</strong>
                <span>Spent so far</span>
              </div>
              <span>{moneyUsd(BUDGET_DEMO.gifts)}</span>
            </li>
            <li>
              <div>
                <strong>Food &amp; decor</strong>
                <span>Spent so far</span>
              </div>
              <span>{moneyUsd(BUDGET_DEMO.foodDecor)}</span>
            </li>
            <li className="is-remain">
              <div>
                <strong>Remaining</strong>
                <span>{moneyUsd(BUDGET_DEMO.season)} − {moneyUsd(BUDGET_DEMO.gifts)} − {moneyUsd(BUDGET_DEMO.foodDecor)}</span>
              </div>
              <span>{moneyUsd(BUDGET_DEMO_REMAINING)}</span>
            </li>
          </ul>
        </div>
      ) : null}

      {tab === "meals" ? (
        <div className="tdg-pl__body">
          <ol className="tdg-pl__flow">
            <li>
              <strong>Recipe</strong>
              <span>Herb-butter roast turkey</span>
            </li>
            <li>
              <strong>Portions</strong>
              <span>8 people</span>
            </li>
            <li>
              <strong>Shopping list</strong>
              <span>Turkey · butter · thyme · onions · citrus</span>
            </li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export default function ChristmasPlannerPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [catalog, setCatalog] = useState<PlannerCatalog>(seedCatalog);
  const [paidAccess, setPaidAccess] = useState(false);
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    orderId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<DemoTab>("gifts");
  const [gifts, setGifts] = useState(() => GIFT_DEMO_PEOPLE.map((p) => ({ ...p })));
  const [heroInView, setHeroInView] = useState(true);
  const [nearFooter, setNearFooter] = useState(false);
  const [offerSeen, setOfferSeen] = useState(false);
  const [demoSeen, setDemoSeen] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const demoRef = useRef<HTMLElement | null>(null);
  const offerRef = useRef<HTMLElement | null>(null);
  const faqRef = useRef<HTMLElement | null>(null);
  const paymentRef = useRef<HTMLDivElement | null>(null);
  const starting = useRef(false);
  const resumedIntent = useRef(false);

  const founding =
    catalog.packages.find((pkg) => pkg.packageKey === FOUNDING_PASS_PACKAGE_KEY) || null;
  const priceCents = founding?.priceCents ?? FOUNDING_PASS_PRICE_CENTS;
  const currency = founding?.currency ?? FOUNDING_PASS_CURRENCY;
  const priceLabel =
    founding && founding.priceCents === FOUNDING_PASS_PRICE_CENTS && currency === FOUNDING_PASS_CURRENCY
      ? FOUNDING_PASS_PRICE_LABEL
      : money(priceCents, currency);
  const buyLabel = `Get my Christmas Planner — ${priceLabel}`;

  useEffect(() => {
    ensureFonts();
    upsertJsonLd("tdg-planner-jsonld", plannerJsonLd());
    void trackPlannerFunnel("planner_landing_view");
    void fetchPlannerCatalog()
      .then((row) => setCatalog(row))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPaidAccess(false);
      return;
    }
    let cancelled = false;
    void fetchPlannerAccess()
      .then((access) => {
        if (!cancelled) setPaidAccess(Boolean(access?.paid));
      })
      .catch(() => {
        if (!cancelled) setPaidAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    const node = heroRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setHeroInView(entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.35)),
      { threshold: [0.2, 0.35, 0.6] },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const node = faqRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setNearFooter(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.08, rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const node = demoRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !demoSeen) {
          setDemoSeen(true);
          void trackPlannerFunnel("planner_demo_viewed");
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [demoSeen]);

  useEffect(() => {
    const node = offerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !offerSeen) {
          setOfferSeen(true);
          void trackPlannerFunnel("planner_checkout_viewed", {
            packageKey: FOUNDING_PASS_PACKAGE_KEY,
            amountCents: priceCents,
          });
          void trackPlannerFunnel("planner_package_viewed", {
            packageKey: FOUNDING_PASS_PACKAGE_KEY,
            amountCents: priceCents,
          });
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [offerSeen, priceCents]);

  const scrollToDemo = useCallback(() => {
    void trackPlannerFunnel("planner_cta_clicked", { metadata: { position: "hero_secondary", action: "see_planner" } });
    demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openPlanner = useCallback(() => {
    rememberAuthReturnTo(PLANNER_ACCOUNT_ROUTE);
    navigate(PLANNER_ACCOUNT_ROUTE);
  }, [navigate]);

  const onDemoTab = useCallback((id: DemoTab) => {
    setTab(id);
    void trackPlannerFunnel("planner_demo_tab_clicked", { metadata: { tab: id } });
  }, []);

  const onCycleGift = useCallback((name: string) => {
    setGifts((prev) =>
      prev.map((person) => (person.name === name ? { ...person, status: nextStatus(person.status) } : person)),
    );
    void trackPlannerFunnel("planner_demo_tab_clicked", { metadata: { tab: "gifts", action: "status_cycle" } });
  }, []);

  const startPay = useCallback(
    async (position: string) => {
      if (paidAccess) {
        openPlanner();
        return;
      }
      if (!catalog.checkoutLive) {
        setError("Christmas Planner checkout is opening soon.");
        void trackPlannerFunnel("planner_purchase_failed", {
          packageKey: FOUNDING_PASS_PACKAGE_KEY,
          metadata: { reason: "checkout_disabled", position },
        });
        offerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (starting.current) return;
      starting.current = true;
      setBusy(true);
      setError(null);
      rememberPurchaseIntent();
      rememberAuthReturnTo(PLANNER_WELCOME_ROUTE);
      void trackPlannerFunnel("planner_cta_clicked", {
        packageKey: FOUNDING_PASS_PACKAGE_KEY,
        amountCents: priceCents,
        metadata: { position },
      });
      void trackPlannerFunnel("planner_checkout_started", {
        packageKey: FOUNDING_PASS_PACKAGE_KEY,
        amountCents: priceCents,
        metadata: { position },
      });
      try {
        const guestToken = getOrCreatePlannerGuestToken();
        const recovered = readPlannerOrderRecovery();
        const result = await startPlannerCheckout({
          packageKey: FOUNDING_PASS_PACKAGE_KEY,
          addonKeys: [],
          guestToken,
          funnelSessionId: getChristmasFunnelSessionId(),
          existingOrderId: recovered?.orderId,
          returnPath: PLANNER_WELCOME_ROUTE,
        });
        if (result.publicToken) {
          persistPlannerOrderRecovery({
            orderId: result.orderId,
            publicToken: result.publicToken,
            packageKey: FOUNDING_PASS_PACKAGE_KEY,
            addonKeys: [],
            funnelSessionId: getChristmasFunnelSessionId(),
          });
        }
        setCheckout({
          clientSecret: result.clientSecret,
          publishableKey: result.publishableKey,
          amountCents: result.amountCents,
          currency: result.currency,
          orderId: result.orderId,
        });
        requestAnimationFrame(() => {
          paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not start checkout.";
        setError(
          /not enabled|checkout_disabled/i.test(msg)
            ? "Christmas Planner checkout is opening soon."
            : msg,
        );
        void trackPlannerFunnel("planner_purchase_failed", {
          packageKey: FOUNDING_PASS_PACKAGE_KEY,
          metadata: { reason: msg.slice(0, 80), position },
        });
        offerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } finally {
        starting.current = false;
        setBusy(false);
      }
    },
    [catalog.checkoutLive, openPlanner, paidAccess, priceCents],
  );

  useEffect(() => {
    if (resumedIntent.current || authLoading || paidAccess || !catalog.checkoutLive) return;
    if (!takePurchaseIntent()) return;
    resumedIntent.current = true;
    void startPay("auth_resume");
  }, [authLoading, catalog.checkoutLive, paidAccess, startPay]);

  const seo = useMemo(() => plannerSeo(), []);
  const checkoutOpen = Boolean(checkout) || busy;
  const stickyHidden = heroInView || checkoutOpen || nearFooter || paidAccess;

  const buyButton = (position: string, testId?: string) =>
    paidAccess ? (
      <button type="button" className="tdg-pl__btn" onClick={openPlanner} data-testid="open-my-christmas-planner">
        Open my planner
      </button>
    ) : (
      <button
        type="button"
        className="tdg-pl__btn"
        disabled={busy}
        data-testid={testId}
        onClick={() => void startPay(position)}
      >
        {busy ? "Starting checkout…" : buyLabel}
      </button>
    );

  return (
    <div className="tdg-planner tdg-pl">
      <PageHead title={seo.title} description={seo.description} url={seo.url} image={seo.image} exactTitle />

      <header className="tdg-pl__hero" ref={heroRef}>
        <div className="tdg-pl__hero-atmosphere" aria-hidden="true">
          <PlannerHeroScene alt="" />
        </div>
        <div className="tdg-pl__shell tdg-pl__hero-grid">
          <div className="tdg-pl__hero-copy">
            <p className="tdg-pl__eyebrow">CHRISTMAS PLANNER 2026</p>
            <h1>Christmas is coming. Get it all out of your head.</h1>
            <p className="tdg-pl__lede">
              Keep gifts, spending, meals and holiday to-dos in one online planner — so you can enjoy the Christmas
              you’re organising.
            </p>
            <ul className="tdg-pl__benefits">
              <li>Every gift, remembered.</li>
              <li>Your budget, in view.</li>
              <li>Your menu and shopping list, together.</li>
            </ul>
            <div className="tdg-pl__cta-row">
              {buyButton("hero", "planner-buy-cta-hero")}
              <button type="button" className="tdg-pl__link" onClick={scrollToDemo}>
                See the planner
              </button>
            </div>
            {!paidAccess ? <p className="tdg-pl__micro">One-time payment. No subscription.</p> : null}
          </div>
          <div className="tdg-pl__hero-product">
            <PlannerDemoPanel tab={tab} onTab={onDemoTab} gifts={gifts} onCycleGift={onCycleGift} compact />
          </div>
        </div>
      </header>

      <section className="tdg-pl__section tdg-pl__section--soft" id="demo" ref={demoRef}>
        <div className="tdg-pl__shell">
          <h2>Less to remember. More already organised.</h2>
          <div className="tdg-pl__demo-full" data-testid="planner-demo">
            <PlannerDemoPanel tab={tab} onTab={onDemoTab} gifts={gifts} onCycleGift={onCycleGift} />
          </div>
        </div>
      </section>

      <section className="tdg-pl__section tdg-pl__section--soft" id="included">
        <div className="tdg-pl__shell">
          <h2>What you keep together</h2>
          <ul className="tdg-pl__groups">
            {PLANNER_INCLUDED_GROUPS.map((group) => (
              <li key={group.title}>
                <strong>{group.title}</strong>
                <p>{group.detail}</p>
              </li>
            ))}
          </ul>
          <p className="tdg-pl__free">
            Free exploration stays limited. Full access unlocks gifts, budget, meals, groceries, tasks, and hosting for
            Christmas 2026.
          </p>
          <div className="tdg-pl__how" id="how">
            <p className="tdg-pl__how-title">How it works</p>
            <ol>
              {PLANNER_HOW_STEPS.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <span>{step.body}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section
        className="tdg-pl__section tdg-pl__section--offer"
        id="offer"
        ref={(node) => {
          offerRef.current = node;
        }}
      >
        <div className="tdg-pl__shell">
          <div className="tdg-pl__offer" id="packages">
            <p className="tdg-pl__eyebrow tdg-pl__eyebrow--on-dark">Christmas Planner 2026</p>
            <p className="tdg-pl__price" aria-label={`Price ${priceLabel} USD`}>
              {priceLabel} <span>USD</span>
            </p>
            <p className="tdg-pl__micro tdg-pl__micro--on-dark">One-time payment. No subscription.</p>
            <ul className="tdg-pl__offer-ticks">
              <li>Gifts, budget, meals, groceries, tasks &amp; hosting</li>
              <li>Access for the Christmas 2026 season</li>
              <li>Works on phone and computer</li>
              <li>Not a PDF — your plan stays online</li>
            </ul>

            <div className="tdg-pl__checkout" id="checkout" ref={paymentRef}>
              {error ? (
                <p role="alert" className="tdg-pl__error">
                  {error}{" "}
                  {error.includes("opening soon") ? null : (
                    <button type="button" className="tdg-pl__text-retry" onClick={() => void startPay("offer_retry")}>
                      Try again
                    </button>
                  )}
                </p>
              ) : null}

              {paidAccess ? (
                <button type="button" className="tdg-pl__btn" onClick={openPlanner}>
                  Open my planner
                </button>
              ) : !catalog.checkoutLive ? (
                <div className="tdg-pl__launch" data-testid="planner-checkout-disabled">
                  <strong>Checkout is opening soon.</strong>
                  <p>Apple Pay, Google Pay, and card appear here when live — only if your device supports them.</p>
                </div>
              ) : !checkout ? (
                buyButton("offer", "planner-buy-cta-offer")
              ) : (
                <Suspense fallback={<p className="tdg-pl__micro tdg-pl__micro--on-dark">Loading secure payment…</p>}>
                  <CustomStripeCheckout
                    clientSecret={checkout.clientSecret}
                    publishableKey={checkout.publishableKey}
                    dueDisplay={money(checkout.amountCents, checkout.currency || "usd")}
                    appearanceTheme="stripe"
                    appearanceVariables={{ ...STRIPE_LIGHT }}
                    walletCapabilityOnly
                    payButtonLabel={(due) => `Pay ${due}`}
                    onWalletAvailability={(info) => {
                      void trackPlannerFunnel("planner_wallet_presented", {
                        packageKey: FOUNDING_PASS_PACKAGE_KEY,
                        metadata: { applePay: info.applePay, googlePay: info.googlePay },
                      });
                    }}
                    onPaymentInteraction={() => {
                      void trackPlannerFunnel("planner_payment_submitted", {
                        packageKey: FOUNDING_PASS_PACKAGE_KEY,
                        orderId: checkout.orderId,
                        amountCents: checkout.amountCents,
                      });
                    }}
                    onReady={() => {
                      trackPlannerMetaInitiateCheckout(
                        checkout.orderId,
                        checkout.amountCents,
                        checkout.currency || "usd",
                      );
                    }}
                  />
                </Suspense>
              )}
            </div>
            <Link className="tdg-pl__refund-link" to="/refunds">
              Refund policy
            </Link>
          </div>
        </div>
      </section>

      <section className="tdg-pl__section" ref={faqRef}>
        <div className="tdg-pl__shell tdg-pl__faq">
          <h2>FAQ</h2>
          {PLANNER_FAQS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="tdg-pl__footer">
        <div className="tdg-pl__shell tdg-pl__footer-row">
          <Link to="/">The Digital Gifter</Link>
          <Link to="/support">Support</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refund Policy</Link>
        </div>
      </footer>

      {!stickyHidden ? (
        <div className="tdg-pl__sticky" data-testid="planner-sticky-cta">
          <div>
            <strong>Christmas Planner 2026</strong>
            <div className="tdg-pl__micro tdg-pl__micro--on-dark">{priceLabel} · One-time</div>
          </div>
          <button type="button" className="tdg-pl__btn" disabled={busy} onClick={() => void startPay("sticky")}>
            {busy ? "Starting…" : buyLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

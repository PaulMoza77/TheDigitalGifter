import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { PLANNER_FAQS, PLANNER_HOW_STEPS, PLANNER_INCLUDED_GROUPS } from "./copy";
import {
  FOUNDING_PASS_CURRENCY,
  FOUNDING_PASS_PACKAGE_KEY,
  FOUNDING_PASS_PRICE_CENTS,
  FOUNDING_PASS_PRICE_LABEL,
  FREE_LIMITS,
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
import { daysUntilChristmas as daysUntilChristmasTz } from "./date";
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="tdg-planner__device-row">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function DeviceShell({
  title,
  children,
  benefit,
}: {
  title: string;
  children: ReactNode;
  benefit: string;
}) {
  return (
    <div className="tdg-planner__device tdg-planner__device--large" aria-label={`${title} example`}>
      <div className="tdg-planner__device-frame">
        <div className="tdg-planner__device-screen">
          <div className="tdg-planner__device-brand">
            The Digital Gifter · Planner
            <span className="tdg-planner__example-tag">Example plan</span>
          </div>
          <h3>{title}</h3>
          {children}
          <p className="tdg-planner__honest">{benefit}</p>
        </div>
      </div>
    </div>
  );
}

function DemoPreview({ tab }: { tab: DemoTab }) {
  if (tab === "gifts") {
    return (
      <DeviceShell title="Gifts" benefit="Keep every person, idea and present in one place.">
        <p className="tdg-planner__device-meta">People · ideas · ordered · arrived · wrapped</p>
        <div className="tdg-planner__device-rows">
          <Row label="Maya" value="Wireless headphones · Ordered" />
          <Row label="Dad" value="Wool scarf · Idea" />
          <Row label="Sam" value="Board game · Arrived" />
          <Row label="Neighbour" value="Candle set · Wrapped" />
        </div>
      </DeviceShell>
    );
  }
  if (tab === "budget") {
    return (
      <DeviceShell title="Budget" benefit="See what you’ve spent and what’s left.">
        <p className="tdg-planner__device-meta">Planned · spent · remaining</p>
        <div className="tdg-planner__device-rows">
          <Row label="Season budget" value="$800" />
          <Row label="Gifts spent" value="$312" />
          <Row label="Food & decor" value="$96" />
          <Row label="Remaining" value="$392" />
        </div>
      </DeviceShell>
    );
  }
  return (
    <DeviceShell title="Meals & shopping" benefit="Turn your holiday menu into a practical shopping list.">
      <p className="tdg-planner__device-meta">Recipe → portions → grocery list</p>
      <div className="tdg-planner__device-rows">
        <Row label="Christmas Day" value="Herb-butter roast turkey" />
        <Row label="Portions" value="8 people" />
        <Row label="Grocery" value="Turkey, butter, thyme, onions…" />
        <Row label="List status" value="Ready for the shop" />
      </div>
    </DeviceShell>
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
  const days = daysUntilChristmasTz(new Date());
  const buyLabel = `Get my Christmas Planner — ${priceLabel}`;

  useEffect(() => {
    ensureFonts();
    upsertJsonLd("tdg-planner-jsonld", plannerJsonLd());
    void trackPlannerFunnel("planner_landing_view");
    void fetchPlannerCatalog()
      .then((row) => {
        setCatalog(row);
      })
      .catch(() => {
        /* seed fallback — checkout still resolves amount on the server */
      });
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
    void trackPlannerFunnel("planner_cta_clicked", { metadata: { position: "hero_secondary", action: "see_how" } });
    demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openPlanner = useCallback(() => {
    rememberAuthReturnTo(PLANNER_ACCOUNT_ROUTE);
    navigate(PLANNER_ACCOUNT_ROUTE);
  }, [navigate]);

  const startPay = useCallback(
    async (position: string) => {
      if (paidAccess) {
        openPlanner();
        return;
      }
      if (!catalog.checkoutLive) {
        setError("Christmas Planner launch access is opening soon.");
        void trackPlannerFunnel("planner_purchase_failed", {
          packageKey: FOUNDING_PASS_PACKAGE_KEY,
          metadata: { reason: "checkout_disabled", position },
        });
        return;
      }
      if (starting.current) return;
      starting.current = true;
      setBusy(true);
      setError(null);
      rememberPurchaseIntent();
      rememberAuthReturnTo(`${PLANNER_WELCOME_ROUTE}`);
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
            ? "Christmas Planner launch access is opening soon."
            : msg,
        );
        void trackPlannerFunnel("planner_purchase_failed", {
          packageKey: FOUNDING_PASS_PACKAGE_KEY,
          metadata: { reason: msg.slice(0, 80), position },
        });
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

  const onDemoTab = (id: DemoTab) => {
    setTab(id);
    void trackPlannerFunnel("planner_demo_tab_clicked", { metadata: { tab: id } });
  };

  const seo = useMemo(() => plannerSeo(), []);
  const checkoutOpen = Boolean(checkout) || busy;
  const stickyHidden = heroInView || checkoutOpen || nearFooter || paidAccess;

  return (
    <div className="tdg-planner tdg-planner--compact tdg-planner--sales">
      <PageHead title={seo.title} description={seo.description} url={seo.url} image={seo.image} exactTitle />

      <header className="tdg-planner__hero tdg-planner__hero--sales" ref={heroRef}>
        <div className="tdg-planner__media">
          <PlannerHeroScene alt="A warm Christmas living room — the atmosphere of a calmer holiday" />
        </div>
        <div className="tdg-planner__hero-copy tdg-planner__hero-copy--sales">
          <p className="tdg-planner__kicker">CHRISTMAS PLANNER 2026</p>
          {days > 0 ? (
            <p className="tdg-planner__countdown tdg-planner__countdown--soft" aria-hidden="true">
              <span className="tdg-planner__countdown-digits">{days} days to Christmas</span>
            </p>
          ) : null}
          <h1>
            A little less planning.
            <br />
            A lot more Christmas.
          </h1>
          <p className="tdg-planner__lede">
            Keep your gifts, budget, meals and holiday to-dos together in one easy-to-use online planner.
          </p>
          <ul className="tdg-planner__hero-benefits">
            <li>Know who you’re buying for.</li>
            <li>Keep your Christmas budget in view.</li>
            <li>Plan meals and build your shopping list.</li>
          </ul>
          <div className="tdg-planner__cta-row">
            {paidAccess ? (
              <button type="button" className="tdg-planner__btn" onClick={openPlanner} data-testid="open-my-christmas-planner">
                Open my planner
              </button>
            ) : (
              <button
                type="button"
                className="tdg-planner__btn"
                disabled={busy}
                data-testid="planner-buy-cta-hero"
                onClick={() => void startPay("hero")}
              >
                {busy ? "Starting checkout…" : buyLabel}
              </button>
            )}
            <button type="button" className="tdg-planner__btn tdg-planner__btn--ghost" onClick={scrollToDemo}>
              See how it works
            </button>
          </div>
          {!paidAccess ? (
            <span className="tdg-planner__micro tdg-planner__micro--on-dark">
              One-time payment. No subscription.
            </span>
          ) : null}
        </div>
      </header>

      <section className="tdg-planner__section tdg-planner__section--cream" id="demo" ref={demoRef}>
        <div className="tdg-planner__inner">
          <p className="tdg-planner__kicker tdg-planner__kicker--ink">Inside the Planner</p>
          <h2>See what a more organised Christmas looks like.</h2>
          <div className="tdg-planner__demo" data-testid="planner-demo">
            <div className="tdg-planner__tabs" role="tablist" aria-label="Planner demonstration">
              {DEMO_TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`tdg-planner__tab${tab === id ? " is-on" : ""}`}
                  onClick={() => onDemoTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="tdg-planner__device-wrap tdg-planner__device-wrap--single">
              <DemoPreview tab={tab} />
            </div>
          </div>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--scene" id="included">
        <div className="tdg-planner__inner">
          <p className="tdg-planner__kicker">Full access</p>
          <h2>Your Christmas essentials, together.</h2>
          <ul className="tdg-planner__include-grid">
            {PLANNER_INCLUDED_GROUPS.map((group) => (
              <li key={group.title}>
                <strong>{group.title}</strong>
                <span className="tdg-planner__include-benefit">{group.benefit}</span>
                <span>{group.detail}</span>
              </li>
            ))}
          </ul>
          <p className="tdg-planner__free-note">
            Free exploration stays limited ({FREE_LIMITS.maxRecipients} gift people, a small task set, limited budget
            categories, and a short recipe teaser). The Founding Pass unlocks the full Christmas 2026 Planner listed
            above. AI cards and videos stay on separate credits.
          </p>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--cream" id="how">
        <div className="tdg-planner__inner">
          <p className="tdg-planner__kicker tdg-planner__kicker--ink">Getting started</p>
          <h2>Ready for your Christmas, in three simple steps.</h2>
          <ol className="tdg-planner__steps">
            {PLANNER_HOW_STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="tdg-planner__step-num">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="tdg-planner__section tdg-planner__section--dark"
        id="offer"
        ref={(node) => {
          offerRef.current = node;
        }}
      >
        <div className="tdg-planner__inner">
          <p className="tdg-planner__kicker">The offer</p>
          <h2>Christmas Planner 2026</h2>
          <div className="tdg-planner__offer-card" id="packages">
            <div className="tdg-planner__offer-card-top">
              <div>
                <h3>Christmas Planner 2026</h3>
                <p className="tdg-planner__micro tdg-planner__micro--on-dark">Founding Pass · one clear product</p>
              </div>
              <div className="tdg-planner__price-hero" aria-label={`Price ${priceLabel} USD`}>
                {priceLabel} USD
              </div>
            </div>
            <p className="tdg-planner__lede tdg-planner__lede--on-dark">One-time payment</p>
            <ul className="tdg-planner__offer-ticks">
              <li>Gifts, budget, meals, groceries, tasks, and hosting in one Planner</li>
              <li>Access for your Christmas 2026 Planner season</li>
              <li>Works on phone and computer — no PDF, no install</li>
              <li>AI cards and videos stay separate (their own credits)</li>
            </ul>

            <div
              className="tdg-planner__checkout-panel tdg-planner__checkout-panel--ivory"
              id="checkout"
              ref={paymentRef}
            >
              <p className="tdg-planner__trust-strip">
                Built by The Digital Gifter.
                <span> Distinct from the card and video generators.</span>
              </p>

              {error ? (
                <p role="alert" className="tdg-planner__launch">
                  {error}{" "}
                  {error.includes("opening soon") ? null : (
                    <button type="button" className="tdg-planner__text-retry" onClick={() => void startPay("offer_retry")}>
                      Try again
                    </button>
                  )}
                </p>
              ) : null}

              {paidAccess ? (
                <button type="button" className="tdg-planner__btn" onClick={openPlanner}>
                  Open my planner
                </button>
              ) : !catalog.checkoutLive ? (
                <div className="tdg-planner__launch" data-testid="planner-checkout-disabled">
                  <strong>Christmas Planner launch access is opening soon.</strong>
                  <p>
                    Apple Pay, Google Pay and card will appear here when checkout opens — only if your device actually
                    supports them.
                  </p>
                </div>
              ) : !checkout ? (
                <button
                  type="button"
                  className="tdg-planner__btn"
                  disabled={busy}
                  data-testid="planner-buy-cta-offer"
                  onClick={() => void startPay("offer")}
                >
                  {busy ? "Starting checkout…" : buyLabel}
                </button>
              ) : (
                <div className="tdg-planner__checkout">
                  <Suspense fallback={<p className="tdg-planner__micro tdg-planner__micro--on-dark">Loading secure payment…</p>}>
                    <CustomStripeCheckout
                      clientSecret={checkout.clientSecret}
                      publishableKey={checkout.publishableKey}
                      dueDisplay={money(checkout.amountCents, checkout.currency || "usd")}
                      appearanceTheme="night"
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
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--scene tdg-planner__section--faq" ref={faqRef}>
        <div className="tdg-planner__inner tdg-planner__faq">
          <p className="tdg-planner__kicker">Questions</p>
          <h2>FAQ</h2>
          {PLANNER_FAQS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
          <article className="tdg-planner__indexable">
            <h3>Online Christmas planner for 2026</h3>
            <p>
              Christmas Planner by The Digital Gifter is a digital Christmas planner for gifts, budget, meals, hosting,
              and family plans. Not a PDF. Distinct from the AI card and video generators on The Digital Gifter.
            </p>
          </article>
        </div>
      </section>

      <footer className="tdg-planner__mini-footer">
        <div className="tdg-planner__inner tdg-planner__mini-footer-row">
          <Link to="/">The Digital Gifter</Link>
          <Link to="/support">Support</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refund Policy</Link>
        </div>
      </footer>

      {!stickyHidden ? (
        <div className="tdg-planner__sticky" data-testid="planner-sticky-cta">
          <div>
            <strong>Christmas Planner 2026</strong>
            <div className="tdg-planner__micro tdg-planner__micro--on-dark">
              {priceLabel} · One-time payment
            </div>
          </div>
          <button
            type="button"
            className="tdg-planner__btn"
            disabled={busy}
            onClick={() => void startPay("sticky")}
          >
            {busy ? "Starting…" : buyLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { getChristmasFunnelSessionId, trackChristmasEvent } from "../analytics";
import { CHRISTMAS_CATALOG_SEED, findProduct } from "../catalog";
import { FONT_HREF, LANDING_ASSETS } from "../landing/assets";
import {
  PLANNER_PRODUCT_KEY,
  addonsIncludedInPackage,
  isPlannerPackageKey,
  plannerPublicCatalog,
  type PlannerPackageKey,
} from "./commerce";
import { fetchPlannerCatalog, startPlannerCheckout, type PlannerCatalog } from "./api";
import { COMPARISON_ROWS, PLANNER_AREAS, PLANNER_FAQS } from "./copy";
import {
  getOrCreatePlannerGuestToken,
  persistPlannerOrderRecovery,
  readPlannerOrderRecovery,
} from "./guest";
import { plannerJsonLd, plannerSeo, upsertJsonLd } from "./seo";
import { trackPlannerMetaInitiateCheckout } from "./meta";
import "./planner.css";

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

export default function ChristmasPlannerPage() {
  const [catalog, setCatalog] = useState<PlannerCatalog>(seedCatalog);
  const [packageKey, setPackageKey] = useState<string>("all_in");
  const [addonKeys, setAddonKeys] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    orderId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [packagesSeen, setPackagesSeen] = useState(false);
  const packagesRef = useRef<HTMLElement | null>(null);
  const starting = useRef(false);

  const selected = catalog.packages.find((pkg) => pkg.packageKey === packageKey) || catalog.packages[0];
  const includedAddons = isPlannerPackageKey(packageKey) ? addonsIncludedInPackage(packageKey) : [];
  const chargedAddons = addonKeys.filter((key) => !includedAddons.includes(key as never));
  const addonTotal = chargedAddons.reduce((sum, key) => {
    const addon = catalog.addons.find((row) => row.packageKey === key);
    return sum + (addon?.priceCents || 0);
  }, 0);
  const displayTotal = (selected?.priceCents || 0) + addonTotal;

  useEffect(() => {
    ensureFonts();
    const seo = plannerSeo();
    upsertJsonLd("tdg-planner-jsonld", plannerJsonLd());
    void trackChristmasEvent("planner_landing_view", {
      productKey: PLANNER_PRODUCT_KEY,
      pathname: "/christmas/planner",
    });
    void fetchPlannerCatalog()
      .then((row) => {
        setCatalog(row);
        if (row.packages.some((pkg) => pkg.packageKey === "all_in")) setPackageKey("all_in");
        else if (row.packages[0]) setPackageKey(row.packages[0].packageKey);
      })
      .catch(() => {
        /* seed fallback keeps prices out of hardcoded checkout */
      });
    void seo;
  }, []);

  useEffect(() => {
    const node = packagesRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPackagesSeen(true);
          void trackChristmasEvent("planner_package_viewed", {
            productKey: PLANNER_PRODUCT_KEY,
            packageKey,
            pathname: "/christmas/planner",
          });
          obs.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [packageKey]);

  const toggleAddon = (key: string) => {
    setAddonKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key];
      void trackChristmasEvent("planner_addon_selected", {
        productKey: PLANNER_PRODUCT_KEY,
        packageKey,
        pathname: "/christmas/planner",
        metadata: { addons: next },
      });
      return next;
    });
  };

  const startPay = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError(null);
    void trackChristmasEvent("planner_cta_clicked", {
      productKey: PLANNER_PRODUCT_KEY,
      packageKey,
      pathname: "/christmas/planner",
    });
    void trackChristmasEvent("planner_checkout_started", {
      productKey: PLANNER_PRODUCT_KEY,
      packageKey,
      amountCents: displayTotal,
      pathname: "/christmas/planner",
    });
    try {
      const guestToken = getOrCreatePlannerGuestToken();
      const recovered = readPlannerOrderRecovery();
      const result = await startPlannerCheckout({
        packageKey,
        addonKeys: chargedAddons,
        email: email.trim() || undefined,
        guestToken,
        funnelSessionId: getChristmasFunnelSessionId(),
        existingOrderId: recovered?.orderId,
      });
      if (result.publicToken) {
        persistPlannerOrderRecovery({
          orderId: result.orderId,
          publicToken: result.publicToken,
          packageKey,
          addonKeys: chargedAddons,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start checkout.";
      setError(
        /not enabled|checkout_disabled/i.test(msg)
          ? "Checkout is not live yet. Packages and prices are ready — payment will open when the Planner offer is enabled."
          : msg,
      );
      void trackChristmasEvent("planner_purchase_failed", {
        productKey: PLANNER_PRODUCT_KEY,
        packageKey,
        pathname: "/christmas/planner",
        metadata: { reason: msg.slice(0, 80) },
      });
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }, [packageKey, chargedAddons, email, displayTotal]);

  const seo = useMemo(() => plannerSeo(), []);

  return (
    <div className="tdg-planner">
      <PageHead title={seo.title} description={seo.description} url={seo.url} image={seo.image} exactTitle />
      <header className="tdg-planner__hero">
        <div className="tdg-planner__media">
          <img src={LANDING_ASSETS.cabin1920} alt="A luxury mountain cabin at Christmas" width={1920} height={1080} />
          <div className="tdg-planner__veil" />
        </div>
        <div className="tdg-planner__hero-copy">
          <p className="tdg-planner__kicker">New for Christmas 2026</p>
          <h1>Your entire Christmas, beautifully planned.</h1>
          <p className="tdg-planner__lede">
            Gifts, budget, meals, family plans, cards, traditions and everything in between — all in one place.
          </p>
          <div className="tdg-planner__cta-row">
            <button type="button" className="tdg-planner__btn" onClick={() => packagesRef.current?.scrollIntoView({ behavior: "smooth" })}>
              Start My Christmas Plan
            </button>
            <span className="tdg-planner__micro">One purchase. Your Christmas organized.</span>
          </div>
          <div className="tdg-planner__mock" aria-label="Planner product preview">
            <div className="tdg-planner__card">
              <small>Preview mock</small>
              <strong>Christmas countdown</strong>
              <p>Days until Christmas, updated in your plan.</p>
            </div>
            <div className="tdg-planner__card">
              <small>Preview mock</small>
              <strong>Today’s tasks</strong>
              <p>Clear next steps instead of scattered notes.</p>
            </div>
            <div className="tdg-planner__card">
              <small>Preview mock</small>
              <strong>Budget progress</strong>
              <p>See what is spent before it surprises you.</p>
            </div>
            <div className="tdg-planner__card">
              <small>Preview mock</small>
              <strong>Gifts · meals · events</strong>
              <p>Honest preview — the live Planner app ships next.</p>
            </div>
          </div>
        </div>
      </header>

      <section>
        <h2>From Christmas chaos to one command center</h2>
        <div className="tdg-planner__split">
          <div className="tdg-planner__before">
            <h3>Before</h3>
            <p>Notes everywhere. Forgotten gifts. Overspending. Last-minute panic. Meal-planning chaos. Forgotten cards. Missed delivery deadlines.</p>
          </div>
          <div className="tdg-planner__after">
            <h3>After</h3>
            <p>One Christmas command center. Clear next steps. Everything tracked. Everything remembered.</p>
          </div>
        </div>
      </section>

      <section>
        <h2>What you get</h2>
        <div className="tdg-planner__grid">
          {PLANNER_AREAS.map((area) => (
            <article className="tdg-planner__card" key={area.title}>
              <h3>{area.title}</h3>
              <p>{area.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Starting late?</h2>
        <p className="tdg-planner__lede">
          Christmas Rescue Mode adapts your plan to the time you have left — whether you start in September or December 18.
          The planning logic ships with the Planner app immediately after this funnel.
        </p>
      </section>

      <section ref={packagesRef} id="packages">
        <h2>Choose your Christmas</h2>
        <div className="tdg-planner__packages">
          {catalog.packages.map((pkg) => (
            <button
              type="button"
              key={pkg.packageKey}
              className={`tdg-planner__offer${pkg.packageKey === packageKey ? " is-selected" : ""}${pkg.highlight ? " is-best" : ""}`}
              onClick={() => {
                setPackageKey(pkg.packageKey);
                void trackChristmasEvent("planner_package_selected", {
                  productKey: PLANNER_PRODUCT_KEY,
                  packageKey: pkg.packageKey,
                  amountCents: pkg.priceCents,
                  pathname: "/christmas/planner",
                });
              }}
            >
              {pkg.highlight || pkg.packageKey === "all_in" ? <span className="tdg-planner__badge">Best value · Most complete</span> : null}
              {pkg.badge && pkg.packageKey !== "all_in" ? <span className="tdg-planner__badge">{pkg.badge}</span> : null}
              <h3>{pkg.packageName}</h3>
              <div className="tdg-planner__price">{money(pkg.priceCents, pkg.currency)}</div>
              <p>{pkg.description}</p>
              <ul>
                {pkg.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Optional add-ons</h2>
        <p className="tdg-planner__micro">Never added automatically. Included packs in your package are not charged again.</p>
        <div className="tdg-planner__addons">
          {catalog.addons.map((addon) => {
            const included = includedAddons.includes(addon.packageKey as never);
            return (
              <label key={addon.packageKey}>
                <input
                  type="checkbox"
                  checked={included || addonKeys.includes(addon.packageKey)}
                  disabled={included}
                  onChange={() => toggleAddon(addon.packageKey)}
                />
                <span>
                  <strong>{addon.packageName}</strong>
                  <br />
                  {included ? "Included in your package" : money(addon.priceCents, addon.currency)}
                  <br />
                  {addon.description}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Compare packages</h2>
        <div className="tdg-planner__desktop-table">
          <table>
            <thead>
              <tr>
                <th>Included</th>
                <th>Essentials</th>
                <th>Magic</th>
                <th>All-In</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label}>
                  <td>
                    {row.label}
                    {row.soon ? " (coming soon)" : ""}
                  </td>
                  <td>{row.essentials ? "Yes" : "—"}</td>
                  <td>{row.magic ? "Yes" : "—"}</td>
                  <td>{row.all_in ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tdg-planner__mobile-compare">
          {(["essentials", "magic", "all_in"] as PlannerPackageKey[]).map((key) => (
            <details key={key} open={key === packageKey}>
              <summary>{key === "all_in" ? "All-In Christmas" : key === "magic" ? "Christmas Magic" : "Essentials"}</summary>
              <ul>
                {COMPARISON_ROWS.filter((row) => row[key]).map((row) => (
                  <li key={row.label}>
                    {row.label}
                    {row.soon ? " (coming soon)" : ""}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2>New for Christmas 2026</h2>
        <p>
          Christmas Planner is a new product. We do not invent reviews, customer counts, or testimonials. Existing Digital Gifter
          Christmas tools — Gift Finder, Wishlist, cards, and portraits — remain available from the{" "}
          <Link to="/christmas">Christmas hub</Link>.
        </p>
      </section>

      <section>
        <h2>FAQ</h2>
        {PLANNER_FAQS.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <section id="checkout">
        <h2>Get Christmas Planner</h2>
        <p className="tdg-planner__lede">
          {selected ? `${selected.packageName} · ${money(displayTotal, selected.currency)}` : ""}
        </p>
        <label>
          Email for receipt (optional)
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@email.com"
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        {!checkout ? (
          <button type="button" className="tdg-planner__btn" disabled={busy} onClick={() => void startPay()}>
            {busy ? "Starting checkout…" : "Continue to payment"}
          </button>
        ) : (
          <div className="tdg-planner__checkout">
            <CustomStripeCheckout
              clientSecret={checkout.clientSecret}
              publishableKey={checkout.publishableKey}
              dueDisplay={money(checkout.amountCents, catalog.packages[0]?.currency || "usd")}
              email={email}
              appearanceTheme="night"
              walletCapabilityOnly
              payButtonLabel={() => "Pay"}
              onWalletAvailability={(info) => {
                void trackChristmasEvent("planner_wallet_presented", {
                  productKey: PLANNER_PRODUCT_KEY,
                  packageKey,
                  pathname: "/christmas/planner",
                  metadata: { applePay: info.applePay, googlePay: info.googlePay },
                });
              }}
              onPaymentInteraction={() => {
                void trackChristmasEvent("planner_payment_submitted", {
                  productKey: PLANNER_PRODUCT_KEY,
                  packageKey,
                  orderId: checkout.orderId,
                  amountCents: checkout.amountCents,
                  pathname: "/christmas/planner",
                });
              }}
              onReady={() => {
                trackPlannerMetaInitiateCheckout(checkout.orderId, checkout.amountCents, catalog.packages[0]?.currency || "usd");
              }}
            />
          </div>
        )}
        <article className="tdg-planner__indexable">
          <h3>Online Christmas planner for 2026</h3>
          <p>
            Christmas Planner by The Digital Gifter is a digital Christmas planner and Christmas planning app for gifts, budget,
            meals, hosting, cards, and family traditions. Use it as a Christmas gift planner, Christmas budget planner, and
            Christmas meal planner without printing a PDF. Start on the phone, finish later on your account.
          </p>
        </article>
      </section>

      <div className="tdg-planner__sticky">
        <div>
          <strong>Get Christmas Planner</strong>
          <div className="tdg-planner__micro">
            {packagesSeen && selected ? `${selected.packageName} · ${money(displayTotal, selected.currency)}` : "One purchase. Your Christmas organized."}
          </div>
        </div>
        <button
          type="button"
          className="tdg-planner__btn"
          onClick={() => {
            document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
            if (!checkout) void startPay();
          }}
        >
          Get Christmas Planner
        </button>
      </div>
    </div>
  );
}

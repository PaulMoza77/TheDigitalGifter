import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { COMPARISON_ROWS, PLANNER_FAQS } from "./copy";
import {
  getOrCreatePlannerGuestToken,
  persistPlannerOrderRecovery,
  readPlannerOrderRecovery,
} from "./guest";
import { plannerJsonLd, plannerSeo, upsertJsonLd } from "./seo";
import { trackPlannerMetaInitiateCheckout } from "./meta";
import "./planner.css";

const DINNER_IMG = "/christmas/planner/dinner-table.webp";
const GIFTS_IMG = "/christmas/planner/gifts-editorial.webp";

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

function daysUntilChristmas(now = new Date()) {
  const year = now.getFullYear();
  const christmas = new Date(year, 11, 25);
  if (now > christmas) christmas.setFullYear(year + 1);
  return Math.max(0, Math.ceil((christmas.getTime() - now.getTime()) / 86_400_000));
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

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      node?.classList.add("is-in");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.classList.add("is-in");
          obs.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`tdg-planner__reveal ${className}`.trim()}>
      {children}
    </div>
  );
}

function ProductDevice({ days }: { days: number }) {
  return (
    <div className="tdg-planner__device" aria-label="Christmas Planner product preview">
      <div className="tdg-planner__device-screen">
        <div className="tdg-planner__device-brand">The Digital Gifter · Planner</div>
        <h3>Today</h3>
        <div className="tdg-planner__device-count">{days}</div>
        <div className="tdg-planner__device-meta">days to Christmas</div>
        <div className="tdg-planner__device-rows">
          <div className="tdg-planner__device-row">
            <strong>3 things to do today</strong>
            <span>Buy ribbons · Confirm guest list · Defrost dessert</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Gifts</strong>
            <span>7 of 12 ordered</span>
            <div className="tdg-planner__bar" aria-hidden>
              <i style={{ ["--w" as string]: "58%" }} />
            </div>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Budget</strong>
            <span>On track · $420 left</span>
            <div className="tdg-planner__bar" aria-hidden>
              <i style={{ ["--w" as string]: "72%" }} />
            </div>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Upcoming</strong>
            <span>Christmas Eve dinner · Tree lighting · Travel day</span>
          </div>
        </div>
        <p className="tdg-planner__honest">Product preview · live Planner ships with your account</p>
      </div>
    </div>
  );
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
  const days = useMemo(() => daysUntilChristmas(), []);

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
    void trackChristmasEvent("planner_cta_clicked", {
      productKey: PLANNER_PRODUCT_KEY,
      packageKey,
      pathname: "/christmas/planner",
    });
    if (!catalog.checkoutLive) {
      setError(
        "Checkout is not live yet. Packages and prices are ready — payment will open when the Planner offer is enabled.",
      );
      void trackChristmasEvent("planner_purchase_failed", {
        productKey: PLANNER_PRODUCT_KEY,
        packageKey,
        pathname: "/christmas/planner",
        metadata: { reason: "checkout_disabled" },
      });
      return;
    }
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError(null);
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
  }, [packageKey, chargedAddons, email, displayTotal, catalog.checkoutLive]);

  const seo = useMemo(() => plannerSeo(), []);
  const scrollToPackages = () => packagesRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="tdg-planner">
      <PageHead title={seo.title} description={seo.description} url={seo.url} image={seo.image} exactTitle />

      <header className="tdg-planner__hero">
        <div className="tdg-planner__media">
          <picture>
            <source srcSet={LANDING_ASSETS.cabin1920} type="image/webp" />
            <img
              src={LANDING_ASSETS.cabin1920Jpg}
              alt="A luxury mountain cabin living room at Christmas"
              width={1920}
              height={1080}
            />
          </picture>
          <div className="tdg-planner__veil" />
        </div>
        <div className="tdg-planner__hero-copy">
          <p className="tdg-planner__kicker">The Digital Gifter · Christmas 2026</p>
          <h1>
            Your entire Christmas,
            <br />
            beautifully planned.
          </h1>
          <p className="tdg-planner__lede">
            Gifts, budget, meals, family plans, cards, traditions and everything in between — all in one place.
          </p>
          <div className="tdg-planner__cta-row">
            <button type="button" className="tdg-planner__btn" onClick={scrollToPackages}>
              Start My Christmas Plan
            </button>
            <span className="tdg-planner__micro">One purchase. Your Christmas beautifully organized.</span>
          </div>
          <div className="tdg-planner__pulse" aria-label="What the Planner quietly tracks">
            <span>{days} days to Christmas</span>
            <span className="tdg-planner__dot" aria-hidden />
            <span>3 things to do today</span>
            <span className="tdg-planner__dot" aria-hidden />
            <span>Gifts on track</span>
            <span className="tdg-planner__dot" aria-hidden />
            <span>Budget under control</span>
          </div>
        </div>
      </header>

      <section className="tdg-planner__section tdg-planner__section--cream">
        <div className="tdg-planner__inner">
          <Reveal>
            <p className="tdg-planner__kicker" style={{ color: "var(--burgundy)" }}>
              The quiet truth
            </p>
            <h2>Christmas shouldn’t feel like project management.</h2>
            <ul className="tdg-planner__story-list">
              <li>Gifts in Notes.</li>
              <li>Recipes in screenshots.</li>
              <li>Budgets in your head.</li>
              <li>Dates in three different chats.</li>
            </ul>
            <p className="tdg-planner__resolve">One place for all of it.</p>
          </Reveal>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--dark">
        <div className="tdg-planner__inner tdg-planner__device-wrap">
          <Reveal>
            <p className="tdg-planner__kicker">Your Christmas command center</p>
            <h2>A calm home for the season.</h2>
            <p className="tdg-planner__lede" style={{ marginTop: "0.85rem" }}>
              Countdown. Today. Gifts. Budget. What’s next. Designed like a lifestyle companion — not a spreadsheet.
            </p>
          </Reveal>
          <Reveal>
            <ProductDevice days={days} />
          </Reveal>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--parchment">
        <div className="tdg-planner__inner">
          <Reveal>
            <p className="tdg-planner__kicker" style={{ color: "var(--burgundy)" }}>
              The Christmas Plan
            </p>
            <h2>Everything that makes Christmas feel like Christmas.</h2>
          </Reveal>

          <div className="tdg-planner__split" style={{ marginTop: "2.5rem" }}>
            <Reveal>
              <img src={GIFTS_IMG} alt="Wrapped Christmas gifts with burgundy ribbon and evergreen" width={1200} height={900} />
            </Reveal>
            <Reveal className="tdg-planner__split-copy">
              <h3>Gifts without the panic</h3>
              <p>Everyone you’re buying for. Every idea. Every order. Every wrapped gift — with Gift Finder when you need inspiration.</p>
              <ul className="tdg-planner__checklist">
                <li>People and lists in one place</li>
                <li>Ideas → ordered → wrapped</li>
                <li>Delivery deadlines you won’t miss</li>
              </ul>
            </Reveal>
          </div>

          <div className="tdg-planner__split tdg-planner__split--flip">
            <Reveal>
              <img src={DINNER_IMG} alt="A candlelit Christmas dinner table set for family" width={1600} height={900} />
            </Reveal>
            <Reveal className="tdg-planner__split-copy">
              <h3>Christmas dinner without the chaos</h3>
              <p>Plan Christmas Eve. Plan Christmas Day. Save recipes. Build one grocery list. Know what needs preparing and when.</p>
              <ul className="tdg-planner__checklist">
                <li>Menus for Eve and Day</li>
                <li>Recipes you actually cook</li>
                <li>One shopping list for the table</li>
              </ul>
            </Reveal>
          </div>

          <div className="tdg-planner__split">
            <Reveal>
              <img
                src={LANDING_ASSETS.cabin1280}
                alt="Warm Christmas cabin with fireplace and tree"
                width={1280}
                height={720}
              />
            </Reveal>
            <Reveal className="tdg-planner__split-copy">
              <h3>Host without forgetting anything</h3>
              <p>Guests, timing, rooms, and the little tasks that keep a house feeling ready — not frantic.</p>
              <ul className="tdg-planner__checklist">
                <li>Guest list and dietary notes</li>
                <li>Decorating and home prep</li>
                <li>Traditions you want to keep</li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--mid">
        <div className="tdg-planner__inner">
          <Reveal>
            <p className="tdg-planner__kicker">A plan that respects the calendar</p>
            <h2>Personalized to the time you have left.</h2>
            <div className="tdg-planner__timeline">
              <div className="tdg-planner__tl-item">
                <strong>September</strong>
                <span>Plan</span>
              </div>
              <div className="tdg-planner__tl-item">
                <strong>October</strong>
                <span>Prepare</span>
              </div>
              <div className="tdg-planner__tl-item">
                <strong>November</strong>
                <span>Buy</span>
              </div>
              <div className="tdg-planner__tl-item">
                <strong>December</strong>
                <span>Enjoy</span>
              </div>
            </div>
            <p className="tdg-planner__rescue-note">
              Starting late? Your plan automatically becomes Christmas Rescue Mode.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--cream">
        <div className="tdg-planner__inner tdg-planner__device-wrap">
          <Reveal>
            <p className="tdg-planner__kicker" style={{ color: "var(--burgundy)" }}>
              Gifts
            </p>
            <h2>Everyone you’re buying for.</h2>
            <p className="tdg-planner__lede" style={{ marginTop: "0.85rem", color: "var(--ink-soft)" }}>
              Every idea. Every order. Every wrapped gift. Gift Finder sits beside your lists — not in another tab.
            </p>
          </Reveal>
          <Reveal>
            <ProductDevice days={days} />
          </Reveal>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--dark" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="tdg-planner__inner" style={{ maxWidth: "100%", padding: 0 }}>
          <img
            src={DINNER_IMG}
            alt="Christmas table with candles, evergreen, and a festive roast"
            width={1600}
            height={900}
            style={{ width: "100%", height: "min(70vh, 34rem)", objectFit: "cover", display: "block" }}
          />
        </div>
        <div className="tdg-planner__inner" style={{ padding: "3.5rem 1.35rem 4.5rem" }}>
          <Reveal>
            <p className="tdg-planner__kicker">The Christmas table</p>
            <h2>Food is half of Christmas.</h2>
            <p className="tdg-planner__lede" style={{ marginTop: "0.85rem", maxWidth: "34rem" }}>
              Plan Christmas Eve. Plan Christmas Day. Save recipes. Build one grocery list. Know what needs preparing
              and when. This is why the Planner is bigger than a gift tracker.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--mid">
        <div className="tdg-planner__inner">
          <Reveal>
            <p className="tdg-planner__kicker">Also in your Planner</p>
            <h2>Everything else, quietly covered.</h2>
            <ul className="tdg-planner__list-grid">
              {[
                "Budget",
                "Hosting",
                "Cards & messages",
                "Decorating",
                "Travel",
                "Traditions",
                "Wishlist",
                "Activities",
                "Memories",
                "Christmas Club",
                "Gift Finder",
                "Christmas AI Assistant (coming soon)",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--dark">
        <div className="tdg-planner__inner">
          <Reveal>
            <p className="tdg-planner__kicker">Christmas Rescue Mode</p>
            <p className="tdg-planner__rescue-quote">
              It’s December 18.
              <br />
              You haven’t started.
              <br />
              You still have a plan.
            </p>
            <p className="tdg-planner__lede" style={{ maxWidth: "32rem" }}>
              Starting in September or December 18? The Planner adapts to the time you have left — a short, clear rescue
              list instead of a long season plan.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--dark" ref={packagesRef} id="packages">
        <div className="tdg-planner__inner">
          <Reveal>
            <p className="tdg-planner__kicker">Choose your Christmas</p>
            <h2>Three ways in. One beautiful season.</h2>
          </Reveal>
          <div className="tdg-planner__packages">
            {catalog.packages.map((pkg) => (
              <button
                type="button"
                key={pkg.packageKey}
                className={`tdg-planner__offer${pkg.packageKey === packageKey ? " is-selected" : ""}${
                  pkg.highlight ? " is-best" : ""
                }`}
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
                {pkg.highlight || pkg.packageKey === "all_in" ? (
                  <span className="tdg-planner__badge">Best value · Most complete</span>
                ) : null}
                {pkg.badge && pkg.packageKey !== "all_in" ? (
                  <span className="tdg-planner__badge">{pkg.badge}</span>
                ) : null}
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

          <div className="tdg-planner__addons">
            <p className="tdg-planner__micro">Optional add-ons — never added automatically. Included packs are not charged again.</p>
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
                    <small>{addon.description}</small>
                  </span>
                  <span className="tdg-planner__addon-price">
                    {included ? "Included" : money(addon.priceCents, addon.currency)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--mid">
        <div className="tdg-planner__inner">
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
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--cream">
        <div className="tdg-planner__inner">
          <h2>New for Christmas 2026</h2>
          <p style={{ color: "var(--ink-soft)", maxWidth: "38rem", marginTop: "0.75rem" }}>
            Christmas Planner is a new product. We do not invent reviews, customer counts, or testimonials. Existing
            Digital Gifter Christmas tools — Gift Finder, Wishlist, cards, and portraits — remain available from the{" "}
            <Link to="/christmas">Christmas hub</Link>.
          </p>
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--dark">
        <div className="tdg-planner__inner">
          <h2>FAQ</h2>
          {PLANNER_FAQS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="tdg-planner__section tdg-planner__section--dark" id="checkout">
        <div className="tdg-planner__inner">
          <p className="tdg-planner__kicker">Final step</p>
          <h2>Get Christmas Planner</h2>
          <div className="tdg-planner__checkout-panel">
            <div className="tdg-planner__summary">
              <strong>{selected ? selected.packageName : "Your plan"}</strong>
              <span>
                {selected
                  ? `${money(selected.priceCents, selected.currency)}${
                      chargedAddons.length
                        ? ` · +${chargedAddons.length} add-on${chargedAddons.length === 1 ? "" : "s"}`
                        : ""
                    }`
                  : ""}
              </span>
              <span>Total {money(displayTotal, selected?.currency || "usd")}</span>
            </div>
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
            {error ? (
              <p role="alert" style={{ marginTop: "0.85rem" }}>
                {error}
              </p>
            ) : null}
            <div style={{ height: 14 }} />
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
                    trackPlannerMetaInitiateCheckout(
                      checkout.orderId,
                      checkout.amountCents,
                      catalog.packages[0]?.currency || "usd",
                    );
                  }}
                />
              </div>
            )}
          </div>
          <article className="tdg-planner__indexable">
            <h3>Online Christmas planner for 2026</h3>
            <p>
              Christmas Planner by The Digital Gifter is a digital Christmas planner and Christmas planning app for
              gifts, budget, meals, hosting, cards, and family traditions. Use it as a Christmas gift planner, Christmas
              budget planner, and Christmas meal planner without printing a PDF. Start on the phone, finish later on
              your account.
            </p>
          </article>
        </div>
      </section>

      <div className="tdg-planner__sticky">
        <div>
          <strong>Get Christmas Planner</strong>
          <div className="tdg-planner__micro">
            {packagesSeen && selected
              ? `${selected.packageName} · ${money(displayTotal, selected.currency)}`
              : "One purchase. Your Christmas beautifully organized."}
          </div>
        </div>
        <button
          type="button"
          className="tdg-planner__btn"
          onClick={() => {
            document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
            if (!checkout && catalog.checkoutLive) void startPay();
          }}
        >
          Get Christmas Planner
        </button>
      </div>
    </div>
  );
}

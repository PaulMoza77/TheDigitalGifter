import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { trackPlannerEvent } from "./analytics";
import { addonIncludedInPackage } from "./entitlements";
import { fetchPlannerCatalog, type PlannerCatalogRow } from "./api";
import { PlannerCheckoutSheet } from "./PlannerCheckout";
import { money } from "./Paywall";
import { PLANNER_ACCOUNT_ROUTE } from "./types";
import "./planner.css";

const MODULES = [
  { title: "Countdown / Today", body: "Days left, readiness, and what to do next.", live: true },
  { title: "Dynamic Christmas Plan", body: "A date-aware checklist that compresses as Christmas approaches.", live: true },
  { title: "Gifts", body: "People you are buying for — idea to given — separate from Wishlist.", live: true },
  { title: "Budget", body: "One season budget. Gift prices roll in.", live: true },
  { title: "Calendar", body: "Known dates and due tasks in one place.", live: true },
  { title: "Shopping / deliveries", body: "Orders, arrivals, and return deadlines.", live: true },
  { title: "Food Planner", body: "Menus and a grocery list for Eve and Day.", live: true },
  { title: "Recipes", body: "Original TDG teasers now; full catalog with the Recipes pack.", live: true },
  { title: "Hosting", body: "Guests, RSVP, dietary notes — no passports or cards.", live: true },
  { title: "Home / decorating", body: "Rooms and a simple decorating list.", live: true },
  { title: "Travel", body: "Trips, packing, home arrangements.", live: true },
  { title: "Traditions / activities", body: "Save and schedule the moments that make it yours.", live: true },
  { title: "Cards & Messages", body: "Track who still needs a card; jump into existing TDG tools.", live: true },
  { title: "Wishlist / Gift Finder", body: "Bridges into the live Wishlist and Gift Finder — not a second engine.", live: true },
  { title: "Memories", body: "Capture notes for next year after the 25th.", live: true },
  { title: "Christmas Club", body: "Stay in the countdown club from the same home.", live: true },
  { title: "Christmas Rescue Mode", body: "When you are late, the plan becomes a short rescue list.", live: true },
  { title: "Ask Christmas AI", body: "A future assistant seam. Not live in this version.", live: false },
];

export default function ChristmasPlannerPublicPage() {
  const [params] = useSearchParams();
  const { session, signInWithGoogle } = useAuth();
  const [catalog, setCatalog] = useState<PlannerCatalogRow[]>([]);
  const [selectedKey, setSelectedKey] = useState("magic");
  const [addonKeys, setAddonKeys] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    trackPlannerEvent("planner_landing_view");
    void fetchPlannerCatalog().then((rows) => {
      setCatalog(rows);
      const recommended = rows.find((r) => r.recommended && !r.addon);
      if (recommended) setSelectedKey(recommended.packageKey);
    });
  }, []);

  useEffect(() => {
    const pkg = params.get("package") || params.get("checkout");
    if (pkg && pkg !== "success" && pkg !== "canceled") {
      setSelectedKey(pkg);
      setCheckoutOpen(true);
    }
  }, [params]);

  const tiers = useMemo(
    () => catalog.filter((r) => r.productKey === "christmas_planner").sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog],
  );
  const addons = useMemo(
    () => catalog.filter((r) => r.addon && r.productKey !== "christmas_planner"),
    [catalog],
  );
  const selected = tiers.find((t) => t.packageKey === selectedKey) || tiers[0] || null;
  const selectedAddons = addons.filter((a) => addonKeys.includes(a.packageKey));

  function selectPackage(key: string) {
    setSelectedKey(key);
    setAddonKeys((prev) => prev.filter((addon) => !addonIncludedInPackage(key, addon)));
    trackPlannerEvent("planner_package_selected", { packageKey: key });
  }

  function toggleAddon(key: string) {
    if (selected && addonIncludedInPackage(selected.packageKey, key)) return;
    setAddonKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      trackPlannerEvent("planner_addon_selected", { packageKey: key, metadata: { on: !prev.includes(key) } });
      return next;
    });
  }

  function startCheckout() {
    trackPlannerEvent("planner_cta_clicked", { packageKey: selected?.packageKey });
    setCheckoutOpen(true);
  }

  return (
    <div className="tdg-planner tdg-planner-funnel">
      <ChristmasPageHead path="/christmas/planner" />
      <header className="tdg-funnel-hero">
        <p className="tdg-planner-brand">Christmas Planner</p>
        <h1>Your entire Christmas, beautifully planned.</h1>
        <p className="tdg-planner-lede">
          One private command center for gifts, budget, meals, hosting, and a plan that changes with the date —
          not another spreadsheet you will abandon in November.
        </p>
        <div className="tdg-planner-actions">
          <button type="button" className="tdg-planner-btn primary" onClick={startCheckout}>
            Unlock this season
          </button>
          <Link
            className="tdg-planner-btn"
            to={PLANNER_ACCOUNT_ROUTE}
            onClick={() => trackPlannerEvent("planner_cta_clicked", { metadata: { cta: "free" } })}
          >
            Start free
          </Link>
        </div>
        <div className="tdg-funnel-mock" aria-hidden>
          <div className="tdg-funnel-mock-top">
            <span>99 days left</span>
            <strong>62% ready</strong>
          </div>
          <div className="tdg-funnel-mock-bar">
            <span />
          </div>
          <ul>
            <li>Order gifts that still have no idea</li>
            <li>Set the food budget</li>
            <li>Confirm who is coming on Christmas Day</li>
          </ul>
        </div>
      </header>

      <section className="tdg-funnel-section">
        <h2>Leave the chaos behind</h2>
        <div className="tdg-funnel-transform">
          {[
            ["Notes on your phone", "A plan that knows what today is"],
            ["Spreadsheets", "Gifts, budget, and meals in one place"],
            ["Forgotten gifts", "Every person tracked to given"],
            ["Overspending", "Remaining budget you can actually see"],
            ["Meal chaos", "Menus that roll into a grocery list"],
            ["Hosting chaos", "Guests, RSVPs, and dietary notes"],
            ["Last-minute panic", "Rescue mode when December is already here"],
          ].map(([from, to]) => (
            <article key={from}>
              <p className="tdg-planner-muted">{from}</p>
              <p>{to}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tdg-funnel-section">
        <h2>What you get</h2>
        <div className="tdg-funnel-modules">
          {MODULES.map((m) => (
            <article key={m.title}>
              <h3>{m.title}</h3>
              <p>{m.body}</p>
              {!m.live ? <span className="tdg-funnel-soon">Coming later</span> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="tdg-funnel-section" id="pricing">
        <h2>Packages for this season</h2>
        <p className="tdg-planner-muted">
          Prices come from the live catalog and can change without a site deploy. Paid checkout stays off until launch
          pricing is approved. Free countdown and a short plan are available now.
        </p>
        <div className="tdg-funnel-packages">
          {tiers.map((tier) => {
            const on = selected?.packageKey === tier.packageKey;
            return (
              <article
                key={tier.packageKey}
                className={on ? "on" : ""}
                onClick={() => selectPackage(tier.packageKey)}
                onMouseEnter={() => trackPlannerEvent("planner_package_viewed", { packageKey: tier.packageKey })}
              >
                {tier.recommended ? <span className="tdg-funnel-badge">Best value</span> : null}
                <h3>{tier.packageName}</h3>
                <p className="tdg-funnel-price">{money(tier.priceCents, tier.currency)}</p>
                <p>{tier.description}</p>
                <button type="button" className="tdg-planner-btn primary">
                  {on ? "Selected" : "Choose"}
                </button>
              </article>
            );
          })}
        </div>
        <button type="button" className="tdg-planner-btn ghost" onClick={() => setCompareOpen((v) => !v)}>
          {compareOpen ? "Hide comparison" : "Compare packages"}
        </button>
        {compareOpen ? (
          <div className="tdg-funnel-compare">
            <table>
              <thead>
                <tr>
                  <th>Included</th>
                  {tiers.map((t) => (
                    <th key={t.packageKey}>{t.packageName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["Gifts & budget", "Rescue mode", "Food & recipes", "Hosting", "Travel"].map((row, i) => (
                  <tr key={row}>
                    <td>{row}</td>
                    {tiers.map((t) => {
                      const keys = [
                        ["gift_planner", "budget"],
                        ["rescue_mode"],
                        ["food_planner", "recipes"],
                        ["hosting"],
                        ["travel"],
                      ][i];
                      const yes = keys.every((k) => t.features.includes(k));
                      return <td key={t.packageKey}>{yes ? "Yes" : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <h3 className="tdg-funnel-sub">Optional add-ons</h3>
        <p className="tdg-planner-muted">Never auto-charged. If your package already includes it, it stays Included.</p>
        <div className="tdg-funnel-addons">
          {addons.map((addon) => {
            const included = selected ? addonIncludedInPackage(selected.packageKey, addon.packageKey) : false;
            const on = addonKeys.includes(addon.packageKey);
            return (
              <article key={addon.packageKey}>
                <h3>{addon.packageName}</h3>
                <p>{addon.description}</p>
                <p className="tdg-funnel-price">{money(addon.priceCents, addon.currency)}</p>
                {included ? (
                  <span className="tdg-funnel-badge">Included</span>
                ) : (
                  <button type="button" className="tdg-planner-btn" onClick={() => toggleAddon(addon.packageKey)}>
                    {on ? "Added" : "Add"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <label className="tdg-funnel-email">
          Email for receipts and recovery
          <input
            className="tdg-planner-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </label>
        <button type="button" className="tdg-planner-btn primary tdg-funnel-sticky" onClick={startCheckout}>
          Continue to checkout
        </button>
      </section>

      <section className="tdg-funnel-section">
        <h2>What is a Christmas planner?</h2>
        <p>
          A Christmas planner is a private command center for the season: countdown, a date-aware checklist, gifts you
          are giving, budget, meals, and hosting. TheDigitalGifter planner is not a PDF or spreadsheet — it changes from
          a 13-week plan in September to a rescue plan in late December.
        </p>
      </section>
      <section className="tdg-funnel-section">
        <h2>Christmas gift planner</h2>
        <p>
          Track people you are buying for separately from your public wishlist. Statuses run from idea to given.{" "}
          <Link to="/christmas/gift-finder">Find a Christmas gift idea</Link> and add it back to that person.
        </p>
      </section>
      <section className="tdg-funnel-section">
        <h2>Christmas budget planner</h2>
        <p>
          Set one season budget. Categories stay simple: gifts, food, travel, decor, events, clothing, charity, other.
          Gift prices roll into spent automatically.
        </p>
      </section>
      <section className="tdg-funnel-section">
        <h2>Christmas meal planner</h2>
        <p>
          Build Christmas Eve and Christmas Day menus, then roll a grocery list. Original TDG recipes can ship as free
          teasers, a tier include, or a standalone add-on.
        </p>
      </section>
      <section className="tdg-funnel-section">
        <h2>Christmas hosting planner</h2>
        <p>
          Keep a guest list with RSVP, adults/kids, dietary notes, and what people bring — without collecting passports
          or payment cards.
        </p>
      </section>
      <section className="tdg-funnel-section">
        <h2>Christmas planning timeline</h2>
        <p>
          Tasks are generated from today’s date plus hosting, travel, children, and gift count. You can complete, skip,
          reschedule, or add custom tasks.
        </p>
      </section>

      <PlannerCheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        selected={selected}
        addons={selectedAddons}
        email={email}
      />
      {!session ? (
        <p className="tdg-planner-muted" style={{ padding: "0 16px 40px" }}>
          After payment you can{" "}
          <button
            type="button"
            className="tdg-planner-linkish"
            onClick={() => {
              rememberAuthReturnTo("/christmas/planner/welcome");
              void signInWithGoogle({
                redirectTo: `${window.location.origin}/auth/callback`,
              });
            }}
          >
            sign in with Google
          </button>{" "}
          using the same email.
        </p>
      ) : null}
      <p className="tdg-planner-muted" style={{ padding: "0 16px 80px" }}>
        Also explore <Link to="/christmas">Christmas Club</Link>, <Link to="/christmas/wishlist">Wishlist</Link>, and{" "}
        <Link to="/christmas/messages">Christmas messages</Link>.
      </p>
    </div>
  );
}

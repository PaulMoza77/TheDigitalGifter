import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CHRISTMAS_CATALOG_SEED, findProduct } from "../catalog";
import { FONT_HREF, LANDING_ASSETS } from "../landing/assets";
import {
  PLANNER_PRODUCT_KEY,
  addonsIncludedInPackage,
  isPlannerPackageKey,
  plannerPublicCatalog,
} from "./commerce";
import { fetchPlannerCatalog, startPlannerCheckout, type PlannerCatalog } from "./api";
import { PLANNER_FAQS } from "./copy";
import {
  getOrCreatePlannerGuestToken,
  persistPlannerOrderRecovery,
  readPlannerOrderRecovery,
} from "./guest";
import { plannerJsonLd, plannerSeo, upsertJsonLd } from "./seo";
import { trackPlannerMetaInitiateCheckout } from "./meta";
import { daysUntilChristmas as daysUntilChristmasTz } from "./date";
import { getChristmasFunnelSessionId, trackPlannerFunnel } from "./funnelTrack";
import {
  CHAOS_OPTIONS,
  EMPTY_PERSONALIZATION,
  ROLE_OPTIONS,
  START_OPTIONS,
  analyticsEnums,
  buildPersonalizedPreview,
  persistPlannerPersonalization,
  personalizationComplete,
  readPlannerPersonalization,
  toggleChaosChoice,
  type ChaosOptionId,
  type PlannerPersonalizationAnswers,
  type PersonalizedPlannerPreview,
  type RoleOptionId,
  type StartOptionId,
} from "./personalization";
import "./planner.css";

const CustomStripeCheckout = lazy(() =>
  import("@/features/pet/components/CustomStripeCheckout").then((mod) => ({
    default: mod.CustomStripeCheckout,
  })),
);

const PACKAGE_COPY: Record<
  string,
  { kicker: string; ticks: string[]; ribbon?: string }
> = {
  essentials: {
    kicker: "The planning basics",
    ticks: ["Plan", "Gifts", "Budget", "Shopping"],
  },
  magic: {
    kicker: "Everything most families need",
    ticks: ["Everything above", "Food", "Hosting", "Cards", "Rescue Mode"],
    ribbon: "Most popular",
  },
  all_in: {
    kicker: "The complete Christmas season",
    ticks: ["Everything", "Recipes", "Premium content", "bonus TDG benefits"],
    ribbon: "Best value",
  },
};

type PreviewTab = "today" | "gifts" | "budget" | "food" | "hosting" | "more";

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

function TeaserDevice({ days }: { days: number }) {
  return (
    <div className="tdg-planner__device tdg-planner__device--teaser" aria-label="Christmas Planner product preview">
      <div className="tdg-planner__device-screen">
        <div className="tdg-planner__device-brand">The Digital Gifter · Planner</div>
        <h3>Today</h3>
        <div className="tdg-planner__device-count">{days}</div>
        <div className="tdg-planner__device-meta">days to Christmas</div>
        <div className="tdg-planner__device-rows">
          <div className="tdg-planner__device-row">
            <strong>Your next steps</strong>
            <span>Your plan appears here</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Gifts</strong>
            <span>Ready to plan</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Budget</strong>
            <span>Not set yet</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Upcoming</strong>
            <span>After three short questions</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tdg-planner__device" aria-label="Christmas Planner product preview">
      <div className="tdg-planner__device-screen">
        <div className="tdg-planner__device-brand">The Digital Gifter · Planner</div>
        <h3>{title}</h3>
        {children}
        <p className="tdg-planner__honest">Preview from your answers · live Planner fills in as you plan</p>
      </div>
    </div>
  );
}

function PreviewDevice({
  tab,
  preview,
}: {
  tab: PreviewTab;
  preview: PersonalizedPlannerPreview;
}) {
  if (tab === "gifts") {
    return (
      <DeviceShell title="Gifts">
        <p className="tdg-planner__device-meta">Idea → ordered → wrapped</p>
        <div className="tdg-planner__device-rows">
          <div className="tdg-planner__device-row">
            <strong>Recipients</strong>
            <span>Your people, in one list</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Gift tasks in your plan</strong>
            <span>
              {preview.giftTaskCount} {preview.giftTaskCount === 1 ? "task" : "tasks"} from Planner templates
            </span>
            <div className="tdg-planner__bar" aria-hidden>
              <i style={{ ["--w" as string]: "0%" }} />
            </div>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Gift Finder</strong>
            <span>Sits beside your lists when you need an idea</span>
          </div>
        </div>
      </DeviceShell>
    );
  }
  if (tab === "budget") {
    return (
      <DeviceShell title="Budget">
        <p className="tdg-planner__device-meta">Planned · spent · remaining</p>
        <div className="tdg-planner__device-rows">
          <div className="tdg-planner__device-row">
            <strong>Set budget</strong>
            <span>
              {preview.budgetTaskCount
                ? "In your generated plan — not spent yet"
                : "Add a budget when you start"}
            </span>
            <div className="tdg-planner__bar" aria-hidden>
              <i style={{ ["--w" as string]: "0%" }} />
            </div>
          </div>
        </div>
      </DeviceShell>
    );
  }
  if (tab === "food") {
    return (
      <DeviceShell title="Food">
        <div className="tdg-planner__device-rows">
          <div className="tdg-planner__device-row">
            <strong>Christmas Eve</strong>
            <span>Menu, timing, prep</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Christmas Day</strong>
            <span>The table, without the scramble</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Recipes</strong>
            <span>Save what you actually cook</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Grocery list</strong>
            <span>One list for the season table</span>
          </div>
        </div>
      </DeviceShell>
    );
  }
  if (tab === "hosting") {
    return (
      <DeviceShell title="Hosting">
        <div className="tdg-planner__device-rows">
          <div className="tdg-planner__device-row">
            <strong>Guests</strong>
            <span>Who’s coming, and who eats what</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Prep</strong>
            <span>The jobs that keep the house ready</span>
          </div>
          <div className="tdg-planner__device-row">
            <strong>Home</strong>
            <span>Rooms, timing, the calm bits</span>
          </div>
        </div>
      </DeviceShell>
    );
  }
  if (tab === "more") {
    return (
      <DeviceShell title="More">
        <div className="tdg-planner__device-rows">
          {["Cards", "Travel", "Traditions", "Wishlist", "Activities", "Memories", "Christmas Club"].map((item) => (
            <div className="tdg-planner__device-row" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </DeviceShell>
    );
  }
  return (
    <DeviceShell title="Today">
      <div className="tdg-planner__device-count">{preview.daysLeft}</div>
      <div className="tdg-planner__device-meta">days to Christmas</div>
      <div className="tdg-planner__device-rows">
        <div className="tdg-planner__device-row">
          <strong>Next {preview.todayTasks.length || 0} tasks</strong>
          <span>
            {preview.todayTasks.length
              ? preview.todayTasks.map((task) => task.title).join(" · ")
              : "Your plan fills this after you start"}
          </span>
        </div>
        <div className="tdg-planner__device-row">
          <strong>Gift progress</strong>
          <span>
            0 of {preview.giftTaskCount} gift {preview.giftTaskCount === 1 ? "task" : "tasks"} started
          </span>
          <div className="tdg-planner__bar" aria-hidden>
            <i style={{ ["--w" as string]: "0%" }} />
          </div>
        </div>
        <div className="tdg-planner__device-row">
          <strong>Budget progress</strong>
          <span>{preview.budgetTaskCount ? "Budget not set yet" : "No budget task in this plan"}</span>
          <div className="tdg-planner__bar" aria-hidden>
            <i style={{ ["--w" as string]: "0%" }} />
          </div>
        </div>
        <div className="tdg-planner__device-row">
          <strong>Upcoming</strong>
          <span>{preview.upcoming.map((task) => task.title).join(" · ")}</span>
        </div>
      </div>
    </DeviceShell>
  );
}

function QuizLayer({
  answers,
  step,
  onClose,
  onPickStart,
  onToggleChaos,
  onContinueChaos,
  onPickRole,
}: {
  answers: PlannerPersonalizationAnswers;
  step: 1 | 2 | 3;
  onClose: () => void;
  onPickStart: (id: StartOptionId) => void;
  onToggleChaos: (id: ChaosOptionId) => void;
  onContinueChaos: () => void;
  onPickRole: (id: RoleOptionId) => void;
}) {
  return (
    <div className="tdg-planner__quiz" role="dialog" aria-modal="true" aria-labelledby="tdg-planner-quiz-title">
      <div className="tdg-planner__quiz-bar">
        <button type="button" className="tdg-planner__quiz-close" onClick={onClose}>
          Back
        </button>
        <span className="tdg-planner__quiz-progress" aria-current="step">
          {step} of 3
        </span>
      </div>
      {step === 1 ? (
        <div className="tdg-planner__quiz-body">
          <p className="tdg-planner__kicker">Question 1</p>
          <h2 id="tdg-planner-quiz-title">When are you starting?</h2>
          <div className="tdg-planner__choices" role="listbox" aria-label="When are you starting?">
            {START_OPTIONS.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={answers.start === option.id}
                key={option.id}
                className={`tdg-planner__choice${answers.start === option.id ? " is-on" : ""}`}
                onClick={() => onPickStart(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="tdg-planner__quiz-body">
          <p className="tdg-planner__kicker">Question 2</p>
          <h2 id="tdg-planner-quiz-title">What usually gets most chaotic?</h2>
          <p className="tdg-planner__micro">Choose up to two.</p>
          <div className="tdg-planner__choices" role="group" aria-label="What usually gets most chaotic?">
            {CHAOS_OPTIONS.map((option) => (
              <button
                type="button"
                aria-pressed={answers.chaos.includes(option.id)}
                key={option.id}
                className={`tdg-planner__choice${answers.chaos.includes(option.id) ? " is-on" : ""}`}
                onClick={() => onToggleChaos(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tdg-planner__btn"
            disabled={answers.chaos.length === 0}
            onClick={onContinueChaos}
          >
            Continue
          </button>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="tdg-planner__quiz-body">
          <p className="tdg-planner__kicker">Question 3</p>
          <h2 id="tdg-planner-quiz-title">This Christmas you are…</h2>
          <div className="tdg-planner__choices" role="listbox" aria-label="This Christmas you are">
            {ROLE_OPTIONS.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={answers.role === option.id}
                key={option.id}
                className={`tdg-planner__choice${answers.role === option.id ? " is-on" : ""}`}
                onClick={() => onPickRole(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ChristmasPlannerPage() {
  const [catalog, setCatalog] = useState<PlannerCatalog>(seedCatalog);
  const [packageKey, setPackageKey] = useState<string>("magic");
  const [addonKeys, setAddonKeys] = useState<string[]>([]);
  const [checkout, setCheckout] = useState<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    orderId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState<1 | 2 | 3>(1);
  const [answers, setAnswers] = useState<PlannerPersonalizationAnswers>(EMPTY_PERSONALIZATION);
  const [tab, setTab] = useState<PreviewTab>("today");
  const [packagesSeen, setPackagesSeen] = useState(false);
  const [previewSeen, setPreviewSeen] = useState(false);
  const [checkoutSeen, setCheckoutSeen] = useState(false);
  const [paymentInView, setPaymentInView] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const [teaserSeen, setTeaserSeen] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const teaserRef = useRef<HTMLElement | null>(null);
  const purchaseRef = useRef<HTMLElement | null>(null);
  const packagesRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const paymentRef = useRef<HTMLDivElement | null>(null);
  const starting = useRef(false);
  const quizHistory = useRef(false);

  const ready = personalizationComplete(answers);
  const preview = useMemo(() => (ready ? buildPersonalizedPreview(answers) : null), [answers, ready]);

  const selected = catalog.packages.find((pkg) => pkg.packageKey === packageKey) || catalog.packages[0];
  const includedAddons = isPlannerPackageKey(packageKey) ? addonsIncludedInPackage(packageKey) : [];
  const chargedAddons = addonKeys.filter((key) => !includedAddons.includes(key as never));
  const visibleAddons = catalog.addons.filter((addon) => !includedAddons.includes(addon.packageKey as never));
  const addonTotal = chargedAddons.reduce((sum, key) => {
    const addon = catalog.addons.find((row) => row.packageKey === key);
    return sum + (addon?.priceCents || 0);
  }, 0);
  const displayTotal = (selected?.priceCents || 0) + addonTotal;
  const days = preview?.daysLeft ?? daysUntilChristmasTz(new Date());

  useEffect(() => {
    ensureFonts();
    upsertJsonLd("tdg-planner-jsonld", plannerJsonLd());
    const stored = readPlannerPersonalization();
    setAnswers(stored);
    if (personalizationComplete(stored)) setQuizStep(3);
    void trackPlannerFunnel("planner_landing_view");
    void fetchPlannerCatalog()
      .then((row) => {
        setCatalog(row);
        const preferred =
          row.packages.find((pkg) => pkg.packageKey === "magic") ||
          row.packages.find((pkg) => pkg.packageKey === "all_in") ||
          row.packages[0];
        if (preferred) setPackageKey(preferred.packageKey);
      })
      .catch(() => {
        /* seed fallback keeps prices out of hardcoded checkout */
      });
  }, []);

  useEffect(() => {
    persistPlannerPersonalization(answers);
  }, [answers]);

  useEffect(() => {
    const node = packagesRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPackagesSeen(true);
          void trackPlannerFunnel("planner_package_viewed", { packageKey });
          obs.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [packageKey, ready]);

  useEffect(() => {
    const node = previewRef.current;
    if (!node || !ready || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !previewSeen) {
          setPreviewSeen(true);
          void trackPlannerFunnel("planner_preview_viewed", {
            metadata: { generated_tasks: preview?.generatedTaskCount ?? 0 },
          });
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [ready, previewSeen, preview?.generatedTaskCount]);

  useEffect(() => {
    const node = purchaseRef.current;
    if (!node || !ready || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !checkoutSeen) {
          setCheckoutSeen(true);
          void trackPlannerFunnel("planner_checkout_viewed", { packageKey, amountCents: displayTotal });
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [ready, checkoutSeen, packageKey, displayTotal]);

  useEffect(() => {
    const node = heroRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setHeroInView(entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0.45)),
      { threshold: [0.2, 0.45, 0.7] },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const node = teaserRef.current;
    if (!node || ready || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !teaserSeen) {
          setTeaserSeen(true);
          void trackPlannerFunnel("planner_teaser_viewed");
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [ready, teaserSeen]);

  useEffect(() => {
    const node = paymentRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setPaymentInView(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.35 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [ready, checkout, catalog.checkoutLive]);

  const closeQuiz = useCallback(() => {
    setQuizOpen(false);
    if (quizHistory.current && window.history.state?.plannerQuiz) {
      quizHistory.current = false;
      window.history.back();
    }
  }, []);

  const openQuiz = useCallback(() => {
    void trackPlannerFunnel("planner_build_started");
    void trackPlannerFunnel("planner_cta_clicked");
    setQuizStep(answers.start ? (answers.chaos.length ? (answers.role ? 3 : 2) : 2) : 1);
    setQuizOpen(true);
    if (!window.history.state?.plannerQuiz) {
      window.history.pushState({ plannerQuiz: true }, "", `${window.location.pathname}${window.location.search}`);
      quizHistory.current = true;
    }
  }, [answers.chaos.length, answers.role, answers.start]);

  const openQuizFromTeaser = useCallback(() => {
    void trackPlannerFunnel("planner_teaser_cta_clicked");
    openQuiz();
  }, [openQuiz]);

  useEffect(() => {
    if (!quizOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeQuiz();
    };
    const onPop = () => {
      quizHistory.current = false;
      setQuizOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, [quizOpen, closeQuiz]);

  const finishQuiz = useCallback((next: PlannerPersonalizationAnswers) => {
    setAnswers(next);
    persistPlannerPersonalization(next);
    void trackPlannerFunnel("planner_personalization_completed", { metadata: analyticsEnums(next) });
    setQuizOpen(false);
    if (quizHistory.current && window.history.state?.plannerQuiz) {
      quizHistory.current = false;
      window.history.back();
    }
    window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }, []);

  const toggleAddon = (key: string) => {
    setAddonKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key];
      void trackPlannerFunnel("planner_addon_selected", {
        packageKey,
        metadata: { addons: next },
      });
      return next;
    });
  };

  const startPay = useCallback(async () => {
    if (!catalog.checkoutLive) {
      setError("Christmas Planner launch access is opening soon.");
      void trackPlannerFunnel("planner_purchase_failed", {
        packageKey,
        metadata: { reason: "checkout_disabled" },
      });
      return;
    }
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError(null);
    void trackPlannerFunnel("planner_checkout_started", { packageKey, amountCents: displayTotal });
    try {
      const guestToken = getOrCreatePlannerGuestToken();
      const recovered = readPlannerOrderRecovery();
      const result = await startPlannerCheckout({
        packageKey,
        addonKeys: chargedAddons,
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
          ? "Christmas Planner launch access is opening soon."
          : msg,
      );
      void trackPlannerFunnel("planner_purchase_failed", {
        packageKey,
        metadata: { reason: msg.slice(0, 80) },
      });
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }, [packageKey, chargedAddons, displayTotal, catalog.checkoutLive]);

  const seo = useMemo(() => plannerSeo(), []);
  const stickyHidden = (paymentInView && ready) || (heroInView && ready);
  const stickyLabel = !ready
    ? "BUILD MY PLAN"
    : !packagesSeen
      ? "SEE MY OPTIONS"
      : `CONTINUE · ${money(displayTotal, selected?.currency || "usd")}`;

  const onSticky = () => {
    if (!ready) {
      openQuiz();
      return;
    }
    if (!packagesSeen) {
      packagesRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    purchaseRef.current?.scrollIntoView({ behavior: "smooth" });
    if (catalog.checkoutLive && !checkout) void startPay();
  };

  return (
    <div className="tdg-planner tdg-planner--compact">
      <PageHead title={seo.title} description={seo.description} url={seo.url} image={seo.image} exactTitle />

      <header className="tdg-planner__hero" ref={heroRef}>
        <div className="tdg-planner__media">
          <picture>
            <source srcSet={`${LANDING_ASSETS.cabin1280} 1280w, ${LANDING_ASSETS.cabin1920} 1920w`} type="image/webp" />
            <img
              src={LANDING_ASSETS.cabin1920Jpg}
              alt="A luxury mountain cabin living room at Christmas"
              width={1920}
              height={1080}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <div className="tdg-planner__veil" />
        </div>
        <div className="tdg-planner__hero-copy">
          <h1>
            Your entire Christmas,
            <br />
            beautifully planned.
          </h1>
          <p className="tdg-planner__lede">
            Gifts, meals, budget, family plans and everything in between — one beautiful plan.
          </p>
          <div className="tdg-planner__cta-row">
            <button type="button" className="tdg-planner__btn" onClick={openQuiz}>
              BUILD MY CHRISTMAS PLAN
            </button>
            <span className="tdg-planner__micro">Takes less than a minute.</span>
          </div>
          <p className="tdg-planner__pulse tdg-planner__pulse--single">
            {days} days left · Gifts · Budget · Food · Hosting · Traditions
          </p>
        </div>
      </header>

      {!ready ? (
        <section
          className="tdg-planner__section tdg-planner__section--cream tdg-planner__teaser"
          ref={teaserRef}
          id="preview"
        >
          <div className="tdg-planner__inner">
            <h2>Everything Christmas. One beautiful place.</h2>
            <p className="tdg-planner__teaser-line">Gifts · Budget · Meals · Hosting · Traditions · Wishlist</p>
            <div className="tdg-planner__teaser-grid">
              <TeaserDevice days={days} />
              <div className="tdg-planner__teaser-copy">
                <ul className="tdg-planner__teaser-benefits">
                  <li>Know exactly what to do next</li>
                  <li>Keep gifts and Christmas spending under control</li>
                  <li>Plan meals, hosting and the little things before they become stressful</li>
                </ul>
                <div className="tdg-planner__cta-row">
                  <button type="button" className="tdg-planner__btn" onClick={openQuizFromTeaser}>
                    BUILD MY CHRISTMAS PLAN
                  </button>
                  <span className="tdg-planner__micro">3 quick questions · Takes less than a minute</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {ready && preview ? (
        <section className="tdg-planner__section tdg-planner__section--cream" ref={previewRef} id="plan">
          <div className="tdg-planner__inner">
            <p className="tdg-planner__kicker" style={{ color: "var(--burgundy)" }}>
              Your Christmas plan is ready
            </p>
            <h2>
              {preview.daysLeft} {preview.daysLeft === 1 ? "day" : "days"} remaining
            </h2>
            <p className="tdg-planner__style">Your planning style: {preview.styleLabel}</p>
            {preview.rescueMode ? (
              <p className="tdg-planner__rescue-inline">
                Starting late? No panic. Your Planner automatically switches to Christmas Rescue Mode and shows only
                what still matters.
              </p>
            ) : (
              <p className="tdg-planner__adapt">Your plan adapts automatically as Christmas gets closer.</p>
            )}
            <p className="tdg-planner__focus-label">Your suggested starting focus:</p>
            <ol className="tdg-planner__focus">
              {preview.focus.map((task) => (
                <li key={task.template_key}>{task.title}</li>
              ))}
            </ol>
            <div className="tdg-planner__tabs" role="tablist" aria-label="Planner preview">
              {(
                [
                  ["today", "TODAY"],
                  ["gifts", "GIFTS"],
                  ["budget", "BUDGET"],
                  ["food", "FOOD"],
                  ["hosting", "HOSTING"],
                  ["more", "MORE"],
                ] as Array<[PreviewTab, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`tdg-planner__tab${tab === id ? " is-on" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="tdg-planner__device-wrap tdg-planner__device-wrap--single">
              <PreviewDevice tab={tab} preview={preview} />
            </div>
          </div>
        </section>
      ) : null}

      {ready ? (
        <section
          className="tdg-planner__section tdg-planner__section--dark"
          ref={(node) => {
            packagesRef.current = node;
            purchaseRef.current = node;
          }}
          id="packages"
        >
          <div className="tdg-planner__inner">
            <h2>Choose your Christmas</h2>
            <div className="tdg-planner__packages tdg-planner__packages--rows">
              {catalog.packages.map((pkg) => {
                const copy = PACKAGE_COPY[pkg.packageKey];
                const ribbon = copy?.ribbon || pkg.badge;
                return (
                  <button
                    type="button"
                    key={pkg.packageKey}
                    className={`tdg-planner__offer tdg-planner__offer--row${
                      pkg.packageKey === packageKey ? " is-selected" : ""
                    }`}
                    onClick={() => {
                      setPackageKey(pkg.packageKey);
                      setAddonKeys((prev) =>
                        prev.filter((key) => {
                          if (!isPlannerPackageKey(pkg.packageKey)) return true;
                          return !addonsIncludedInPackage(pkg.packageKey).includes(key as never);
                        }),
                      );
                      void trackPlannerFunnel("planner_package_selected", {
                        packageKey: pkg.packageKey,
                        amountCents: pkg.priceCents,
                      });
                    }}
                  >
                    <div className="tdg-planner__offer-top">
                      <div>
                        <h3>{pkg.packageName}</h3>
                        <p>{copy?.kicker || pkg.description}</p>
                      </div>
                      <div className="tdg-planner__price">{money(pkg.priceCents, pkg.currency)}</div>
                    </div>
                    {ribbon ? <span className="tdg-planner__badge">{ribbon}</span> : null}
                    <ul>
                      {(copy?.ticks || pkg.features.slice(0, 5)).map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <div className="tdg-planner__addons">
              <h3 className="tdg-planner__addons-title">Make it yours</h3>
              {visibleAddons.length === 0 ? (
                <p className="tdg-planner__micro">Everything in this package is already included.</p>
              ) : (
                visibleAddons.map((addon) => (
                  <label key={addon.packageKey}>
                    <input
                      type="checkbox"
                      checked={addonKeys.includes(addon.packageKey)}
                      onChange={() => toggleAddon(addon.packageKey)}
                    />
                    <span>
                      <strong>{addon.packageName}</strong>
                    </span>
                    <span className="tdg-planner__addon-price">+{money(addon.priceCents, addon.currency)}</span>
                  </label>
                ))
              )}
            </div>

            <div className="tdg-planner__checkout-panel" id="checkout" ref={paymentRef}>
              <h3 className="tdg-planner__summary-title">Your Christmas Plan</h3>
              <div className="tdg-planner__summary tdg-planner__summary--lines">
                {selected ? (
                  <div>
                    <span>{selected.packageName}</span>
                    <span>{money(selected.priceCents, selected.currency)}</span>
                  </div>
                ) : null}
                {chargedAddons.map((key) => {
                  const addon = catalog.addons.find((row) => row.packageKey === key);
                  if (!addon) return null;
                  return (
                    <div key={key}>
                      <span>{addon.packageName}</span>
                      <span>{money(addon.priceCents, addon.currency)}</span>
                    </div>
                  );
                })}
                <div className="is-total">
                  <span>Total</span>
                  <span>{money(displayTotal, selected?.currency || "usd")}</span>
                </div>
              </div>

              <p className="tdg-planner__trust-strip">
                New for Christmas 2026 · Built by The Digital Gifter.
                <span> Gift Finder · Wishlist · Christmas Cards · Christmas photo experiences</span>
              </p>

              {error ? (
                <p role="alert" className="tdg-planner__launch">
                  {error}
                </p>
              ) : null}

              {!catalog.checkoutLive ? (
                <div className="tdg-planner__launch" data-testid="planner-checkout-disabled">
                  <strong>Christmas Planner launch access is opening soon.</strong>
                  <p>
                    Apple Pay, Google Pay and card will appear here when checkout opens — only if your device actually
                    supports them.
                  </p>
                </div>
              ) : !checkout ? (
                <button type="button" className="tdg-planner__btn" disabled={busy} onClick={() => void startPay()}>
                  {busy ? "Starting checkout…" : `Pay ${money(displayTotal, selected?.currency || "usd")}`}
                </button>
              ) : (
                <div className="tdg-planner__checkout">
                  <Suspense fallback={<p className="tdg-planner__micro">Loading secure payment…</p>}>
                    <CustomStripeCheckout
                      clientSecret={checkout.clientSecret}
                      publishableKey={checkout.publishableKey}
                      dueDisplay={money(checkout.amountCents, checkout.currency || "usd")}
                      appearanceTheme="night"
                      walletCapabilityOnly
                      payButtonLabel={(due) => `Pay ${due}`}
                      onWalletAvailability={(info) => {
                        void trackPlannerFunnel("planner_wallet_presented", {
                          packageKey,
                          metadata: { applePay: info.applePay, googlePay: info.googlePay },
                        });
                      }}
                      onPaymentInteraction={() => {
                        void trackPlannerFunnel("planner_payment_submitted", {
                          packageKey,
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
        </section>
      ) : null}

      <section className="tdg-planner__section tdg-planner__section--mid tdg-planner__section--faq">
        <div className="tdg-planner__inner">
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
              and family traditions. Not a PDF. Start on your phone after a 3-question plan, then keep going in your
              account.
            </p>
          </article>
          <p className="tdg-planner__micro" style={{ marginTop: "1.25rem" }}>
            More Christmas tools live on the <Link to="/christmas">Christmas hub</Link>.
          </p>
        </div>
      </section>

      {quizOpen ? (
        <QuizLayer
          answers={answers}
          step={quizStep}
          onClose={closeQuiz}
          onPickStart={(id) => {
            const next = { ...answers, start: id };
            setAnswers(next);
            void trackPlannerFunnel("planner_personalization_q1", { metadata: { start: id } });
            setQuizStep(2);
          }}
          onToggleChaos={(id) => {
            setAnswers((prev) => ({ ...prev, chaos: toggleChaosChoice(prev.chaos, id) }));
          }}
          onContinueChaos={() => {
            void trackPlannerFunnel("planner_personalization_q2", { metadata: { chaos: answers.chaos } });
            setQuizStep(3);
          }}
          onPickRole={(id) => {
            const next = { ...answers, role: id };
            void trackPlannerFunnel("planner_personalization_q3", { metadata: { role: id } });
            finishQuiz(next);
          }}
        />
      ) : null}

      {!stickyHidden ? (
        <div className="tdg-planner__sticky">
          <div>
            <strong>{ready ? selected?.packageName || "Your plan" : "Christmas Planner"}</strong>
            <div className="tdg-planner__micro">
              {ready ? money(displayTotal, selected?.currency || "usd") : "Takes less than a minute."}
            </div>
          </div>
          <button type="button" className="tdg-planner__btn" onClick={onSticky}>
            {stickyLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

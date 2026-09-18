import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CHRISTMAS_CATALOG_SEED, findProduct } from "../catalog";
import { FONT_HREF } from "../landing/assets";
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
import { PlannerHeroScene } from "./PlannerHeroScene";
import "./planner.css";

const CustomStripeCheckout = lazy(() =>
  import("@/features/pet/components/CustomStripeCheckout").then((mod) => ({
    default: mod.CustomStripeCheckout,
  })),
);

const PACKAGE_COPY: Record<
  string,
  { audience: string; ticks: string[]; ribbon?: string }
> = {
  essentials: {
    audience: "For people who mainly want to stay organized.",
    ticks: ["Christmas plan", "Daily tasks", "Gifts", "Budget", "Shopping tracker"],
  },
  magic: {
    audience: "For families planning the full Christmas.",
    ticks: [
      "Everything in Essentials",
      "Food planner",
      "Hosting",
      "Cards",
      "Activities",
      "Travel",
      "Rescue Mode",
    ],
    ribbon: "Most popular",
  },
  all_in: {
    audience: "The complete Christmas experience.",
    ticks: [
      "Everything in Magic",
      "Recipe collection",
      "Premium content",
      "Bonus TDG Christmas benefits",
      "Future AI assistant access",
    ],
    ribbon: "Best value",
  },
};

const VALUE_ROWS = [
  {
    title: "Gifts",
    copy: "Track everyone, every idea, every order and every wrapped gift.",
  },
  {
    title: "Budget",
    copy: "Set a Christmas budget and always know what you have left.",
  },
  {
    title: "Food & recipes",
    copy: "Plan Christmas Eve, Christmas Day, recipes and one grocery list.",
  },
  {
    title: "Hosting",
    copy: "Guests, prep, home, dietary needs and the small things you usually forget.",
  },
  {
    title: "Traditions & activities",
    copy: "Markets, movie nights, family traditions, kids activities and memories.",
  },
  {
    title: "Wishlist & Gift Finder",
    copy: "Build and share wishlists and get help finding the right gift.",
  },
  {
    title: "Christmas Rescue Mode",
    copy: "Starting late? The Planner automatically focuses only on what still matters.",
  },
] as const;

type PreviewTab = "today" | "gifts" | "budget" | "food" | "hosting" | "more";

const DEMO_TABS: Array<[PreviewTab, string]> = [
  ["today", "TODAY"],
  ["gifts", "GIFTS"],
  ["budget", "BUDGET"],
  ["food", "FOOD"],
  ["hosting", "HOSTING"],
  ["more", "MORE"],
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="tdg-planner__device-row">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function DeviceShell({ title, children, note }: { title: string; children: ReactNode; note: string }) {
  return (
    <div className="tdg-planner__device tdg-planner__device--large" aria-label="Christmas Planner product preview">
      <div className="tdg-planner__device-screen">
        <div className="tdg-planner__device-brand">The Digital Gifter · Planner</div>
        <h3>{title}</h3>
        {children}
        <p className="tdg-planner__honest">{note}</p>
      </div>
    </div>
  );
}

function PreviewDevice({
  tab,
  preview,
  days,
}: {
  tab: PreviewTab;
  preview: PersonalizedPlannerPreview | null;
  days: number;
}) {
  const note = preview
    ? "Preview from your answers · live Planner fills in as you plan"
    : "Example Planner · no fake customer progress";

  if (tab === "gifts") {
    return (
      <DeviceShell title="Gifts" note={note}>
        <p className="tdg-planner__device-meta">People · ideas · ordered · arrived · wrapped</p>
        <div className="tdg-planner__device-rows">
          <Row label="People" value="Everyone you buy for, in one list" />
          <Row label="Ideas" value="Capture ideas as they appear" />
          <Row label="Ordered" value="Track what you have actually bought" />
          <Row label="Arrived" value="Know what is already in the house" />
          <Row label="Wrapped" value="Ready for the tree" />
          <Row
            label="Gift Finder"
            value={
              preview
                ? `${preview.giftTaskCount} gift ${preview.giftTaskCount === 1 ? "task" : "tasks"} in your generated plan`
                : "Help finding the right gift, beside your lists"
            }
          />
        </div>
      </DeviceShell>
    );
  }
  if (tab === "budget") {
    return (
      <DeviceShell title="Budget" note={note}>
        <p className="tdg-planner__device-meta">Planned · spent · remaining</p>
        <div className="tdg-planner__device-rows">
          <Row
            label="Planned"
            value={preview?.budgetTaskCount ? "Set-budget task is in your generated plan" : "Set a Christmas budget"}
          />
          <Row label="Spent" value="Nothing spent yet · updates as you log gifts" />
          <Row label="Remaining" value="Always know what you have left" />
        </div>
      </DeviceShell>
    );
  }
  if (tab === "food") {
    return (
      <DeviceShell title="Food" note={note}>
        <div className="tdg-planner__device-rows">
          <Row label="Christmas Eve" value="Menu, timing, prep" />
          <Row label="Christmas Day" value="The table, without the scramble" />
          <Row label="Recipes" value="Save what you actually cook" />
          <Row label="Grocery list" value="One list for the season table" />
        </div>
      </DeviceShell>
    );
  }
  if (tab === "hosting") {
    return (
      <DeviceShell title="Hosting" note={note}>
        <div className="tdg-planner__device-rows">
          <Row label="Guests" value="Who is coming, and who eats what" />
          <Row label="Prep" value="The jobs that keep the house ready" />
          <Row label="Dietary notes" value="Allergies and preferences, in one place" />
          <Row label="House prep" value="Rooms, timing, the calm bits" />
        </div>
      </DeviceShell>
    );
  }
  if (tab === "more") {
    return (
      <DeviceShell title="More" note={note}>
        <div className="tdg-planner__device-rows">
          <Row label="Travel" value="Trips, packing, timing" />
          <Row label="Cards" value="Who still needs a card" />
          <Row label="Traditions" value="The rituals you want to keep" />
          <Row label="Wishlist" value="Build and share wishlists" />
          <Row label="Activities" value="Markets, movie nights, kids days" />
          <Row label="Memories" value="Keep the season, not only the tasks" />
          <Row label="Christmas Club" value="Premium Club content where included" />
        </div>
      </DeviceShell>
    );
  }

  const next = preview?.todayTasks.length
    ? preview.todayTasks.map((task) => task.title).join(" · ")
    : "Your next three tasks appear here";
  const upcoming = preview?.upcoming.length
    ? preview.upcoming.map((task) => task.title).join(" · ")
    : "Upcoming dates appear after you start";

  return (
    <DeviceShell title="Today" note={note}>
      <div className="tdg-planner__device-count">{preview?.daysLeft ?? days}</div>
      <div className="tdg-planner__device-meta">days to Christmas</div>
      <div className="tdg-planner__device-rows">
        <Row label="Your next steps" value={next} />
        <Row label="Gifts" value="Ready to plan" />
        <Row label="Budget" value="Not set yet" />
        <Row label="Upcoming" value={upcoming} />
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
        <p className="tdg-planner__micro tdg-planner__micro--on-dark">Choose up to two.</p>
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
  const [valueSeen, setValueSeen] = useState(false);
  const [demoSeen, setDemoSeen] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const valueRef = useRef<HTMLElement | null>(null);
  const demoRef = useRef<HTMLDivElement | null>(null);
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
    const node = valueRef.current;
    if (!node || ready || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !valueSeen) {
          setValueSeen(true);
          void trackPlannerFunnel("planner_value_section_viewed");
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [ready, valueSeen]);

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
  }, [demoSeen, ready]);

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

  const onDemoTab = (id: PreviewTab) => {
    setTab(id);
    void trackPlannerFunnel("planner_demo_tab_clicked", { metadata: { tab: id } });
  };

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
  const stickyHidden = (paymentInView && ready) || (heroInView && ready) || quizOpen;
  const stickyLabel = !ready
    ? "BUILD MY PLAN"
    : !packagesSeen
      ? "SEE OPTIONS"
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

  const demoBlock = (
    <div className="tdg-planner__demo" ref={demoRef}>
      <div className="tdg-planner__tabs" role="tablist" aria-label="Planner preview">
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
        <PreviewDevice tab={tab} preview={preview} days={days} />
      </div>
    </div>
  );

  return (
    <div className="tdg-planner tdg-planner--compact">
      <PageHead title={seo.title} description={seo.description} url={seo.url} image={seo.image} exactTitle />

      <header className="tdg-planner__hero" ref={heroRef}>
        <div className="tdg-planner__media">
          <PlannerHeroScene alt="A luxury mountain cabin living room at Christmas" />
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
            <span className="tdg-planner__micro tdg-planner__micro--on-dark">
              3 quick questions · Takes less than a minute
            </span>
          </div>
          <p className="tdg-planner__live-strip">
            {days} days left · Today: 3 things · Gifts: ready to plan · Budget: not set yet
          </p>
        </div>
      </header>

      {!ready ? (
        <>
          <section
            className="tdg-planner__section tdg-planner__section--cream tdg-planner__value"
            ref={valueRef}
            id="what-you-get"
          >
            <div className="tdg-planner__inner">
              <h2>Everything you need for Christmas. In one place.</h2>
              <p className="tdg-planner__value-lead">
                No scattered notes. No forgotten gifts. No last-minute meal panic. Just one clear plan from now until
                Christmas.
              </p>
              <ul className="tdg-planner__value-list">
                {VALUE_ROWS.map((row) => (
                  <li key={row.title}>
                    <strong>{row.title}</strong>
                    <span>{row.copy}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="tdg-planner__section tdg-planner__section--mid" id="preview">
            <div className="tdg-planner__inner">
              <h2>See your Christmas before the chaos starts.</h2>
              <div className="tdg-planner__demo-layout">
                {demoBlock}
                <div className="tdg-planner__demo-cta">
                  <p className="tdg-planner__demo-cta-lead">This is the Planner. Now make it yours.</p>
                  <button type="button" className="tdg-planner__btn" onClick={openQuiz}>
                    Build Your Christmas Plan
                  </button>
                  <span className="tdg-planner__micro tdg-planner__micro--on-dark">
                    3 quick questions · Takes less than a minute
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="tdg-planner__section tdg-planner__section--cream tdg-planner__transform">
            <div className="tdg-planner__inner">
              <h2>
                Christmas should feel magical.
                <br />
                Not like project management.
              </h2>
              <div className="tdg-planner__ba">
                <div>
                  <p className="tdg-planner__kicker" style={{ color: "var(--burgundy)" }}>
                    Before
                  </p>
                  <ul>
                    <li>Notes everywhere</li>
                    <li>Forgotten gifts</li>
                    <li>Overspending</li>
                    <li>Meal planning at the last minute</li>
                    <li>Hosting stress</li>
                  </ul>
                </div>
                <div>
                  <p className="tdg-planner__kicker" style={{ color: "var(--burgundy)" }}>
                    After
                  </p>
                  <ul>
                    <li>One plan</li>
                    <li>One budget</li>
                    <li>One gift list</li>
                    <li>One meal plan</li>
                    <li>Clear next steps every day</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="tdg-planner__section tdg-planner__section--dark tdg-planner__build">
            <div className="tdg-planner__inner">
              <h2>Let’s build your Christmas.</h2>
              <div className="tdg-planner__cta-row">
                <button type="button" className="tdg-planner__btn" onClick={openQuiz}>
                  BUILD MY CHRISTMAS PLAN
                </button>
                <span className="tdg-planner__micro tdg-planner__micro--on-dark">
                  3 quick questions · Takes less than a minute
                </span>
              </div>
            </div>
          </section>
        </>
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
                Starting late? The Planner automatically focuses only on what still matters.
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
            {demoBlock}
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
                        <p>{copy?.audience || pkg.description}</p>
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
                <p className="tdg-planner__micro tdg-planner__micro--on-dark">
                  Everything in this package is already included.
                </p>
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
                Built by The Digital Gifter.
                <span> Gift Finder · Wishlist · Christmas Cards · Christmas Experiences</span>
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
          <p className="tdg-planner__micro tdg-planner__micro--on-dark" style={{ marginTop: "1.25rem" }}>
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
            <div className="tdg-planner__micro tdg-planner__micro--on-dark">
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

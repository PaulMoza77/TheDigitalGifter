import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Gift, Heart, Search, Sparkles } from "lucide-react";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { ChristmasSnowfall } from "@/features/christmas-v2/ChristmasSnowfall";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import { parseGiftRecipient } from "./landing/handoff";
import {
  OrnamentSvg,
  PineCorner,
  SnowflakeSvg,
} from "./giftFinder/GiftFinderArt";
import { gfT } from "./giftFinder/copy";
import { HERO_DEMO, EXAMPLE_SETS, findExampleForProfile, type ExampleGiftIdea } from "./giftFinder/examples";
import {
  applyGiftFinderJsonLd,
  GIFT_FINDER_FAQS,
  giftFinderSeo,
  taxonomyHref,
  SEO_TAXONOMY_LINKS,
} from "./giftFinder/seo";
import { readFinderAnswers, writeFinderAnswers } from "./giftFinder/state";
import "./giftFinder/GiftFinder.css";
import {
  AGE_RANGE_WIZARD,
  BUDGET_WIZARD,
  INTERESTS,
  PERSONALITIES,
  RANKING_ROLES,
  RECIPIENTS,
  REFINEMENT_OPTIONS,
  labelFor,
  primaryVibeFromPersonalities,
  type LocaleCode,
} from "./wishlist/taxonomy";
import {
  FINDER_SESSION_KEY,
  getOrCreateFinderGuestToken,
  readWishlistOwner,
  wishlistFunnel,
  writeWishlistOwner,
  type GiftIdea,
} from "./wishlist/wishlistApi";

const PRODUCT = "christmas_gift_finder";
const PATH = "/christmas/gift-finder";
const LOGO_SRC = "/TheDigitalGifter.png";
const TOTAL_STEPS = 6;

function exampleIdeasToGiftIdeas(ideas: ExampleGiftIdea[]): GiftIdea[] {
  return ideas.map((idea, idx) => ({
    id: `curated_${idx}_${idea.ranking_role}`,
    result_key: `curated_${idx}_${idea.ranking_role}`,
    title: idea.title,
    reason: idea.reason,
    budget_min: idea.budget_min,
    budget_max: idea.budget_max,
    currency: "usd",
    category: idea.category,
    gift_type: idea.gift_type,
    ranking_role: idea.ranking_role,
    search_query: idea.search_query,
    tdg_product_key: idea.tdg_product_key,
  }));
}

function curatedFallbackIdeas(input: {
  recipient: string;
  interests: string[];
  personalities: string[];
}): GiftIdea[] {
  const hit =
    findExampleForProfile({
      recipientKey: input.recipient,
      interestKeys: input.interests,
      personalityKeys: input.personalities,
    }) || EXAMPLE_SETS[0];
  return exampleIdeasToGiftIdeas(hit.ideas);
}

const TDG_ROUTES: Record<string, { path: string; labelKey: string }> = {
  christmas_photo: { path: "/christmas/photo-generator", labelKey: "crossSell.portrait" },
  christmas_family: { path: "/christmas/family", labelKey: "crossSell.portrait" },
  christmas_couple: { path: "/christmas/couples", labelKey: "crossSell.portrait" },
  christmas_pet: { path: "/christmas/pets", labelKey: "crossSell.portrait" },
  christmas_santa_video: { path: "/christmas/santa-video", labelKey: "crossSell.santa" },
  christmas_tree: { path: "/christmas/tree", labelKey: "crossSell.portrait" },
};

const CROSS_SELL = [
  { path: "/christmas/photo-generator", labelKey: "crossSell.portrait" as const },
  { path: "/christmas/santa-video", labelKey: "crossSell.santa" as const },
  { path: "/christmas/cards", labelKey: "crossSell.card" as const },
];

type Phase = "hero" | "wizard" | "loading" | "results";

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`gf-chip ${active ? "gf-chip--on" : ""}`}>
      {children}
    </button>
  );
}

function formatPrice(idea: GiftIdea, locale: LocaleCode): string {
  if (idea.tdg_product_key) return "TDG digital gift";
  if (idea.budget_min == null && idea.budget_max == null) return gfT("results.priceFlexible", locale);
  const symbol = idea.currency === "ron" ? "RON " : "$";
  const min = idea.budget_min ?? "?";
  const max = idea.budget_max != null ? `–${idea.budget_max}` : "+";
  return gfT("results.price", locale, { range: `${symbol}${min}${max}` });
}

function rankingLabel(role: string | null | undefined, locale: LocaleCode): string {
  if (!role) return labelFor(RANKING_ROLES, "best_match", locale);
  return labelFor(RANKING_ROLES, role, locale);
}

function shouldShowCrossSell(personalities: string[], interests: string[], recipient: string): boolean {
  if (personalities.includes("sentimental") || personalities.includes("loves_personalized")) return true;
  if (interests.includes("pets") || interests.includes("home")) return true;
  if (["partner", "wife", "husband", "girlfriend", "boyfriend", "mom", "dad"].includes(recipient)) {
    return personalities.includes("has_everything") || personalities.includes("sentimental");
  }
  return false;
}

export default function ChristmasGiftFinderPage() {
  const [params] = useSearchParams();
  const locale: LocaleCode = "en";
  const seo = giftFinderSeo(locale);
  const saved = readFinderAnswers();
  const initialRecipient =
    parseGiftRecipient(params.get("recipient") || params.get("for")) || saved?.recipient || "mom";

  const [phase, setPhase] = useState<Phase>(() => (saved?.step && saved.step > 0 ? "wizard" : "hero"));
  const [step, setStep] = useState(() => saved?.step || 1);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [age, setAge] = useState(saved?.age || "55_64");
  const [interests, setInterests] = useState<string[]>(saved?.interests || []);
  const [customInterest, setCustomInterest] = useState(saved?.customInterest || "");
  const [showCustomInterest, setShowCustomInterest] = useState(Boolean(saved?.customInterest));
  const [personalities, setPersonalities] = useState<string[]>(saved?.personalities || []);
  const [budget, setBudget] = useState(saved?.budget || "50_100");
  const [personalDetail, setPersonalDetail] = useState(saved?.personalDetail || "");
  const [refinement, setRefinement] = useState<string | null>(null);
  const [feedbackMissing, setFeedbackMissing] = useState("");
  const [showFeedbackDetail, setShowFeedbackDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<GiftIdea[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [loadingCopy, setLoadingCopy] = useState(gfT("loading.1", locale));
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const viewed = useRef(false);
  const resultsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    applyGiftFinderJsonLd(locale);
  }, [locale]);

  useEffect(() => {
    writeFinderAnswers({
      step,
      recipient,
      age,
      interests,
      customInterest,
      personalities,
      budget,
      personalDetail,
    });
  }, [step, recipient, age, interests, customInterest, personalities, budget, personalDetail]);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("gift_finder_page_view", {
      productKey: PRODUCT,
      pathname: PATH,
      locale,
    });
    try {
      const sid = sessionStorage.getItem(FINDER_SESSION_KEY);
      if (sid) {
        void wishlistFunnel<{
          ok: boolean;
          session_id: string;
          ideas: GiftIdea[];
        }>({
          action: "getGiftFinderSession",
          session_id: sid,
          guest_token: getOrCreateFinderGuestToken(),
        })
          .then((data) => {
            setSessionId(data.session_id);
            setIdeas(data.ideas || []);
            if ((data.ideas || []).length) setPhase("results");
          })
          .catch(() => undefined);
      }
    } catch {
      /* ignore */
    }

    const intent = params.get("intent");
    if (intent?.startsWith("for-")) {
      const mapped = parseGiftRecipient(intent.replace(/^for-/, ""));
      if (mapped) {
        setRecipient(mapped);
        setPhase("wizard");
        setStep(1);
      }
    }
  }, [params, locale]);

  useEffect(() => {
    if (phase !== "loading") return;
    const msgs = [gfT("loading.1", locale), gfT("loading.2", locale), gfT("loading.3", locale)];
    let i = 0;
    setLoadingCopy(msgs[0]);
    const id = window.setInterval(() => {
      i = (i + 1) % msgs.length;
      setLoadingCopy(msgs[i]);
    }, 1400);
    return () => window.clearInterval(id);
  }, [phase, locale]);

  const recipientLabel = labelFor(RECIPIENTS, recipient, locale);
  const visibleIdeas = useMemo(
    () => ideas.filter((idea) => !dismissed.has(idea.id || idea.title)),
    [ideas, dismissed],
  );
  const showCross = shouldShowCrossSell(personalities, interests, recipient);

  function toggleInterest(key: string) {
    setInterests((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 6) return prev;
      return [...prev, key];
    });
  }

  function togglePersonality(key: string) {
    setPersonalities((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 6) return prev;
      return [...prev, key];
    });
  }

  function canContinue(): boolean {
    if (step === 1) return Boolean(recipient);
    if (step === 2) return Boolean(age);
    if (step === 3) return interests.length > 0 || customInterest.trim().length > 0;
    if (step === 4) return personalities.length > 0;
    if (step === 5) return Boolean(budget);
    return true;
  }

  async function generate(opts?: { forceNew?: boolean; refinementKey?: string | null }) {
    setPhase("loading");
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    setDismissed(new Set());
    try {
      void trackChristmasEvent("gift_finder_started", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: { recipient_key: recipient },
      });
      const data = await wishlistFunnel<{
        ok: boolean;
        session_id: string;
        ideas: GiftIdea[];
        provider: string;
        model: string;
      }>(
        {
          action: "runGiftFinder",
          guest_token: getOrCreateFinderGuestToken(),
          locale,
          recipient_key: recipient,
          age_range_key: age,
          interest_keys: interests,
          custom_interest: customInterest,
          // Privacy: sent to generation only — never included in analytics metadata.
          personal_detail: personalDetail.slice(0, 280),
          personality_keys: personalities,
          budget_key: budget,
          gift_type_key: "either",
          vibe_key: primaryVibeFromPersonalities(personalities),
          refinement_key: opts?.refinementKey || refinement || null,
          force_new: Boolean(opts?.forceNew || opts?.refinementKey),
        },
        await authBearer(),
      );
      setSessionId(data.session_id);
      setIdeas(data.ideas || []);
      try {
        sessionStorage.setItem(FINDER_SESSION_KEY, data.session_id);
      } catch {
        /* ignore */
      }
      void trackChristmasEvent("gift_finder_completed", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: {
          recipient_key: recipient,
          budget_key: budget,
          interest_count: interests.length,
          personality_count: personalities.length,
        },
      });
      void trackChristmasEvent("gift_finder_results_viewed", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: { result_count: (data.ideas || []).length },
      });
      setPhase("results");
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not find ideas";
      // Resilience: show curated example matches when the live finder is unavailable.
      const fallback = curatedFallbackIdeas({ recipient, interests, personalities });
      if (fallback.length >= 3) {
        setIdeas(fallback);
        setSessionId(null);
        void trackChristmasEvent("gift_finder_completed", {
          productKey: PRODUCT,
          pathname: PATH,
          locale,
          metadata: { provider: "client_curated_fallback", recipient_key: recipient },
        });
        void trackChristmasEvent("gift_finder_results_viewed", {
          productKey: PRODUCT,
          pathname: PATH,
          locale,
          metadata: { result_count: fallback.length, provider: "client_curated_fallback" },
        });
        setPhase("results");
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else {
        setError(msg.includes("rate_limited") ? gfT("error.rate", locale) : gfT("error.generic", locale));
        void trackChristmasEvent("gift_finder_failed", {
          productKey: PRODUCT,
          pathname: PATH,
          locale,
        });
        setPhase("wizard");
        setStep(6);
      }
    } finally {
      setBusy(false);
    }
  }

  async function addToWishlist(idea: GiftIdea) {
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      let recovery = readWishlistOwner();
      let wishlistId = recovery?.wishlistId;
      let ownerToken = recovery?.ownerToken || null;
      const bearer = await authBearer();

      if (!wishlistId) {
        const created = await wishlistFunnel<{
          ok: boolean;
          wishlist_id: string;
          share_id: string;
          owner_token: string | null;
        }>(
          {
            action: "createWishlist",
            title: "My Christmas Wishlist",
            description: "Ideas from Gift Finder",
          },
          bearer,
        );
        wishlistId = created.wishlist_id;
        ownerToken = created.owner_token;
        if (created.owner_token) {
          writeWishlistOwner({
            wishlistId: created.wishlist_id,
            ownerToken: created.owner_token,
            shareId: created.share_id,
          });
        }
      }

      await wishlistFunnel(
        {
          action: "addWishlistItem",
          wishlist_id: wishlistId,
          owner_token: ownerToken || undefined,
          title: idea.title,
          note: idea.reason,
          source_type: "gift_finder",
          source_ref: idea.result_key || idea.id,
          budget_amount: idea.budget_max ?? idea.budget_min,
          currency: idea.currency || "usd",
        },
        bearer,
      );
      setSavedMsg(gfT("results.saved", locale));
      void trackChristmasEvent("gift_finder_to_wishlist", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
      });
      void trackChristmasEvent("wishlist_from_finder_item_added", {
        productKey: "christmas_wishlist",
        pathname: PATH,
        locale,
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Could not save to wishlist";
      setError(
        /failed to fetch|network|supabase/i.test(raw)
          ? "We couldn’t reach your wishlist just now. Please try again in a moment."
          : raw,
      );
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    if (!canContinue()) return;
    if (step === 1) {
      void trackChristmasEvent("gift_finder_recipient_selected", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: { recipient_key: recipient },
      });
    }
    if (step === 3) {
      void trackChristmasEvent("gift_finder_interests_selected", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: { interest_count: interests.length },
      });
    }
    if (step === 4) {
      void trackChristmasEvent("gift_finder_personality_selected", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: { personality_count: personalities.length },
      });
    }
    if (step === 5) {
      void trackChristmasEvent("gift_finder_budget_selected", {
        productKey: PRODUCT,
        pathname: PATH,
        locale,
        metadata: { budget_key: budget },
      });
    }
    if (step >= TOTAL_STEPS) {
      void generate();
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function startWizard() {
    setPhase("wizard");
    setStep(1);
  }

  return (
    <div className="gf-page">
      <ChristmasPageHead path="/christmas/gift-finder" image={seo.image} />
      <ChristmasSnowfall />
      <div className="gf-glow gf-glow--left" aria-hidden="true" />
      <div className="gf-glow gf-glow--right" aria-hidden="true" />
      <PineCorner className="gf-pine gf-pine--left" style={{ position: "absolute", left: "-1.5rem", top: "11rem", width: "8rem", opacity: 0.45, zIndex: 2, pointerEvents: "none" }} />
      <PineCorner className="gf-pine gf-pine--right" style={{ position: "absolute", right: "-2rem", top: "18rem", width: "8rem", opacity: 0.35, zIndex: 2, pointerEvents: "none", transform: "scaleX(-1)" }} />
      <OrnamentSvg style={{ position: "absolute", right: "12%", top: "5.5rem", width: "2rem", zIndex: 2, pointerEvents: "none" }} />
      <SnowflakeSvg style={{ position: "absolute", left: "16%", top: "7rem", width: "1.1rem", zIndex: 2, color: "rgba(246,239,227,0.35)", pointerEvents: "none" }} />

      <div className="gf-shell">
        <nav className="gf-breadcrumb" aria-label="Breadcrumb">
          <Link to="/christmas">{gfT("breadcrumb.christmas", locale)}</Link>
          <span aria-hidden="true">/</span>
          <span>{gfT("breadcrumb.finder", locale)}</span>
        </nav>

        {phase === "hero" ? (
          <section className="gf-hero">
            <div className="mb-3 flex justify-center">
              <img
                src={LOGO_SRC}
                alt="The Digital Gifter"
                width={56}
                height={56}
                decoding="async"
                fetchPriority="high"
                className="h-14 w-14 rounded-full object-cover ring-1 ring-[#d4b36a]/50"
              />
            </div>
            <p className="gf-display gf-hero__brand">{gfT("brand.name", locale)}</p>
            <p className="gf-hero__kicker">{gfT("hero.kicker", locale)}</p>
            <h1 className="gf-display">{gfT("hero.h1", locale)}</h1>
            <p className="gf-hero__sub">{gfT("hero.sub", locale)}</p>
            <div className="gf-hero__cta">
              <button type="button" className="gf-cta" onClick={startWizard}>
                <Gift className="h-5 w-5" aria-hidden="true" />
                {gfT("hero.cta", locale)}
              </button>
            </div>
            <div className="gf-demo" aria-label="Example result preview">
              <p>{gfT("hero.demo.for", locale)}</p>
              <p>{gfT("hero.demo.loves", locale)}</p>
              <p>{gfT("hero.demo.budget", locale)}</p>
              <p className="gf-demo__match">{gfT("hero.demo.match", locale)}</p>
              <p>{gfT("hero.demo.why", locale)}</p>
              <p className="gf-demo__note">{gfT("hero.demo.note", locale)}</p>
            </div>
            <p className="mt-4">
              <Link to="/christmas/wishlist" className="inline-flex items-center gap-1.5 text-sm text-[rgba(246,239,227,0.65)] hover:text-[#f6efe3]">
                <Heart className="h-4 w-4" aria-hidden="true" />
                {gfT("nav.openWishlist", locale)}
              </Link>
            </p>
            {/* Keep hero demo data referenced for future live swap */}
            <span className="sr-only">{HERO_DEMO.ideas[0]?.title}</span>
          </section>
        ) : null}

        {phase === "wizard" ? (
          <section className="gf-stage" aria-label="Gift finder questions">
            <div className="gf-progress">
              <p className="gf-progress__text" aria-live="polite">
                {gfT("progress.of", locale, { current: String(step), total: String(TOTAL_STEPS) })}
              </p>
              <div className="gf-progress__marks" aria-hidden="true">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <span key={i} className={`gf-progress__mark ${i < step ? "is-on" : ""}`} />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="gf-step"
              >
                {step === 1 ? (
                  <>
                    <h2 className="gf-display">{gfT("step.recipient.title", locale)}</h2>
                    <div className="gf-chips" role="group" aria-label={gfT("step.recipient.title", locale)}>
                      {RECIPIENTS.map((r) => (
                        <Chip
                          key={r.key}
                          active={recipient === r.key}
                          onClick={() => setRecipient(r.key)}
                        >
                          {labelFor(RECIPIENTS, r.key, locale)}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <h2 className="gf-display">{gfT("step.age.title", locale)}</h2>
                    <div className="gf-chips" role="group" aria-label={gfT("step.age.title", locale)}>
                      {AGE_RANGE_WIZARD.map((a) => (
                        <Chip key={a.key} active={age === a.key} onClick={() => setAge(a.key)}>
                          {labelFor(AGE_RANGE_WIZARD, a.key, locale)}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <h2 className="gf-display">{gfT("step.interests.title", locale)}</h2>
                    <p className="gf-step__hint">{gfT("step.interests.hint", locale)}</p>
                    <div className="gf-chips" role="group" aria-label={gfT("step.interests.title", locale)}>
                      {INTERESTS.map((i) => (
                        <Chip
                          key={i.key}
                          active={interests.includes(i.key)}
                          onClick={() => toggleInterest(i.key)}
                        >
                          {labelFor(INTERESTS, i.key, locale)}
                        </Chip>
                      ))}
                      <Chip
                        active={showCustomInterest}
                        onClick={() => setShowCustomInterest((v) => !v)}
                      >
                        {gfT("step.interests.other", locale)}
                      </Chip>
                    </div>
                    {showCustomInterest ? (
                      <input
                        className="gf-input"
                        maxLength={120}
                        value={customInterest}
                        onChange={(e) => setCustomInterest(e.target.value)}
                        placeholder={gfT("step.interests.otherPlaceholder", locale)}
                        aria-label={gfT("step.interests.otherPlaceholder", locale)}
                      />
                    ) : null}
                  </>
                ) : null}

                {step === 4 ? (
                  <>
                    <h2 className="gf-display">{gfT("step.personality.title", locale)}</h2>
                    <p className="gf-step__hint">{gfT("step.personality.hint", locale)}</p>
                    <div className="gf-chips" role="group" aria-label={gfT("step.personality.title", locale)}>
                      {PERSONALITIES.map((p) => (
                        <Chip
                          key={p.key}
                          active={personalities.includes(p.key)}
                          onClick={() => togglePersonality(p.key)}
                        >
                          {labelFor(PERSONALITIES, p.key, locale)}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : null}

                {step === 5 ? (
                  <>
                    <h2 className="gf-display">{gfT("step.budget.title", locale)}</h2>
                    <div className="gf-chips" role="group" aria-label={gfT("step.budget.title", locale)}>
                      {BUDGET_WIZARD.map((b) => (
                        <Chip key={b.key} active={budget === b.key} onClick={() => setBudget(b.key)}>
                          {labelFor(BUDGET_WIZARD, b.key, locale)}
                        </Chip>
                      ))}
                    </div>
                  </>
                ) : null}

                {step === 6 ? (
                  <>
                    <h2 className="gf-display">{gfT("step.detail.title", locale)}</h2>
                    <p className="gf-step__hint">{gfT("step.detail.optional", locale)}</p>
                    <textarea
                      className="gf-textarea"
                      maxLength={280}
                      value={personalDetail}
                      onChange={(e) => setPersonalDetail(e.target.value)}
                      placeholder={gfT("step.detail.placeholder", locale)}
                      aria-label={gfT("step.detail.title", locale)}
                    />
                    <p className="gf-step__hint">{gfT("step.detail.examples", locale)}</p>
                  </>
                ) : null}
              </motion.div>
            </AnimatePresence>

            {error ? (
              <p className="gf-alert" role="alert">
                {error}
              </p>
            ) : null}

            <div className="gf-actions">
              {step > 1 ? (
                <button
                  type="button"
                  className="gf-btn"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {gfT("nav.back", locale)}
                </button>
              ) : (
                <button type="button" className="gf-btn" onClick={() => setPhase("hero")}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {gfT("nav.back", locale)}
                </button>
              )}
              {step === 6 ? (
                <>
                  <button
                    type="button"
                    className="gf-btn"
                    disabled={busy}
                    onClick={() => {
                      setPersonalDetail("");
                      void generate();
                    }}
                  >
                    {gfT("nav.skip", locale)}
                  </button>
                  <button
                    type="button"
                    className="gf-cta"
                    disabled={busy}
                    onClick={() => void generate()}
                  >
                    <Gift className="h-5 w-5" aria-hidden="true" />
                    {gfT("nav.find", locale)}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="gf-cta"
                  disabled={!canContinue() || busy}
                  onClick={goNext}
                >
                  {gfT("nav.continue", locale)}
                </button>
              )}
            </div>
          </section>
        ) : null}

        {phase === "loading" ? (
          <div className="gf-loading" role="status" aria-live="polite">
            <div className="gf-loading__ornament" aria-hidden="true" />
            <p className="gf-display">{loadingCopy}</p>
          </div>
        ) : null}

        {phase === "results" ? (
          <section className="gf-results" ref={resultsRef} aria-label="Gift recommendations">
            <div className="gf-results__head">
              <div>
                <p className="gf-progress__text">{gfT("hero.kicker", locale)}</p>
                <h2 className="gf-display">
                  {gfT("results.title", locale, { recipient: recipientLabel })}
                </h2>
              </div>
              <button
                type="button"
                className="gf-btn-ghost"
                onClick={() => {
                  setPhase("wizard");
                  setStep(4);
                }}
              >
                {gfT("nav.refine", locale)}
              </button>
            </div>

            {error ? (
              <p className="gf-alert" role="alert">
                {error}
              </p>
            ) : null}
            {savedMsg ? <p className="gf-ok">{savedMsg}</p> : null}

            {visibleIdeas.length === 0 ? (
              <div className="gf-alert" role="status">
                <p>{gfT("error.generic", locale)}</p>
                <button
                  type="button"
                  className="gf-cta mt-3"
                  onClick={() => {
                    setPhase("wizard");
                    setStep(3);
                  }}
                >
                  {gfT("nav.refine", locale)}
                </button>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {visibleIdeas.map((idea, index) => {
                  const tdg = idea.tdg_product_key ? TDG_ROUTES[idea.tdg_product_key] : null;
                  return (
                    <motion.li
                      key={idea.id || `${idea.title}-${index}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.25) }}
                    >
                      <article className="gf-idea">
                        <div className="gf-idea__meta">
                          <span className="gf-idea__role">
                            {rankingLabel(idea.ranking_role, locale)}
                          </span>
                          <span className="gf-idea__type">
                            {idea.gift_type || idea.category || gfT("results.ideaOnly", locale)}
                          </span>
                        </div>
                        <h3 className="gf-display">{idea.title}</h3>
                        <p className="gf-idea__why">
                          <strong>{gfT("results.why", locale)}</strong>
                          {idea.reason}
                        </p>
                        <p className="gf-idea__price">{formatPrice(idea, locale)}</p>
                        <div className="gf-idea__actions">
                          {tdg ? (
                            <Link
                              className="gf-btn-primary"
                              to={tdg.path}
                              onClick={() =>
                                void trackChristmasEvent("gift_finder_tdg_cross_sell_clicked", {
                                  productKey: PRODUCT,
                                  pathname: PATH,
                                  locale,
                                  metadata: { tdg_product_key: idea.tdg_product_key },
                                })
                              }
                            >
                              <Sparkles className="h-4 w-4" aria-hidden="true" />
                              {gfT(tdg.labelKey, locale)}
                            </Link>
                          ) : idea.search_query ? (
                            <a
                              className="gf-btn-ghost"
                              href={`https://www.google.com/search?q=${encodeURIComponent(idea.search_query)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={gfT("results.shopLater", locale)}
                              onClick={() =>
                                void trackChristmasEvent("gift_finder_result_clicked", {
                                  productKey: PRODUCT,
                                  pathname: PATH,
                                  locale,
                                  metadata: { action: "see_gift_search" },
                                })
                              }
                            >
                              <Search className="h-4 w-4" aria-hidden="true" />
                              {gfT("results.seeGift", locale)}
                            </a>
                          ) : (
                            <button type="button" className="gf-btn-ghost is-disabled" disabled>
                              {gfT("results.seeGift", locale)}
                            </button>
                          )}
                          <button
                            type="button"
                            className="gf-btn-primary"
                            disabled={busy}
                            onClick={() => void addToWishlist(idea)}
                          >
                            <Heart className="h-4 w-4" aria-hidden="true" />
                            {gfT("results.save", locale)}
                          </button>
                          <button
                            type="button"
                            className="gf-btn-ghost"
                            disabled={busy}
                            onClick={() => {
                              void trackChristmasEvent("gift_finder_more_like_this", {
                                productKey: PRODUCT,
                                pathname: PATH,
                                locale,
                              });
                              setRefinement("more_unique");
                              void generate({ forceNew: true, refinementKey: "more_unique" });
                            }}
                          >
                            {gfT("results.moreLike", locale)}
                          </button>
                          <button
                            type="button"
                            className="gf-btn-ghost"
                            onClick={() => {
                              setDismissed((prev) => new Set(prev).add(idea.id || idea.title));
                            }}
                          >
                            {gfT("results.notForThem", locale)}
                          </button>
                        </div>
                      </article>
                    </motion.li>
                  );
                })}
              </ul>
            )}

            <div className="gf-feedback">
              <h3 className="gf-display">{gfT("feedback.title", locale)}</h3>
              <div className="gf-chips">
                {REFINEMENT_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.key}
                    active={refinement === opt.key}
                    onClick={() => {
                      setRefinement(opt.key);
                      void generate({ forceNew: true, refinementKey: opt.key });
                    }}
                  >
                    {labelFor(REFINEMENT_OPTIONS, opt.key, locale)}
                  </Chip>
                ))}
                <Chip
                  active={showFeedbackDetail}
                  onClick={() => {
                    setShowFeedbackDetail(true);
                    void trackChristmasEvent("gift_finder_feedback_negative", {
                      productKey: PRODUCT,
                      pathname: PATH,
                      locale,
                    });
                  }}
                >
                  {gfT("feedback.none", locale)}
                </Chip>
              </div>
              {showFeedbackDetail ? (
                <div>
                  <label className="gf-step__hint" htmlFor="gf-missing">
                    {gfT("feedback.missing", locale)}
                  </label>
                  <textarea
                    id="gf-missing"
                    className="gf-textarea"
                    maxLength={200}
                    value={feedbackMissing}
                    onChange={(e) => setFeedbackMissing(e.target.value)}
                    placeholder={gfT("feedback.missingPlaceholder", locale)}
                  />
                  <button
                    type="button"
                    className="gf-cta mt-3"
                    disabled={busy || !feedbackMissing.trim()}
                    onClick={() => {
                      // Use as custom interest refinement without sending free-text to analytics.
                      setCustomInterest((prev) => prev || feedbackMissing.trim().slice(0, 120));
                      setPersonalDetail((prev) => prev || feedbackMissing.trim().slice(0, 280));
                      void generate({ forceNew: true, refinementKey: "more_personal" });
                      setShowFeedbackDetail(false);
                    }}
                  >
                    {gfT("feedback.apply", locale)}
                  </button>
                </div>
              ) : null}
            </div>

            {showCross ? (
              <div className="gf-cross">
                <h3 className="gf-display">{gfT("crossSell.title", locale)}</h3>
                <div className="gf-cross__links">
                  {CROSS_SELL.map((item) => (
                    <Link
                      key={item.path}
                      className="gf-btn-ghost"
                      to={item.path}
                      onClick={() =>
                        void trackChristmasEvent("gift_finder_tdg_cross_sell_clicked", {
                          productKey: PRODUCT,
                          pathname: PATH,
                          locale,
                          metadata: { path: item.path },
                        })
                      }
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      {gfT(item.labelKey, locale)}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/christmas/wishlist" className="gf-btn-primary">
                <Heart className="h-4 w-4" aria-hidden="true" />
                {gfT("nav.openWishlist", locale)}
              </Link>
              <button
                type="button"
                className="gf-btn-ghost"
                onClick={() => {
                  setPhase("wizard");
                  setStep(1);
                  setIdeas([]);
                }}
              >
                {gfT("nav.restart", locale)}
              </button>
            </div>
            {sessionId ? <span className="sr-only">Session {sessionId}</span> : null}
          </section>
        ) : null}

        <div className="gf-seo">
          <section>
            <h2 className="gf-display">{gfT("seo.geo.title", locale)}</h2>
            <p>{gfT("seo.geo.body", locale)}</p>
          </section>

          <section>
            <h2 className="gf-display">{gfT("seo.section.how", locale)}</h2>
            <p>{gfT("seo.section.howBody", locale)}</p>
            <ol>
              <li>Who you’re shopping for</li>
              <li>Interests and personality</li>
              <li>Budget range</li>
              <li>Personalized gift ideas with reasons</li>
            </ol>
          </section>

          <section>
            <h2 className="gf-display">{gfT("seo.section.recipient", locale)}</h2>
            <p>
              Recipient-specific landing pages are not live yet. Start the finder and choose Mom,
              Dad, wife, husband, girlfriend, boyfriend, kids, teens, grandparents, friends,
              coworkers, and more inside the tool.
            </p>
            <ul>
              {SEO_TAXONOMY_LINKS.byRecipient.map((link) => (
                <li key={link.slug}>
                  <Link to={taxonomyHref(link.slug)}>{link.labelEn}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="gf-display">{gfT("seo.section.budget", locale)}</h2>
            <p>
              Recommendations use typical price ranges for gift ideas — not live retailer inventory
              or guaranteed stock.
            </p>
            <ul>
              {SEO_TAXONOMY_LINKS.byBudget.map((link) => (
                <li key={link.slug}>
                  <Link to={taxonomyHref(link.slug)}>{link.labelEn}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="gf-display">{gfT("seo.section.hasEverything", locale)}</h2>
            <p>{gfT("seo.section.hasEverythingBody", locale)}</p>
            <p>
              <Link to={taxonomyHref("for-someone-who-has-everything")}>
                Start with “someone who has everything”
              </Link>
            </p>
          </section>

          <section>
            <h2 className="gf-display">{gfT("seo.section.wishlist", locale)}</h2>
            <p>{gfT("seo.section.wishlistBody", locale)}</p>
            <p>
              <Link to="/christmas/wishlist">Open the Christmas Wishlist Maker</Link>
            </p>
          </section>

          <section>
            <h2 className="gf-display">{gfT("seo.section.personality", locale)}</h2>
            <ul>
              {SEO_TAXONOMY_LINKS.byPersonality.map((link) => (
                <li key={link.slug}>
                  <Link to={taxonomyHref(link.slug)}>{link.labelEn}</Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="gf-display">{gfT("seo.faq.title", locale)}</h2>
            {GIFT_FINDER_FAQS.map((item) => (
              <div key={item.q}>
                <h3 className="gf-display">{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

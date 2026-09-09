import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parseGiftRecipient } from "./landing/handoff";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Heart, RefreshCw, Search, Sparkles } from "lucide-react";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { ChristmasSnowfall } from "@/features/christmas-v2/ChristmasSnowfall";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import {
  GiftIdeaArt,
  OrnamentSvg,
  PineCorner,
  SnowflakeSvg,
  resolveGiftArtKey,
} from "./giftFinder/GiftFinderArt";
import {
  AGE_RANGES,
  BUDGETS,
  GIFT_TYPES,
  INTERESTS,
  RECIPIENTS,
  VIBES,
  labelFor,
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

const TDG_ROUTES: Record<string, { path: string; label: string }> = {
  christmas_photo: { path: "/christmas/photo-generator", label: "Create Christmas Portrait" },
  christmas_family: { path: "/christmas/family", label: "Create Family Portrait" },
  christmas_couple: { path: "/christmas/couples", label: "Create Couples Portrait" },
  christmas_pet: { path: "/christmas/pets", label: "Create Pet Portrait" },
  christmas_santa_video: { path: "/christmas/santa-video", label: "Create Santa Video" },
  christmas_tree: { path: "/christmas/tree", label: "Build a Christmas Tree" },
};

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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`gf-chip ${active ? "gf-chip--on" : ""}`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <legend className="gf-label">{children}</legend>;
}

export default function ChristmasGiftFinderPage() {
  const resultsId = useId();
  const [params] = useSearchParams();
  const [locale] = useState<LocaleCode>("en");
  const [recipient, setRecipient] = useState(
    () => parseGiftRecipient(params.get("recipient") || params.get("for")) || "mom",
  );
  const [age, setAge] = useState("45_54");
  const [interests, setInterests] = useState<string[]>(["gardening", "cooking"]);
  const [customInterest, setCustomInterest] = useState("");
  const [budget, setBudget] = useState("50_100");
  const [giftType, setGiftType] = useState("either");
  const [vibe, setVibe] = useState("cozy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<GiftIdea[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
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
    setFontsReady(true);
  }, []);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("gift_finder_started", {
      productKey: PRODUCT,
      pathname: PATH,
    });
    try {
      const sid = sessionStorage.getItem(FINDER_SESSION_KEY);
      if (sid) {
        void wishlistFunnel<{
          ok: boolean;
          session_id: string;
          ideas: GiftIdea[];
          provider?: string;
          model?: string;
        }>({
          action: "getGiftFinderSession",
          session_id: sid,
          guest_token: getOrCreateFinderGuestToken(),
        })
          .then((data) => {
            setSessionId(data.session_id);
            setIdeas(data.ideas || []);
          })
          .catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function toggleInterest(key: string) {
    setInterests((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 6) return prev;
      return [...prev, key];
    });
  }

  async function generate(forceNew = false) {
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const data = await wishlistFunnel<{
        ok: boolean;
        session_id: string;
        ideas: GiftIdea[];
        provider: string;
        model: string;
        latency_ms?: number;
        already?: boolean;
      }>(
        {
          action: "runGiftFinder",
          guest_token: getOrCreateFinderGuestToken(),
          locale,
          recipient_key: recipient,
          age_range_key: age,
          interest_keys: interests,
          custom_interest: customInterest,
          budget_key: budget,
          gift_type_key: giftType,
          vibe_key: vibe,
          force_new: forceNew,
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
      });
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not find ideas";
      setError(msg.includes("rate_limited") ? "Please wait a bit before searching again." : msg);
      void trackChristmasEvent("gift_finder_failed" as never, {
        productKey: PRODUCT,
        pathname: PATH,
      });
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
      setSavedMsg(`Saved “${idea.title}” to your wishlist`);
      void trackChristmasEvent("gift_finder_to_wishlist" as never, {
        productKey: PRODUCT,
        pathname: PATH,
      });
      void trackChristmasEvent("wishlist_from_finder_item_added" as never, {
        productKey: "christmas_wishlist",
        pathname: PATH,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save to wishlist");
    } finally {
      setBusy(false);
    }
  }

  const recipientLabel = labelFor(RECIPIENTS, recipient, locale);

  return (
    <div className={`gf-page ${fontsReady ? "gf-page--fonts" : ""}`}>
      <PageHead
        title="Christmas Gift Finder"
        description="Find a Christmas gift they'll actually love — guided ideas for any recipient and budget."
      />
      <ChristmasSnowfall />

      <div className="gf-glow gf-glow--left" aria-hidden="true" />
      <div className="gf-glow gf-glow--right" aria-hidden="true" />
      <PineCorner className="gf-pine gf-pine--left" />
      <PineCorner className="gf-pine gf-pine--right" />
      <OrnamentSvg className="gf-ornament gf-ornament--a" />
      <OrnamentSvg className="gf-ornament gf-ornament--b" />
      <SnowflakeSvg className="gf-flake gf-flake--a" />
      <SnowflakeSvg className="gf-flake gf-flake--b" />
      <SnowflakeSvg className="gf-flake gf-flake--c" />

      <div className="relative z-[3] mx-auto max-w-2xl px-4 pb-24 pt-5 sm:px-6">
        <section className="relative mt-4 overflow-hidden px-1 pb-2 pt-2 sm:mt-6">
          <div className="gf-hero-wash" aria-hidden="true" />
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative text-center"
          >
            <div className="mb-4 flex items-center justify-center gap-3">
              <img
                src={LOGO_SRC}
                alt=""
                width={52}
                height={52}
                decoding="async"
                fetchPriority="high"
                className="h-12 w-12 rounded-full object-cover ring-1 ring-[#D4A017]/50 shadow-[0_0_28px_rgba(212,160,23,0.4)] sm:h-14 sm:w-14"
              />
            </div>
            <p className="gf-display text-2xl font-semibold tracking-tight text-[#F7F0E4] sm:text-3xl">
              The Digital Gifter
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#F3D98A]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Christmas Gift Finder
            </p>
            <h1 className="gf-display mx-auto mt-3 max-w-xl text-[2rem] font-semibold leading-[1.08] tracking-tight text-[#F7F0E4] sm:text-[2.75rem]">
              Find gifts they’ll actually love
            </h1>
            <p className="mx-auto mt-3 max-w-md text-base leading-7 text-[#F7F0E4]/72 sm:text-lg">
              A few festive picks. Thoughtful ideas in under a minute — no endless scrolling.
            </p>
            <Link
              to="/christmas/wishlist"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#F7F0E4]/65 transition hover:text-[#F7F0E4]"
            >
              <Heart className="h-4 w-4" aria-hidden="true" />
              Open Wishlist
            </Link>
          </motion.div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="gf-panel mt-7 space-y-6 p-5 sm:p-6"
          aria-label="Gift finder form"
        >
          <fieldset>
            <FieldLabel>Who is it for?</FieldLabel>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {RECIPIENTS.map((r) => (
                <Chip key={r.key} active={recipient === r.key} onClick={() => setRecipient(r.key)}>
                  {labelFor(RECIPIENTS, r.key, locale)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="gf-label">Age range</span>
            <select
              className="gf-select mt-2"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            >
              {AGE_RANGES.map((a) => (
                <option key={a.key} value={a.key}>
                  {labelFor(AGE_RANGES, a.key, locale)}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <FieldLabel>Interests (pick up to 6)</FieldLabel>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <Chip
                  key={i.key}
                  active={interests.includes(i.key)}
                  onClick={() => toggleInterest(i.key)}
                >
                  {labelFor(INTERESTS, i.key, locale)}
                </Chip>
              ))}
            </div>
            <input
              className="gf-input mt-3"
              placeholder="Optional custom interest"
              maxLength={120}
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
            />
          </fieldset>

          <fieldset>
            <FieldLabel>Budget</FieldLabel>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <Chip key={b.key} active={budget === b.key} onClick={() => setBudget(b.key)}>
                  {labelFor(BUDGETS, b.key, locale)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset>
              <FieldLabel>Gift type</FieldLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {GIFT_TYPES.map((g) => (
                  <Chip key={g.key} active={giftType === g.key} onClick={() => setGiftType(g.key)}>
                    {labelFor(GIFT_TYPES, g.key, locale)}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <FieldLabel>Vibe</FieldLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {VIBES.map((v) => (
                  <Chip key={v.key} active={vibe === v.key} onClick={() => setVibe(v.key)}>
                    {labelFor(VIBES, v.key, locale)}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void generate(false)}
            className="gf-cta group"
          >
            <Gift className="h-5 w-5 transition group-hover:scale-110" aria-hidden="true" />
            {busy ? "Finding thoughtful ideas…" : `Find gift ideas for ${recipientLabel}`}
          </button>
        </motion.section>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#7f1d1d]/55 px-4 py-3 text-sm text-[#fecaca]" role="alert">
            {error}
          </p>
        ) : null}
        {savedMsg ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#A7F3D0]">
            <Heart className="h-4 w-4" aria-hidden="true" />
            {savedMsg}
          </p>
        ) : null}

        <AnimatePresence>
          {ideas.length > 0 ? (
            <motion.section
              id={resultsId}
              ref={resultsRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="mt-10"
              aria-label="Gift ideas"
            >
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F3D98A]/80">
                    Curated for {recipientLabel}
                  </p>
                  <h2 className="gf-display mt-1 text-3xl font-semibold text-[#F7F0E4]">Ideas for you</h2>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-[#F7F0E4]/70 underline-offset-2 hover:text-[#F7F0E4] hover:underline disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void generate(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Try different ideas
                </button>
              </div>

              <ul className="space-y-4">
                {ideas.map((idea, index) => {
                  const tdg = idea.tdg_product_key ? TDG_ROUTES[idea.tdg_product_key] : null;
                  const artKey = resolveGiftArtKey(idea);
                  const budgetLabel = idea.tdg_product_key
                    ? "TDG digital gift"
                    : idea.budget_min != null || idea.budget_max != null
                      ? `Typical budget: ${idea.currency === "ron" ? "RON" : "$"}${idea.budget_min ?? "?"}${
                          idea.budget_max != null ? `–${idea.budget_max}` : "+"
                        }`
                      : "Budget flexible";

                  return (
                    <motion.li
                      key={idea.id || `${idea.title}-${index}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.3) }}
                    >
                      <article className="gf-idea">
                        <GiftIdeaArt
                          artKey={artKey}
                          seed={idea.title}
                          className="gf-idea__art"
                        />
                        <div className="gf-idea__body">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="gf-idea__tag">{idea.category || "gift"}</span>
                            <span className="text-xs text-[#F7F0E4]/45">{budgetLabel}</span>
                          </div>
                          <h3 className="gf-display mt-1.5 text-xl font-semibold leading-snug text-[#F7F0E4] sm:text-2xl">
                            {idea.title}
                          </h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-[#F7F0E4]/72">{idea.reason}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="gf-btn-primary"
                              disabled={busy}
                              onClick={() => void addToWishlist(idea)}
                            >
                              <Heart className="h-4 w-4" aria-hidden="true" />
                              Add to Wishlist
                            </button>
                            {idea.search_query && !tdg ? (
                              <a
                                className="gf-btn-ghost"
                                href={`https://www.google.com/search?q=${encodeURIComponent(idea.search_query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Search className="h-4 w-4" aria-hidden="true" />
                                Search this gift
                              </a>
                            ) : null}
                            {tdg ? (
                              <Link className="gf-btn-ghost" to={tdg.path}>
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                {tdg.label}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    </motion.li>
                  );
                })}
              </ul>
              {sessionId ? <span className="sr-only">Session saved</span> : null}
            </motion.section>
          ) : null}
        </AnimatePresence>

        <nav className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[#F7F0E4]/10 pt-6 text-sm text-[#F7F0E4]/55">
          <Link className="hover:text-[#F7F0E4] hover:underline" to="/christmas/wishlist">
            Open Wishlist
          </Link>
          <Link className="hover:text-[#F7F0E4] hover:underline" to="/christmas/cards">
            Christmas Cards
          </Link>
          <Link className="hover:text-[#F7F0E4] hover:underline" to="/christmas/tree">
            Christmas Tree
          </Link>
          <Link className="hover:text-[#F7F0E4] hover:underline" to="/christmas">
            All Christmas gifts
          </Link>
        </nav>
      </div>

      <style>{`
        .gf-page {
          --gf-display: "Cormorant Garamond", "Times New Roman", serif;
          --gf-body: "Source Sans 3", "Segoe UI", sans-serif;
          --gf-cream: #F7F0E4;
          --gf-gold: #D4A017;
          --gf-berry: #C1121F;
          --gf-pine: #1B4332;
          position: relative;
          min-height: 100dvh;
          overflow-x: hidden;
          color: var(--gf-cream);
          font-family: var(--gf-body);
          background:
            radial-gradient(ellipse 90% 55% at 50% -8%, rgba(212,160,23,0.2), transparent 55%),
            radial-gradient(ellipse 60% 40% at 100% 20%, rgba(193,18,31,0.18), transparent 50%),
            linear-gradient(165deg, #0c1a14 0%, #132820 38%, #1a120f 72%, #0e1814 100%);
        }
        .gf-display { font-family: var(--gf-display); }
        .gf-glow {
          pointer-events: none;
          position: absolute;
          z-index: 1;
          border-radius: 999px;
          filter: blur(60px);
        }
        .gf-glow--left { left: -4rem; top: 8rem; width: 12rem; height: 12rem; background: rgba(27,67,50,0.45); }
        .gf-glow--right { right: -3rem; bottom: 10rem; width: 14rem; height: 14rem; background: rgba(212,160,23,0.14); }
        .gf-pine {
          pointer-events: none;
          position: absolute;
          z-index: 2;
          width: 9rem;
          opacity: 0.55;
        }
        .gf-pine--left { left: -1.5rem; top: 11rem; transform: rotate(-8deg); }
        .gf-pine--right { right: -2rem; top: 18rem; transform: scaleX(-1) rotate(-6deg); opacity: 0.4; }
        .gf-ornament {
          pointer-events: none;
          position: absolute;
          z-index: 2;
          width: 2.25rem;
          animation: gf-sway 5.5s ease-in-out infinite;
        }
        .gf-ornament--a { right: 12%; top: 5.5rem; }
        .gf-ornament--b { left: 10%; top: 22rem; width: 1.75rem; animation-delay: -2s; opacity: 0.7; }
        .gf-flake {
          pointer-events: none;
          position: absolute;
          z-index: 2;
          color: rgba(247,240,228,0.35);
          width: 1.25rem;
          animation: gf-twinkle 3.8s ease-in-out infinite;
        }
        .gf-flake--a { left: 18%; top: 7rem; }
        .gf-flake--b { right: 22%; top: 14rem; width: 0.9rem; animation-delay: -1.2s; }
        .gf-flake--c { left: 8%; top: 36rem; width: 1.1rem; animation-delay: -2.4s; }
        .gf-hero-wash {
          position: absolute;
          inset: -20% -10% auto;
          height: 140%;
          background:
            radial-gradient(ellipse at center, rgba(212,160,23,0.12), transparent 65%),
            linear-gradient(180deg, rgba(247,240,228,0.04), transparent 70%);
          pointer-events: none;
        }
        .gf-panel {
          border: 1px solid rgba(247,240,228,0.12);
          border-radius: 1.5rem;
          background: linear-gradient(160deg, rgba(247,240,228,0.07), rgba(27,67,50,0.18));
          backdrop-filter: blur(8px);
        }
        .gf-label {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(247,240,228,0.55);
        }
        .gf-chip {
          border-radius: 999px;
          border: 1px solid rgba(247,240,228,0.14);
          background: rgba(247,240,228,0.06);
          padding: 0.4rem 0.85rem;
          font-size: 0.875rem;
          color: rgba(247,240,228,0.88);
          transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
        }
        .gf-chip:hover { background: rgba(247,240,228,0.12); }
        .gf-chip--on {
          border-color: transparent;
          background: linear-gradient(135deg, #F3D98A, #E8C547);
          color: #1a1208;
          font-weight: 600;
          transform: translateY(-1px);
        }
        .gf-select, .gf-input {
          width: 100%;
          border-radius: 0.85rem;
          border: 1px solid rgba(247,240,228,0.14);
          background: rgba(8,16,12,0.45);
          padding: 0.7rem 0.9rem;
          font-size: 0.9rem;
          color: var(--gf-cream);
          outline: none;
        }
        .gf-select:focus, .gf-input:focus {
          border-color: rgba(212,160,23,0.55);
          box-shadow: 0 0 0 3px rgba(212,160,23,0.18);
        }
        .gf-select option { background: #132820; color: #F7F0E4; }
        .gf-cta {
          display: inline-flex;
          width: 100%;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          border-radius: 1rem;
          background: linear-gradient(135deg, #C1121F 0%, #E5383B 55%, #C1121F 100%);
          padding: 0.95rem 1.25rem;
          font-size: 1rem;
          font-weight: 700;
          color: #fff8f0;
          box-shadow: 0 12px 28px rgba(193,18,31,0.35);
          transition: transform 0.15s, filter 0.15s, opacity 0.15s;
        }
        .gf-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.05); }
        .gf-cta:disabled { opacity: 0.55; }
        .gf-idea {
          display: grid;
          grid-template-columns: 5.5rem 1fr;
          gap: 1rem;
          align-items: start;
          padding: 1rem 0 1.15rem;
          border-bottom: 1px solid rgba(247,240,228,0.1);
        }
        @media (min-width: 640px) {
          .gf-idea { grid-template-columns: 7rem 1fr; gap: 1.25rem; padding: 1.15rem 0 1.35rem; }
        }
        .gf-idea__art {
          width: 5.5rem;
          height: 5.5rem;
          border-radius: 1.35rem;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(0,0,0,0.28);
        }
        @media (min-width: 640px) {
          .gf-idea__art { width: 7rem; height: 7rem; }
        }
        .gf-idea__tag {
          display: inline-flex;
          border-radius: 999px;
          background: rgba(27,67,50,0.55);
          border: 1px solid rgba(82,183,136,0.25);
          padding: 0.15rem 0.55rem;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #B7E4C7;
        }
        .gf-btn-primary, .gf-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          border-radius: 0.75rem;
          padding: 0.55rem 0.9rem;
          font-size: 0.875rem;
          font-weight: 600;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
        }
        .gf-btn-primary {
          background: linear-gradient(135deg, #F3D98A, #D4A017);
          color: #1a1208;
        }
        .gf-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
        .gf-btn-primary:disabled { opacity: 0.55; }
        .gf-btn-ghost {
          border: 1px solid rgba(247,240,228,0.2);
          color: rgba(247,240,228,0.9);
          background: rgba(247,240,228,0.04);
        }
        .gf-btn-ghost:hover { background: rgba(247,240,228,0.1); }
        @keyframes gf-sway {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes gf-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gf-ornament, .gf-flake { animation: none !important; }
        }
        @media (max-width: 640px) {
          .gf-pine--left, .gf-pine--right { opacity: 0.28; width: 6.5rem; }
          .gf-ornament--b { display: none; }
        }
      `}</style>
    </div>
  );
}

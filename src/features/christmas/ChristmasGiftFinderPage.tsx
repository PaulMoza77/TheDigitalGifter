import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
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

const TDG_ROUTES: Record<string, { path: string; label: string }> = {
  christmas_photo: { path: "/christmas/photo-generator", label: "Explore Christmas Portrait" },
  christmas_family: { path: "/christmas/family", label: "Explore Family Portrait" },
  christmas_couple: { path: "/christmas/couples", label: "Explore Couples Portrait" },
  christmas_pet: { path: "/christmas/pets", label: "Explore Pet Portrait" },
  christmas_santa_video: { path: "/christmas/santa-video", label: "Explore Santa Video" },
  christmas_tree: { path: "/christmas/tree", label: "Build a Christmas Tree" },
};

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function ChristmasGiftFinderPage() {
  const [locale] = useState<LocaleCode>("en");
  const [recipient, setRecipient] = useState("mom");
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
  const [meta, setMeta] = useState<{ provider?: string; model?: string; latency?: number } | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("gift_finder_started", {
      productKey: PRODUCT,
      pathname: "/christmas/gift-finder",
    });
    try {
      const sid = sessionStorage.getItem(FINDER_SESSION_KEY);
      if (sid) {
        void wishlistFunnel<{ ok: boolean; session_id: string; ideas: GiftIdea[]; provider?: string; model?: string }>({
          action: "getGiftFinderSession",
          session_id: sid,
          guest_token: getOrCreateFinderGuestToken(),
        }).then((data) => {
          setSessionId(data.session_id);
          setIdeas(data.ideas || []);
          setMeta({ provider: data.provider, model: data.model });
        }).catch(() => undefined);
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
      setMeta({ provider: data.provider, model: data.model, latency: data.latency_ms });
      try {
        sessionStorage.setItem(FINDER_SESSION_KEY, data.session_id);
      } catch {
        /* ignore */
      }
      void trackChristmasEvent("gift_finder_completed", {
        productKey: PRODUCT,
        pathname: "/christmas/gift-finder",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not find ideas";
      setError(msg.includes("rate_limited") ? "Please wait a bit before searching again." : msg);
      void trackChristmasEvent("gift_finder_failed" as never, {
        productKey: PRODUCT,
        pathname: "/christmas/gift-finder",
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
        pathname: "/christmas/gift-finder",
      });
      void trackChristmasEvent("wishlist_from_finder_item_added" as never, {
        productKey: "christmas_wishlist",
        pathname: "/christmas/gift-finder",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save to wishlist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden"
      style={{ background: "linear-gradient(160deg,#1a1220 0%,#122028 50%,#182018 100%)", color: "#f6f1e8" }}
    >
      <PageHead
        title="Christmas Gift Finder"
        description="Find a Christmas gift they'll actually love — guided ideas for any recipient and budget."
      />
      <div className="mx-auto max-w-lg px-4 pb-20 pt-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-rose-200/70">The Digital Gifter</p>
        <h1 className="mt-2 text-center font-serif text-3xl text-rose-50">Find a Christmas gift they’ll love</h1>
        <p className="mt-2 text-center text-sm text-rose-100/75">
          Answer a few questions. Get thoughtful ideas — no endless scrolling.
        </p>

        <section className="mt-8 space-y-5" aria-label="Gift finder form">
          <fieldset>
            <legend className="text-xs text-rose-100/70">Who is it for?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {RECIPIENTS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRecipient(r.key)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    recipient === r.key ? "bg-rose-200 text-slate-900" : "bg-white/10"
                  }`}
                >
                  {labelFor(RECIPIENTS, r.key, locale)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block text-xs text-rose-100/70">
            Age range
            <select
              className="mt-1 w-full rounded-md bg-white/10 px-2 py-2 text-sm"
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
            <legend className="text-xs text-rose-100/70">Interests</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => toggleInterest(i.key)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    interests.includes(i.key) ? "bg-rose-200 text-slate-900" : "bg-white/10"
                  }`}
                >
                  {labelFor(INTERESTS, i.key, locale)}
                </button>
              ))}
            </div>
            <input
              className="mt-3 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
              placeholder="Optional custom interest"
              maxLength={120}
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
            />
          </fieldset>

          <fieldset>
            <legend className="text-xs text-rose-100/70">Budget</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBudget(b.key)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    budget === b.key ? "bg-rose-200 text-slate-900" : "bg-white/10"
                  }`}
                >
                  {labelFor(BUDGETS, b.key, locale)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs text-rose-100/70">Gift type</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {GIFT_TYPES.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGiftType(g.key)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    giftType === g.key ? "bg-rose-200 text-slate-900" : "bg-white/10"
                  }`}
                >
                  {labelFor(GIFT_TYPES, g.key, locale)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs text-rose-100/70">Vibe</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setVibe(v.key)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    vibe === v.key ? "bg-rose-200 text-slate-900" : "bg-white/10"
                  }`}
                >
                  {labelFor(VIBES, v.key, locale)}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            disabled={busy}
            onClick={() => void generate(false)}
            className="w-full rounded-md bg-rose-200 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {busy ? "Finding thoughtful ideas…" : "Find gift ideas"}
          </button>
        </section>

        {error ? (
          <p className="mt-4 rounded-md bg-red-900/40 px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {savedMsg ? <p className="mt-4 text-sm text-emerald-200">{savedMsg}</p> : null}

        {ideas.length > 0 ? (
          <section className="mt-8 space-y-3" aria-label="Gift ideas">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-xl">Ideas for you</h2>
              <button
                type="button"
                className="text-xs underline"
                disabled={busy}
                onClick={() => void generate(true)}
              >
                Try different ideas
              </button>
            </div>
            {meta ? (
              <p className="text-[11px] text-rose-100/50">
                {meta.provider}/{meta.model}
                {meta.latency != null ? ` · ${meta.latency}ms` : ""}
                {sessionId ? ` · saved` : ""}
              </p>
            ) : null}
            {ideas.map((idea) => {
              const tdg = idea.tdg_product_key ? TDG_ROUTES[idea.tdg_product_key] : null;
              return (
                <article key={idea.id} className="rounded-md border border-white/15 bg-white/5 p-4">
                  <h3 className="font-medium text-rose-50">{idea.title}</h3>
                  <p className="mt-1 text-sm text-rose-100/80">{idea.reason}</p>
                  <p className="mt-2 text-xs text-rose-100/60">
                    {idea.tdg_product_key
                      ? "TDG experience · preview available"
                      : idea.budget_min != null || idea.budget_max != null
                        ? `Typical budget: ${idea.currency === "ron" ? "RON" : "$"}${idea.budget_min ?? "?"}${
                            idea.budget_max != null ? `–${idea.budget_max}` : "+"
                          }`
                        : "Budget flexible"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-amber-200 px-3 py-1.5 text-sm font-medium text-slate-900"
                      disabled={busy}
                      onClick={() => void addToWishlist(idea)}
                    >
                      Add to Wishlist
                    </button>
                    {idea.search_query && !tdg ? (
                      <a
                        className="rounded-md border border-white/20 px-3 py-1.5 text-sm"
                        href={`https://www.google.com/search?q=${encodeURIComponent(idea.search_query)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Search this gift
                      </a>
                    ) : null}
                    {tdg ? (
                      <Link className="rounded-md border border-white/20 px-3 py-1.5 text-sm" to={tdg.path}>
                        {tdg.label}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        <p className="mt-10 text-center text-sm">
          <Link className="underline" to="/christmas/wishlist">
            Open your Wishlist
          </Link>
          {" · "}
          <Link className="underline" to="/christmas/cards">
            Add a personalized Christmas Card idea
          </Link>
          {" · "}
          <Link className="underline" to="/christmas/tree">
            Christmas Tree
          </Link>
        </p>
      </div>
    </div>
  );
}

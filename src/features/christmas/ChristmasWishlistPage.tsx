import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { ChristmasSnowfall } from "@/features/christmas-v2/ChristmasSnowfall";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import { EXAMPLE_WISHES, WISHLIST_COPY_EN, WISHLIST_FAQ_EN } from "./wishlist/copy";
import {
  PRIORITY_EMOJI,
  WISHLIST_AUDIENCES,
  labelFor,
  type LocaleCode,
} from "./wishlist/taxonomy";
import {
  defaultWishlistTitle,
  readReservations,
  readWishlistOwner,
  shareMessage,
  wishlistFunnel,
  writeReservation,
  writeWishlistOwner,
  type OwnerWishlist,
  type SharedWishlist,
  type WishlistItem,
} from "./wishlist/wishlistApi";
import { DEFAULT_LETTER, serializeLetterDescription } from "./wishlist/letterModel";
import { WishlistLetterEditor } from "./wishlist/WishlistLetterEditor";
import { WishlistLetterViewer } from "./wishlist/WishlistLetterViewer";
import "./wishlist/wishlist.css";

const PRODUCT = "christmas_wishlist";
const PATH = "/christmas/wishlist";
const LOGO_SRC = "/TheDigitalGifter.png";
const copy = WISHLIST_COPY_EN;

type LandingPhase = "hero" | "create";

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function ChristmasWishlistPage() {
  const { shareId: routeShareId } = useParams<{ shareId?: string }>();
  const isShare = Boolean(routeShareId);
  const howId = useId();
  const navigate = useNavigate();
  const locale: LocaleCode = "en";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerWishlist | null>(null);
  const [shared, setShared] = useState<SharedWishlist | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [phase, setPhase] = useState<LandingPhase>("hero");
  const [title, setTitle] = useState(() => defaultWishlistTitle());
  const [audience, setAudience] = useState("me");
  const [description, setDescription] = useState(() => serializeLetterDescription(DEFAULT_LETTER));
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [myReservations, setMyReservations] = useState<Record<string, string>>({});
  const [fontsReady, setFontsReady] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const viewed = useRef(false);
  const firstWishTracked = useRef(false);

  const loadOwner = useCallback(async (wishlistId: string, token: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const data = await wishlistFunnel<{ ok: boolean; wishlist: OwnerWishlist }>(
        { action: "getOwnerWishlist", wishlist_id: wishlistId, owner_token: token || undefined },
        await authBearer(),
      );
      setOwner(data.wishlist);
      setTitle(data.wishlist.title);
      setDescription(data.wishlist.description || "");
      setAudience(data.wishlist.audience || "me");
      setOwnerToken(token);
      setPhase("hero");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load wishlist");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const href =
      "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Great+Vibes&family=Source+Sans+3:wght@400;500;600;700&display=swap";
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
    void trackChristmasEvent(isShare ? "shared_wishlist_view" : "wishlist_page_view", {
      productKey: PRODUCT,
      pathname: window.location.pathname,
    });
  }, [isShare]);

  useEffect(() => {
    setMyReservations(readReservations());
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      const name =
        (typeof meta?.full_name === "string" && meta.full_name) ||
        (typeof meta?.name === "string" && meta.name) ||
        "";
      if (name) setProfileName(String(name).split(" ")[0]);
    })();
  }, []);

  useEffect(() => {
    if (isShare && routeShareId) {
      let cancelled = false;
      (async () => {
        setBusy(true);
        try {
          const data = await wishlistFunnel<{ ok: boolean; wishlist: SharedWishlist }>({
            action: "getSharedWishlist",
            share_id: routeShareId,
          });
          if (!cancelled) setShared(data.wishlist);
        } catch {
          if (!cancelled) setUnavailable(true);
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Dev-only visual demo for the standalone letter editor (no backend required).
    if (import.meta.env.DEV) {
      const demo = new URLSearchParams(window.location.search).get("demo");
      if (demo === "letter" || demo === "viewer") {
        const demoList = {
          id: "demo-wishlist",
          share_id: "demoShareWishlistLetter01",
          share_enabled: true,
          title: "My Christmas Wishlist",
          description: serializeLetterDescription({
            ...DEFAULT_LETTER,
            signature: "Paul",
          }),
          locale: "en",
          currency: "EUR",
          show_budgets_public: true,
          audience: "me",
          view_count: 0,
          share_count: 0,
          items: [
            {
              id: "d1",
              sort_order: 0,
              title: "A cozy weekend in the mountains ❄️",
              priority: "really_want",
            },
            {
              id: "d2",
              sort_order: 1,
              title: "New headphones",
              external_url: "https://example.com/headphones",
              budget_amount: 399,
              currency: "EUR",
              priority: "would_love",
            },
            {
              id: "d3",
              sort_order: 2,
              title: "A family Christmas portrait",
              priority: "really_want",
            },
            {
              id: "d4",
              sort_order: 3,
              title: "A new book set",
              priority: "nice_to_have",
            },
            {
              id: "d5",
              sort_order: 4,
              title: "More time with the people I love",
              priority: "would_love",
            },
          ],
        } satisfies OwnerWishlist;

        if (demo === "letter") {
          setOwner(demoList);
          setOwnerToken("demo");
        } else {
          setShared({
            share_id: demoList.share_id,
            title: "Paul’s Christmas Wishlist",
            description: demoList.description,
            locale: demoList.locale,
            items: demoList.items.map((item, index) => ({
              ...item,
              reservation_status: index === 1 ? "reserved" : "none",
            })),
          });
        }
        return;
      }
    }

    const recovery = readWishlistOwner();
    if (recovery) {
      void loadOwner(recovery.wishlistId, recovery.ownerToken);
      void (async () => {
        const bearer = await authBearer();
        if (!bearer) return;
        try {
          await wishlistFunnel(
            {
              action: "claimGuestWishlist",
              wishlist_id: recovery.wishlistId,
              owner_token: recovery.ownerToken,
            },
            bearer,
          );
          writeWishlistOwner(null);
          await loadOwner(recovery.wishlistId, null);
        } catch {
          /* optional claim */
        }
      })();
    }
  }, [isShare, routeShareId, loadOwner]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const id = owner?.share_id || routeShareId;
    return id ? `${window.location.origin}/wishlist/${id}` : "";
  }, [owner?.share_id, routeShareId]);

  async function createList() {
    setBusy(true);
    setError(null);
    void trackChristmasEvent("wishlist_creation_started", {
      productKey: PRODUCT,
      pathname: PATH,
    });
    try {
      const letterDescription =
        description.trim() ||
        serializeLetterDescription({
          ...DEFAULT_LETTER,
          signature: profileName || "",
        });
      const data = await wishlistFunnel<{
        ok: boolean;
        wishlist_id: string;
        share_id: string;
        owner_token: string | null;
      }>(
        {
          action: "createWishlist",
          title: title.trim() || defaultWishlistTitle(profileName),
          description: letterDescription,
          audience,
        },
        await authBearer(),
      );
      if (data.owner_token) {
        writeWishlistOwner({
          wishlistId: data.wishlist_id,
          ownerToken: data.owner_token,
          shareId: data.share_id,
        });
      }
      void trackChristmasEvent("wishlist_created", {
        productKey: PRODUCT,
        pathname: PATH,
      });
      await loadOwner(data.wishlist_id, data.owner_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function ensureShareEnabled() {
    if (!owner || owner.share_enabled) return true;
    await wishlistFunnel(
      {
        action: "setWishlistShareEnabled",
        wishlist_id: owner.id,
        owner_token: ownerToken || undefined,
        share_enabled: true,
      },
      await authBearer(),
    );
    void trackChristmasEvent("wishlist_share_enabled", { productKey: PRODUCT, pathname: PATH });
    await loadOwner(owner.id, ownerToken);
    return true;
  }

  async function shareVia(channel: "native" | "copy" | "whatsapp" | "email") {
    if (!owner) return;
    setBusy(true);
    setError(null);
    try {
      await ensureShareEnabled();
      const url = `${window.location.origin}/wishlist/${owner.share_id}`;
      const msg = shareMessage(owner.title, url);
      void trackChristmasEvent("wishlist_share", { productKey: PRODUCT, pathname: PATH });
      if (channel === "whatsapp") {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${msg.text}\n${url}`)}`, "_blank", "noopener,noreferrer");
        setShareHint(copy.linkCopied);
      } else if (channel === "email") {
        window.location.href = `mailto:?subject=${encodeURIComponent(msg.title)}&body=${encodeURIComponent(`${msg.text}\n${url}`)}`;
      } else if (channel === "native" && navigator.share) {
        await navigator.share({ title: msg.title, text: msg.text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareHint(copy.linkCopied);
      }
    } catch {
      try {
        if (owner?.share_id) {
          await navigator.clipboard.writeText(`${window.location.origin}/wishlist/${owner.share_id}`);
          setShareHint(copy.linkCopied);
        }
      } catch {
        setShareHint(shareUrl);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reserveItem(item: WishlistItem) {
    if (!shared || !routeShareId) return;
    if (item.reservation_status && item.reservation_status !== "none") {
      setError(copy.alreadyTaken);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await wishlistFunnel<{
        ok: boolean;
        reservation_token: string;
        reservation_status: string;
      }>({
        action: "reserveWishlistItem",
        share_id: routeShareId,
        item_id: item.id,
      });
      writeReservation(item.id, data.reservation_token);
      setMyReservations(readReservations());
      void trackChristmasEvent("wishlist_item_reserved", {
        productKey: PRODUCT,
        pathname: window.location.pathname,
      });
      const refreshed = await wishlistFunnel<{ ok: boolean; wishlist: SharedWishlist }>({
        action: "getSharedWishlist",
        share_id: routeShareId,
      });
      setShared(refreshed.wishlist);
    } catch (e) {
      const msg = e instanceof Error ? e.message : copy.reservationFail;
      setError(msg === "already_reserved" ? copy.alreadyTaken : copy.reservationFail);
      try {
        const refreshed = await wishlistFunnel<{ ok: boolean; wishlist: SharedWishlist }>({
          action: "getSharedWishlist",
          share_id: routeShareId,
        });
        setShared(refreshed.wishlist);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function markPurchased(item: WishlistItem) {
    if (!routeShareId) return;
    const token = myReservations[item.id];
    if (!token) return;
    setBusy(true);
    try {
      await wishlistFunnel({
        action: "markWishlistItemPurchased",
        share_id: routeShareId,
        item_id: item.id,
        reservation_token: token,
      });
      void trackChristmasEvent("wishlist_item_purchased", {
        productKey: PRODUCT,
        pathname: window.location.pathname,
      });
      const refreshed = await wishlistFunnel<{ ok: boolean; wishlist: SharedWishlist }>({
        action: "getSharedWishlist",
        share_id: routeShareId,
      });
      setShared(refreshed.wishlist);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.reservationFail);
    } finally {
      setBusy(false);
    }
  }

  function trackExternal(item: WishlistItem) {
    if (isShare && shared) {
      void wishlistFunnel({ action: "trackWishlistExternalClick", share_id: shared.share_id });
      void trackChristmasEvent("wishlist_external_link_clicked", {
        productKey: PRODUCT,
        pathname: window.location.pathname,
      });
    }
  }

  const demoMode =
    import.meta.env.DEV ? new URLSearchParams(window.location.search).get("demo") : null;
  const letterMode = isShare || Boolean(owner) || demoMode === "viewer";
  const showViewer = Boolean(isShare || (demoMode === "viewer" && shared));
  const pageTitle = isShare
    ? copy.shareSeoTitle(shared?.title || "Christmas Wishlist")
    : copy.seoTitle;
  const pageDesc = isShare
    ? copy.shareSeoDescription(shared?.title || "Christmas Wishlist")
    : copy.seoDescription;

  if (unavailable) {
    return (
      <div className="wl-page" data-fonts={fontsReady ? "ready" : "loading"}>
        <PageHead title={copy.unavailableTitle} description={copy.unavailableBody} noindex exactTitle />
        <div className="wl-shell text-center">
          <p className="wl-brand-name">{copy.brand}</p>
          <h1 className="wl-hero-h1 mt-6">{copy.unavailableTitle}</h1>
          <p className="wl-hero-support">{copy.unavailableBody}</p>
          <div className="mt-8">
            <Link className="wl-cta" to="/christmas/wishlist">
              {copy.createMine}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`wl-page ${letterMode ? "wl-page--letter" : ""}`}
      data-fonts={fontsReady ? "ready" : "loading"}
    >
      <PageHead title={pageTitle} description={pageDesc} exactTitle={!isShare} noindex={isShare} />
      {!letterMode ? <ChristmasSnowfall /> : null}
      <div className="wl-glow wl-glow--ember" aria-hidden />
      <div className="wl-glow wl-glow--gold" aria-hidden />

      <div className={`wl-shell ${letterMode ? "wl-shell--letter" : ""}`}>
        {/* ——— Shared public letter ——— */}
        {showViewer ? (
          shared ? (
            <WishlistLetterViewer
              shared={shared}
              busy={busy}
              error={error}
              myReservations={myReservations}
              viralTitle={copy.viralTitle}
              viralCta={copy.viralCta}
              giftFinderLabel={copy.tryGiftFinder}
              onReserve={reserveItem}
              onMarkPurchased={markPurchased}
              onExternalClick={trackExternal}
              onCreateMine={() => {
                void trackChristmasEvent("wishlist_create_from_shared_clicked", {
                  productKey: PRODUCT,
                  pathname: window.location.pathname,
                });
                navigate("/christmas/wishlist");
              }}
            />
          ) : (
            <p className="wl-hero-support text-center">{copy.loading}</p>
          )
        ) : null}

        {/* ——— Owner letter editor (standalone) ——— */}
        {!showViewer && owner ? (
          <>
            <nav className="wl-topnav" aria-label="Wishlist navigation">
              <Link className="wl-topnav__brand" to="/christmas">
                <img src={LOGO_SRC} alt="" />
                <span>{copy.brand}</span>
              </Link>
              <Link to="/christmas">Home</Link>
            </nav>
            <WishlistLetterEditor
              owner={owner}
              busy={busy}
              error={error}
              shareUrl={shareUrl}
              shareHint={shareHint}
              profileName={profileName}
              onMetaSave={async (patch) => {
                if (owner.id === "demo-wishlist") {
                  setOwner((prev) =>
                    prev
                      ? {
                          ...prev,
                          title: patch.title ?? prev.title,
                          description: patch.description ?? prev.description,
                        }
                      : prev,
                  );
                  return;
                }
                await wishlistFunnel(
                  {
                    action: "updateWishlist",
                    wishlist_id: owner.id,
                    owner_token: ownerToken || undefined,
                    ...patch,
                  },
                  await authBearer(),
                );
                setOwner((prev) =>
                  prev
                    ? {
                        ...prev,
                        title: patch.title ?? prev.title,
                        description: patch.description ?? prev.description,
                      }
                    : prev,
                );
              }}
              onAddWish={async (input) => {
                if (owner.id === "demo-wishlist") {
                  setOwner((prev) => {
                    if (!prev) return prev;
                    const id = `d${Date.now()}`;
                    return {
                      ...prev,
                      items: [
                        ...prev.items,
                        {
                          id,
                          sort_order: prev.items.length,
                          title: input.title,
                          external_url: input.external_url,
                          priority: input.priority || "would_love",
                          note: input.note,
                        },
                      ],
                    };
                  });
                  return;
                }
                const wasEmpty = owner.items.length === 0;
                await wishlistFunnel(
                  {
                    action: "addWishlistItem",
                    wishlist_id: owner.id,
                    owner_token: ownerToken || undefined,
                    title: input.title,
                    external_url: input.external_url,
                    note: input.note || "",
                    priority: input.priority || "would_love",
                    source_type: "manual",
                  },
                  await authBearer(),
                );
                void trackChristmasEvent("wishlist_item_added", { productKey: PRODUCT, pathname: PATH });
                if (wasEmpty && !firstWishTracked.current) {
                  firstWishTracked.current = true;
                  void trackChristmasEvent("wishlist_first_wish_added", {
                    productKey: PRODUCT,
                    pathname: PATH,
                  });
                }
                if (input.external_url) {
                  void trackChristmasEvent("wishlist_link_added", { productKey: PRODUCT, pathname: PATH });
                }
                await loadOwner(owner.id, ownerToken);
              }}
              onUpdateWish={async (itemId, patch) => {
                if (owner.id === "demo-wishlist") {
                  setOwner((prev) =>
                    prev
                      ? {
                          ...prev,
                          items: prev.items.map((item) =>
                            item.id === itemId ? ({ ...item, ...patch } as WishlistItem) : item,
                          ),
                        }
                      : prev,
                  );
                  return;
                }
                await wishlistFunnel(
                  {
                    action: "updateWishlistItem",
                    wishlist_id: owner.id,
                    owner_token: ownerToken || undefined,
                    item_id: itemId,
                    ...patch,
                  },
                  await authBearer(),
                );
                await loadOwner(owner.id, ownerToken);
              }}
              onRemoveWish={async (itemId) => {
                if (owner.id === "demo-wishlist") {
                  setOwner((prev) =>
                    prev ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) } : prev,
                  );
                  return;
                }
                await wishlistFunnel(
                  {
                    action: "removeWishlistItem",
                    wishlist_id: owner.id,
                    owner_token: ownerToken || undefined,
                    item_id: itemId,
                  },
                  await authBearer(),
                );
                void trackChristmasEvent("wishlist_item_removed", { productKey: PRODUCT, pathname: PATH });
                await loadOwner(owner.id, ownerToken);
              }}
              onReorder={async (itemIds) => {
                if (owner.id === "demo-wishlist") {
                  setOwner((prev) => {
                    if (!prev) return prev;
                    const map = new Map(prev.items.map((item) => [item.id, item]));
                    return {
                      ...prev,
                      items: itemIds
                        .map((id, index) => {
                          const item = map.get(id);
                          return item ? { ...item, sort_order: index } : null;
                        })
                        .filter(Boolean) as WishlistItem[],
                    };
                  });
                  return;
                }
                await wishlistFunnel(
                  {
                    action: "reorderWishlistItems",
                    wishlist_id: owner.id,
                    owner_token: ownerToken || undefined,
                    item_ids: itemIds,
                  },
                  await authBearer(),
                );
                void trackChristmasEvent("wishlist_item_reordered", {
                  productKey: PRODUCT,
                  pathname: PATH,
                });
                await loadOwner(owner.id, ownerToken);
              }}
              onShare={async (channel) => {
                if (owner.id === "demo-wishlist") {
                  setShareHint(copy.linkCopied);
                  return;
                }
                await shareVia(channel);
              }}
              onPreviewGuest={() => {
                if (owner.id === "demo-wishlist") return;
                if (owner.share_id) {
                  void ensureShareEnabled().then(() => {
                    window.open(`/wishlist/${owner.share_id}`, "_blank", "noopener,noreferrer");
                  });
                }
              }}
            />
          </>
        ) : null}

        {/* ——— Marketing landing (no owner yet) ——— */}
        {!showViewer && !owner ? (
          <>
            <header className="wl-brand">
              <img src={LOGO_SRC} alt="" />
              <p className="wl-brand-name">{copy.brand}</p>
              <p className="wl-eyebrow">Christmas Wishlist</p>
            </header>
            <h1 className="wl-hero-h1">{copy.heroH1}</h1>
            <p className="wl-hero-support">{copy.heroSupport}</p>
            <div className="wl-cta-row">
              <button
                type="button"
                className="wl-cta"
                onClick={() => {
                  setPhase("create");
                  void trackChristmasEvent("wishlist_creation_started", {
                    productKey: PRODUCT,
                    pathname: PATH,
                  });
                  requestAnimationFrame(() => {
                    document.getElementById("wl-create")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              >
                {copy.ctaCreate}
              </button>
              <a className="wl-cta-ghost" href={`#${howId}`}>
                {copy.ctaHow}
              </a>
            </div>

            <aside className="wl-letter" aria-label="Example wishlist">
              <div className="wl-letter__ribbon" aria-hidden />
              <div className="wl-letter__inner">
                <h2 className="wl-letter-title">{copy.exampleTitle}</h2>
                <p className="wl-made-with">Example only · not a real customer list</p>
                <ul className="mt-3">
                  {EXAMPLE_WISHES.map((w) => (
                    <li key={w.title} className="wl-example-item">
                      <strong>
                        {PRIORITY_EMOJI[w.priority] || "🎁"} {w.title}
                      </strong>
                      {w.note ? <em>{w.note}</em> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            <section id="wl-create" className="wl-letter mt-6" aria-label="Create wishlist">
              <div className="wl-letter__inner">
                <h2 className="wl-letter-title">{copy.createTitleAsk}</h2>
                <label className="mt-4 block">
                  <span className="wl-label">Wishlist name</span>
                  <input
                    className="wl-input"
                    value={title}
                    maxLength={80}
                    placeholder={copy.createTitlePlaceholder}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <div className="mt-4">
                  <p className="wl-label">{copy.createForAsk}</p>
                  <div className="wl-audience" role="group" aria-label={copy.createForAsk}>
                    {WISHLIST_AUDIENCES.map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        className={`wl-chip ${audience === a.key ? "wl-chip--on" : ""}`}
                        aria-pressed={audience === a.key}
                        onClick={() => setAudience(a.key)}
                      >
                        {labelFor(WISHLIST_AUDIENCES, a.key, locale)}
                      </button>
                    ))}
                  </div>
                </div>
                {error ? (
                  <p className="wl-alert" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="wl-cta mt-5"
                  disabled={busy || !title.trim()}
                  onClick={() => void createList()}
                >
                  {copy.createSubmit}
                </button>
                <p className="wl-hint">{copy.saveListHint}</p>
              </div>
            </section>

            <section className="wl-section" id={howId} aria-labelledby={`${howId}-title`}>
              <h2 id={`${howId}-title`}>{copy.howTitle}</h2>
              <ol className="wl-how">
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    1
                  </span>
                  <h3>{copy.how1Title}</h3>
                  <p>{copy.how1Body}</p>
                </li>
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    2
                  </span>
                  <h3>{copy.how2Title}</h3>
                  <p>{copy.how2Body}</p>
                </li>
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    3
                  </span>
                  <h3>{copy.how3Title}</h3>
                  <p>{copy.how3Body}</p>
                </li>
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    4
                  </span>
                  <h3>{copy.how4Title}</h3>
                  <p>{copy.how4Body}</p>
                </li>
              </ol>
            </section>

            <section className="wl-section" aria-label="About Christmas wishlists">
              <article className="wl-seo-block">
                <h2>{copy.seoCreateTitle}</h2>
                <p>{copy.seoCreateBody}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{copy.seoAnywhereTitle}</h2>
                <p>{copy.seoAnywhereBody}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{copy.seoShareTitle}</h2>
                <p>{copy.seoShareBody}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{copy.seoDuplicateTitle}</h2>
                <p>{copy.seoDuplicateBody}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{copy.seoKidsTitle}</h2>
                <p>{copy.seoKidsBody}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{copy.geoWhatTitle}</h2>
                <p>{copy.geoWhatBody}</p>
              </article>
            </section>

            <section className="wl-section wl-faq" aria-label={copy.faqTitle}>
              <h2>{copy.faqTitle}</h2>
              {WISHLIST_FAQ_EN.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </section>

            <nav className="wl-links" aria-label="More Christmas gifts">
              <Link to="/christmas/gift-finder">Gift Finder</Link>
              <Link to="/christmas/tree">Christmas Tree</Link>
              <Link to="/christmas/cards">Christmas Cards</Link>
              <Link to="/christmas">All Christmas gifts</Link>
            </nav>
          </>
        ) : null}
      </div>
    </div>
  );
}

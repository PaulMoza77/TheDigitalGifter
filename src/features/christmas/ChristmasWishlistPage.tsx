import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { parseChristmasLocalePath } from "@/features/christmas/seo/localeRouting";
import { normalizeWave1GenerationLocale } from "@/features/christmas/i18n/wave1Locale";
import { ChristmasSnowfall } from "@/features/christmas-v2/ChristmasSnowfall";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import {
  EXAMPLE_WISHES,
  wishlistFaq,
  wishlistOwnerStats,
  wishlistShareSeoDescription,
  wishlistT,
} from "./wishlist/copy";
import {
  PRIORITY_EMOJI,
  WISHLIST_AUDIENCES,
  WISHLIST_PRIORITIES,
  labelFor,
  type LocaleCode,
} from "./wishlist/taxonomy";
import {
  defaultWishlistTitle,
  formatMoney,
  readReservations,
  readWishlistOwner,
  reorderIds,
  retailerFromUrl,
  sanitizeExternalUrlClient,
  shareMessage,
  wishlistFunnel,
  writeReservation,
  writeWishlistOwner,
  type OwnerWishlist,
  type SharedWishlist,
  type UrlPreview,
  type WishlistItem,
} from "./wishlist/wishlistApi";
import "./wishlist/wishlist.css";

const PRODUCT = "christmas_wishlist";
const PATH = "/christmas/wishlist";
const LOGO_SRC = "/TheDigitalGifter.png";
type ComposerMode = "closed" | "link" | "manual" | "edit";
type LandingPhase = "hero" | "create";

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function PriorityLabel({ priority, locale }: { priority?: string; locale: LocaleCode }) {
  if (!priority) return null;
  const emoji = PRIORITY_EMOJI[priority] || "🎁";
  return (
    <span className="wl-badge">
      {emoji} {labelFor(WISHLIST_PRIORITIES, priority, locale)}
    </span>
  );
}

function WishMedia({ item }: { item: Pick<WishlistItem, "title" | "image_url"> }) {
  return (
    <div className="wl-wish__media" aria-hidden={!item.image_url}>
      {item.image_url ? (
        <img src={item.image_url} alt="" loading="lazy" />
      ) : (
        <div className="grid h-full place-items-center text-lg text-[#f7f0e4]/80">🎁</div>
      )}
    </div>
  );
}

export default function ChristmasWishlistPage() {
  const { shareId: routeShareId } = useParams<{ shareId?: string }>();
  const location = useLocation();
  const isShare = Boolean(routeShareId);
  const howId = useId();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(location.pathname).locale,
  ) as LocaleCode;
  const t = (key: string, vars?: Record<string, string>) => wishlistT(locale, key, vars);
  const faq = useMemo(() => wishlistFaq(locale), [locale]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerWishlist | null>(null);
  const [shared, setShared] = useState<SharedWishlist | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [phase, setPhase] = useState<LandingPhase>("hero");
  const [title, setTitle] = useState(() => defaultWishlistTitle(null, "en"));
  const [audience, setAudience] = useState("me");
  const [description, setDescription] = useState("");
  const [composer, setComposer] = useState<ComposerMode>("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemPriority, setItemPriority] = useState("would_love");
  const [itemBudget, setItemBudget] = useState("");
  const [itemSize, setItemSize] = useState("");
  const [itemColor, setItemColor] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [showDetails, setShowDetails] = useState(false);
  const [linkPreview, setLinkPreview] = useState<UrlPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [myReservations, setMyReservations] = useState<Record<string, string>>({});
  const [fontsReady, setFontsReady] = useState(false);
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
      setError(e instanceof Error ? e.message : t("error.load"));
    } finally {
      setBusy(false);
    }
  }, [locale]);

  useEffect(() => {
    const href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Source+Sans+3:wght@400;500;600;700&display=swap";
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

  // Localize the create-form default title when locale changes — never rewrite user/server titles.
  useEffect(() => {
    const knownDefaults = [
      "en",
      "ro",
      "de",
      "fr",
      "es",
      "it",
      "pt",
      "nl",
      "pl",
    ].map((loc) => defaultWishlistTitle(null, loc));
    if (!title.trim() || knownDefaults.includes(title)) {
      setTitle(defaultWishlistTitle(null, locale));
    }
    // Intentionally omit `title` from deps: only react to locale switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

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

  function resetComposer() {
    setComposer("closed");
    setEditingId(null);
    setItemTitle("");
    setItemNote("");
    setItemUrl("");
    setItemImage("");
    setItemPriority("would_love");
    setItemBudget("");
    setItemSize("");
    setItemColor("");
    setItemQty("1");
    setShowDetails(false);
    setLinkPreview(null);
  }

  function openComposer(mode: ComposerMode, item?: WishlistItem) {
    if (item) {
      setEditingId(item.id);
      setItemTitle(item.title);
      setItemNote(item.note || "");
      setItemUrl(item.external_url || "");
      setItemImage(item.image_url || "");
      setItemPriority(item.priority || "would_love");
      setItemBudget(item.budget_amount != null ? String(item.budget_amount) : "");
      setItemSize(item.preference_size || "");
      setItemColor(item.preference_color || "");
      setItemQty(String(item.quantity || 1));
      setShowDetails(Boolean(item.preference_size || item.preference_color || item.budget_amount || (item.quantity || 1) > 1));
      setComposer("edit");
      return;
    }
    setEditingId(null);
    setComposer(mode);
  }

  async function createList() {
    setBusy(true);
    setError(null);
    void trackChristmasEvent("wishlist_creation_started", {
      productKey: PRODUCT,
      pathname: PATH,
    });
    try {
      const data = await wishlistFunnel<{
        ok: boolean;
        wishlist_id: string;
        share_id: string;
        owner_token: string | null;
      }>(
        {
          action: "createWishlist",
          title: title.trim() || defaultWishlistTitle(null, locale),
          description,
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
      setComposer("closed");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.create"));
    } finally {
      setBusy(false);
    }
  }

  async function previewLink() {
    const url = sanitizeExternalUrlClient(itemUrl);
    if (!url) {
      setError(t("error.linkHttps"));
      return;
    }
    setPreviewBusy(true);
    setError(null);
    setLinkPreview(null);
    try {
      const data = await wishlistFunnel<UrlPreview>({ action: "previewExternalUrl", url });
      setLinkPreview(data);
      if (data.extracted) {
        if (data.title && !itemTitle.trim()) setItemTitle(data.title);
        if (data.image_url && !itemImage.trim()) setItemImage(data.image_url);
      }
    } catch {
      setLinkPreview({
        ok: false,
        url,
        extracted: false,
        title: null,
        image_url: null,
        retailer: retailerFromUrl(url),
        error: "fetch_failed",
      });
    } finally {
      setPreviewBusy(false);
    }
  }

  async function saveWish(e?: FormEvent) {
    e?.preventDefault();
    if (!owner) return;
    const url = itemUrl ? sanitizeExternalUrlClient(itemUrl) : null;
    if (itemUrl && !url) {
      setError(t("error.linkHttps"));
      return;
    }
    const image = itemImage ? sanitizeExternalUrlClient(itemImage) : null;
    if (itemImage && !image) {
      setError(t("error.imageUrl"));
      return;
    }
    if (!itemTitle.trim()) {
      setError(t("error.titleRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const wasEmpty = owner.items.length === 0;
    try {
      if (editingId) {
        await wishlistFunnel(
          {
            action: "updateWishlistItem",
            wishlist_id: owner.id,
            owner_token: ownerToken || undefined,
            item_id: editingId,
            title: itemTitle,
            note: itemNote,
            external_url: url,
            image_url: image,
            priority: itemPriority,
            budget_amount: itemBudget === "" ? null : Number(itemBudget),
            preference_size: itemSize,
            preference_color: itemColor,
            quantity: Number(itemQty) || 1,
          },
          await authBearer(),
        );
      } else {
        await wishlistFunnel(
          {
            action: "addWishlistItem",
            wishlist_id: owner.id,
            owner_token: ownerToken || undefined,
            title: itemTitle,
            note: itemNote,
            external_url: url,
            image_url: image,
            priority: itemPriority,
            budget_amount: itemBudget === "" ? null : Number(itemBudget),
            preference_size: itemSize,
            preference_color: itemColor,
            quantity: Number(itemQty) || 1,
            source_type: "manual",
          },
          await authBearer(),
        );
        void trackChristmasEvent("wishlist_item_added", { productKey: PRODUCT, pathname: PATH });
        if (wasEmpty && !firstWishTracked.current) {
          firstWishTracked.current = true;
          void trackChristmasEvent("wishlist_first_wish_added", { productKey: PRODUCT, pathname: PATH });
        }
        if (url) {
          void trackChristmasEvent("wishlist_link_added", { productKey: PRODUCT, pathname: PATH });
        }
      }
      resetComposer();
      await loadOwner(owner.id, ownerToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.saveWish"));
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(index: number, dir: -1 | 1) {
    if (!owner) return;
    const ids = owner.items.map((i) => i.id);
    const next = reorderIds(ids, index, index + dir);
    if (next.join() === ids.join()) return;
    setBusy(true);
    try {
      await wishlistFunnel(
        {
          action: "reorderWishlistItems",
          wishlist_id: owner.id,
          owner_token: ownerToken || undefined,
          item_ids: next,
        },
        await authBearer(),
      );
      void trackChristmasEvent("wishlist_item_reordered", { productKey: PRODUCT, pathname: PATH });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.reorder"));
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    if (!owner) return;
    setBusy(true);
    try {
      await wishlistFunnel(
        {
          action: "removeWishlistItem",
          wishlist_id: owner.id,
          owner_token: ownerToken || undefined,
          item_id: id,
        },
        await authBearer(),
      );
      void trackChristmasEvent("wishlist_item_removed", { productKey: PRODUCT, pathname: PATH });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.remove"));
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
      const msg = shareMessage(owner.title, url, locale);
      void trackChristmasEvent("wishlist_share", { productKey: PRODUCT, pathname: PATH });
      if (channel === "whatsapp") {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${msg.text}\n${url}`)}`, "_blank", "noopener,noreferrer");
        setShareHint(t("share.linkCopied"));
      } else if (channel === "email") {
        window.location.href = `mailto:?subject=${encodeURIComponent(msg.title)}&body=${encodeURIComponent(`${msg.text}\n${url}`)}`;
      } else if (channel === "native" && navigator.share) {
        await navigator.share({ title: msg.title, text: msg.text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareHint(t("share.linkCopied"));
      }
    } catch {
      try {
        if (owner?.share_id) {
          await navigator.clipboard.writeText(`${window.location.origin}/wishlist/${owner.share_id}`);
          setShareHint(t("share.linkCopied"));
        }
      } catch {
        setShareHint(shareUrl);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare(enabled: boolean) {
    if (!owner) return;
    setBusy(true);
    try {
      await wishlistFunnel(
        {
          action: "setWishlistShareEnabled",
          wishlist_id: owner.id,
          owner_token: ownerToken || undefined,
          share_enabled: enabled,
        },
        await authBearer(),
      );
      if (enabled) {
        void trackChristmasEvent("wishlist_share_enabled", { productKey: PRODUCT, pathname: PATH });
      }
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.shareUpdate"));
    } finally {
      setBusy(false);
    }
  }

  async function reserveItem(item: WishlistItem) {
    if (!shared || !routeShareId) return;
    if (item.reservation_status && item.reservation_status !== "none") {
      setError(t("reserve.alreadyTaken"));
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
      const msg = e instanceof Error ? e.message : t("reserve.fail");
      setError(msg === "already_reserved" ? t("reserve.alreadyTaken") : t("reserve.fail"));
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
      setError(e instanceof Error ? e.message : t("reserve.fail"));
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

  if (unavailable) {
    return (
      <div className="wl-page" data-fonts={fontsReady ? "ready" : "loading"}>
        <PageHead title={t("unavailable.title")} description={t("unavailable.body")} noindex exactTitle />
        <div className="wl-shell text-center">
          <p className="wl-brand-name">{t("brand.name")}</p>
          <h1 className="wl-hero-h1 mt-6">{t("unavailable.title")}</h1>
          <p className="wl-hero-support">{t("unavailable.body")}</p>
          <div className="mt-8">
            <Link className="wl-cta" to="/christmas/wishlist">
              {t("unavailable.createMine")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const items = owner?.items || shared?.items || [];
  const pageTitle = isShare
    ? t("share.seoTitle", { name: shared?.title || t("title.default") })
    : t("seo.title");
  const pageDesc = isShare
    ? wishlistShareSeoDescription(locale, shared?.title || t("title.default"))
    : t("seo.description");

  return (
    <div className="wl-page" data-fonts={fontsReady ? "ready" : "loading"}>
      {isShare ? (
        <PageHead
          title={pageTitle}
          description={pageDesc}
          exactTitle
          noindex
        />
      ) : (
        <ChristmasPageHead path="/christmas/wishlist" />
      )}
      <ChristmasSnowfall />
      <div className="wl-glow wl-glow--ember" aria-hidden />
      <div className="wl-glow wl-glow--gold" aria-hidden />

      <div className="wl-shell">
        {/* ——— Shared public view ——— */}
        {isShare ? (
          <>
            <header className="wl-brand">
              <p className="wl-made-with text-center !text-[rgba(247,240,228,0.55)]">{t("brand.madeWith")}</p>
            </header>
            <div className="wl-letter" role="region" aria-label={shared?.title || t("title.default")}>
              <div className="wl-letter__ribbon" aria-hidden />
              <div className="wl-letter__inner">
                <h1 className="wl-letter-title">{shared?.title || t("loading")}</h1>
                <p className="wl-letter-note">{t("letter.dearSanta")}</p>
                {shared?.description ? <p className="wl-letter-note">“{shared.description}”</p> : (
                  <p className="wl-letter-note">{t("letter.thanks")}</p>
                )}
                {error ? <p className="wl-alert" role="alert">{error}</p> : null}

                <ul className="mt-4" aria-label={t("a11y.wishlistItems")}>
                  {busy && !shared ? (
                    <li className="wl-hint">{t("loading")}</li>
                  ) : items.length === 0 ? (
                    <li className="wl-hint">{t("empty.shared")}</li>
                  ) : (
                    items.map((item) => {
                      const taken = item.reservation_status === "reserved" || item.reservation_status === "purchased";
                      const mine = Boolean(myReservations[item.id]);
                      return (
                        <li
                          key={item.id}
                          className={`wl-wish ${taken ? "wl-wish--taken" : ""}`}
                        >
                          <WishMedia item={item} />
                          <div>
                            <p className="wl-wish__title">{item.title}</p>
                            {item.note ? <p className="wl-wish__note">{item.note}</p> : null}
                            <div className="wl-wish__meta">
                              <PriorityLabel priority={item.priority} locale={locale} />
                              {formatMoney(item.budget_amount, item.currency, locale) ? (
                                <span>{formatMoney(item.budget_amount, item.currency, locale)}</span>
                              ) : null}
                              {item.preference_size ? <span>{t("add.size")}: {item.preference_size}</span> : null}
                              {item.preference_color ? <span>{t("add.color")}: {item.preference_color}</span> : null}
                              {taken ? (
                                <span className="wl-badge wl-badge--taken">
                                  {item.reservation_status === "purchased" ? t("reserve.purchased") : t("reserve.reserved")}
                                </span>
                              ) : null}
                            </div>
                            <div className="wl-wish__actions">
                              {item.external_url ? (
                                <a
                                  className="wl-btn wl-btn--soft"
                                  href={item.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => trackExternal(item)}
                                >
                                  {t("item.openLink")}
                                </a>
                              ) : null}
                              {!taken ? (
                                <button
                                  type="button"
                                  className="wl-btn wl-btn--primary"
                                  disabled={busy}
                                  onClick={() => void reserveItem(item)}
                                >
                                  {t("reserve.cta")}
                                </button>
                              ) : null}
                              {mine && item.reservation_status === "reserved" ? (
                                <button
                                  type="button"
                                  className="wl-btn wl-btn--soft"
                                  disabled={busy}
                                  onClick={() => void markPurchased(item)}
                                >
                                  {t("reserve.markPurchased")}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            <div className="wl-viral">
              <h2>{t("viral.title")}</h2>
              <Link
                className="wl-cta mt-4"
                to="/christmas/wishlist"
                onClick={() =>
                  void trackChristmasEvent("wishlist_create_from_shared_clicked", {
                    productKey: PRODUCT,
                    pathname: window.location.pathname,
                  })
                }
              >
                {t("viral.cta")}
              </Link>
              <p className="mt-3 text-sm text-[rgba(247,240,228,0.6)]">
                <Link
                  className="underline"
                  to="/christmas/gift-finder"
                  onClick={() =>
                    void trackChristmasEvent("wishlist_gift_finder_clicked", {
                      productKey: PRODUCT,
                      pathname: window.location.pathname,
                    })
                  }
                >
                  {t("crossSell.tryGiftFinder")}
                </Link>
              </p>
            </div>
          </>
        ) : null}

        {/* ——— Owner / landing ——— */}
        {!isShare ? (
          <>
            {!owner ? (
              <>
                <header className="wl-brand">
                  <img src={LOGO_SRC} alt="" />
                  <p className="wl-brand-name">{t("brand.name")}</p>
                  <p className="wl-eyebrow">{t("brand.eyebrow")}</p>
                </header>
                <h1 className="wl-hero-h1">{t("hero.h1")}</h1>
                <p className="wl-hero-support">{t("hero.support")}</p>
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
                    {t("hero.ctaCreate")}
                  </button>
                  <a className="wl-cta-ghost" href={`#${howId}`}>
                    {t("hero.ctaHow")}
                  </a>
                </div>

                {/* Example letter */}
                <aside className="wl-letter" aria-label={t("a11y.exampleWishlist")}>
                  <div className="wl-letter__ribbon" aria-hidden />
                  <div className="wl-letter__inner">
                    <h2 className="wl-letter-title">{t("example.title")}</h2>
                    <p className="wl-letter-note">{t("letter.dearSanta")}</p>
                    <p className="wl-made-with">{t("example.only")}</p>
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

                <section id="wl-create" className="wl-letter mt-6" aria-label={t("a11y.createWishlist")}>
                    <div className="wl-letter__inner">
                      <h2 className="wl-letter-title">{t("create.titleAsk")}</h2>
                      <label className="mt-4 block">
                        <span className="wl-label">{t("create.nameLabel")}</span>
                        <input
                          className="wl-input"
                          value={title}
                          maxLength={80}
                          placeholder={t("create.titlePlaceholder")}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </label>
                      <div className="mt-4">
                        <p className="wl-label">{t("create.forAsk")}</p>
                        <div className="wl-audience" role="group" aria-label={t("create.forAsk")}>
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
                      <label className="mt-4 block">
                        <span className="wl-label">{t("create.messageLabel")}</span>
                        <textarea
                          className="wl-textarea"
                          value={description}
                          maxLength={500}
                          placeholder={t("create.messagePlaceholder")}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </label>
                      {error ? <p className="wl-alert" role="alert">{error}</p> : null}
                      <button
                        type="button"
                        className="wl-cta mt-5"
                        disabled={busy || !title.trim()}
                        onClick={() => void createList()}
                      >
                        {t("create.submit")}
                      </button>
                      <p className="wl-hint">{t("create.saveHint")}</p>
                    </div>
                  </section>
              </>
            ) : (
              <>
                <header className="wl-brand">
                  <img src={LOGO_SRC} alt="" />
                  <p className="wl-brand-name text-[1.65rem]">{t("brand.name")}</p>
                </header>
                <div className="wl-letter" role="region" aria-label={owner.title}>
                  <div className="wl-letter__ribbon" aria-hidden />
                  <div className="wl-letter__inner">
                    <h1 className="wl-letter-title">{owner.title}</h1>
                    <p className="wl-letter-note">{t("letter.dearSanta")}</p>
                    {owner.description ? <p className="wl-letter-note">“{owner.description}”</p> : null}
                    <p className="wl-stats">
                      {wishlistOwnerStats(locale, owner.items.length, owner.share_count || 0, owner.view_count || 0)}
                    </p>
                    <p className="wl-hint">{t("status.autosave")}</p>
                    {error ? <p className="wl-alert" role="alert">{error}</p> : null}

                    {owner.items.length === 0 && composer === "closed" ? (
                      <div className="wl-empty">
                        <h3>{t("empty.ask")}</h3>
                        <button type="button" className="wl-cta mt-4" onClick={() => openComposer("manual")}>
                          {t("empty.cta")}
                        </button>
                        <div className="wl-mode-row">
                          <button type="button" className="wl-btn wl-btn--soft" onClick={() => openComposer("link")}>
                            {t("add.pasteLink")}
                          </button>
                          <button type="button" className="wl-btn wl-btn--soft" onClick={() => openComposer("manual")}>
                            {t("add.writeWish")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ul className="mt-2" aria-label={t("a11y.yourWishes")}>
                        {owner.items.map((item, idx) => (
                          <li key={item.id} className="wl-wish">
                            <WishMedia item={item} />
                            <div>
                              <p className="wl-wish__title">{item.title}</p>
                              {item.note ? <p className="wl-wish__note">{item.note}</p> : null}
                              <div className="wl-wish__meta">
                                <PriorityLabel priority={item.priority} locale={locale} />
                                {formatMoney(item.budget_amount, item.currency, locale) ? (
                                  <span>{formatMoney(item.budget_amount, item.currency, locale)}</span>
                                ) : null}
                                {retailerFromUrl(item.external_url) ? (
                                  <span>{retailerFromUrl(item.external_url)}</span>
                                ) : null}
                              </div>
                              <div className="wl-wish__actions">
                                {item.external_url ? (
                                  <a
                                    className="wl-btn wl-btn--soft"
                                    href={item.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {t("item.openLink")}
                                  </a>
                                ) : null}
                                <button type="button" className="wl-btn wl-btn--soft" onClick={() => openComposer("edit", item)}>
                                  {t("item.edit")}
                                </button>
                                <button type="button" className="wl-btn wl-btn--soft" disabled={busy} onClick={() => void moveItem(idx, -1)}>
                                  {t("item.moveUp")}
                                </button>
                                <button type="button" className="wl-btn wl-btn--soft" disabled={busy} onClick={() => void moveItem(idx, 1)}>
                                  {t("item.moveDown")}
                                </button>
                                <button type="button" className="wl-btn wl-btn--danger" disabled={busy} onClick={() => void removeItem(item.id)}>
                                  {t("item.remove")}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {composer !== "closed" ? (
                      <form className="mt-4 border-t border-[rgba(26,18,15,0.1)] pt-4" onSubmit={(e) => void saveWish(e)}>
                        <h3 className="wl-letter-title text-[1.25rem]">
                          {composer === "edit" ? t("item.edit") : composer === "link" ? t("add.pasteLink") : t("add.writeWish")}
                        </h3>
                        {(composer === "link" || composer === "edit") && (
                          <label className="mt-3 block">
                            <span className="wl-label">{t("add.pasteLink")}</span>
                            <input
                              className="wl-input"
                              value={itemUrl}
                              placeholder={t("add.pasteLinkHint")}
                              inputMode="url"
                              autoComplete="url"
                              onChange={(e) => setItemUrl(e.target.value)}
                            />
                          </label>
                        )}
                        {composer === "link" ? (
                          <button
                            type="button"
                            className="wl-btn wl-btn--soft mt-2"
                            disabled={previewBusy || !itemUrl.trim()}
                            onClick={() => void previewLink()}
                          >
                            {previewBusy ? t("loading") : t("add.lookupLink")}
                          </button>
                        ) : null}
                        {linkPreview && !linkPreview.extracted ? (
                          <p className="wl-hint">{t("add.linkImportFail")}</p>
                        ) : null}
                        {linkPreview?.retailer ? (
                          <p className="wl-hint">{t("add.store", { name: linkPreview.retailer })}</p>
                        ) : null}

                        <label className="mt-3 block">
                          <span className="wl-label">{t("add.whatWant")}</span>
                          <input
                            className="wl-input"
                            value={itemTitle}
                            maxLength={120}
                            placeholder={t("add.whatWantExample")}
                            required
                            onChange={(e) => setItemTitle(e.target.value)}
                          />
                        </label>
                        <label className="mt-3 block">
                          <span className="wl-label">{t("add.note")}</span>
                          <input
                            className="wl-input"
                            value={itemNote}
                            maxLength={500}
                            placeholder={t("add.noteExample")}
                            onChange={(e) => setItemNote(e.target.value)}
                          />
                        </label>

                        <p className="wl-label mt-4">{t("add.priority")}</p>
                        <div className="wl-priority" role="group" aria-label={t("a11y.priority")}>
                          {WISHLIST_PRIORITIES.filter((p) => p.key !== "surprise_me").map((p) => (
                            <button
                              key={p.key}
                              type="button"
                              aria-pressed={itemPriority === p.key}
                              onClick={() => setItemPriority(p.key)}
                            >
                              {PRIORITY_EMOJI[p.key]} {labelFor(WISHLIST_PRIORITIES, p.key, locale)}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="wl-details-toggle"
                          onClick={() => setShowDetails((v) => !v)}
                        >
                          {t("add.details")}
                        </button>
                        {showDetails ? (
                          <div className="mt-2 space-y-3">
                            {composer === "manual" ? (
                              <label className="block">
                                <span className="wl-label">{t("add.externalLink")}</span>
                                <input
                                  className="wl-input"
                                  value={itemUrl}
                                  placeholder={t("add.pasteLinkHint")}
                                  onChange={(e) => setItemUrl(e.target.value)}
                                />
                              </label>
                            ) : null}
                            <label className="block">
                              <span className="wl-label">{t("add.imageUrl")}</span>
                              <input
                                className="wl-input"
                                value={itemImage}
                                placeholder="https://"
                                onChange={(e) => setItemImage(e.target.value)}
                              />
                            </label>
                            <label className="block">
                              <span className="wl-label">{t("add.preferredPrice")}</span>
                              <input
                                className="wl-input"
                                value={itemBudget}
                                inputMode="decimal"
                                onChange={(e) => setItemBudget(e.target.value)}
                              />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block">
                                <span className="wl-label">{t("add.size")}</span>
                                <input className="wl-input" value={itemSize} maxLength={40} onChange={(e) => setItemSize(e.target.value)} />
                              </label>
                              <label className="block">
                                <span className="wl-label">{t("add.color")}</span>
                                <input className="wl-input" value={itemColor} maxLength={40} onChange={(e) => setItemColor(e.target.value)} />
                              </label>
                            </div>
                            <label className="block">
                              <span className="wl-label">{t("add.quantity")}</span>
                              <input
                                className="wl-input"
                                value={itemQty}
                                inputMode="numeric"
                                onChange={(e) => setItemQty(e.target.value)}
                              />
                            </label>
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button type="submit" className="wl-cta flex-1" disabled={busy || !itemTitle.trim()}>
                            {t("add.saveWish")}
                          </button>
                          <button type="button" className="wl-cta-ghost flex-1 !text-[var(--wl-ink)] !border-[rgba(26,18,15,0.15)]" onClick={resetComposer}>
                            {t("add.cancel")}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {owner.items.length > 0 && composer === "closed" ? (
                      <div className="wl-sticky-add">
                        <button type="button" className="wl-cta wl-cta--gold" onClick={() => openComposer("manual")}>
                          {t("add.wish")}
                        </button>
                        <div className="wl-mode-row">
                          <button type="button" className="wl-btn wl-btn--soft" onClick={() => openComposer("link")}>
                            {t("add.pasteLink")}
                          </button>
                          <button type="button" className="wl-btn wl-btn--soft" onClick={() => openComposer("manual")}>
                            {t("add.writeWish")}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="wl-share-panel">
                      <h3 className="wl-letter-title text-[1.25rem]">{t("share.cta")}</h3>
                      <p className="wl-hint">
                        {owner.share_enabled ? t("share.on") : t("share.enableFirst")}
                      </p>
                      <div className="wl-share-grid">
                        <button type="button" className="wl-btn wl-btn--primary" disabled={busy} onClick={() => void shareVia("copy")}>
                          {t("share.copyLink")}
                        </button>
                        <button type="button" className="wl-btn wl-btn--soft" disabled={busy} onClick={() => void shareVia("whatsapp")}>
                          {t("share.whatsapp")}
                        </button>
                        <button type="button" className="wl-btn wl-btn--soft" disabled={busy} onClick={() => void shareVia("email")}>
                          {t("share.email")}
                        </button>
                        <button type="button" className="wl-btn wl-btn--soft" disabled={busy} onClick={() => void shareVia("native")}>
                          {t("share.native")}
                        </button>
                      </div>
                      {shareHint ? <p className="wl-hint break-all">{shareHint}</p> : null}
                      {owner.share_enabled ? (
                        <button type="button" className="wl-btn wl-btn--danger mt-3" onClick={() => void toggleShare(false)}>
                          {t("share.turnOff")}
                        </button>
                      ) : null}
                      {owner.share_enabled && shareUrl ? (
                        <p className="wl-hint mt-2 break-all">{shareUrl}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="wl-section text-center">
                  <p className="text-[rgba(247,240,228,0.7)]">{t("crossSell.notSure")}</p>
                  <Link
                    className="wl-cta-ghost mt-3 inline-flex !w-auto"
                    to="/christmas/gift-finder"
                    onClick={() =>
                      void trackChristmasEvent("wishlist_gift_finder_clicked", {
                        productKey: PRODUCT,
                        pathname: PATH,
                      })
                    }
                  >
                    {t("crossSell.tryGiftFinder")}
                  </Link>
                </div>

                <div className="wl-section">
                  <h2 className="!text-left text-[1.25rem]">{t("crossSell.personalIdeas")}</h2>
                  <div className="wl-links !justify-start !mt-3">
                    <Link to="/christmas/photo-generator">{t("crossSell.addPortrait")}</Link>
                    <Link to="/christmas/santa-video">{t("crossSell.addSanta")}</Link>
                    <Link to="/christmas/cards">{t("crossSell.addCard")}</Link>
                    <Link to="/christmas/tree">{t("crossSell.addTree")}</Link>
                  </div>
                  <p className="mt-3 text-sm text-[rgba(247,240,228,0.55)]">{t("crossSell.putUnderTree")}</p>
                </div>
              </>
            )}

            {/* How it works + SEO / GEO */}
            <section className="wl-section" id={howId} aria-labelledby={`${howId}-title`}>
              <h2 id={`${howId}-title`}>{t("how.title")}</h2>
              <ol className="wl-how">
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    1
                  </span>
                  <h3>{t("how.1.title")}</h3>
                  <p>{t("how.1.body")}</p>
                </li>
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    2
                  </span>
                  <h3>{t("how.2.title")}</h3>
                  <p>{t("how.2.body")}</p>
                </li>
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    3
                  </span>
                  <h3>{t("how.3.title")}</h3>
                  <p>{t("how.3.body")}</p>
                </li>
                <li className="wl-how__step">
                  <span className="wl-how__num" aria-hidden>
                    4
                  </span>
                  <h3>{t("how.4.title")}</h3>
                  <p>{t("how.4.body")}</p>
                </li>
              </ol>
            </section>

            <section className="wl-section" aria-label={t("a11y.about")}>
              <article className="wl-seo-block">
                <h2>{t("seo.createTitle")}</h2>
                <p>{t("seo.createBody")}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{t("seo.anywhereTitle")}</h2>
                <p>{t("seo.anywhereBody")}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{t("seo.shareTitle")}</h2>
                <p>{t("seo.shareBody")}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{t("seo.duplicateTitle")}</h2>
                <p>{t("seo.duplicateBody")}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{t("seo.kidsTitle")}</h2>
                <p>{t("seo.kidsBody")}</p>
              </article>
              <article className="wl-seo-block">
                <h2>{t("geo.whatTitle")}</h2>
                <p>{t("geo.whatBody")}</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[rgba(247,240,228,0.78)]">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <li key={i}>{t(`geo.bullet.${i}`)}</li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="wl-section wl-faq" aria-label={t("faq.title")}>
              <h2>{t("faq.title")}</h2>
              {faq.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </section>

            <nav className="wl-links" aria-label={t("a11y.moreGifts")}>
              <Link to="/christmas/gift-finder">{t("nav.giftFinder")}</Link>
              <Link to="/christmas/tree">{t("nav.tree")}</Link>
              <Link to="/christmas/cards">{t("nav.cards")}</Link>
              <Link to="/christmas">{t("nav.all")}</Link>
            </nav>
          </>
        ) : null}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import { WISHLIST_PRIORITIES, labelFor, type LocaleCode } from "./wishlist/taxonomy";
import {
  itemCountBucket,
  readWishlistOwner,
  reorderIds,
  sanitizeExternalUrlClient,
  wishlistFunnel,
  writeWishlistOwner,
  type OwnerWishlist,
  type SharedWishlist,
} from "./wishlist/wishlistApi";

const PRODUCT = "christmas_wishlist";

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function ChristmasWishlistPage() {
  const { shareId: routeShareId } = useParams<{ shareId?: string }>();
  const isShare = Boolean(routeShareId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerWishlist | null>(null);
  const [shared, setShared] = useState<SharedWishlist | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [title, setTitle] = useState("My Christmas Wishlist");
  const [description, setDescription] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemPriority, setItemPriority] = useState("would_love");
  const [shareHint, setShareHint] = useState<string | null>(null);
  const viewed = useRef(false);
  const locale: LocaleCode = "en";

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
      setDescription(data.wishlist.description);
      setOwnerToken(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load wishlist");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent(
      (isShare ? "shared_wishlist_view" : "wishlist_page_view") as never,
      { productKey: PRODUCT, pathname: window.location.pathname },
    );
  }, [isShare]);

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
          /* optional */
        }
      })();
    }
  }, [isShare, routeShareId, loadOwner]);

  async function createList() {
    setBusy(true);
    setError(null);
    void trackChristmasEvent("wishlist_creation_started" as never, {
      productKey: PRODUCT,
      pathname: "/christmas/wishlist",
    });
    try {
      const data = await wishlistFunnel<{
        ok: boolean;
        wishlist_id: string;
        share_id: string;
        owner_token: string | null;
      }>(
        { action: "createWishlist", title, description },
        await authBearer(),
      );
      if (data.owner_token) {
        writeWishlistOwner({
          wishlistId: data.wishlist_id,
          ownerToken: data.owner_token,
          shareId: data.share_id,
        });
      }
      void trackChristmasEvent("wishlist_created" as never, {
        productKey: PRODUCT,
        pathname: "/christmas/wishlist",
      });
      await loadOwner(data.wishlist_id, data.owner_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    if (!owner) return;
    const url = itemUrl ? sanitizeExternalUrlClient(itemUrl) : null;
    if (itemUrl && !url) {
      setError("Link must start with https:// (or http://)");
      return;
    }
    setBusy(true);
    try {
      await wishlistFunnel(
        {
          action: "addWishlistItem",
          wishlist_id: owner.id,
          owner_token: ownerToken || undefined,
          title: itemTitle,
          note: itemNote,
          external_url: url,
          priority: itemPriority,
          source_type: "manual",
        },
        await authBearer(),
      );
      setItemTitle("");
      setItemNote("");
      setItemUrl("");
      void trackChristmasEvent("wishlist_item_added" as never, {
        productKey: PRODUCT,
        pathname: "/christmas/wishlist",
      });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
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
      void trackChristmasEvent("wishlist_item_reordered" as never, {
        productKey: PRODUCT,
        pathname: "/christmas/wishlist",
      });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed");
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
      void trackChristmasEvent("wishlist_item_removed" as never, {
        productKey: PRODUCT,
        pathname: "/christmas/wishlist",
      });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
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
        void trackChristmasEvent("wishlist_share_enabled" as never, {
          productKey: PRODUCT,
          pathname: "/christmas/wishlist",
        });
      }
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share update failed");
    } finally {
      setBusy(false);
    }
  }

  async function shareNative() {
    if (!owner?.share_enabled) return;
    const url = `${window.location.origin}/wishlist/${owner.share_id}`;
    void trackChristmasEvent("wishlist_share" as never, {
      productKey: PRODUCT,
      pathname: "/christmas/wishlist",
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Christmas Wishlist", url, text: "Here's my Christmas list." });
      } else {
        await navigator.clipboard.writeText(url);
        setShareHint("Link copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareHint("Link copied");
      } catch {
        setShareHint(url);
      }
    }
  }

  if (unavailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <PageHead title="Wishlist unavailable" description="This wishlist is private or unavailable." noindex />
        <h1 className="text-2xl font-semibold">This wishlist is private</h1>
        <Link className="mt-6 inline-block underline" to="/christmas/wishlist">
          Make your own wishlist
        </Link>
      </div>
    );
  }

  const items = owner?.items || shared?.items || [];

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden"
      style={{ background: "linear-gradient(165deg,#1a1520 0%,#101820 55%,#152018 100%)", color: "#f5f0e8" }}
    >
      <PageHead
        title={isShare ? "A Christmas Wishlist" : "Christmas Wishlist"}
        description={
          isShare
            ? "Someone shared their Christmas list with you."
            : "Make your Christmas list. Share one link."
        }
        noindex={isShare}
      />
      <div className="mx-auto max-w-lg px-4 pb-20 pt-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-amber-200/70">The Digital Gifter</p>
        <h1 className="mt-2 text-center font-serif text-3xl text-amber-50">
          {isShare ? shared?.title || "Christmas Wishlist" : owner?.title || "Your Christmas Wishlist"}
        </h1>
        <p className="mt-2 text-center text-sm text-amber-100/75">
          {isShare ? shared?.description || "A shared Christmas list" : "Make your Christmas list. Share one link."}
        </p>

        {error ? (
          <p className="mt-4 rounded-md bg-red-900/40 px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <ul className="mt-8 space-y-3" aria-label="Wishlist items">
          {items.length === 0 ? (
            <li className="text-center text-sm text-amber-100/60">No gifts yet</li>
          ) : (
            items.map((item, idx) => (
              <li key={item.id} className="rounded-md border border-white/15 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-amber-50">{item.title}</p>
                    {item.note ? <p className="mt-1 text-sm text-amber-100/75">{item.note}</p> : null}
                    {item.budget_amount != null ? (
                      <p className="mt-1 text-xs text-amber-100/60">
                        About {item.currency || "USD"} {item.budget_amount}
                      </p>
                    ) : null}
                    {item.external_url ? (
                      <a
                        className="mt-2 inline-block text-sm underline"
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (isShare && shared) {
                            void wishlistFunnel({
                              action: "trackWishlistExternalClick",
                              share_id: shared.share_id,
                            });
                            void trackChristmasEvent("wishlist_external_link_clicked" as never, {
                              productKey: PRODUCT,
                              pathname: window.location.pathname,
                            });
                          }
                        }}
                      >
                        Open link
                      </a>
                    ) : null}
                  </div>
                  {!isShare && owner ? (
                    <div className="flex flex-col gap-1 text-[10px]">
                      <button type="button" className="underline" onClick={() => void moveItem(idx, -1)}>
                        Up
                      </button>
                      <button type="button" className="underline" onClick={() => void moveItem(idx, 1)}>
                        Down
                      </button>
                      <button type="button" className="underline" onClick={() => void removeItem(item.id)}>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>

        {!isShare ? (
          <section className="mt-10 space-y-4" aria-label="Wishlist editor">
            <label className="block text-xs text-amber-100/70">
              Title
              <input
                className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block text-xs text-amber-100/70">
              Short note
              <textarea
                className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
                value={description}
                maxLength={500}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {!owner ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void createList()}
                className="w-full rounded-md bg-amber-200 py-3 text-sm font-semibold text-slate-900"
              >
                Save my wishlist
              </button>
            ) : (
              <>
                <div className="rounded-md border border-white/15 p-4">
                  <h2 className="text-sm font-medium">Add a gift</h2>
                  <label className="mt-3 block text-xs">
                    Title
                    <input
                      className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
                      value={itemTitle}
                      maxLength={120}
                      onChange={(e) => setItemTitle(e.target.value)}
                    />
                  </label>
                  <label className="mt-2 block text-xs">
                    Note
                    <input
                      className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
                      value={itemNote}
                      maxLength={500}
                      onChange={(e) => setItemNote(e.target.value)}
                    />
                  </label>
                  <label className="mt-2 block text-xs">
                    Link (optional)
                    <input
                      className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
                      value={itemUrl}
                      placeholder="https://"
                      onChange={(e) => setItemUrl(e.target.value)}
                    />
                  </label>
                  <label className="mt-2 block text-xs">
                    Priority
                    <select
                      className="mt-1 w-full rounded-md bg-white/10 px-2 py-2 text-sm"
                      value={itemPriority}
                      onChange={(e) => setItemPriority(e.target.value)}
                    >
                      {WISHLIST_PRIORITIES.map((p) => (
                        <option key={p.key} value={p.key}>
                          {labelFor(WISHLIST_PRIORITIES, p.key, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md border border-amber-200/40 py-2 text-sm"
                    disabled={busy || !itemTitle.trim()}
                    onClick={() => void addItem()}
                  >
                    Add gift
                  </button>
                </div>

                <div className="rounded-md border border-white/15 p-4">
                  <h2 className="text-sm font-medium">Share your list</h2>
                  <p className="mt-1 text-xs text-amber-100/65">Private until you enable sharing.</p>
                  {!owner.share_enabled ? (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-md bg-emerald-500/90 py-2.5 text-sm font-semibold text-slate-950"
                      onClick={() => void toggleShare(true)}
                    >
                      Enable sharing
                    </button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        className="w-full rounded-md bg-emerald-500/90 py-2.5 text-sm font-semibold text-slate-950"
                        onClick={() => void shareNative()}
                      >
                        Share link
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md border border-white/20 py-2 text-sm"
                        onClick={() => void toggleShare(false)}
                      >
                        Turn sharing off
                      </button>
                      {shareHint ? <p className="break-all text-xs">{shareHint}</p> : null}
                    </div>
                  )}
                </div>

                <p className="text-center text-xs text-amber-100/55">
                  {items.length} item{items.length === 1 ? "" : "s"} · {itemCountBucket(items.length)}
                </p>
              </>
            )}
          </section>
        ) : null}

        <p className="mt-10 text-center text-sm">
          {isShare ? (
            <>
              <Link className="underline" to="/christmas/wishlist">
                Make your own wishlist
              </Link>
              {" · "}
              <Link className="underline" to="/christmas/gift-finder">
                Need another gift idea? Try Gift Finder
              </Link>
            </>
          ) : (
            <>
              <Link className="underline" to="/christmas/gift-finder">
                Find gift ideas
              </Link>
              {" · "}
              <Link className="underline" to="/christmas/cards">
                Create a Christmas Card
              </Link>
              {" · "}
              <Link className="underline" to="/christmas/tree">
                Put a special gift under your Christmas Tree
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

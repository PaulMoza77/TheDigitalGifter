import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { parseChristmasLocalePath } from "@/features/christmas/seo/localeRouting";
import { normalizeWave1GenerationLocale } from "@/features/christmas/i18n/wave1Locale";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import { treeT, type TreeLocale } from "./tree/treeCopy";
import { ChristmasTreeVisual } from "./tree/ChristmasTreeVisual";
import {
  BOX_STYLES,
  defaultDecorations,
  readOwnerRecovery,
  treeFunnel,
  TREE_STYLES,
  writeOwnerRecovery,
  type BoxStyle,
  type Decorations,
  type OwnerTree,
  type SharedTree,
  type TreeStyle,
} from "./tree/treeApi";
import { giftCountBucket, reorderIds } from "./tree/treeLogic";
import {
  ChristmasProductSeoDepth,
  TREE_SEO_DEPTH,
} from "./seo/ChristmasProductSeoDepth";

type Mode = "create" | "owner" | "shared" | "unavailable";

const PRODUCT_KEY = "christmas_tree";

async function authBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function ChristmasTreePage() {
  const { shareId: routeShareId } = useParams<{ shareId?: string }>();
  const location = useLocation();
  const locale = normalizeWave1GenerationLocale(
    parseChristmasLocalePath(location.pathname).locale,
  ) as TreeLocale;
  const t = useCallback(
    (key: string, vars?: Record<string, string>) => treeT(key, locale, vars),
    [locale],
  );
  const isShareRoute = Boolean(routeShareId);
  const [mode, setMode] = useState<Mode>(isShareRoute ? "shared" : "create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerTree | null>(null);
  const [shared, setShared] = useState<SharedTree | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [title, setTitle] = useState(() => treeT("defaults.title", locale));
  const [message, setMessage] = useState(() => treeT("defaults.message", locale));
  const [fromName, setFromName] = useState("");
  const [style, setStyle] = useState<TreeStyle>("classic");
  const [decor, setDecor] = useState<Decorations>(defaultDecorations());
  const [giftName, setGiftName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftBox, setGiftBox] = useState<BoxStyle>("red");
  const [reveal, setReveal] = useState<{ name: string; message: string } | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const pageViewed = useRef(false);

  useEffect(() => {
    if (mode === "create" && !owner) {
      setTitle(t("defaults.title"));
      setMessage(t("defaults.message"));
    }
  }, [locale, mode, owner, t]);

  const loadOwner = useCallback(async (treeId: string, token: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const data = await treeFunnel<{ ok: boolean; tree: OwnerTree }>(
        {
          action: "getOwnerTree",
          tree_id: treeId,
          owner_token: token || undefined,
        },
        await authBearer(),
      );
      setOwner(data.tree);
      setTitle(data.tree.title);
      setMessage(data.tree.message);
      setFromName(data.tree.from_name);
      setStyle(data.tree.tree_style);
      setDecor({ ...defaultDecorations(), ...data.tree.decoration_config });
      setOwnerToken(token);
      setMode("owner");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.load"));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (pageViewed.current) return;
    pageViewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent(isShareRoute ? "shared_tree_view" : "christmas_tree_view", {
      productKey: PRODUCT_KEY,
      pathname: window.location.pathname,
    });
  }, [isShareRoute]);

  useEffect(() => {
    if (isShareRoute && routeShareId) {
      let cancelled = false;
      (async () => {
        setBusy(true);
        try {
          const data = await treeFunnel<{ ok: boolean; tree: SharedTree }>({
            action: "getSharedTree",
            share_id: routeShareId,
          });
          if (cancelled) return;
          setShared(data.tree);
          setMode("shared");
        } catch {
          if (!cancelled) {
            setMode("unavailable");
            setShared(null);
          }
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    const recovery = readOwnerRecovery();
    if (recovery) {
      void loadOwner(recovery.treeId, recovery.ownerToken);
      void (async () => {
        const bearer = await authBearer();
        if (!bearer) return;
        try {
          await treeFunnel(
            {
              action: "claimGuestTree",
              tree_id: recovery.treeId,
              owner_token: recovery.ownerToken,
            },
            bearer,
          );
          writeOwnerRecovery(null);
          await loadOwner(recovery.treeId, null);
        } catch {
          /* claim optional */
        }
      })();
    }
  }, [isShareRoute, routeShareId, loadOwner]);

  async function createTree() {
    setBusy(true);
    setError(null);
    void trackChristmasEvent("tree_creation_started", {
      productKey: PRODUCT_KEY,
      pathname: "/christmas/tree",
    });
    try {
      const data = await treeFunnel<{
        ok: boolean;
        tree_id: string;
        share_id: string;
        owner_token: string | null;
      }>(
        {
          action: "createTree",
          title,
          message,
          from_name: fromName,
          tree_style: style,
          decoration_config: decor,
        },
        await authBearer(),
      );
      if (data.owner_token) {
        writeOwnerRecovery({
          treeId: data.tree_id,
          ownerToken: data.owner_token,
          shareId: data.share_id,
        });
        setOwnerToken(data.owner_token);
      }
      void trackChristmasEvent("tree_created", {
        productKey: PRODUCT_KEY,
        pathname: "/christmas/tree",
      });
      await loadOwner(data.tree_id, data.owner_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.create"));
    } finally {
      setBusy(false);
    }
  }

  async function saveCustomization() {
    if (!owner) return;
    setBusy(true);
    try {
      await treeFunnel(
        {
          action: "updateTree",
          tree_id: owner.id,
          owner_token: ownerToken || undefined,
          title,
          message,
          from_name: fromName,
          tree_style: style,
          decoration_config: decor,
        },
        await authBearer(),
      );
      void trackChristmasEvent("tree_customized", {
        productKey: PRODUCT_KEY,
        pathname: "/christmas/tree",
      });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.save"));
    } finally {
      setBusy(false);
    }
  }

  async function addGift() {
    if (!owner) return;
    setBusy(true);
    try {
      await treeFunnel(
        {
          action: "addGift",
          tree_id: owner.id,
          owner_token: ownerToken || undefined,
          display_name: giftName,
          message: giftMessage,
          box_style: giftBox,
          gift_type: "message",
        },
        await authBearer(),
      );
      setGiftName("");
      setGiftMessage("");
      void trackChristmasEvent("gift_added", {
        productKey: PRODUCT_KEY,
        pathname: "/christmas/tree",
      });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.addGift"));
    } finally {
      setBusy(false);
    }
  }

  async function moveGift(index: number, dir: -1 | 1) {
    if (!owner) return;
    const ids = owner.gifts.map((g) => g.id);
    const next = reorderIds(ids, index, index + dir);
    if (next.join() === ids.join()) return;
    setBusy(true);
    try {
      await treeFunnel(
        {
          action: "reorderGifts",
          tree_id: owner.id,
          owner_token: ownerToken || undefined,
          gift_ids: next,
        },
        await authBearer(),
      );
      void trackChristmasEvent("gift_reordered", {
        productKey: PRODUCT_KEY,
        pathname: "/christmas/tree",
      });
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.reorder"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleShare(enabled: boolean) {
    if (!owner) return;
    setBusy(true);
    try {
      await treeFunnel(
        {
          action: "setShareEnabled",
          tree_id: owner.id,
          owner_token: ownerToken || undefined,
          share_enabled: enabled,
        },
        await authBearer(),
      );
      if (enabled) {
        void trackChristmasEvent("tree_share_enabled", {
          productKey: PRODUCT_KEY,
          pathname: "/christmas/tree",
        });
      }
      await loadOwner(owner.id, ownerToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.share"));
    } finally {
      setBusy(false);
    }
  }

  async function shareNative() {
    if (!owner?.share_enabled) return;
    const url = `${window.location.origin}/christmas/tree/${owner.share_id}`;
    void trackChristmasEvent("tree_share", {
      productKey: PRODUCT_KEY,
      pathname: "/christmas/tree",
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: t("share.nativeTitle"), url, text: t("share.nativeText") });
      } else {
        await navigator.clipboard.writeText(url);
        setShareHint(t("share.copied"));
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareHint(t("share.copied"));
      } catch {
        setShareHint(url);
      }
    }
  }

  async function openGift(giftId: string, shareId: string) {
    setBusy(true);
    try {
      const data = await treeFunnel<{
        ok: boolean;
        gift: { display_name: string; message: string };
      }>({
        action: "openGift",
        share_id: shareId,
        gift_id: giftId,
      });
      setReveal({ name: data.gift.display_name || t("gift.defaultName"), message: data.gift.message || "" });
      void trackChristmasEvent("gift_opened", {
        productKey: PRODUCT_KEY,
        pathname: window.location.pathname,
      });
      if (shared) {
        const refreshed = await treeFunnel<{ ok: boolean; tree: SharedTree }>({
          action: "getSharedTree",
          share_id: shareId,
        });
        setShared(refreshed.tree);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.open"));
    } finally {
      setBusy(false);
    }
  }

  const viewStyle = owner?.tree_style || shared?.tree_style || style;
  const viewDecor = owner?.decoration_config
    ? { ...defaultDecorations(), ...owner.decoration_config }
    : shared?.decoration_config
      ? { ...defaultDecorations(), ...shared.decoration_config }
      : decor;
  const gifts = owner?.gifts || shared?.gifts || [];

  if (mode === "unavailable") {
    return (
      <div className="mx-auto min-h-[70vh] max-w-lg px-4 py-16 text-center">
        <PageHead
          title={t("unavailable.metaTitle")}
          description={t("unavailable.metaDesc")}
          noindex
        />
        <h1 className="text-2xl font-semibold text-slate-900">{t("unavailable.title")}</h1>
        <p className="mt-3 text-slate-600">{t("unavailable.body")}</p>
        <Link className="mt-8 inline-block underline" to="/christmas/tree">
          {t("unavailable.cta")}
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a3a2a 0%, #0b1520 45%, #120a14 100%)",
        color: "#f4efe6",
      }}
    >
      {isShareRoute ? (
        <PageHead
          title={t("title.fallback")}
          description={t("lede.shareMeta")}
          noindex
        />
      ) : (
        <ChristmasPageHead path="/christmas/tree" />
      )}

      <div className="mx-auto max-w-lg px-4 pb-24 pt-8">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-amber-200/80">
          {t("brand")}
        </p>
        <h1 className="mt-2 text-center font-serif text-3xl tracking-tight text-amber-50 sm:text-4xl">
          {isShareRoute
            ? shared?.title || t("title.shared")
            : owner
              ? owner.title
              : t("title.create")}
        </h1>
        <p className="mt-2 text-center text-sm text-amber-100/75">
          {isShareRoute
            ? shared?.from_name
              ? t("lede.from", { name: shared.from_name })
              : t("lede.shared")
            : t("lede.create")}
        </p>

        <div className="mt-6">
          <ChristmasTreeVisual style={viewStyle} decorations={viewDecor} />
        </div>

        {error ? (
          <p className="mt-4 rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-100" role="alert">
            {error}
          </p>
        ) : null}

        {/* Gifts under tree */}
        <section className="mt-6" aria-label={t("gifts.heading")}>
          <h2 className="text-sm font-medium text-amber-100/90">{t("gifts.heading")}</h2>
          <ul className="mt-3 flex flex-wrap justify-center gap-3">
            {gifts.length === 0 ? (
              <li className="text-sm text-amber-100/60">{t("gifts.empty")}</li>
            ) : (
              gifts.map((g, idx) => (
                <li key={g.id} className="flex flex-col items-center gap-1">
                  {mode === "shared" ? (
                    <button
                      type="button"
                      disabled={busy || g.can_open === false}
                      aria-label={t("gifts.openAria", { name: g.display_name || String(idx + 1) })}
                      onClick={() => void openGift(g.id, shared!.share_id)}
                      className="h-14 w-14 rounded-md border border-amber-200/30 shadow-md transition hover:scale-105 disabled:opacity-40"
                      style={{
                        background:
                          g.box_style === "gold"
                            ? "linear-gradient(145deg,#d4af37,#8a6d1a)"
                            : g.box_style === "green"
                              ? "linear-gradient(145deg,#2ecc71,#1a6b3a)"
                              : g.box_style === "blue"
                                ? "linear-gradient(145deg,#5dade2,#1a5276)"
                                : g.box_style === "snow"
                                  ? "linear-gradient(145deg,#f8f9f9,#aeb6bf)"
                                  : "linear-gradient(145deg,#e74c3c,#922b21)",
                      }}
                    />
                  ) : (
                    <div
                      className="h-14 w-14 rounded-md border border-amber-200/30"
                      style={{
                        background:
                          g.box_style === "gold"
                            ? "linear-gradient(145deg,#d4af37,#8a6d1a)"
                            : "linear-gradient(145deg,#e74c3c,#922b21)",
                      }}
                      aria-hidden
                    />
                  )}
                  <span className="max-w-[4.5rem] truncate text-center text-[11px] text-amber-100/80">
                    {g.display_name || t("gifts.fallbackName", { n: String(idx + 1) })}
                  </span>
                  {mode === "owner" ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded px-1 text-[10px] underline"
                        aria-label={t("gifts.moveEarlier")}
                        onClick={() => void moveGift(idx, -1)}
                      >
                        {t("gifts.up")}
                      </button>
                      <button
                        type="button"
                        className="rounded px-1 text-[10px] underline"
                        aria-label={t("gifts.moveLater")}
                        onClick={() => void moveGift(idx, 1)}
                      >
                        {t("gifts.down")}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          {mode === "shared" && shared?.message ? (
            <p className="mt-4 text-center text-sm text-amber-50/90">{shared.message}</p>
          ) : null}
        </section>

        {/* Owner / create controls */}
        {!isShareRoute && mode !== "shared" ? (
          <section className="mt-10 space-y-6" aria-label={t("editor.aria")}>
            <div>
              <label className="block text-xs text-amber-100/70" htmlFor="tree-style">
                {t("editor.style")}
              </label>
              <div className="mt-2 flex flex-wrap gap-2" id="tree-style" role="group">
                {TREE_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStyle(s.key)}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      style === s.key
                        ? "bg-amber-200 text-slate-900"
                        : "bg-white/10 text-amber-50"
                    }`}
                  >
                    {t(`treeStyle.${s.key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-amber-100/70">
                {t("editor.lights")}
                <input
                  className="ml-2 align-middle"
                  type="checkbox"
                  checked={decor.lights}
                  onChange={(e) => setDecor((d) => ({ ...d, lights: e.target.checked }))}
                />
              </label>
              <label className="block text-xs text-amber-100/70">
                {t("editor.snow")}
                <input
                  className="ml-2 align-middle"
                  type="checkbox"
                  checked={decor.snow}
                  onChange={(e) => setDecor((d) => ({ ...d, snow: e.target.checked }))}
                />
              </label>
              <label className="block text-xs text-amber-100/70">
                {t("editor.topper")}
                <select
                  className="mt-1 w-full rounded-md bg-white/10 px-2 py-2 text-sm text-amber-50"
                  value={decor.topper}
                  onChange={(e) =>
                    setDecor((d) => ({
                      ...d,
                      topper: e.target.value as Decorations["topper"],
                    }))
                  }
                >
                  <option value="star">{t("topper.star")}</option>
                  <option value="angel">{t("topper.angel")}</option>
                  <option value="bow">{t("topper.bow")}</option>
                  <option value="none">{t("topper.none")}</option>
                </select>
              </label>
              <label className="block text-xs text-amber-100/70">
                {t("editor.ornaments")}
                <select
                  className="mt-1 w-full rounded-md bg-white/10 px-2 py-2 text-sm text-amber-50"
                  value={decor.ornaments}
                  onChange={(e) =>
                    setDecor((d) => ({
                      ...d,
                      ornaments: e.target.value as Decorations["ornaments"],
                    }))
                  }
                >
                  <option value="classic">{t("ornaments.classic")}</option>
                  <option value="gold">{t("ornaments.gold")}</option>
                  <option value="minimal">{t("ornaments.minimal")}</option>
                  <option value="colorful">{t("ornaments.colorful")}</option>
                </select>
              </label>
            </div>

            <label className="block text-xs text-amber-100/70">
              {t("editor.title")}
              <input
                className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm text-amber-50"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block text-xs text-amber-100/70">
              {t("editor.greeting")}
              <textarea
                className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm text-amber-50"
                value={message}
                maxLength={500}
                rows={2}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label className="block text-xs text-amber-100/70">
              {t("editor.from")}
              <input
                className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm text-amber-50"
                value={fromName}
                maxLength={80}
                onChange={(e) => setFromName(e.target.value)}
              />
            </label>

            {!owner ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void createTree()}
                className="w-full rounded-md bg-amber-200 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {busy ? t("editor.saving") : t("editor.saveCreate")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveCustomization()}
                  className="w-full rounded-md bg-amber-200 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  {t("editor.saveChanges")}
                </button>

                <div className="rounded-md border border-white/15 p-4">
                  <h3 className="text-sm font-medium">{t("gift.add")}</h3>
                  <label className="mt-3 block text-xs text-amber-100/70">
                    {t("gift.for")}
                    <input
                      className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
                      value={giftName}
                      maxLength={80}
                      onChange={(e) => setGiftName(e.target.value)}
                    />
                  </label>
                  <label className="mt-2 block text-xs text-amber-100/70">
                    {t("gift.message")}
                    <textarea
                      className="mt-1 w-full rounded-md bg-white/10 px-3 py-2 text-sm"
                      value={giftMessage}
                      maxLength={800}
                      rows={2}
                      onChange={(e) => setGiftMessage(e.target.value)}
                    />
                  </label>
                  <label className="mt-2 block text-xs text-amber-100/70">
                    {t("gift.box")}
                    <select
                      className="mt-1 w-full rounded-md bg-white/10 px-2 py-2 text-sm"
                      value={giftBox}
                      onChange={(e) => setGiftBox(e.target.value as BoxStyle)}
                    >
                      {BOX_STYLES.map((b) => (
                        <option key={b.key} value={b.key}>
                          {t(`box.${b.key}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md border border-amber-200/40 py-2 text-sm"
                    disabled={busy}
                    onClick={() => void addGift()}
                  >
                    {t("gift.addCta")}
                  </button>
                  <p className="mt-3 text-xs text-amber-100/60">
                    {t("gift.wantMore")}{" "}
                    <Link className="underline" to="/christmas/photo-generator">
                      {t("gift.crossPortrait")}
                    </Link>{" "}
                    ·{" "}
                    <Link className="underline" to="/christmas/santa-video">
                      {t("gift.crossSanta")}
                    </Link>
                  </p>
                </div>

                <div className="rounded-md border border-white/15 p-4">
                  <h3 className="text-sm font-medium">{t("share.heading")}</h3>
                  <p className="mt-1 text-xs text-amber-100/65">{t("share.privacy")}</p>
                  {!owner.share_enabled ? (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-md bg-emerald-500/90 py-2.5 text-sm font-semibold text-slate-950"
                      disabled={busy}
                      onClick={() => void toggleShare(true)}
                    >
                      {t("share.enable")}
                    </button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        className="w-full rounded-md bg-emerald-500/90 py-2.5 text-sm font-semibold text-slate-950"
                        onClick={() => void shareNative()}
                      >
                        {t("share.link")}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md border border-white/20 py-2 text-sm"
                        onClick={() => void toggleShare(false)}
                      >
                        {t("share.off")}
                      </button>
                      {shareHint ? (
                        <p className="break-all text-xs text-amber-100/80">{shareHint}</p>
                      ) : null}
                    </div>
                  )}
                </div>

                <p className="text-center text-xs text-amber-100/55">
                  {gifts.length === 1 ? t("gifts.countOne") : t("gifts.count", { count: String(gifts.length) })} · bucket{" "}
                  {giftCountBucket(gifts.length)}
                </p>

                <div className="text-center text-sm">
                  <Link className="underline" to="/christmas/advent">
                    {t("nav.openAdvent")}
                  </Link>
                </div>
              </>
            )}
          </section>
        ) : null}

        {isShareRoute ? (
          <p className="mt-10 text-center text-sm text-amber-100/70">
            <Link className="underline" to="/christmas/tree">
              {t("nav.makeOwn")}
            </Link>
            {" · "}
            <Link className="underline" to="/christmas/advent">
              {t("nav.advent")}
            </Link>
          </p>
        ) : (
          <ChristmasProductSeoDepth content={TREE_SEO_DEPTH} tone="dark" />
        )}
      </div>

      {reveal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t("reveal.aria")}
        >
          <div className="w-full max-w-md rounded-lg bg-[#1a2430] p-6 text-amber-50 shadow-xl">
            <h2 className="font-serif text-xl">{reveal.name}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-amber-100/90">{reveal.message}</p>
            <button
              type="button"
              className="mt-6 w-full rounded-md bg-amber-200 py-2.5 text-sm font-semibold text-slate-900"
              onClick={() => setReveal(null)}
            >
              {t("reveal.close")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

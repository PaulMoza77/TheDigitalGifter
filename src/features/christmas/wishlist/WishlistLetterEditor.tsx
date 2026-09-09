import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  sanitizeExternalUrlClient,
  type OwnerWishlist,
  type WishlistItem,
} from "./wishlistApi";
import {
  DEFAULT_LETTER,
  WISH_PLACEHOLDER,
  extractUrlFromWishText,
  parseLetterDescription,
  serializeLetterDescription,
  signatureFromTitle,
  type LetterFraming,
} from "./letterModel";
import { WishlistLetterShell } from "./WishlistLetterShell";
import { ShareWishlistSheet } from "./ShareWishlistSheet";
import { WishDetailSheet, WishLineMeta, WishPriorityMark } from "./WishDetailSheet";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  owner: OwnerWishlist;
  busy: boolean;
  error: string | null;
  shareUrl: string;
  shareHint: string | null;
  profileName?: string | null;
  onMetaSave: (patch: { title?: string; description?: string }) => Promise<void>;
  onAddWish: (input: {
    title: string;
    external_url?: string | null;
    note?: string;
    priority?: string;
  }) => Promise<void>;
  onUpdateWish: (
    itemId: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  onRemoveWish: (itemId: string) => Promise<void>;
  onReorder: (itemIds: string[]) => Promise<void>;
  onShare: (channel: "native" | "copy" | "whatsapp") => Promise<void>;
  onPreviewGuest: () => void;
};

type DraftLine = { key: string; text: string };

function newDraftKey() {
  return `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function WishlistLetterEditor({
  owner,
  busy,
  error,
  shareUrl,
  shareHint,
  profileName,
  onMetaSave,
  onAddWish,
  onUpdateWish,
  onRemoveWish,
  onReorder,
  onShare,
  onPreviewGuest,
}: Props) {
  const framingSeed = parseLetterDescription(owner.description);
  const [title, setTitle] = useState(owner.title || "My Christmas Wishlist");
  const [framing, setFraming] = useState<LetterFraming>(() => ({
    ...framingSeed,
    signature:
      framingSeed.signature ||
      signatureFromTitle(owner.title) ||
      String(profileName || "").trim() ||
      "",
  }));
  const [localTitles, setLocalTitles] = useState<Record<string, string>>(() =>
    Object.fromEntries(owner.items.map((i) => [i.id, i.title])),
  );
  const [draft, setDraft] = useState<DraftLine>({ key: newDraftKey(), text: "" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [detailItem, setDetailItem] = useState<WishlistItem | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [finishedOnce, setFinishedOnce] = useState(owner.items.length > 0 && owner.share_enabled);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const draftInputRef = useRef<HTMLInputElement>(null);
  const lineRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusAfterAdd = useRef(false);

  // Sync when owner reloads from server
  useEffect(() => {
    setTitle(owner.title || "My Christmas Wishlist");
    const next = parseLetterDescription(owner.description);
    setFraming((prev) => ({
      ...next,
      signature: next.signature || prev.signature || signatureFromTitle(owner.title) || String(profileName || "").trim(),
    }));
    setLocalTitles(Object.fromEntries(owner.items.map((i) => [i.id, i.title])));
  }, [owner.id, owner.title, owner.description, owner.items, profileName]);

  useEffect(() => {
    if (focusAfterAdd.current) {
      focusAfterAdd.current = false;
      draftInputRef.current?.focus();
    }
  }, [owner.items.length, draft.key]);

  const flashSaved = useCallback(() => {
    setSaveStatus("saved");
    window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1600);
  }, []);

  const scheduleMetaSave = useCallback(
    (nextTitle: string, nextFraming: LetterFraming) => {
      if (metaTimer.current) clearTimeout(metaTimer.current);
      metaTimer.current = setTimeout(() => {
        setSaveStatus("saving");
        void onMetaSave({
          title: nextTitle.trim() || "My Christmas Wishlist",
          description: serializeLetterDescription(nextFraming),
        })
          .then(flashSaved)
          .catch(() => setSaveStatus("error"));
      }, 650);
    },
    [onMetaSave, flashSaved],
  );

  function updateFraming(patch: Partial<LetterFraming>) {
    setFraming((prev) => {
      const next = { ...prev, ...patch };
      scheduleMetaSave(title, next);
      return next;
    });
  }

  function updateTitle(value: string) {
    setTitle(value);
    scheduleMetaSave(value, framing);
  }

  function scheduleTitleSave(item: WishlistItem, value: string) {
    if (titleTimers.current[item.id]) clearTimeout(titleTimers.current[item.id]);
    titleTimers.current[item.id] = setTimeout(() => {
      void persistWishTitle(item, value);
    }, 500);
  }

  async function persistWishTitle(item: WishlistItem, value: string) {
    const extracted = extractUrlFromWishText(value);
    const titleText = extracted.title.trim();
    if (!titleText) return;
    if (titleText === item.title && (!extracted.url || extracted.url === item.external_url)) return;
    setSaveStatus("saving");
    try {
      await onUpdateWish(item.id, {
        title: titleText,
        ...(extracted.url ? { external_url: extracted.url } : {}),
      });
      flashSaved();
    } catch {
      setSaveStatus("error");
    }
  }

  async function commitDraft(andContinue: boolean) {
    const extracted = extractUrlFromWishText(draft.text);
    const titleText = extracted.title.trim();
    if (!titleText || titleText === WISH_PLACEHOLDER) return;
    setSaveStatus("saving");
    try {
      await onAddWish({
        title: titleText,
        external_url: extracted.url,
        priority: "would_love",
      });
      setDraft({ key: newDraftKey(), text: "" });
      if (andContinue) focusAfterAdd.current = true;
      flashSaved();
    } catch {
      setSaveStatus("error");
    }
  }

  async function handleLineKeyDown(item: WishlistItem, index: number, e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = localTitles[item.id] ?? item.title;
      if (titleTimers.current[item.id]) {
        clearTimeout(titleTimers.current[item.id]);
        await persistWishTitle(item, value);
      }
      // Focus next line or draft
      const next = owner.items[index + 1];
      if (next) {
        lineRefs.current[next.id]?.focus();
      } else {
        await commitDraft(true);
        draftInputRef.current?.focus();
      }
      return;
    }
    if (e.key === "Backspace") {
      const value = localTitles[item.id] ?? item.title;
      if (value.length === 0) {
        e.preventDefault();
        setSaveStatus("saving");
        try {
          await onRemoveWish(item.id);
          const prev = owner.items[index - 1];
          if (prev) lineRefs.current[prev.id]?.focus();
          else draftInputRef.current?.focus();
          flashSaved();
        } catch {
          setSaveStatus("error");
        }
      }
    }
  }

  async function handleDraftKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      await commitDraft(true);
      return;
    }
    if (e.key === "Backspace" && draft.text.length === 0 && owner.items.length > 0) {
      e.preventDefault();
      const last = owner.items[owner.items.length - 1];
      lineRefs.current[last.id]?.focus();
    }
  }

  async function moveWish(index: number, dir: -1 | 1) {
    const ids = owner.items.map((i) => i.id);
    const to = index + dir;
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    setSaveStatus("saving");
    try {
      await onReorder(next);
      flashSaved();
    } catch {
      setSaveStatus("error");
    }
  }

  const items = owner.items;
  const showFinish = !finishedOnce;

  return (
    <>
      <WishlistLetterShell
        ariaLabel={title}
        saveStatus={saveStatus}
        footerNote={
          <p className="wl-desk__tagline">Make your Christmas list. Share one link.</p>
        }
      >
        <label className="wl-letter-field">
          <span className="sr-only">Wishlist title</span>
          <input
            className="wl-ink-title"
            value={title}
            maxLength={80}
            onChange={(e) => updateTitle(e.target.value)}
            aria-label="Wishlist title"
          />
        </label>
        <div className="wl-ink-divider" aria-hidden>
          <span>♡</span>
        </div>

        <label className="wl-letter-field">
          <span className="sr-only">Salutation</span>
          <input
            className="wl-ink-salutation"
            value={framing.salutation}
            maxLength={60}
            onChange={(e) => updateFraming({ salutation: e.target.value })}
            aria-label="Letter salutation"
          />
        </label>

        <label className="wl-letter-field">
          <span className="sr-only">Letter introduction</span>
          <textarea
            className="wl-ink-intro"
            value={framing.intro}
            maxLength={320}
            rows={2}
            onChange={(e) => updateFraming({ intro: e.target.value })}
            aria-label="Letter introduction"
          />
        </label>

        {error ? (
          <p className="wl-alert" role="alert">
            {error}
          </p>
        ) : null}

        <ol className="wl-wish-lines" aria-label="Your wishes">
          {items.map((item, index) => (
            <li key={item.id} className="wl-wish-line">
              <span className="wl-wish-line__num" aria-hidden>
                {index + 1}.
              </span>
              <div className="wl-wish-line__body">
                <div className="wl-wish-line__row">
                  <input
                    ref={(el) => {
                      lineRefs.current[item.id] = el;
                    }}
                    className="wl-ink-wish"
                    value={localTitles[item.id] ?? item.title}
                    maxLength={120}
                    aria-label={`Wish ${index + 1}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalTitles((prev) => ({ ...prev, [item.id]: v }));
                      scheduleTitleSave(item, v);
                    }}
                    onKeyDown={(e) => void handleLineKeyDown(item, index, e)}
                    onBlur={() => {
                      const v = localTitles[item.id] ?? item.title;
                      void persistWishTitle(item, v);
                    }}
                  />
                  <WishPriorityMark priority={item.priority} />
                  <button
                    type="button"
                    className="wl-wish-line__details"
                    aria-label={`Details for wish ${index + 1}`}
                    onClick={() => setDetailItem(item)}
                  >
                    Details
                  </button>
                  <div className="wl-wish-line__reorder">
                    <button
                      type="button"
                      aria-label="Move wish up"
                      disabled={busy || index === 0}
                      onClick={() => void moveWish(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move wish down"
                      disabled={busy || index === items.length - 1}
                      onClick={() => void moveWish(index, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <WishLineMeta item={item} />
              </div>
            </li>
          ))}

          <li className="wl-wish-line wl-wish-line--draft">
            <span className="wl-wish-line__num" aria-hidden>
              {items.length + 1}.
            </span>
            <div className="wl-wish-line__body">
              <input
                key={draft.key}
                ref={draftInputRef}
                className="wl-ink-wish"
                value={draft.text}
                maxLength={120}
                placeholder={items.length === 0 ? WISH_PLACEHOLDER : "Write another wish…"}
                aria-label={items.length === 0 ? "First wish" : "New wish"}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                onKeyDown={(e) => void handleDraftKeyDown(e)}
                onBlur={() => {
                  if (draft.text.trim()) void commitDraft(false);
                }}
              />
            </div>
          </li>
        </ol>

        <div className="wl-letter-closing">
          <p className="wl-ink-thanks">Thank you for making Christmas magical.</p>
          <label className="wl-letter-field">
            <span className="sr-only">Closing</span>
            <input
              className="wl-ink-closing"
              value={framing.closing || DEFAULT_LETTER.closing}
              maxLength={40}
              onChange={(e) => updateFraming({ closing: e.target.value })}
              aria-label="Letter closing"
            />
          </label>
          <label className="wl-letter-field">
            <span className="sr-only">Your name</span>
            <input
              className="wl-ink-signature"
              value={framing.signature}
              maxLength={40}
              placeholder="Your name"
              onChange={(e) => updateFraming({ signature: e.target.value })}
              aria-label="Signature name"
            />
          </label>
        </div>
      </WishlistLetterShell>

      <div className="wl-letter-actions">
        {showFinish ? (
          <button
            type="button"
            className="wl-action wl-action--primary"
            disabled={busy}
            onClick={() => {
              setFinishedOnce(true);
              setShareOpen(true);
              void onShare("copy").catch(() => undefined);
            }}
          >
            Finish my wishlist
          </button>
        ) : (
          <button
            type="button"
            className="wl-action wl-action--primary"
            disabled={busy}
            onClick={() => {
              setShareOpen(true);
            }}
          >
            Share Wishlist
          </button>
        )}
        <button type="button" className="wl-action wl-action--ghost" disabled={busy || !owner.share_id} onClick={onPreviewGuest}>
          Preview as Guest
        </button>
        <button
          type="button"
          className="wl-action wl-action--ghost"
          disabled={busy}
          onClick={() => {
            draftInputRef.current?.focus();
          }}
        >
          + Add Wish
        </button>
      </div>

      <p className="wl-finder-link">
        <Link to="/christmas/gift-finder">Not sure what to wish for? Find gift ideas →</Link>
      </p>

      {detailItem ? (
        <WishDetailSheet
          item={detailItem}
          open
          busy={busy}
          onClose={() => setDetailItem(null)}
          onSave={async (patch) => {
            const url = patch.external_url ? sanitizeExternalUrlClient(String(patch.external_url)) : null;
            if (patch.external_url && String(patch.external_url).trim() && !url) {
              setSaveStatus("error");
              return;
            }
            setSaveStatus("saving");
            try {
              await onUpdateWish(detailItem.id, {
                ...patch,
                external_url: patch.external_url === undefined ? undefined : url,
              });
              setDetailItem(null);
              flashSaved();
            } catch {
              setSaveStatus("error");
            }
          }}
          onRemove={async () => {
            setSaveStatus("saving");
            try {
              await onRemoveWish(detailItem.id);
              setDetailItem(null);
              flashSaved();
            } catch {
              setSaveStatus("error");
            }
          }}
        />
      ) : null}

      <ShareWishlistSheet
        open={shareOpen}
        title={title}
        shareUrl={shareUrl}
        hint={shareHint}
        onClose={() => setShareOpen(false)}
        onCopy={() => void onShare("copy")}
        onWhatsApp={() => void onShare("whatsapp")}
        onShare={() => void onShare("native")}
      />
    </>
  );
}

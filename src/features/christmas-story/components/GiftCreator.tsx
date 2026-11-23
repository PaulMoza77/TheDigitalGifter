import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { STORY_OFFER } from "../catalog";
import { trackStoryEvent } from "../analytics";
import { composePreviewContent, createMockPaidOrder } from "../generation/compose";
import { localImageHandler } from "../generation/videoProvider";
import { loadDraft, saveDraft, saveOrder, clearDraft } from "../draftStore";
import { createEmptyDraft, type RelationshipKind, type StoryGiftContent, type StoryGiftDraft } from "../types";
import {
  createStoryCheckout,
  isStoryApiEnabled,
  syncDraftToServer,
} from "../storyApi";
import { ExampleAudioPlayer } from "./ExampleAudioPlayer";

const RELATIONSHIPS: { id: RelationshipKind; label: string }[] = [
  { id: "partner", label: "Partner" },
  { id: "spouse", label: "Spouse" },
  { id: "parent", label: "Parent" },
  { id: "child", label: "Child" },
  { id: "sibling", label: "Sibling" },
  { id: "friend", label: "Friend" },
  { id: "family", label: "Family" },
  { id: "other", label: "Someone special" },
];

const SPECIAL_CHIPS = [
  "They always show up for me",
  "Their laugh changes the room",
  "They made our home feel safe",
  "They believe in me when I doubt myself",
];

type Stage = 1 | 2 | 3;

export function GiftCreator() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>(1);
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<StoryGiftDraft>(() => {
    let saved: StoryGiftDraft;
    try { saved = loadDraft(); } catch { saved = createEmptyDraft(); }
    return params.get("v") === "song" ? { ...saved, copyVariant: "personalized_song" } : saved;
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const creatorRef = useRef<HTMLDivElement>(null);
  const previousStage = useRef(stage);
  const [preview, setPreview] = useState<StoryGiftContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackStoryEvent("builder_started");
  }, []);

  useEffect(() => {
    try { saveDraft(draft); setSaveFailed(false); }
    catch { setSaveFailed(true); }
    if (isStoryApiEnabled() && draft.recipientName.trim().length >= 2) {
      // Debounce remote saves; local draft remains available when offline.
      const timer = window.setTimeout(() => {
        void syncDraftToServer(draft).catch(() => {
          // No remote-save confirmation can be assumed from local persistence.
        });
      }, 800);
      return () => window.clearTimeout(timer);
    }
  }, [draft]);

  useEffect(() => {
    if (previousStage.current !== stage) {
      creatorRef.current?.querySelector("h1")?.focus();
      previousStage.current = stage;
    }
  }, [stage]);

  const stage1Valid = useMemo(
    () =>
      Boolean(draft.relationship) &&
      draft.recipientName.trim().length >= 2 &&
      draft.whatMakesThemSpecial.trim().length >= 8,
    [draft],
  );

  async function buildPreview(nextStage: Stage = 2) {
    setBusy(true);
    setError(null);
    try {
      const content = await composePreviewContent(draft, { markAsExample: true });
      setPreview(content);
      trackStoryEvent("preview_view", { has_photos: draft.photoDataUrls.length > 0 });
      setStage(nextStage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPhotos(files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(true);
    setError(null);
    const next = [...draft.photoDataUrls];
    const available = Math.max(0, 8 - next.length);
    const issues: string[] = [];
    if (files.length > available) issues.push("You can add up to 8 photos. Extra selections were skipped.");
    try {
      for (const file of Array.from(files).slice(0, available)) {
        if (!file.type.startsWith("image/")) { issues.push(`${file.name}: choose an image file.`); continue; }
        if (file.size > 8 * 1024 * 1024) { issues.push(`${file.name}: choose a photo under 8 MB.`); continue; }
        try { next.push(await localImageHandler.normalize(await readFile(file))); }
        catch { issues.push(`${file.name}: this photo could not be read. Try another image.`); }
      }
      setDraft(d => ({ ...d, photoDataUrls: next }));
      if (issues.length) setError(issues.join(" "));
    } finally { setUploading(false); }
  }

  async function startCheckout() {
    if (!draft.digitalConsent) {
      setError("Please confirm the digital content terms to continue.");
      return;
    }
    trackStoryEvent("checkout_started", { price_cents: STORY_OFFER.priceCents });
    setBusy(true);
    try {
      // Prefer durable Stripe TEST when API + server kill-switch allow it.
      if (isStoryApiEnabled()) {
        const remote = await createStoryCheckout({
          draft,
          content: preview,
          fromName: "You",
        });
        if (remote.ok) {
          // Keep a local mirror for buyer dashboard until paid webhook lands.
          const order = await createMockPaidOrder(draft, "You");
          order.id = remote.orderId;
          order.checkoutMode = "test";
          order.status = "CHECKOUT_PENDING";
          if (remote.recipientToken) order.recipientToken = remote.recipientToken;
          saveOrder(order);
          navigate(`/christmas-story/order/${remote.orderId}`);
          return;
        }
        if (remote.code !== "api_disabled" && remote.code !== "checkout_kill_switch") {
          setError(remote.message || `Checkout unavailable (${remote.code})`);
          return;
        }
      }

      // Local mock path when durable checkout kill-switch is ON (default).
      if (!STORY_OFFER.checkoutEnabled) {
        const order = await createMockPaidOrder(draft, "You");
        saveOrder(order);
        clearDraft();
        trackStoryEvent("gift_generation_started", { order_status: order.status });
        trackStoryEvent("gift_ready", { order_status: order.status });
        navigate(`/christmas-story/order/${order.id}`);
        return;
      }
      setError("Live checkout is not authorized yet.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cs-creator" ref={creatorRef}>
      <div className="cs-brand">
        <Link to="/christmas-story" className="cs-brand__name" style={{ color: "inherit", textDecoration: "none" }}>
          Digital Gifter
        </Link>
        <span className="cs-brand__meta">Create their gift</span>
      </div>

      <div className="cs-step-label" role="status"><span>Step {stage} of 3 · {stage === 1 ? "Their story" : stage === 2 ? "Your preview" : "Review the gift"}</span><span>{saveFailed ? "Draft not saved" : "Draft saved on this device"}</span></div>
      {saveFailed ? <p className="cs-preview-banner" role="alert">Your changes are here, but this browser could not save them. Keep this page open and try removing a photo to free up space.</p> : null}
      <div className="cs-progress" aria-hidden>
        <span className={stage >= 1 ? "is-on" : undefined} />
        <span className={stage >= 2 ? "is-on" : undefined} />
        <span className={stage >= 3 ? "is-on" : undefined} />
      </div>

      {stage === 1 ? (
        <>
          <h1 tabIndex={-1} className="cs-display" style={{ fontSize: "2rem", margin: 0 }}>
            Someone only you know like this.
          </h1>
          <p style={{ color: "var(--cs-ivory-soft)", margin: 0 }}>
            Start with three little things. The best gifts begin with what you already know.
          </p>

          <div className="cs-field">
            <span>1. Who is the gift for?</span>
            <div className="cs-chips" role="group" aria-label="Relationship">
              {RELATIONSHIPS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`cs-chip ${draft.relationship === r.id ? "is-on" : ""}`}
                  aria-pressed={draft.relationship === r.id}
                  onClick={() => setDraft((d) => ({ ...d, relationship: r.id }))}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <label className="cs-field">
            <span>2. What is their first name?</span>
            <input
              value={draft.recipientName}
              onChange={(e) => setDraft((d) => ({ ...d, recipientName: e.target.value }))}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              aria-describedby="cs-name-help"
              maxLength={40}
              placeholder="e.g. Emma"
            />
            <small id="cs-name-help" className="cs-field-hint">Use the name they love to hear. At least 2 characters.</small>
          </label>

          <label className="cs-field">
            <span>3. What makes them special to you?</span>
            <textarea
              value={draft.whatMakesThemSpecial}
              onChange={(e) => setDraft((d) => ({ ...d, whatMakesThemSpecial: e.target.value }))}
              maxLength={320}
              aria-describedby="cs-special-help"
              placeholder="The way you always know when I need a little encouragement…"
            />
            <small id="cs-special-help" className="cs-field-hint">A small detail is enough. At least 8 characters · {draft.whatMakesThemSpecial.length}/320</small>
          </label>
          <p className="cs-field-hint">Need a starting point? Choose one and make it your own.</p>
          <div className="cs-chips" aria-label="Writing suggestions">
            {SPECIAL_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className="cs-chip"
                onClick={() => setDraft((d) => ({ ...d, whatMakesThemSpecial: c }))}
              >
                {c}
              </button>
            ))}
          </div>

          <aside className="cs-live-preview" aria-label="Personalized gift cover preview">
            <span className="cs-seal" aria-hidden="true">{draft.recipientName.trim().slice(0, 1) || "✧"}</span>
            <div><p className="cs-kicker">Their gift begins here · Preview</p><p className="cs-live-preview__name">For {draft.recipientName.trim() || "someone special"}</p><p>{draft.whatMakesThemSpecial.trim() || "Your words will make this theirs."}</p></div>
          </aside>
          {!stage1Valid ? <p className="cs-field-hint">Choose a relationship, add their name and share a little detail to see the full preview.</p> : null}
          <button
            type="button"
            className="cs-btn cs-btn--primary"
            disabled={!stage1Valid || busy}
            onClick={() => void buildPreview()}
          >
            {busy ? "Creating preview…" : "See their preview"}
          </button>
        </>
      ) : null}

      {stage === 2 && preview ? (
        <>
          <p className="cs-preview-banner" role="note">
            Gift preview · Sample lyrics and draft story only. No finished song or film has been generated.
          </p>
          <h1 tabIndex={-1} className="cs-display" style={{ fontSize: "1.9rem", margin: 0 }}>
            {preview.welcomeTitle}
          </h1>
          <p>{preview.dedication}</p>
          <ExampleAudioPlayer song={preview.song} />

          <details className="cs-customize">
            <summary>Make it even more personal <span>Optional memories, dedication &amp; photos</span></summary>
            <div className="cs-customize__fields">
          <label className="cs-field">
            <span>A special memory (optional)</span>
            <textarea
              value={draft.memories[0] ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, memories: e.target.value ? [e.target.value] : [] }))
              }
              placeholder="That Christmas when…"
              maxLength={400}
            />
          </label>
          <label className="cs-field">
            <span>Dedication (optional)</span>
            <textarea
              value={draft.dedication}
              onChange={(e) => setDraft((d) => ({ ...d, dedication: e.target.value }))}
              maxLength={400}
            />
          </label>
          <label className="cs-field">
            <span>Photos (optional, up to 8)</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading || draft.photoDataUrls.length >= 8}
              aria-describedby="cs-photo-help"
              onChange={(e) => { void onPhotos(e.target.files); e.target.value = ""; }}
            />
          </label>
          <p id="cs-photo-help" className="cs-field-hint">Up to 8 images, under 8 MB each. Photos stay in this browser for this preview.</p>
          <p role="status" className="cs-field-hint">{uploading ? "Preparing your photos…" : `${draft.photoDataUrls.length} of 8 photos added`}</p>
          <div className="cs-photo-grid">{draft.photoDataUrls.map((src, i) => <figure key={`${i}-${src.slice(-20)}`}><img src={src} alt={`Selected memory ${i + 1}`} /><button type="button" disabled={uploading} className="cs-photo-remove" aria-label={`Remove photo ${i + 1}`} onClick={() => setDraft(d => ({ ...d, photoDataUrls: d.photoDataUrls.filter((_, n) => n !== i) }))}>×</button></figure>)}</div>
          {draft.photoDataUrls.length ? (
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              {draft.photoDataUrls.length} photo{draft.photoDataUrls.length === 1 ? "" : "s"} ready
              for the memory film.
            </p>
          ) : null}

            </div>
          </details>
          <div className="cs-cta-row">
            <button type="button" className="cs-btn cs-btn--ghost" disabled={busy || uploading} onClick={() => setStage(1)}>
              Back
            </button>
            <button
              type="button"
              className="cs-btn cs-btn--primary"
              disabled={busy || uploading}
              onClick={() => void buildPreview(3)}
            >
              {busy ? "Updating preview…" : "Review the gift"}
            </button>
          </div>
        </>
      ) : null}

      {stage === 3 ? (
        <>
          <h1 tabIndex={-1} className="cs-display" style={{ fontSize: "2rem", margin: 0 }}>
            {STORY_OFFER.name}
          </h1>
          <p className="cs-price__amount">{STORY_OFFER.displayPrice}</p>
          <ul className="cs-price__list">
            {STORY_OFFER.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p style={{ color: "var(--cs-ivory-soft)" }}>{STORY_OFFER.timeline}</p>
          <p style={{ color: "var(--cs-ivory-soft)", fontSize: "0.9rem" }}>{STORY_OFFER.taxesNote}</p>

          <label className="cs-field">
            <span>Email for order updates (test only; no email is sent)</span>
            <input
              type="email"
              value={draft.buyerEmail}
              onChange={(e) => setDraft((d) => ({ ...d, buyerEmail: e.target.value }))}
              placeholder="you@email.com"
              autoComplete="email"
            />
          </label>

          <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={draft.digitalConsent}
              onChange={(e) => setDraft((d) => ({ ...d, digitalConsent: e.target.checked }))}
            />
            <span style={{ fontSize: "0.9rem", color: "var(--cs-ivory-soft)" }}>
              I understand this is digital content produced after purchase. Legal withdrawal wording
              for immediate supply will be finalized with counsel before LIVE checkout. Defective
              products remain eligible for support under applicable law.{" "}
              <em>(Pending legal approval.)</em>
            </span>
          </label>

          {!STORY_OFFER.checkoutEnabled ? (
            <p className="cs-preview-banner">
              Payments are disabled in this environment. Continuing creates a local test order with
              mock generation — no card charge.
            </p>
          ) : null}

          <div className="cs-cta-row">
            <button type="button" className="cs-btn cs-btn--ghost" disabled={busy} onClick={() => setStage(2)}>
              Back
            </button>
            <button
              type="button"
              className="cs-btn cs-btn--primary"
              disabled={busy}
              onClick={() => void startCheckout()}
            >
              {busy ? "Preparing…" : STORY_OFFER.checkoutEnabled ? "Pay securely" : "Continue (test order)"}
            </button>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: "#f0b4b4" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

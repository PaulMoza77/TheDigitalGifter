import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { STORY_OFFER } from "../catalog";
import { trackStoryEvent } from "../analytics";
import { composePreviewContent, createMockPaidOrder } from "../generation/compose";
import { localImageHandler } from "../generation/videoProvider";
import { loadDraft, saveDraft, saveOrder, clearDraft } from "../draftStore";
import type { RelationshipKind, StoryGiftContent, StoryGiftDraft } from "../types";
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
  const [draft, setDraft] = useState<StoryGiftDraft>(() => loadDraft());
  const [preview, setPreview] = useState<StoryGiftContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackStoryEvent("builder_started");
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

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
    if (!files?.length) return;
    const next: string[] = [...draft.photoDataUrls];
    for (const file of Array.from(files).slice(0, 8 - next.length)) {
      if (!file.type.startsWith("image/")) {
        setError("Only image uploads are supported.");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("Each photo must be under 8MB.");
        continue;
      }
      const dataUrl = await readFile(file);
      next.push(await localImageHandler.normalize(dataUrl));
    }
    setDraft((d) => ({ ...d, photoDataUrls: next }));
  }

  async function startCheckout() {
    if (!draft.digitalConsent) {
      setError("Please confirm the digital content terms to continue.");
      return;
    }
    trackStoryEvent("checkout_started", { price_cents: STORY_OFFER.priceCents });
    if (!STORY_OFFER.checkoutEnabled) {
      setBusy(true);
      try {
        const order = await createMockPaidOrder(draft, "You");
        saveOrder(order);
        clearDraft();
        trackStoryEvent("gift_generation_started", { order_status: order.status });
        trackStoryEvent("gift_ready", { order_status: order.status });
        navigate(`/christmas-story/order/${order.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create order");
      } finally {
        setBusy(false);
      }
      return;
    }
    setError("Live checkout is not authorized yet.");
  }

  return (
    <div className="cs-creator">
      <div className="cs-brand">
        <Link to="/christmas-story" className="cs-brand__name" style={{ color: "inherit", textDecoration: "none" }}>
          Digital Gifter
        </Link>
        <span className="cs-brand__meta">Create their gift</span>
      </div>

      <div className="cs-progress" aria-hidden>
        <span className={stage >= 1 ? "is-on" : undefined} />
        <span className={stage >= 2 ? "is-on" : undefined} />
        <span className={stage >= 3 ? "is-on" : undefined} />
      </div>

      {stage === 1 ? (
        <>
          <h1 className="cs-display" style={{ fontSize: "2rem", margin: 0 }}>
            Who is this for?
          </h1>
          <p style={{ color: "var(--cs-ivory-soft)", margin: 0 }}>
            Three answers. Then you will see a personalized preview — before any payment.
          </p>

          <div className="cs-field">
            <span>Relationship</span>
            <div className="cs-chips" role="group" aria-label="Relationship">
              {RELATIONSHIPS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`cs-chip ${draft.relationship === r.id ? "is-on" : ""}`}
                  onClick={() => setDraft((d) => ({ ...d, relationship: r.id }))}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <label className="cs-field">
            <span>What is their first name?</span>
            <input
              value={draft.recipientName}
              onChange={(e) => setDraft((d) => ({ ...d, recipientName: e.target.value }))}
              autoComplete="off"
              maxLength={40}
              placeholder="Emma"
            />
          </label>

          <label className="cs-field">
            <span>What makes them special to you?</span>
            <textarea
              value={draft.whatMakesThemSpecial}
              onChange={(e) => setDraft((d) => ({ ...d, whatMakesThemSpecial: e.target.value }))}
              maxLength={320}
              placeholder="The way they…"
            />
          </label>
          <div className="cs-chips">
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
            Gift Preview — demonstration only. The custom song and final film are created after payment
            and your approval.
          </p>
          <h1 className="cs-display" style={{ fontSize: "1.9rem", margin: 0 }}>
            {preview.welcomeTitle}
          </h1>
          <p>{preview.dedication}</p>
          <ExampleAudioPlayer song={preview.song} />

          <h2 className="cs-display" style={{ fontSize: "1.45rem", margin: "0.5rem 0 0" }}>
            Optional: enrich the gift
          </h2>
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
              onChange={(e) => void onPhotos(e.target.files)}
            />
          </label>
          {draft.photoDataUrls.length ? (
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              {draft.photoDataUrls.length} photo{draft.photoDataUrls.length === 1 ? "" : "s"} ready
              for the memory film.
            </p>
          ) : null}

          <div className="cs-cta-row">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setStage(1)}>
              Back
            </button>
            <button
              type="button"
              className="cs-btn cs-btn--primary"
              onClick={() => void buildPreview(3)}
            >
              Continue to offer
            </button>
          </div>
        </>
      ) : null}

      {stage === 3 ? (
        <>
          <h1 className="cs-display" style={{ fontSize: "2rem", margin: 0 }}>
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
            <span>Email for order updates (guest checkout)</span>
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
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setStage(2)}>
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

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { supabase } from "@/lib/supabase";
import { trackChristmasEvent } from "./analytics";
import {
  downloadBlob,
  loadImageFromFile,
  renderChristmasCard,
  shareCardFile,
  validatePhotoFile,
} from "./cards/cardRenderer";
import {
  CARD_LAYOUTS,
  CARD_STYLES,
  MAX_CARD_MESSAGE_CHARS,
  type CardLayoutKey,
} from "./cards/taxonomy";
import {
  cardsMessagesFunnel,
  clearMessageToCardHandoff,
  getOrCreateMessageGuestToken,
  readCardDraft,
  readCardOwner,
  readMessageToCardHandoff,
  writeCardDraft,
  writeCardOwner,
} from "./cards/cardsApi";

const PRODUCT = "christmas_card";

async function authBearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function ChristmasCardsPage() {
  const [params] = useSearchParams();
  const [styleKey, setStyleKey] = useState("classic_christmas");
  const [layoutKey, setLayoutKey] = useState<CardLayoutKey>("square");
  const [message, setMessage] = useState("");
  const [messageSource, setMessageSource] = useState<"manual" | "message_generator">("manual");
  const [messageResultId, setMessageResultId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [fromName, setFromName] = useState("");
  const [photoEl, setPhotoEl] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [result, setResult] = useState<{
    dataUrl: string;
    blob: Blob;
    width: number;
    height: number;
    filename: string;
  } | null>(null);
  const viewed = useRef(false);
  const handoffApplied = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    captureFunnelAttribution(window.location.search);
    void trackChristmasEvent("christmas_card_page_view", {
      productKey: PRODUCT,
      pathname: "/christmas/cards",
    });
    void trackChristmasEvent("card_creation_started", { productKey: PRODUCT });

    const draft = readCardDraft();
    if (draft?.message) {
      setMessage(draft.message);
      if (draft.styleKey) setStyleKey(draft.styleKey);
      if (draft.layoutKey === "story" || draft.layoutKey === "landscape" || draft.layoutKey === "square") {
        setLayoutKey(draft.layoutKey);
      }
      if (draft.recipientName) setRecipientName(draft.recipientName);
      if (draft.fromName) setFromName(draft.fromName);
      if (draft.messageSource) setMessageSource(draft.messageSource);
      if (draft.messageResultId) setMessageResultId(draft.messageResultId);
    }
    const owner = readCardOwner();
    if (owner) {
      setProjectId(owner.projectId);
      setOwnerToken(owner.ownerToken);
    }
  }, []);

  useEffect(() => {
    if (handoffApplied.current) return;
    const fromMessage = params.get("from_message") === "1";
    const handoff = readMessageToCardHandoff();
    if (!handoff) return;
    if (!fromMessage && !handoff.text) return;
    handoffApplied.current = true;

    if (handoff.text) {
      setMessage(handoff.text);
      setMessageSource("message_generator");
      setMessageResultId(handoff.resultId);
      void trackChristmasEvent("card_message_added", {
        productKey: PRODUCT,
        metadata: { message_source: "message_generator", language: handoff.language },
      });
      // Leave handoff until card is generated so refresh recovers the imported message.
      return;
    }

    if (handoff.resultId && handoff.sessionId) {
      void cardsMessagesFunnel<{
        ok: boolean;
        message: { id: string; text: string; language: string };
      }>({
        action: "getMessageResult",
        result_id: handoff.resultId,
        session_id: handoff.sessionId,
        guest_token: handoff.guestToken || getOrCreateMessageGuestToken(),
      })
        .then((data) => {
          setMessage(data.message.text);
          setMessageSource("message_generator");
          setMessageResultId(data.message.id);
          void trackChristmasEvent("card_message_added", {
            productKey: PRODUCT,
            metadata: { message_source: "message_generator", language: data.message.language },
          });
        })
        .catch(() => undefined)
        .finally(() => clearMessageToCardHandoff());
    }
  }, [params]);

  useEffect(() => {
    writeCardDraft({
      styleKey,
      layoutKey,
      message,
      recipientName,
      fromName,
      messageSource,
      messageResultId,
      locale: "en",
    });
  }, [styleKey, layoutKey, message, recipientName, fromName, messageSource, messageResultId]);

  async function onPhoto(file: File | null) {
    if (!file) {
      setPhotoEl(null);
      return;
    }
    const check = validatePhotoFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    try {
      const img = await loadImageFromFile(file);
      setPhotoEl(img);
      void trackChristmasEvent("card_photo_added", { productKey: PRODUCT });
    } catch {
      setError("Could not read that photo.");
    }
  }

  async function ensureProject(): Promise<{ id: string; token: string | null }> {
    if (projectId) return { id: projectId, token: ownerToken };
    const data = await cardsMessagesFunnel<{
      ok: boolean;
      project_id: string;
      owner_token: string | null;
    }>(
      {
        action: "createCardProject",
        style_key: styleKey,
        layout_key: layoutKey,
        message,
        recipient_name: recipientName,
        from_name: fromName,
        message_source: messageSource,
        message_result_id: messageResultId,
        guest_token: getOrCreateMessageGuestToken(),
      },
      await authBearer(),
    );
    setProjectId(data.project_id);
    if (data.owner_token) {
      setOwnerToken(data.owner_token);
      writeCardOwner({ projectId: data.project_id, ownerToken: data.owner_token });
    }
    return { id: data.project_id, token: data.owner_token };
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!message.trim()) throw new Error("Add a Christmas message first.");
      void trackChristmasEvent("card_style_selected", {
        productKey: PRODUCT,
        metadata: { style_key: styleKey },
      });
      void trackChristmasEvent("card_layout_selected", {
        productKey: PRODUCT,
        metadata: { layout: layoutKey },
      });
      const project = await ensureProject();
      await cardsMessagesFunnel(
        {
          action: "updateCardProject",
          project_id: project.id,
          owner_token: project.token,
          style_key: styleKey,
          layout_key: layoutKey,
          message,
          recipient_name: recipientName,
          from_name: fromName,
          message_source: messageSource,
          photo_present: Boolean(photoEl),
        },
        await authBearer(),
      );
      void trackChristmasEvent("card_preview_seen", { productKey: PRODUCT });
      const rendered = await renderChristmasCard({
        message,
        styleKey,
        layoutKey,
        recipientName,
        fromName,
        photo: photoEl,
        projectRef: project.id.slice(0, 8),
      });
      await cardsMessagesFunnel(
        {
          action: "recordCardRender",
          project_id: project.id,
          owner_token: project.token,
          layout_key: layoutKey,
          width: rendered.width,
          height: rendered.height,
          byte_size: rendered.byteSize,
        },
        await authBearer(),
      );
      setResult({
        dataUrl: rendered.dataUrl,
        blob: rendered.blob,
        width: rendered.width,
        height: rendered.height,
        filename: rendered.filename,
      });
      clearMessageToCardHandoff();
      void trackChristmasEvent("card_generated", {
        productKey: PRODUCT,
        metadata: {
          style_key: styleKey,
          layout: layoutKey,
          photo_present: Boolean(photoEl),
          message_source: messageSource,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create card");
      if (projectId) {
        void cardsMessagesFunnel({
          action: "recordCardRender",
          project_id: projectId,
          owner_token: ownerToken,
          failed: true,
          error_code: e instanceof Error ? e.message : "render_failed",
        }).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
    void trackChristmasEvent("card_download", { productKey: PRODUCT });
    if (projectId) {
      void cardsMessagesFunnel({
        action: "trackCardDownload",
        project_id: projectId,
        owner_token: ownerToken,
      }).catch(() => undefined);
    }
  }

  async function onShare() {
    if (!result) return;
    await shareCardFile(result.blob, result.filename);
    void trackChristmasEvent("card_share", { productKey: PRODUCT });
    if (projectId) {
      void cardsMessagesFunnel({
        action: "trackCardShare",
        project_id: projectId,
        owner_token: ownerToken,
      }).catch(() => undefined);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-slate-900">
      <PageHead
        title="Personalized Christmas Cards"
        description="Turn your photo and Christmas message into a card worth sending. Free digital Christmas cards — square, story, and landscape."
        url="https://www.thedigitalgifter.com/christmas/cards"
      />
      <p className="text-sm text-slate-500">
        <Link to="/christmas" className="underline-offset-2 hover:underline">
          Christmas
        </Link>{" "}
        / Cards
      </p>
      <h1 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">
        Turn your photo and Christmas message into a card worth sending
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Choose a style, add a message (or import one from the Message Generator), optionally upload a
        photo, then download a real PNG — no checkout required.
      </p>

      <section className="mt-8 space-y-6" aria-label="Card editor">
        <fieldset>
          <legend className="text-sm font-medium">Style</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CARD_STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`rounded-md border px-2 py-2 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${
                  styleKey === s.key ? "border-emerald-800 ring-1 ring-emerald-800" : "border-slate-300"
                }`}
                style={{ background: `linear-gradient(160deg, ${s.bgTop}, ${s.bgBottom})`, color: s.text }}
                onClick={() => setStyleKey(s.key)}
              >
                {s.labelEn}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Layout</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CARD_LAYOUTS.map((layout) => (
              <button
                key={layout.key}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                  layoutKey === layout.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"
                }`}
                onClick={() => setLayoutKey(layout.key)}
              >
                {layout.labelEn} ({layout.width}×{layout.height})
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium">Christmas message</span>
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2"
            maxLength={MAX_CARD_MESSAGE_CHARS}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setMessageSource("manual");
            }}
            placeholder="Write your Christmas message…"
          />
          <span className="mt-1 block text-xs text-slate-500">
            {message.length}/{MAX_CARD_MESSAGE_CHARS} ·{" "}
            <Link className="underline" to="/christmas/messages">
              Need help writing it?
            </Link>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            To (optional)
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              maxLength={80}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            From (optional)
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              maxLength={80}
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Photo (optional)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1 block w-full text-sm"
            onChange={(e) => void onPhoto(e.target.files?.[0] || null)}
          />
          <span className="mt-1 block text-xs text-slate-500">
            JPEG/PNG/WebP up to 8MB. Rendered on your device; not published to a gallery.
          </span>
        </label>

        <button
          type="button"
          disabled={busy || !message.trim()}
          onClick={() => void generate()}
          className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Creating your card…" : "Create card"}
        </button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </section>

      {result ? (
        <section className="mt-10 space-y-4" aria-label="Card result">
          <h2 className="text-lg font-semibold">Your Christmas card</h2>
          <img
            src={result.dataUrl}
            alt="Generated Christmas card"
            className="max-h-[70vh] w-full rounded-md border border-slate-200 object-contain"
          />
          <p className="text-xs text-slate-500">
            {result.width}×{result.height} PNG · {(result.blob.size / 1024).toFixed(0)} KB
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={() => void onDownload()}
            >
              Download
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => void onShare()}
            >
              Share
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => {
                setResult(null);
                void trackChristmasEvent("card_create_another", { productKey: PRODUCT });
              }}
            >
              Create another
            </button>
          </div>
          <p className="text-sm text-slate-600">
            Next:{" "}
            <Link className="underline" to="/christmas/photo-generator">
              Christmas Portrait
            </Link>{" "}
            ·{" "}
            <Link className="underline" to="/christmas/wishlist">
              Wishlist
            </Link>{" "}
            ·{" "}
            <Link className="underline" to="/christmas/tree">
              Add something special under your Christmas Tree
            </Link>
          </p>
        </section>
      ) : null}

      <section className="mt-12 border-t border-slate-200 pt-8 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">Digital Christmas cards online</h2>
        <p className="mt-2">
          Create personalized Christmas photo cards and text-only holiday cards for sharing. Styles are
          designed templates — not AI-generated borders — so results stay fast and free to preview.
        </p>
        <p className="mt-2">
          Need a gift idea?{" "}
          <Link className="underline" to="/christmas/gift-finder">
            Gift Finder
          </Link>
        </p>
      </section>
    </main>
  );
}

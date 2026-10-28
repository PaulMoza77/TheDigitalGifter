import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { connectOpenAiRealtimeWebRtc, type RealtimeSessionHandle } from "@/features/christmas/santa-call/openaiRealtimeWebRtc";
import { NorthPoleScene } from "@/features/christmas/santa-call/NorthPoleScene";
import {
  confirmSantaCallCheckout,
  createSantaCallExtensionCheckout,
  endSantaCall,
  getOrCreateCallFingerprint,
  heartbeatSantaCall,
  pollSantaCallExtension,
  resolveSantaCall,
  startSantaCall,
} from "@/features/christmas/santa-call/santaCallApi";
import { readSantaQaPageAccessToken } from "@/features/christmas/santa-call/santaCallPublic";
import {
  SANTA_CALL_COPY,
  SANTA_CALL_MAX_SECONDS,
  type SantaCallUiState,
} from "@/features/christmas/santa-call/santaCallTypes";
import { pricesForSantaCallMarket, readStoredSantaCallMarket } from "@/features/christmas/santa-call/santaCallPricing";

function ensureFonts() {
  const id = "tdg-santa-call-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatMoney(amountMinor: number, currency = "ron") {
  try {
    return new Intl.NumberFormat(currency === "ron" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function asPlainText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

const STATUS_LABEL: Record<SantaCallUiState, { ro: string; en: string }> = {
  ready: { ro: "Gata de apel", en: "Ready" },
  connecting: { ro: "Se conectează…", en: "Connecting…" },
  connected: { ro: "Conectat", en: "Connected" },
  listening: { ro: "Moșul ascultă", en: "Santa is listening" },
  speaking: { ro: "Moșul vorbește", en: "Santa is speaking" },
  reconnecting: { ro: "Se reconectează…", en: "Reconnecting…" },
  awaiting_extension: { ro: "Prelungire disponibilă", en: "Extension available" },
  completed: { ro: "Apel încheiat", en: "Call completed" },
  expired: { ro: "Link expirat", en: "Link expired" },
  failed: { ro: "Eroare", en: "Failed" },
};

export default function SantaCallRoomPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const [ui, setUi] = useState<SantaCallUiState>("ready");
  const [lang, setLang] = useState<"en" | "ro">("ro");
  const [childName, setChildName] = useState("");
  const [remaining, setRemaining] = useState(SANTA_CALL_MAX_SECONDS);
  const [allotted, setAllotted] = useState(SANTA_CALL_MAX_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [extensionCheckout, setExtensionCheckout] = useState<{
    clientSecret: string | null;
    publishableKey: string | null;
    checkoutUrl: string | null;
    checkoutMode: "custom" | "hosted";
    amountCents: number;
    currency: string;
    stripeMode?: string;
  } | null>(null);
  const [extensionBusy, setExtensionBusy] = useState(false);
  const [extensionPolling, setExtensionPolling] = useState(false);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const [paymentConfirmFailed, setPaymentConfirmFailed] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const handleRef = useRef<RealtimeSessionHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const heartbeatTimer = useRef<number | null>(null);
  const wrapSent = useRef(false);
  const topicsRef = useRef<string[]>([]);

  useEffect(() => {
    ensureFonts();
  }, []);

  const applyResolve = useCallback((data: Record<string, unknown>) => {
    if (data?.ok === true) {
      setLang(data.language === "en" ? "en" : "ro");
      setChildName(asPlainText(data.child_first_name));
      {
        const rem = Number(data.remaining_seconds) || SANTA_CALL_MAX_SECONDS;
        setRemaining(rem);
        setAllotted(rem);
      }
      setUpsellOpen(false);
      setExtensionCheckout(null);
      setUi("ready");
      setError(null);
      return;
    }
    const code = asPlainText(data?.code, "invalid_token");
    if (code === "awaiting_extension" || data?.extension_available === true) {
      setLang(data.language === "en" ? "en" : "ro");
      setChildName(asPlainText(data.child_first_name));
      setRemaining(0);
      setUi("awaiting_extension");
      setUpsellOpen(true);
      setError(null);
      return;
    }
    if (code === "expired") setUi("expired");
    else if (code === "completed") setUi("completed");
    else setUi("failed");
    setError(code);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setUi("failed");
      setError("invalid_token");
      return;
    }
    const returningFromCheckout =
      params.get("checkout") === "success" ||
      params.get("extension") === "return" ||
      Boolean(params.get("session_id"));
    // Avoid flashing "failed" for pending_payment while Safari return reconcile runs.
    if (returningFromCheckout) return;
    void resolveSantaCall(token).then(({ data }) => {
      if (cancelled) return;
      applyResolve((data || {}) as Record<string, unknown>);
    });
    return () => {
      cancelled = true;
    };
  }, [token, params, applyResolve]);

  // Initial Stripe return: reconcile Checkout Session server-side (never treat as extension).
  useEffect(() => {
    if (!token) return;
    const extensionReturn = params.get("extension") === "return";
    const initialReturn =
      params.get("checkout") === "success" ||
      (Boolean(params.get("session_id")) && !extensionReturn && params.get("extension") !== "cancel");
    if (!initialReturn || extensionReturn) return;

    let cancelled = false;
    setPaymentConfirming(true);
    setPaymentConfirmFailed(false);
    setUpsellOpen(false);
    setExtensionPolling(false);
    let tries = 0;
    const sessionId = params.get("session_id");

    const tick = async () => {
      const { data } = await confirmSantaCallCheckout({
        accessToken: token,
        sessionId,
      });
      if (cancelled) return;
      const payload = (data || {}) as Record<string, unknown>;
      const resolved = (payload.resolve || payload) as Record<string, unknown>;
      if (resolved.ok === true && Number(resolved.remaining_seconds) > 0) {
        setPaymentConfirming(false);
        applyResolve(resolved);
        return;
      }
      tries += 1;
      if (tries < 24) {
        const delay = Math.min(4000, 900 + tries * 250);
        window.setTimeout(() => void tick(), delay);
        return;
      }
      setPaymentConfirming(false);
      setPaymentConfirmFailed(true);
      applyResolve(resolved);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [token, params, applyResolve]);

  // Extension Stripe return only — never triggered by initial session_id alone.
  useEffect(() => {
    if (!token) return;
    if (params.get("extension") !== "return") return;
    let cancelled = false;
    setExtensionPolling(true);
    setUpsellOpen(true);
    setPaymentConfirming(false);
    let tries = 0;
    const sessionId = params.get("session_id");
    const tick = async () => {
      // Prefer server reconcile (handles delayed webhook), then resolve.
      await confirmSantaCallCheckout({ accessToken: token, sessionId });
      if (cancelled) return;
      const { data } = await pollSantaCallExtension(token);
      if (cancelled) return;
      const obj = (data || {}) as Record<string, unknown>;
      if (obj.ok === true && Number(obj.remaining_seconds) > 0) {
        setExtensionPolling(false);
        applyResolve(obj);
        return;
      }
      tries += 1;
      if (tries < 24) {
        window.setTimeout(() => void tick(), Math.min(4000, 900 + tries * 250));
      } else {
        setExtensionPolling(false);
        applyResolve(obj);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [token, params, applyResolve]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      window.clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    handleRef.current?.close();
    handleRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }, []);

  const buildResumeSummary = useCallback(() => {
    const name = childName || "child";
    const bits = topicsRef.current.filter(Boolean).slice(-4);
    const base = bits.length
      ? `Talked with ${name}. Topics: ${bits.join("; ")}.`
      : `Talked with ${name} about Christmas. Continue warmly without re-greeting.`;
    return base.slice(0, 600);
  }, [childName]);

  const finishCall = useCallback(
    async (reason: string, keepRemaining = false) => {
      stopHeartbeat();
      const elapsed = connectedAtRef.current
        ? Math.floor((Date.now() - connectedAtRef.current) / 1000)
        : 0;
      const sessionId = sessionIdRef.current;
      cleanupMedia();
      connectedAtRef.current = null;
      sessionIdRef.current = null;
      let endData: Record<string, unknown> | null = null;
      if (sessionId && token) {
        const { data } = await endSantaCall({
          accessToken: token,
          sessionId,
          secondsElapsed: elapsed,
          reason,
          keepRemaining,
          resumeSummary: reason === "duration_limit" ? buildResumeSummary() : undefined,
          resumeLanguage: lang,
        });
        endData = (data || {}) as Record<string, unknown>;
      }
      if (keepRemaining) {
        setUi("ready");
        return;
      }
      if (endData?.extension_available === true || reason === "duration_limit") {
        setRemaining(0);
        setUi("awaiting_extension");
        setUpsellOpen(true);
        return;
      }
      setUi("completed");
      setRemaining(0);
      setUpsellOpen(false);
    },
    [buildResumeSummary, cleanupMedia, lang, stopHeartbeat, token],
  );

  const startHeartbeat = useCallback(
    (sessionId: string) => {
      stopHeartbeat();
      heartbeatTimer.current = window.setInterval(() => {
        if (!connectedAtRef.current) return;
        const elapsed = Math.floor((Date.now() - connectedAtRef.current) / 1000);
        void heartbeatSantaCall({
          accessToken: token,
          sessionId,
          secondsElapsed: elapsed,
          uiStatus: ui === "speaking" || ui === "listening" ? ui : "connected",
        }).then(({ data }) => {
          // Session may already be closed by a prior force_end; still open the offer if eligible.
          if (data?.force_end || data?.extension_available === true) {
            if (data.extension_available === true) {
              setRemaining(0);
              setUi("awaiting_extension");
              setUpsellOpen(true);
            }
            if (data?.ok !== false || data?.force_end) {
              void finishCall("duration_limit", false);
            }
            return;
          }
          if (!data?.ok) return;
          const rem = Number(data.remaining_seconds);
          if (Number.isFinite(rem)) setRemaining(rem);
          if (data.wrap_up && !wrapSent.current) {
            wrapSent.current = true;
            handleRef.current?.sendEvent({
              type: "response.create",
              response: {
                instructions:
                  lang === "ro"
                    ? "Apelul se apropie de final. Încheie cald în 1-2 propoziții scurte. Poți folosi un singur Ho, ho, ho! doar dacă e natural."
                    : "The call is almost over. Warmly wrap up in 1-2 short sentences. Optional one Ho, ho, ho! only if natural.",
              },
            });
          }
        });
      }, 2000);
    },
    [finishCall, lang, stopHeartbeat, token, ui],
  );

  async function onStart() {
    setError(null);
    setConfirmEnd(false);
    setUi("connecting");
    wrapSent.current = false;
    try {
      const { ok, data } = await startSantaCall(token, getOrCreateCallFingerprint());
      if (!ok || data?.ok !== true) {
        const code = String(data?.code || "start_failed");
        setError(code);
        if (code === "awaiting_extension") {
          setUi("awaiting_extension");
          setUpsellOpen(true);
          return;
        }
        setUi(code === "expired" ? "expired" : code === "completed" ? "completed" : "failed");
        return;
      }
      sessionIdRef.current = String(data.sessionId);
      {
        const rem = Number(data.remainingSeconds) || remaining;
        setRemaining(rem);
        setAllotted((prev) => Math.max(prev, rem));
      }
      setLang(data.language === "en" ? "en" : "ro");
      setChildName(String(data.childFirstName || childName));
      if (data.resumeMode) {
        topicsRef.current.push("extension_resume");
      }

      if (data.provider !== "openai_realtime") {
        setError("provider_unsupported_client");
        setUi("failed");
        await endSantaCall({
          accessToken: token,
          sessionId: String(data.sessionId),
          secondsElapsed: 0,
          reason: "provider_unsupported_client",
          keepRemaining: true,
          errorCode: "provider_unsupported_client",
        });
        return;
      }

      const handle = await connectOpenAiRealtimeWebRtc({
        clientSecret: String(data.clientSecret),
        realtimeUrl: String(data.bootstrap?.realtimeUrl || "https://api.openai.com/v1/realtime/calls"),
        openingLine: String(data.bootstrap?.openingLine || ""),
        handlers: {
          onStatus: (status) => {
            if (status === "failed") setUi("failed");
            else if (status === "connecting") setUi("connecting");
            else if (status === "connected") {
              if (!connectedAtRef.current) connectedAtRef.current = Date.now();
              setUi("connected");
            } else if (status === "listening") setUi("listening");
            else if (status === "speaking") setUi("speaking");
          },
          onRemoteTrack: (stream) => {
            if (!audioRef.current) {
              audioRef.current = new Audio();
              audioRef.current.autoplay = true;
            }
            audioRef.current.srcObject = stream;
            void audioRef.current.play().catch(() => undefined);
            if (!connectedAtRef.current) {
              connectedAtRef.current = Date.now();
              startHeartbeat(String(data.sessionId));
            }
          },
          onError: (message) => {
            setError(message);
            setUi("failed");
          },
        },
      });
      handleRef.current = handle;
      if (!connectedAtRef.current) {
        connectedAtRef.current = Date.now();
        startHeartbeat(String(data.sessionId));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed";
      setError(message);
      setUi("failed");
      if (sessionIdRef.current) {
        await endSantaCall({
          accessToken: token,
          sessionId: sessionIdRef.current,
          secondsElapsed: 0,
          reason: "technical_interrupt",
          keepRemaining: true,
          errorCode: message,
        });
      }
    }
  }

  async function retryPaymentConfirm() {
    if (!token) return;
    setPaymentConfirmFailed(false);
    setPaymentConfirming(true);
    setError(null);
    const sessionId = params.get("session_id");
    const { data } = await confirmSantaCallCheckout({ accessToken: token, sessionId });
    const payload = (data || {}) as Record<string, unknown>;
    const resolved = (payload.resolve || payload) as Record<string, unknown>;
    if (resolved.ok === true && Number(resolved.remaining_seconds) > 0) {
      setPaymentConfirming(false);
      applyResolve(resolved);
      return;
    }
    setPaymentConfirming(false);
    setPaymentConfirmFailed(true);
    setError(String(resolved.code || payload.code || "payment_not_completed"));
  }

  async function onBuyExtension() {
    setExtensionBusy(true);
    setError(null);
    try {
      const access = readSantaQaPageAccessToken(window.location.search);
      const accessQs = access ? `&access=${encodeURIComponent(access)}` : "";
      const successUrl =
        `${window.location.origin}${window.location.pathname}?extension=return${accessQs}&session_id={CHECKOUT_SESSION_ID}`;
      const { ok, data } = await createSantaCallExtensionCheckout({ accessToken: token, successUrl });
      if (!ok || data?.ok !== true) {
        setError(String(data?.code || "extension_checkout_failed"));
        return;
      }
      const checkoutUrl = data.checkoutUrl ? String(data.checkoutUrl) : null;
      const checkoutMode = data.checkoutMode === "custom" ? "custom" : "hosted";
      if (checkoutMode === "hosted" && checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      setExtensionCheckout({
        clientSecret: data.clientSecret ? String(data.clientSecret) : null,
        publishableKey: data.publishableKey ? String(data.publishableKey) : null,
        checkoutUrl,
        checkoutMode,
        amountCents:
          Number(data.amountCents) ||
          pricesForSantaCallMarket(readStoredSantaCallMarket() || "ro").extensionMinor,
        currency: String(data.currency || pricesForSantaCallMarket(readStoredSantaCallMarket() || "ro").currency),
        stripeMode: data.stripeMode ? String(data.stripeMode) : undefined,
      });
    } catch {
      setError("extension_checkout_failed");
    } finally {
      setExtensionBusy(false);
    }
  }

  function declineExtension() {
    setUpsellOpen(false);
    setExtensionCheckout(null);
    setUi("completed");
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = !speakerOn;
  }, [speakerOn]);

  useEffect(() => {
    return () => {
      stopHeartbeat();
      cleanupMedia();
    };
  }, [cleanupMedia, stopHeartbeat]);

  const copy = SANTA_CALL_COPY[lang];
  const label = STATUS_LABEL[ui][lang];
  const canStart =
    !paymentConfirming &&
    (ui === "ready" || (ui === "failed" && error === "microphone_denied"));
  const inCall = ["connecting", "connected", "listening", "speaking", "reconnecting"].includes(ui);
  const showWave = ui === "listening" || ui === "speaking" || ui === "connecting";
  const totalBudget = Math.max(allotted, remaining, SANTA_CALL_MAX_SECONDS);

  return (
    <>
      <PageHead
        title={copy.roomTitle}
        description={copy.ogDescription}
        noindex
        exactTitle
      />
      <div className="santa-room text-[#F7F0E4]">
        <div className="santa-room-stage" aria-hidden>
          <NorthPoleScene
            variant="immersive"
            speaking={ui === "speaking"}
            listening={ui === "listening" || ui === "ready"}
          />
        </div>

        <main className="santa-room-ui">
          <header className="santa-room-top">
            <p className="santa-room-brand">{copy.brand}</p>
            <h1 className="santa-call-display santa-room-title">
              {copy.santaLabel}
            </h1>
            {childName ? (
              <p className="santa-room-for">
                {copy.forChild.replace("{name}", childName)}
              </p>
            ) : null}
          </header>

          <div className="santa-room-mid">
            {showWave || inCall || canStart ? (
              <div
                className={`santa-status-pill ${ui === "speaking" ? "is-speak" : ui === "listening" ? "is-listen" : ""}`}
                role="status"
                aria-live="polite"
              >
                <span className="santa-status-dot" aria-hidden />
                <span className="santa-status-label">
                  {ui === "listening"
                    ? copy.listening
                    : ui === "speaking"
                      ? copy.speaking
                      : label}
                </span>
                {showWave ? (
                  <span className="santa-wave" aria-hidden>
                    <i /><i /><i /><i /><i /><i /><i />
                  </span>
                ) : null}
              </div>
            ) : null}

            {paymentConfirming ? (
              <p className="santa-status-pill" role="status" aria-live="polite">
                <span className="santa-status-dot" aria-hidden />
                <span className="santa-status-label">{copy.paymentConfirming}</span>
              </p>
            ) : null}

            {paymentConfirmFailed ? (
              <div className="santa-room-recover">
                <p className="santa-room-error">{copy.paymentConfirmFailed}</p>
                <button type="button" className="santa-cta-start" onClick={() => void retryPaymentConfirm()}>
                  {copy.paymentConfirmRetry}
                </button>
              </div>
            ) : null}

            {error && !paymentConfirming && !paymentConfirmFailed ? (
              <p className="santa-room-error">
                {error === "microphone_denied"
                  ? copy.micDenied
                  : error === "concurrent_session"
                    ? copy.concurrentDevice
                    : error === "expired"
                      ? copy.linkExpired
                      : copy.startFailed}
              </p>
            ) : null}
          </div>

          <footer className="santa-room-dock">
            {canStart ? (
              <button type="button" onClick={() => void onStart()} className="santa-cta-start">
                {copy.startCall}
              </button>
            ) : null}

            {inCall ? (
              <div className="santa-controls">
                <button
                  type="button"
                  className={`santa-ctrl ${micOn ? "" : "is-off"}`}
                  aria-pressed={!micOn}
                  aria-label={micOn ? copy.muteMic : copy.unmuteMic}
                  onClick={() => {
                    const next = !micOn;
                    setMicOn(next);
                    handleRef.current?.setMicEnabled(next);
                  }}
                >
                  <span className="santa-ctrl-icon" aria-hidden>
                    {micOn ? (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M6 11a6 6 0 0 0 12 0" />
                        <path d="M12 17v3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 4l16 16" />
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M6 11a6 6 0 0 0 9.5 4.9" />
                        <path d="M12 17v3" />
                      </svg>
                    )}
                  </span>
                  <span className="santa-ctrl-label">{copy.mic}</span>
                </button>

                {!confirmEnd ? (
                  <button
                    type="button"
                    className="santa-ctrl santa-ctrl-end"
                    aria-label={copy.endCallAria}
                    onClick={() => setConfirmEnd(true)}
                  >
                    <span className="santa-ctrl-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                        <path d="M6.6 10.8c1.4 2.7 3.9 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C10.5 22 2 13.5 2 3c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.9z" />
                      </svg>
                    </span>
                    <span className="santa-ctrl-label">{copy.endCall}</span>
                  </button>
                ) : (
                  <div className="santa-confirm-end">
                    <button type="button" className="santa-confirm-yes" onClick={() => void finishCall("user_hangup", false)}>
                      {copy.confirmEndYes}
                    </button>
                    <button type="button" className="santa-confirm-no" onClick={() => setConfirmEnd(false)}>
                      {copy.confirmEndNo}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className={`santa-ctrl ${speakerOn ? "" : "is-off"}`}
                  aria-pressed={!speakerOn}
                  aria-label={speakerOn ? copy.muteSpeaker : copy.unmuteSpeaker}
                  onClick={() => setSpeakerOn((v) => !v)}
                >
                  <span className="santa-ctrl-icon" aria-hidden>
                    {speakerOn ? (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 9v6h4l5 4V5L8 9H4z" />
                        <path d="M16 8.5a4 4 0 0 1 0 7" />
                        <path d="M18.5 6a7 7 0 0 1 0 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 9v6h4l5 4V5L8 9H4z" />
                        <path d="M18 9l4 6M22 9l-4 6" />
                      </svg>
                    )}
                  </span>
                  <span className="santa-ctrl-label">{copy.speaker}</span>
                </button>
              </div>
            ) : null}

            {ui === "completed" || ui === "expired" ? (
              <div className="santa-done">
                <p className="santa-call-display text-2xl font-semibold">
                  {copy.thankYouTitle}
                </p>
                <p className="mt-1 text-sm opacity-85">
                  {copy.thankYouBody}
                </p>
                <Link to="/christmas/santa-call" className="santa-done-link">
                  {copy.backToProduct}
                </Link>
              </div>
            ) : null}

            {ui !== "completed" && ui !== "expired" && ui !== "awaiting_extension" ? (
              <div className="santa-timer-pill">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l2.5 1.5" />
                </svg>
                <span className="tabular-nums">{formatClock(remaining)}</span>
                <span className="santa-timer-sub">
                  {copy.timeBudgetOf.replace("{total}", formatClock(totalBudget))}
                </span>
              </div>
            ) : null}

            {canStart ? (
              <p className="santa-room-fineprint">
                {copy.decorativeScene}
              </p>
            ) : null}
          </footer>
        </main>

        {upsellOpen
          ? createPortal(
          <div className="santa-upsell-portal fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="santa-upsell-title"
              className="santa-upsell-sheet w-full max-w-md rounded-3xl border border-[#E8C547]/30 bg-[#1a0b0d] p-5 shadow-2xl max-h-[min(88dvh,40rem)] overflow-y-auto"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[#E8C547]">{copy.brand}</p>
              <h2 id="santa-upsell-title" className="mt-2 santa-call-display text-2xl font-bold">
                {copy.upsellTitle}
              </h2>
              <p className="mt-2 text-base font-semibold text-[#E8C547]">{copy.upsellPrice}</p>
              {extensionPolling ? (
                <p className="mt-3 text-sm opacity-80">
                  {copy.paymentConfirming}
                </p>
              ) : null}
              {!extensionCheckout ? (
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={extensionBusy || extensionPolling}
                    onClick={() => void onBuyExtension()}
                    className="rounded-full bg-[#0f3d2e] px-5 py-3 font-semibold disabled:opacity-50"
                  >
                    {extensionBusy ? "…" : copy.upsellContinue}
                  </button>
                  <button
                    type="button"
                    onClick={declineExtension}
                    className="rounded-full border border-white/20 px-5 py-3 text-sm"
                  >
                    {copy.upsellEnd}
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="mb-2 text-sm opacity-80">
                    {formatMoney(extensionCheckout.amountCents, extensionCheckout.currency)}
                    {extensionCheckout.stripeMode === "test" ? " · TEST" : ""}
                  </p>
                  {extensionCheckout.checkoutMode === "custom" &&
                  extensionCheckout.clientSecret &&
                  extensionCheckout.publishableKey ? (
                    <CustomStripeCheckout
                      clientSecret={extensionCheckout.clientSecret}
                      publishableKey={extensionCheckout.publishableKey}
                      dueDisplay={formatMoney(extensionCheckout.amountCents, extensionCheckout.currency)}
                    />
                  ) : extensionCheckout.checkoutUrl ? (
                    <a
                      href={extensionCheckout.checkoutUrl}
                      className="block rounded-full bg-[#0f3d2e] px-5 py-3 text-center font-semibold"
                    >
                      {copy.upsellContinue}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={declineExtension}
                    className="mt-3 w-full rounded-full border border-white/20 px-5 py-2 text-sm"
                  >
                    {copy.upsellEnd}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        ) : null}

        <style>{`
          .santa-call-display { font-family: "Cormorant Garamond", Georgia, serif; }
          .santa-room {
            font-family: "Source Sans 3", system-ui, sans-serif;
            position: fixed;
            inset: 0;
            overflow: hidden;
            background: #12080a;
            color: #F7F0E4;
          }
          .santa-room-stage { position: absolute; inset: 0; z-index: 0; }
          .santa-room-ui {
            position: relative;
            z-index: 2;
            height: 100%;
            height: 100dvh;
            max-width: 28rem;
            margin: 0 auto;
            display: grid;
            grid-template-rows: auto 1fr auto;
            padding:
              max(0.75rem, env(safe-area-inset-top))
              1.1rem
              max(0.85rem, env(safe-area-inset-bottom));
            box-sizing: border-box;
          }
          .santa-room-top { text-align: center; text-shadow: 0 2px 16px rgba(0,0,0,0.55); }
          .santa-room-brand {
            font-size: 0.68rem; letter-spacing: 0.2em; text-transform: uppercase;
            color: #E8C547; margin: 0;
          }
          .santa-room-title {
            margin: 0.15rem 0 0;
            font-size: clamp(1.55rem, 6vw, 1.9rem);
            font-weight: 700; line-height: 1.1;
          }
          .santa-room-for { margin: 0.15rem 0 0; font-size: 0.9rem; opacity: 0.88; }
          .santa-room-mid {
            display: flex; flex-direction: column; align-items: center;
            justify-content: flex-end; gap: 0.75rem; padding-bottom: 0.5rem; min-height: 0;
          }
          .santa-status-pill {
            display: inline-flex; align-items: center; gap: 0.55rem; max-width: 100%;
            padding: 0.55rem 0.9rem; border-radius: 999px;
            background: rgba(10, 6, 8, 0.62);
            border: 1px solid rgba(255,255,255,0.14);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
          }
          .santa-status-pill.is-listen { border-color: rgba(90, 190, 150, 0.35); }
          .santa-status-pill.is-speak { border-color: rgba(232, 197, 71, 0.4); }
          .santa-status-dot {
            width: 0.55rem; height: 0.55rem; border-radius: 999px; background: #6fd6a8;
            box-shadow: 0 0 10px rgba(111,214,168,0.7); flex: 0 0 auto;
          }
          .is-speak .santa-status-dot { background: #E8C547; box-shadow: 0 0 10px rgba(232,197,71,0.7); }
          .santa-status-label { font-size: 0.86rem; font-weight: 600; white-space: nowrap; }
          .santa-wave { display: inline-flex; align-items: flex-end; gap: 2px; height: 16px; margin-left: 0.15rem; }
          .santa-wave i {
            display: block; width: 2.5px; border-radius: 2px; background: #8fe0bc;
            animation: santa-wave 0.9s ease-in-out infinite;
          }
          .is-speak .santa-wave i { background: #E8C547; }
          .santa-wave i:nth-child(1) { height: 5px; animation-delay: 0s; }
          .santa-wave i:nth-child(2) { height: 10px; animation-delay: 0.1s; }
          .santa-wave i:nth-child(3) { height: 14px; animation-delay: 0.18s; }
          .santa-wave i:nth-child(4) { height: 8px; animation-delay: 0.05s; }
          .santa-wave i:nth-child(5) { height: 15px; animation-delay: 0.22s; }
          .santa-wave i:nth-child(6) { height: 9px; animation-delay: 0.12s; }
          .santa-wave i:nth-child(7) { height: 6px; animation-delay: 0.28s; }
          @keyframes santa-wave {
            0%, 100% { transform: scaleY(0.45); opacity: 0.65; }
            50% { transform: scaleY(1); opacity: 1; }
          }
          .santa-room-error {
            margin: 0; max-width: 22rem; padding: 0.55rem 0.75rem; border-radius: 0.85rem;
            border: 1px solid rgba(255,120,120,0.35); background: rgba(80,10,16,0.72);
            color: #ffb4b4; font-size: 0.82rem; text-align: center;
          }
          .santa-room-recover {
            display: flex; flex-direction: column; align-items: center; gap: 0.75rem; width: min(100%, 22rem);
          }
          .santa-room-dock {
            display: flex; flex-direction: column; align-items: center; gap: 0.7rem; padding-top: 0.25rem;
            width: 100%; max-width: 100%;
          }
          .santa-cta-start {
            width: min(100%, 20rem); border: 0; border-radius: 999px; padding: 0.95rem 1.25rem;
            font-size: 1.05rem; font-weight: 700; color: #F7F0E4;
            background: linear-gradient(180deg, #1a5a42 0%, #0f3d2e 100%);
            box-shadow: 0 12px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12);
            -webkit-tap-highlight-color: transparent;
          }
          .santa-controls {
            display: flex; align-items: flex-end; justify-content: center; gap: clamp(0.55rem, 4vw, 1.1rem);
            width: 100%; max-width: 100%; padding: 0 0.25rem; box-sizing: border-box;
          }
          .santa-ctrl {
            display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
            border: 0; background: transparent; color: #F7F0E4; padding: 0;
          }
          .santa-ctrl-icon {
            width: 3.35rem; height: 3.35rem; border-radius: 999px; display: grid; place-items: center;
            background: rgba(18, 12, 14, 0.55); border: 1px solid rgba(255,255,255,0.18);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          }
          .santa-ctrl.is-off .santa-ctrl-icon {
            background: rgba(40, 16, 18, 0.7); border-color: rgba(255,140,140,0.35); color: #ffb4b4;
          }
          .santa-ctrl-end .santa-ctrl-icon {
            width: 4.15rem; height: 4.15rem;
            background: linear-gradient(180deg, #a01f2c 0%, #7a1520 100%);
            border-color: rgba(255,180,180,0.25); color: #fff;
            box-shadow: 0 10px 24px rgba(122, 21, 32, 0.45);
          }
          .santa-ctrl-label {
            font-size: 0.68rem; letter-spacing: 0.02em; opacity: 0.9;
            text-shadow: 0 1px 8px rgba(0,0,0,0.6);
          }
          .santa-confirm-end { display: flex; flex-direction: column; gap: 0.35rem; min-width: 7.5rem; }
          .santa-confirm-yes, .santa-confirm-no {
            border-radius: 999px; border: 0; padding: 0.55rem 0.75rem; font-size: 0.78rem; font-weight: 600;
          }
          .santa-confirm-yes { background: #7a1520; color: #fff; }
          .santa-confirm-no {
            background: rgba(0,0,0,0.35); color: #F7F0E4; border: 1px solid rgba(255,255,255,0.2);
          }
          .santa-timer-pill {
            display: inline-flex; align-items: center; gap: 0.4rem;
            padding: 0.4rem 0.75rem; border-radius: 999px;
            background: rgba(10,6,8,0.58); border: 1px solid rgba(255,255,255,0.12);
            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            font-size: 0.82rem; font-weight: 600;
          }
          .santa-timer-sub { font-weight: 500; opacity: 0.72; font-size: 0.72rem; }
          .santa-room-fineprint {
            margin: 0; max-width: 18rem; text-align: center;
            font-size: 0.65rem; line-height: 1.35; opacity: 0.55;
          }
          .santa-done {
            width: min(100%, 22rem); text-align: center; padding: 1rem 1.1rem;
            border-radius: 1.25rem; background: rgba(10,6,8,0.72);
            border: 1px solid rgba(232,197,71,0.28); backdrop-filter: blur(10px);
          }
          .santa-done-link {
            display: inline-block; margin-top: 0.85rem; border-radius: 999px;
            border: 1px solid rgba(232,197,71,0.4); padding: 0.55rem 1.1rem; font-size: 0.85rem;
          }
          @media (max-width: 390px) {
            .santa-room-ui { padding-left: 0.85rem; padding-right: 0.85rem; }
            .santa-ctrl-icon { width: 3rem; height: 3rem; }
            .santa-ctrl-end .santa-ctrl-icon { width: 3.65rem; height: 3.65rem; }
            .santa-status-label { font-size: 0.8rem; white-space: normal; text-align: left; }
            .santa-upsell-sheet { padding: 1rem; }
          }
          @media (prefers-reduced-motion: reduce) {
            .santa-wave i { animation: none; }
          }
        `}</style>
      </div>
    </>
  );
}

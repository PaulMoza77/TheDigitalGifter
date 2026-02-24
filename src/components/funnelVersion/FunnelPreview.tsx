import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * FunnelPreview.tsx (NEWBORN / PORTRAIT funnel)
 * ------------------------------------------------
 * - Preview only (NO style selector, NO regenerate)
 * - Calls Supabase Edge Function replicate-preview
 * - Polls by request_id until real preview URL arrives (fast + no budget burn)
 */

type PreviewResponse = {
  preview_url?: string; // ✅ poate lipsi când e pending
  request_id?: string;
  pending?: boolean;
  cached?: "mem" | "db";
  error?: string;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeNow(): number {
  return typeof performance !== "undefined" && (performance as any).now ? (performance as any).now() : Date.now();
}

function normalizeKey(s: string | null | undefined, fallback: string) {
  const v = (s || "").trim();
  return v ? v : fallback;
}

function getQS(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getQueryStringValue(key: string): string | null {
  try {
    return getQS().get(key);
  } catch {
    return null;
  }
}

function isDataUrl(url: string) {
  return /^data:/i.test(url);
}

function addCacheBusterIfHttp(url: string): string {
  if (!url) return url;
  if (isDataUrl(url)) return url; // ✅ DO NOT break data: URLs
  const t = Date.now();
  return url.includes("?") ? `${url}&t=${t}` : `${url}?t=${t}`;
}

/** Minimal UI primitives */
function Card(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-black/10 bg-white/80 backdrop-blur shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function Badge(props: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-xs font-medium text-black/80",
        props.className
      )}
    >
      {props.children}
    </span>
  );
}

function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
}) {
  const variant = props.variant ?? "primary";
  const base =
    "inline-flex select-none items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed";
  const primary =
    "bg-[#0f3d2e] text-white shadow-[0_12px_30px_-18px_rgba(15,61,46,0.9)] hover:bg-[#0c3326] focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/30";
  const secondary =
    "bg-black/5 text-black/80 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-black/10";

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cx(base, variant === "primary" ? primary : secondary, props.className)}
    >
      {props.children}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-48 rounded bg-black/10" />
      <div className="mt-2 h-3 w-64 rounded bg-black/10" />
      <div className="mt-4 h-3 w-40 rounded bg-black/10" />
    </div>
  );
}

/** Local toast system (anti-spam: dedupe last message) */
type ToastItem = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  durationMs: number;
};

function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastRef = useRef<string>("");

  const push = (title: string, description?: string, durationMs = 2200) => {
    const sig = `${title}::${description || ""}`;
    if (lastRef.current === sig) return;
    lastRef.current = sig;

    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const item: ToastItem = {
      id,
      title,
      description,
      createdAt: Date.now(),
      durationMs: clamp(durationMs, 1200, 6000),
    };
    setToasts((prev) => [...prev, item]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, item.durationMs);
  };

  return { toasts, push };
}

function ToastViewport(props: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {props.toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none rounded-2xl border border-black/10 bg-white/90 px-4 py-3 shadow-[0_14px_36px_-22px_rgba(0,0,0,0.55)] backdrop-blur"
          >
            <div className="text-sm font-semibold text-black/90">{t.title}</div>
            {t.description ? <div className="mt-0.5 text-xs leading-relaxed text-black/65">{t.description}</div> : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * ✅ CRITICAL FIX:
 * - trimitem snake_case către Edge Function: funnel_slug, style_key
 * - NU includem "signal" în body
 * - acceptăm răspuns "pending" fără preview_url
 */
async function requestReplicatePreview(args:
  | {
      signal: AbortSignal;
      funnelSlug: string;
      styleKey: string;
      photo: string;
      bucket: string;
    }
  | {
      signal: AbortSignal;
      request_id: string;
    }
): Promise<PreviewResponse> {
  const body =
    "request_id" in args
      ? { request_id: args.request_id }
      : {
          funnel_slug: args.funnelSlug,
          style_key: args.styleKey,
          photo: args.photo,
          bucket: args.bucket,
          watermark: true,
        };

  const res = await fetch("https://rmdsnpckutsucabledqz.supabase.co/functions/v1/replicate-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: args.signal,
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  let data: PreviewResponse = {};
  try {
    data = text ? (JSON.parse(text) as PreviewResponse) : {};
  } catch {
    // ignore json parse
  }

  if (!res.ok) {
    const msg = data?.error || `Preview request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

export default function FunnelPreview() {
  const { toasts, push } = useToasts();

  const [funnelSlug, setFunnelSlug] = useState<string>("newborn");
  const [bucket, setBucket] = useState<string>("templates");
  const [photo, setPhoto] = useState<string | null>(null);

  // keep styleKey (backend needs it), but NO UI to change it
  const [styleKey, setStyleKey] = useState<string>("newborn_soft_cream");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressHint, setProgressHint] = useState("Generating preview…");

  const redirectTimerRef = useRef<number | null>(null);
  const lastKeydownRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  // ✅ Read photo from query params OR localStorage
  useEffect(() => {
    const qsPhoto = getQueryStringValue("photo");
    const qsBucket = getQueryStringValue("bucket");
    const qsSlug = getQueryStringValue("slug");
    const qsStyle = getQueryStringValue("style");

    setFunnelSlug(normalizeKey(qsSlug, "newborn"));
    setBucket(normalizeKey(qsBucket, "templates"));

    if (qsStyle && qsStyle.trim()) setStyleKey(qsStyle.trim());

    if (qsPhoto && qsPhoto.trim()) {
      setPhoto(qsPhoto.trim());
      return;
    }

    const storedPhoto = (() => {
      try {
        return window.localStorage.getItem("tdg_funnel_photo");
      } catch {
        return null;
      }
    })();

    const storedStyle = (() => {
      try {
        return window.localStorage.getItem("tdg_funnel_style");
      } catch {
        return null;
      }
    })();

    if (storedStyle && storedStyle.trim()) setStyleKey(storedStyle.trim());

    if (!storedPhoto) {
      push("Upload a photo first", "No photo reference found. Please upload again.");
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.assign("/funnel/uploadPhoto");
      }, 650);
      return;
    }

    setPhoto(storedPhoto);
  }, [push]);

  // protect keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const now = safeNow();
      if (now - lastKeydownRef.current < 150) return;
      lastKeydownRef.current = now;

      const key = (e.key || "").toLowerCase();
      const isPrintScreen = key === "printscreen";
      const isPrintCombo = (e.ctrlKey || e.metaKey) && key === "p";
      if (isPrintScreen || isPrintCombo) {
        e.preventDefault();
        push("Preview protected");
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown as any);
  }, [push]);

  // cleanup
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const bg = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(1200px 800px at 20% 10%, rgba(235,244,242,0.95) 0%, rgba(250,248,242,1) 55%, rgba(247,246,242,1) 100%), radial-gradient(900px 600px at 85% 35%, rgba(220,235,255,0.55) 0%, rgba(255,255,255,0) 60%)",
    } as React.CSSProperties;
  }, []);

  const onPreviewContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    push("Preview protected");
  };

  const onPreviewDragStart = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // watermark overlay
  const watermarkText = "TDG • TheDigitalGifter • PREVIEW";
  const repeatedTextLines = useMemo(() => {
    const line = `${watermarkText}   ${watermarkText}   ${watermarkText}   ${watermarkText}   ${watermarkText}`;
    return new Array(10).fill(line);
  }, [watermarkText]);

  const watermarkTileStyle = useMemo(() => ({ opacity: 0.15 } as React.CSSProperties), []);
  const bigTDGStyle = useMemo(
    () =>
      ({
        opacity: 0.1,
        mixBlendMode: "soft-light" as React.CSSProperties["mixBlendMode"],
        textShadow: "0 10px 40px rgba(0,0,0,0.25)",
      }) as React.CSSProperties,
    []
  );

  // ✅ Generate + poll until real URL (max ~10s), no repeat creates
  useEffect(() => {
    if (!photo) return;

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsGenerating(true);
    setPreviewUrl(null);
    setProgressHint("Generating preview…");

    let stopped = false;

    (async () => {
      try {
        // 1) create (or cached) => get request_id + placeholder/real url
        const first = await requestReplicatePreview({
          funnelSlug,
          styleKey,
          photo,
          bucket,
          signal: ac.signal,
        });

        const requestId = first.request_id;
        const pending = !!first.pending;

        if (first.preview_url) {
          setPreviewUrl(addCacheBusterIfHttp(first.preview_url));
        }

        try {
          window.localStorage.setItem("tdg_funnel_style", styleKey);
        } catch {}

        if (!pending || !requestId) {
          setIsGenerating(false);
          return;
        }

        // 2) poll by request_id (cheap, no create)
        const deadline = Date.now() + 10_000;
        while (!stopped && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 450));

          const polled = await requestReplicatePreview({ request_id: requestId, signal: ac.signal });

          if (polled.preview_url) {
            setPreviewUrl(addCacheBusterIfHttp(polled.preview_url));
          }

          const u = polled.preview_url || "";
          const stillPending = !!polled.pending || (u ? isDataUrl(u) : true);

          if (!stillPending) {
            setIsGenerating(false);
            return;
          }
        }

        setIsGenerating(false);
      } catch (e: any) {
        if (ac.signal.aborted) return;
        console.error("[FunnelPreview] replicate preview error:", e);
        setIsGenerating(false);
        setPreviewUrl(null);
        push("Couldn’t generate preview", e?.message || "Please try again.");
      }
    })();

    return () => {
      stopped = true;
      ac.abort();
    };
  }, [photo, bucket, funnelSlug, styleKey, push]);

  return (
    <div className="min-h-screen w-full" style={bg}>
      <ToastViewport toasts={toasts} />

      <div className="sticky top-0 z-40 w-full border-b border-black/10 bg-white/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#0f3d2e] shadow-[0_10px_30px_-18px_rgba(15,61,46,0.9)]" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-black/90">TheDigitalGifter</span>
              <span className="text-xs text-black/55">Step 2 of 3 — Preview ({funnelSlug})</span>
            </div>
          </div>

          <Badge className="text-black/75">
            <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#0f3d2e]" />
            Secure preview
          </Badge>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Card className="p-4 md:p-7">
          <div className="flex flex-col items-center">
            <div className="w-full">
              <div className="mb-4 text-center">
                <div className="text-sm font-semibold text-black/85">Preview</div>
                <div className="mt-1 text-xs text-black/55">We generate a watermarked preview automatically.</div>
              </div>

              <div
                className={cx(
                  "relative mx-auto overflow-hidden rounded-2xl border border-black/10 bg-white",
                  "shadow-[0_14px_36px_-26px_rgba(0,0,0,0.45)]"
                )}
                onContextMenu={onPreviewContextMenu}
              >
                <div className="relative w-full" style={{ paddingTop: "75%" }}>
                  <div className="absolute inset-0">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Generated preview"
                        className="h-full w-full object-cover"
                        draggable={false}
                        onDragStart={onPreviewDragStart}
                        onError={(e) => {
                          console.error("IMG LOAD ERROR:", (e.target as HTMLImageElement)?.src);
                          push("Preview image failed to load", "Check the returned preview_url (Console).");
                        }}
                      />
                    ) : photo ? (
                      <div className="flex h-full w-full items-center justify-center bg-black/5">
                        <div className="text-sm text-black/60">Preparing preview…</div>
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-black/5">
                        <div className="text-sm text-black/60">No photo</div>
                      </div>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {isGenerating ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[2px]"
                      >
                        <div className="mx-6 w-full max-w-sm rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_14px_36px_-26px_rgba(0,0,0,0.45)]">
                          <div className="text-sm font-semibold text-black/85">{progressHint}</div>
                          <div className="mt-3">
                            <Skeleton />
                          </div>
                          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10">
                            <motion.div
                              className="h-full w-1/2 bg-[#0f3d2e]/70"
                              initial={{ x: "-60%" }}
                              animate={{ x: "120%" }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </div>
                          <div className="mt-3 text-[11px] text-black/55">This is a low-res, watermarked preview.</div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* Watermark overlay */}
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                      msUserSelect: "none",
                      pointerEvents: "none",
                    }}
                    animate={{ x: [0, 8, 0], y: [0, -6, 0] }}
                    transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div
                      className="absolute inset-[-30%] flex flex-col gap-6"
                      style={{ transform: "rotate(-20deg)", ...watermarkTileStyle }}
                    >
                      {repeatedTextLines.map((line, idx) => (
                        <div key={`wm_${idx}`} className="whitespace-nowrap text-[14px] font-semibold tracking-wide text-black/70">
                          {line}
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-[96px] font-black uppercase tracking-[0.18em] text-black" style={bigTDGStyle}>
                        TDG
                      </div>
                    </div>

                    <div
                      className="absolute inset-0"
                      style={{
                        opacity: 0.12,
                        mixBlendMode: "overlay",
                        backgroundImage:
                          "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"140\" height=\"140\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"140\" height=\"140\" filter=\"url(%23n)\" opacity=\"0.35\"/></svg>')",
                        backgroundSize: "140px 140px",
                      }}
                    />
                  </motion.div>
                </div>
              </div>

              <div className="mt-3 text-center text-xs text-black/60">
                Preview is watermarked. Full quality unlock after checkout.
              </div>
            </div>

            <div className="mt-6 w-full max-w-sm text-center">
              <Button className="w-full" disabled={!photo || isGenerating} onClick={() => window.location.assign("/funnel/payment")}>
                Unlock Full Quality
              </Button>
              <div className="mt-2 text-xs text-black/55">You’ll receive the final image in high resolution after payment.</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="h-10" />
    </div>
  );
}
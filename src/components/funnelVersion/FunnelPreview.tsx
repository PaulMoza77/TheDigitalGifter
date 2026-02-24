import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * FunnelPreview.tsx (NEWBORN / PORTRAIT funnel)
 * ------------------------------------------------
 * - Single-file React + TS component
 * - NO external UI/toast imports, NO router hooks.
 * - Navigation via window.location.assign(...)
 *
 * How it gets the photo:
 * ✅ Primary: query params (recommended)
 *   /funnel/preview?bucket=templates&photo=previews/xxx.png&slug=newborn
 *
 * Fallbacks:
 * - localStorage tdg_funnel_photo (if present)
 *
 * Replicate:
 * - Calls POST /api/replicate/preview -> { preview_url: string }
 */

type ColorGrade = "warm" | "cool" | "neutral";

type TemplateStyle = {
  styleKey:
    | "newborn_soft_cream"
    | "newborn_clean_studio"
    | "newborn_warm_beige"
    | "newborn_lifestyle_home"
    | "newborn_fine_art"
    | "newborn_matte_portrait";
  name: string;
  subtitle: string;
  previewOverlay: {
    background: string;
    opacity: number;
    mixBlendMode?: React.CSSProperties["mixBlendMode"];
  };
  colorGrade: ColorGrade;
  motionHint: string;
  promptHint: string;
  flags?: {
    hasGlow?: boolean;
    hasBokeh?: boolean;
    hasGrain?: boolean;
  };
};

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  durationMs: number;
};

type PreviewResponse = {
  preview_url: string;
  request_id?: string;
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

function addCacheBuster(url: string): string {
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

function Select(props: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; sub?: string }>;
  className?: string;
}) {
  return (
    <div className={cx("w-full", props.className)}>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold text-black/80 outline-none focus:ring-2 focus:ring-black/10"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {(() => {
        const sub = props.options.find((o) => o.value === props.value)?.sub;
        return sub ? <div className="mt-1 text-xs text-black/55">{sub}</div> : null;
      })()}
    </div>
  );
}

/** Local toast system (anti-spam: dedupe last message) */
function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastRef = useRef<string>("");

  const push = (title: string, description?: string, durationMs = 2200) => {
    const sig = `${title}::${description || ""}`;
    if (lastRef.current === sig) return; // prevent spam
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
            {t.description ? (
              <div className="mt-0.5 text-xs leading-relaxed text-black/65">{t.description}</div>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Newborn/Portrait styles (exactly 6) */
const TEMPLATES: TemplateStyle[] = [
  {
    styleKey: "newborn_soft_cream",
    name: "Soft Cream",
    subtitle: "Gentle skin tones, airy softness",
    previewOverlay: {
      background:
        "radial-gradient(1000px 700px at 30% 30%, rgba(255,245,230,0.70) 0%, rgba(255,255,255,0.0) 62%), linear-gradient(135deg, rgba(250,235,215,0.25) 0%, rgba(255,255,255,0.0) 55%)",
      opacity: 0.58,
      mixBlendMode: "soft-light",
    },
    colorGrade: "warm",
    motionHint: "Soft glow",
    promptHint: "soft cream studio newborn portrait, natural skin, gentle highlight rolloff, airy softness",
    flags: { hasGlow: true, hasBokeh: true, hasGrain: false },
  },
  {
    styleKey: "newborn_clean_studio",
    name: "Clean Studio",
    subtitle: "Neutral whites, crisp clarity",
    previewOverlay: {
      background:
        "radial-gradient(1100px 800px at 25% 25%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.0) 60%), linear-gradient(180deg, rgba(235,245,255,0.22) 0%, rgba(255,255,255,0.0) 65%)",
      opacity: 0.55,
      mixBlendMode: "screen",
    },
    colorGrade: "neutral",
    motionHint: "Studio clarity",
    promptHint: "clean studio newborn portrait, neutral background, crisp but soft detail, high-end photography",
    flags: { hasGlow: false, hasBokeh: false, hasGrain: false },
  },
  {
    styleKey: "newborn_warm_beige",
    name: "Warm Beige",
    subtitle: "Cozy warmth, matte softness",
    previewOverlay: {
      background:
        "radial-gradient(900px 650px at 35% 35%, rgba(245,225,200,0.55) 0%, rgba(255,255,255,0.0) 62%), repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, rgba(0,0,0,0.0) 5px, rgba(0,0,0,0.0) 11px)",
      opacity: 0.52,
      mixBlendMode: "soft-light",
    },
    colorGrade: "warm",
    motionHint: "Matte warmth",
    promptHint: "warm beige newborn portrait, matte finish, cozy tones, premium editorial look",
    flags: { hasGlow: true, hasBokeh: false, hasGrain: true },
  },
  {
    styleKey: "newborn_lifestyle_home",
    name: "Lifestyle Home",
    subtitle: "Natural light, documentary feel",
    previewOverlay: {
      background:
        "radial-gradient(950px 700px at 20% 20%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.0) 60%), linear-gradient(135deg, rgba(210,235,255,0.18) 0%, rgba(255,255,255,0.0) 62%)",
      opacity: 0.5,
      mixBlendMode: "overlay",
    },
    colorGrade: "neutral",
    motionHint: "Natural light drift",
    promptHint: "lifestyle newborn portrait, natural window light, authentic home feel, soft contrast",
    flags: { hasGlow: false, hasBokeh: true, hasGrain: false },
  },
  {
    styleKey: "newborn_fine_art",
    name: "Fine Art",
    subtitle: "Painterly tones, elegant depth",
    previewOverlay: {
      background:
        "radial-gradient(1000px 750px at 60% 40%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.0) 60%), linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(255,255,255,0.0) 60%), repeating-radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, rgba(255,255,255,0.0) 10px, rgba(255,255,255,0.0) 22px)",
      opacity: 0.55,
      mixBlendMode: "soft-light",
    },
    colorGrade: "neutral",
    motionHint: "Fine-art depth",
    promptHint: "fine art newborn portrait, elegant depth, soft chiaroscuro, premium gallery style",
    flags: { hasGlow: true, hasBokeh: true, hasGrain: true },
  },
  {
    styleKey: "newborn_matte_portrait",
    name: "Matte Portrait",
    subtitle: "Smooth matte, modern clean look",
    previewOverlay: {
      background:
        "radial-gradient(1000px 700px at 35% 35%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.0) 62%), linear-gradient(135deg, rgba(240,245,255,0.20) 0%, rgba(255,255,255,0.0) 60%)",
      opacity: 0.52,
      mixBlendMode: "overlay",
    },
    colorGrade: "cool",
    motionHint: "Matte modern finish",
    promptHint: "matte newborn portrait, modern clean look, smooth skin tones, high-end retouching",
    flags: { hasGlow: false, hasBokeh: false, hasGrain: false },
  },
];

function getTemplateByKey(styleKey: string | null | undefined): TemplateStyle {
  const key = (styleKey || "").trim();
  const found = TEMPLATES.find((t) => t.styleKey === key);
  return found ?? (TEMPLATES[0] as TemplateStyle);
}

function computeFilterForTemplate(t: TemplateStyle): string {
  const base = { contrast: 1.05, saturate: 1.06, brightness: 1.02, hue: 0, blur: 0 };

  if (t.colorGrade === "cool") {
    base.contrast = 1.06;
    base.saturate = 1.05;
    base.brightness = 1.03;
    base.hue = -5;
  } else if (t.colorGrade === "warm") {
    base.contrast = 1.04;
    base.saturate = 1.1;
    base.brightness = 1.02;
    base.hue = 6;
  }

  if (t.flags?.hasBokeh) base.blur = 0.25;
  if (t.flags?.hasGlow) {
    base.brightness = Math.max(base.brightness, 1.04);
    base.saturate = Math.max(base.saturate, 1.08);
  }
  if (t.flags?.hasGrain) base.contrast = Math.max(base.contrast, 1.06);

  return `contrast(${base.contrast}) saturate(${base.saturate}) brightness(${base.brightness}) blur(${base.blur}px) hue-rotate(${base.hue}deg)`;
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

async function requestReplicatePreview(args: {
  funnelSlug: string;
  styleKey: string;
  photo: string; // should be a URL or a storage path (backend must support)
  bucket: string;
  signal: AbortSignal;
}): Promise<PreviewResponse> {
const res = await fetch("https://rmdsnpckutsucabledqz.supabase.co/functions/v1/replicate-preview", {
      method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: args.signal,
    body: JSON.stringify({
      funnel_slug: args.funnelSlug,
      style_key: args.styleKey,
      photo: args.photo,
      bucket: args.bucket,
      watermark: true,
    }),
  });

  if (!res.ok) {
    let msg = `Preview request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch {}
    throw new Error(msg);
  }

  const data = (await res.json()) as PreviewResponse;
  if (!data?.preview_url) throw new Error("Preview response missing preview_url");
  return data;
}

export default function FunnelPreview() {
  const { toasts, push } = useToasts();

  // context
  const [funnelSlug, setFunnelSlug] = useState<string>("newborn");
  const [bucket, setBucket] = useState<string>("templates");

  // photo source
  const [photo, setPhoto] = useState<string | null>(null); // can be storage path or full URL

  // style
  const [styleKey, setStyleKey] = useState<string>("newborn_soft_cream");

  // generated result
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // generating
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressHint, setProgressHint] = useState("Generating preview…");
  const [generationToken, setGenerationToken] = useState(0);

  const redirectTimerRef = useRef<number | null>(null);
  const lastKeydownRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  // ✅ Read photo from query params (primary) OR localStorage (fallback)
  useEffect(() => {
    const qsPhoto = getQueryStringValue("photo"); // e.g. previews/xxx.png
    const qsBucket = getQueryStringValue("bucket"); // templates
    const qsSlug = getQueryStringValue("slug"); // newborn
    const qsStyle = getQueryStringValue("style"); // optional

    const slug = normalizeKey(qsSlug, "newborn");
    setFunnelSlug(slug);

    setBucket(normalizeKey(qsBucket, "templates"));

    if (qsStyle) setStyleKey(qsStyle);

    // primary: query param
    if (qsPhoto && qsPhoto.trim()) {
      setPhoto(qsPhoto.trim());
      return;
    }

    // fallback: localStorage
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

    if (storedStyle && storedStyle.trim()) {
      setStyleKey(storedStyle.trim());
    }

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

  const resolvedTemplate = useMemo(() => getTemplateByKey(styleKey), [styleKey]);
  const filterCss = useMemo(() => computeFilterForTemplate(resolvedTemplate), [resolvedTemplate]);

  // ✅ Generate via Replicate when photo/style changes
  useEffect(() => {
    if (!photo) return;

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsGenerating(true);
    setPreviewUrl(null);
    setProgressHint(`Generating preview… ${resolvedTemplate.motionHint}`);

    (async () => {
      try {
        const r = await requestReplicatePreview({
          funnelSlug,
          styleKey: resolvedTemplate.styleKey,
          photo,
          bucket,
          signal: ac.signal,
        });

        setPreviewUrl(addCacheBuster(r.preview_url));
        setIsGenerating(false);

        // persist only style (optional)
        try {
          window.localStorage.setItem("tdg_funnel_style", resolvedTemplate.styleKey);
        } catch {}
      } catch (e: any) {
        if (ac.signal.aborted) return;
        console.error("[FunnelPreview] replicate preview error:", e);
        setIsGenerating(false);
        setPreviewUrl(null);
        push("Couldn’t generate preview", e?.message || "Please try again.");
      }
    })();

    return () => ac.abort();
  }, [photo, bucket, funnelSlug, resolvedTemplate.styleKey, resolvedTemplate.motionHint, generationToken, push]);

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

  const styleOptions = useMemo(
    () => TEMPLATES.map((t) => ({ value: t.styleKey, label: t.name, sub: t.subtitle })),
    []
  );

  const onRegenerate = () => setGenerationToken((n) => n + 1);

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
                <div className="mt-1 text-xs text-black/55">
                  Choose a style. We generate a watermarked preview automatically.
                </div>
              </div>

              <div className="mx-auto mb-4 w-full max-w-md">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-black/65">Style</div>
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="text-xs font-semibold text-black/55 hover:text-black/75"
                    title="Regenerate preview"
                  >
                    Regenerate
                  </button>
                </div>
                <Select value={styleKey} onChange={setStyleKey} options={styleOptions} />
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
                        style={{ filter: filterCss }}
                        draggable={false}
                        onDragStart={onPreviewDragStart}
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

                  <div
                    className="absolute inset-0"
                    style={{
                      background: resolvedTemplate.previewOverlay.background,
                      opacity: clamp(resolvedTemplate.previewOverlay.opacity, 0, 1),
                      mixBlendMode: resolvedTemplate.previewOverlay.mixBlendMode,
                    }}
                  />

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
                          <div className="mt-3 text-[11px] text-black/55">
                            This is a low-res, watermarked preview.
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

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
                        <div
                          key={`wm_${idx}`}
                          className="whitespace-nowrap text-[14px] font-semibold tracking-wide text-black/70"
                        >
                          {line}
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="text-[96px] font-black uppercase tracking-[0.18em] text-black"
                        style={bigTDGStyle}
                      >
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

                  <div
                    className="absolute inset-0"
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 text-center text-xs text-black/60">
                Preview is watermarked. Full quality unlock after checkout.
              </div>
            </div>

            <div className="mt-6 w-full max-w-sm text-center">
              <Button
                className="w-full"
                disabled={!photo || isGenerating}
                onClick={() => window.location.assign("/funnel/payment")}
              >
                Unlock Full Quality
              </Button>
              <div className="mt-2 text-xs text-black/55">
                You’ll receive the final image in high resolution after payment.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="h-10" />
    </div>
  );
}
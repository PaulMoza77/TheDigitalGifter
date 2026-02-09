import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * FunnelPreview.tsx
 * Single-file React + TS component, no external UI/toast imports, no router hooks.
 * Navigation via window.location.assign("/funnel/payment")
 */

type ColorGrade = "warm" | "cool" | "neutral";

type TemplateStyle = {
  styleKey:
    | "classic_winter"
    | "cozy_fireplace"
    | "horse_carriage"
    | "sledding_fun"
    | "build_snowman"
    | "winter_city_lights";
  name: string;
  subtitle: string;
  previewOverlay: {
    background: string;
    opacity: number;
    mixBlendMode?: React.CSSProperties["mixBlendMode"];
  };
  colorGrade: ColorGrade;
  motionHint: string;
  flags?: {
    hasSnow?: boolean;
    hasGlow?: boolean;
    hasBokeh?: boolean;
  };
};

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  durationMs: number;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeNow(): number {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function randomMs(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const ms = Math.floor(lo + Math.random() * (hi - lo + 1));
  if (typeof window !== "undefined") {
    console.assert(ms >= lo && ms <= hi, "randomMs out of range", { ms, lo, hi });
  }
  return ms;
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

/** Local toast system */
function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = (title: string, description?: string, durationMs = 2200) => {
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

/** Templates (exactly 6) */
const TEMPLATES: TemplateStyle[] = [
  {
    styleKey: "classic_winter",
    name: "Classic Winter",
    subtitle: "Clean snow tones, crisp contrast",
    previewOverlay: {
      background:
        "radial-gradient(1200px 800px at 20% 20%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.0) 55%), linear-gradient(135deg, rgba(210,235,255,0.55) 0%, rgba(255,255,255,0.0) 45%), repeating-linear-gradient(135deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, rgba(255,255,255,0.0) 10px, rgba(255,255,255,0.0) 18px)",
      opacity: 0.55,
      mixBlendMode: "screen",
    },
    colorGrade: "cool",
    motionHint: "Frost shimmer",
    flags: { hasSnow: true, hasGlow: false, hasBokeh: false },
  },
  {
    styleKey: "cozy_fireplace",
    name: "Cozy Fireplace",
    subtitle: "Warm highlights, gentle vignette",
    previewOverlay: {
      background:
        "radial-gradient(900px 700px at 25% 35%, rgba(255,205,140,0.55) 0%, rgba(255,255,255,0.0) 60%), radial-gradient(700px 500px at 70% 65%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.0) 55%), linear-gradient(135deg, rgba(255,170,90,0.18) 0%, rgba(255,255,255,0.0) 55%)",
      opacity: 0.6,
      mixBlendMode: "overlay",
    },
    colorGrade: "warm",
    motionHint: "Soft ember glow",
    flags: { hasSnow: false, hasGlow: true, hasBokeh: true },
  },
  {
    styleKey: "horse_carriage",
    name: "Horse & Carriage",
    subtitle: "Storybook winter, subtle grain",
    previewOverlay: {
      background:
        "linear-gradient(180deg, rgba(240,244,255,0.55) 0%, rgba(255,255,255,0.0) 60%), radial-gradient(850px 650px at 80% 25%, rgba(210,220,255,0.35) 0%, rgba(255,255,255,0.0) 60%), repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.0) 4px, rgba(0,0,0,0.0) 9px)",
      opacity: 0.5,
      mixBlendMode: "soft-light",
    },
    colorGrade: "neutral",
    motionHint: "Snow drift & film grain",
    flags: { hasSnow: true, hasGlow: false, hasBokeh: false },
  },
  {
    styleKey: "sledding_fun",
    name: "Sledding Fun",
    subtitle: "Punchy whites, playful pop",
    previewOverlay: {
      background:
        "radial-gradient(1100px 800px at 30% 25%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.0) 58%), linear-gradient(45deg, rgba(170,230,255,0.28) 0%, rgba(255,255,255,0.0) 55%), radial-gradient(700px 500px at 75% 75%, rgba(255,240,210,0.22) 0%, rgba(255,255,255,0.0) 55%)",
      opacity: 0.58,
      mixBlendMode: "screen",
    },
    colorGrade: "cool",
    motionHint: "Sparkle trails",
    flags: { hasSnow: true, hasGlow: true, hasBokeh: true },
  },
  {
    styleKey: "build_snowman",
    name: "Build a Snowman",
    subtitle: "Soft whites, friendly haze",
    previewOverlay: {
      background:
        "radial-gradient(950px 700px at 45% 35%, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.0) 60%), linear-gradient(135deg, rgba(220,245,255,0.28) 0%, rgba(255,255,255,0.0) 58%), repeating-radial-gradient(circle at 20% 20%, rgba(255,255,255,0.24) 0px, rgba(255,255,255,0.24) 2px, rgba(255,255,255,0.0) 9px, rgba(255,255,255,0.0) 18px)",
      opacity: 0.56,
      mixBlendMode: "soft-light",
    },
    colorGrade: "neutral",
    motionHint: "Gentle snow specks",
    flags: { hasSnow: true, hasGlow: false, hasBokeh: true },
  },
  {
    styleKey: "winter_city_lights",
    name: "Winter City Lights",
    subtitle: "Cool neon glow, bokeh lights",
    previewOverlay: {
      background:
        "radial-gradient(900px 650px at 30% 65%, rgba(180,220,255,0.22) 0%, rgba(255,255,255,0.0) 60%), radial-gradient(650px 480px at 70% 30%, rgba(255,220,180,0.18) 0%, rgba(255,255,255,0.0) 58%), repeating-radial-gradient(circle at 65% 40%, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 3px, rgba(255,255,255,0.0) 12px, rgba(255,255,255,0.0) 26px)",
      opacity: 0.62,
      mixBlendMode: "overlay",
    },
    colorGrade: "cool",
    motionHint: "City glow drift",
    flags: { hasSnow: false, hasGlow: true, hasBokeh: true },
  },
];

function getTemplateByKey(styleKey: string | null | undefined): TemplateStyle {
  const key = (styleKey || "").trim();
  const found = TEMPLATES.find((t) => t.styleKey === key);
  const fallback = TEMPLATES.find((t) => t.styleKey === "classic_winter") as TemplateStyle;
  const resolved = found ?? fallback;

  // Dev-only assertion: unknown styleKey falls back to classic_winter
  if (typeof window !== "undefined") {
    if (key && !found) {
      console.assert(resolved.styleKey === "classic_winter", "Unknown styleKey did not fallback");
    }
  }
  return resolved;
}

function computeFilterForTemplate(t: TemplateStyle): string {
  const base = {
    contrast: 1.06,
    saturate: 1.08,
    brightness: 1.02,
    blur: 0,
    hue: 0,
  };

  if (t.colorGrade === "cool") {
    base.contrast = 1.08;
    base.saturate = 1.07;
    base.brightness = 1.03;
    base.hue = -6;
  } else if (t.colorGrade === "warm") {
    base.contrast = 1.06;
    base.saturate = 1.12;
    base.brightness = 1.02;
    base.hue = 8;
  } else {
    base.contrast = 1.05;
    base.saturate = 1.06;
    base.brightness = 1.02;
    base.hue = 0;
  }

  if (t.flags?.hasBokeh) base.blur = 0.35;
  if (t.flags?.hasGlow) {
    base.brightness = Math.max(base.brightness, 1.04);
    base.saturate = Math.max(base.saturate, 1.1);
  }
  if (t.flags?.hasSnow) base.contrast = Math.max(base.contrast, 1.08);

  const blurPx = `${base.blur}px`;
  return `contrast(${base.contrast}) saturate(${base.saturate}) brightness(${base.brightness}) blur(${blurPx}) hue-rotate(${base.hue}deg)`;
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

export default function FunnelPreview() {
  const { toasts, push } = useToasts();

  const [photo, setPhoto] = useState<string | null>(null);
  const [styleKey, setStyleKey] = useState<string>("classic_winter");

  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [generationToken, setGenerationToken] = useState<number>(0);
  const [progressHint, setProgressHint] = useState<string>("Generating winter look…");

  const redirectTimerRef = useRef<number | null>(null);
  const generateTimerRef = useRef<number | null>(null);
  const lastKeydownRef = useRef<number>(0);

  // Dev-only assertions (extra test coverage)
  useEffect(() => {
    console.assert(TEMPLATES.length === 6, "Template count must be 6", { count: TEMPLATES.length });
    console.assert(getTemplateByKey("does_not_exist").styleKey === "classic_winter", "Fallback test failed");
    console.assert(getTemplateByKey("classic_winter").styleKey === "classic_winter", "Known key test failed");
    const ms = randomMs(2000, 4000);
    console.assert(ms >= 2000 && ms <= 4000, "randomMs(2000,4000) out of range", { ms });
  }, []);

  // Read localStorage and handle missing photo
  useEffect(() => {
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

    if (!storedPhoto) {
      push("Upload a photo first");
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.assign("/funnel/uploadPhoto");
      }, 650);
      return;
    }

    setPhoto(storedPhoto);
    setStyleKey(storedStyle && storedStyle.trim().length > 0 ? storedStyle : "classic_winter");
  }, [push]);

  // Keyboard protection: PrintScreen, Ctrl+P / Cmd+P
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

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
      if (generateTimerRef.current) window.clearTimeout(generateTimerRef.current);
    };
  }, []);

  const resolvedTemplate: TemplateStyle = useMemo(() => getTemplateByKey(styleKey), [styleKey]);
  const filterCss = useMemo(() => computeFilterForTemplate(resolvedTemplate), [resolvedTemplate]);

  // Regenerate preview (mock) when style or photo changes
  useEffect(() => {
    if (!photo) return;

    if (generateTimerRef.current) {
      window.clearTimeout(generateTimerRef.current);
      generateTimerRef.current = null;
    }

    setIsGenerating(true);

    const ms = randomMs(2000, 4000);
    const hint = ["Generating winter look…", resolvedTemplate.motionHint].filter(Boolean).join(" ");
    setProgressHint(hint);

    generateTimerRef.current = window.setTimeout(() => {
      setIsGenerating(false);
    }, ms);

    return () => {
      if (generateTimerRef.current) {
        window.clearTimeout(generateTimerRef.current);
        generateTimerRef.current = null;
      }
    };
  }, [photo, styleKey, generationToken, resolvedTemplate.motionHint]);

  const bg = useMemo(() => {
    return {
      backgroundImage:
        "radial-gradient(1200px 800px at 20% 10%, rgba(225,244,240,0.9) 0%, rgba(250,248,242,1) 55%, rgba(247,246,242,1) 100%), radial-gradient(900px 600px at 85% 35%, rgba(220,235,255,0.55) 0%, rgba(255,255,255,0) 60%)",
    } as React.CSSProperties;
  }, []);

  const onPreviewContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    push("Preview protected");
  };

  const onPreviewDragStart = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Aggressive watermark composition
  const watermarkTileStyle = useMemo(() => {
    const opacity = 0.15; // 0.12–0.18
    return {
      opacity,
    } as React.CSSProperties;
  }, []);

  const watermarkText = "TDG • TheDigitalGifter • PREVIEW";
  const repeatedTextLines = useMemo(() => {
    const line = `${watermarkText}   ${watermarkText}   ${watermarkText}   ${watermarkText}   ${watermarkText}`;
    return new Array(10).fill(line);
  }, [watermarkText]);

  const bigTDGStyle = useMemo(() => {
    return {
      opacity: 0.1,
      mixBlendMode: "soft-light" as React.CSSProperties["mixBlendMode"],
      textShadow: "0 10px 40px rgba(0,0,0,0.25)",
    } as React.CSSProperties;
  }, []);

  // Optional: allow regenerating via clicking the style badge (no style cards shown)
  const onRegenClick = () => {
    setGenerationToken((n) => n + 1);
  };

  return (
    <div className="min-h-screen w-full" style={bg}>
      <ToastViewport toasts={toasts} />

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 w-full border-b border-black/10 bg-white/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#0f3d2e] shadow-[0_10px_30px_-18px_rgba(15,61,46,0.9)]" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-black/90">TheDigitalGifter</span>
              <span className="text-xs text-black/55">Step 2 of 3 — Preview</span>
            </div>
          </div>

          <Badge className="text-black/75">
            <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-[#0f3d2e]" />
            Secure preview
          </Badge>
        </div>
      </div>

      {/* Main (centered) */}
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Card className="p-4 md:p-7">
          <div className="flex flex-col items-center">
            <div className="w-full">
              <div className="mb-3 text-center">
                <div className="text-sm font-semibold text-black/85">Preview</div>
                <button
                  type="button"
                  onClick={onRegenClick}
                  className="mt-0.5 inline-flex items-center justify-center"
                  aria-label="Regenerate preview"
                  title="Regenerate preview"
                >
                  <span className="text-xs text-black/55">{resolvedTemplate.name}</span>
                </button>
              </div>

              <div
                className={cx(
                  "relative mx-auto overflow-hidden rounded-2xl border border-black/10 bg-white",
                  "shadow-[0_14px_36px_-26px_rgba(0,0,0,0.45)]"
                )}
                onContextMenu={onPreviewContextMenu}
              >
                {/* aspect 4/3 */}
                <div className="relative w-full" style={{ paddingTop: "75%" }}>
                  {/* base image */}
                  <div className="absolute inset-0">
                    {photo ? (
                      <img
                        src={photo}
                        alt="Uploaded preview"
                        className="h-full w-full object-cover"
                        style={{ filter: filterCss }}
                        draggable={false}
                        onDragStart={onPreviewDragStart}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-black/5">
                        <div className="text-sm text-black/60">No photo</div>
                      </div>
                    )}
                  </div>

                  {/* Template overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: resolvedTemplate.previewOverlay.background,
                      opacity: clamp(resolvedTemplate.previewOverlay.opacity, 0, 1),
                      mixBlendMode: resolvedTemplate.previewOverlay.mixBlendMode,
                    }}
                  />

                  {/* Loading overlay */}
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
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {/* Aggressive watermark layers */}
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
                    {/* tiled diagonal repeating text */}
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

                    {/* big centered TDG */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="text-[96px] font-black uppercase tracking-[0.18em] text-black"
                        style={bigTDGStyle}
                      >
                        TDG
                      </div>
                    </div>

                    {/* subtle film grain */}
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

                  {/* hard interaction guard */}
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

            {/* CTA under preview */}
            <div className="mt-6 w-full max-w-sm text-center">
              <Button
                className="w-full"
                disabled={!photo || isGenerating}
                onClick={() => window.location.assign("/funnel/payment")}
              >
                Unlock Full Quality
              </Button>
              <div className="mt-2 text-xs text-black/55">Bonus credits included today.</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="h-10" />
    </div>
  );
}

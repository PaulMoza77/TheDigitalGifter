import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Canvas Preview Page — Volocar (inspired by alivemoment.com/quiz-main/style)
 * Theme: Winter Vibes
 * Single-step quiz: selection only, auto-redirect on click
 * React + TS + Tailwind + shadcn/ui + framer-motion
 */

type WinterStyleKey =
  | "classic_winter"
  | "cozy_fireplace"
  | "horse_carriage"
  | "sledding"
  | "snowman"
  | "winter_city";

type WinterStyle = {
  key: WinterStyleKey;
  title: string;
  subtitle: string;
  vibeTags: string[];
  hero: {
    gradient: string;
    emoji: string;
  };
};

const STYLES: WinterStyle[] = [
  {
    key: "classic_winter",
    title: "Classic Winter",
    subtitle: "Crisp air, soft snow, timeless winter postcard mood.",
    vibeTags: ["Snowy", "Minimal", "Bright"],
    hero: {
      gradient: "bg-gradient-to-br from-sky-50 via-indigo-50 to-slate-50",
      emoji: "❄️",
    },
  },
  {
    key: "cozy_fireplace",
    title: "Cozy Fireplace",
    subtitle: "Warm lights, blankets, hot cocoa, calm and cozy.",
    vibeTags: ["Warm", "Cozy", "Soft Glow"],
    hero: {
      gradient: "bg-gradient-to-br from-amber-50 via-rose-50 to-violet-50",
      emoji: "🔥",
    },
  },
  {
    key: "horse_carriage",
    title: "Horse & Carriage",
    subtitle: "Elegant winter ride — romantic, cinematic, premium vibe.",
    vibeTags: ["Luxury", "Cinematic", "Romantic"],
    hero: {
      gradient: "bg-gradient-to-br from-slate-50 via-stone-50 to-indigo-50",
      emoji: "🐴",
    },
  },
  {
    key: "sledding",
    title: "Sledding Fun",
    subtitle: "Playful winter energy — laughter, speed, and snow trails.",
    vibeTags: ["Fun", "Family", "Dynamic"],
    hero: {
      gradient: "bg-gradient-to-br from-cyan-50 via-sky-50 to-indigo-50",
      emoji: "🛷",
    },
  },
  {
    key: "snowman",
    title: "Building a Snowman",
    subtitle: "Cute, joyful, wholesome — classic winter memories.",
    vibeTags: ["Wholesome", "Cute", "Bright"],
    hero: {
      gradient: "bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50",
      emoji: "⛄️",
    },
  },
  {
    key: "winter_city",
    title: "Winter City Lights",
    subtitle: "Street lights + falling snow — modern, moody, stylish.",
    vibeTags: ["Urban", "Moody", "Stylish"],
    hero: {
      gradient: "bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-50",
      emoji: "🌃",
    },
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const cardAnim: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }, // <— înlocuiește "easeOut"
  },
};


export default function SelectStyle() {
  const [selected, setSelected] = useState<WinterStyleKey | null>(null);
  // hover state removed for cleaner UX

  const selectedStyle = useMemo(
    () => STYLES.find((s) => s.key === selected) ?? null,
    [selected]
  );

  return (
    <div className="min-h-screen w-full bg-[#F6F5FF] text-slate-900">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#6D5EF7]/10 blur-3xl" />
        <div className="absolute -bottom-44 right-[-120px] h-[520px] w-[520px] rounded-full bg-[#FF6AA2]/10 blur-3xl" />
        <div className="absolute -bottom-52 left-[-140px] h-[520px] w-[520px] rounded-full bg-[#32C6FF]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mx-auto max-w-2xl text-center"
        >
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Choose your <span className="text-[#6D5EF7]">Winter Vibe</span>
          </h1>
          <p className="mt-4 text-sm text-slate-600 sm:text-base">
            Tap a style. You’ll be redirected automatically.
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mx-auto mt-10"
        >
          <Card className="overflow-hidden rounded-[28px] border-slate-200 bg-white/80 shadow-[0_12px_40px_-18px_rgba(17,24,39,0.35)] backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Select a style</div>
                  <div className="text-xs text-slate-500">Auto-continue</div>
                </div>
                <Badge className="border-slate-200 bg-white text-slate-600">
                  6 options
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {STYLES.map((style) => {
                  const isSelected = selected === style.key;
                  

                  return (
                    <motion.div key={style.key} variants={cardAnim}>
                      <button
                        type="button"
                        onClick={() => {
  setSelected(style.key);
  setTimeout(() => {
    // 1) salvezi style-ul ales
    localStorage.setItem("tdg_funnel_style", style.key);

    // 2) mergi direct la payment
    window.location.href = "/funnel/payment";
  }, 250);
}}
                        
                        className={cn(
                          "group relative w-full rounded-2xl border p-4 text-left transition",
                          "border-slate-200 bg-white hover:bg-slate-50",
                          "shadow-[0_10px_24px_-18px_rgba(17,24,39,0.35)]",
                          isSelected && "border-[#6D5EF7]/40 ring-2 ring-[#6D5EF7]/15"
                        )}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "grid h-11 w-11 place-items-center rounded-2xl border border-slate-200",
                                style.hero.gradient
                              )}
                            >
                              <span className="text-xl">{style.hero.emoji}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">
                                  {style.title}
                                </span>
                                {isSelected && (
                                  <Badge className="border-[#6D5EF7]/20 bg-[#6D5EF7]/10 text-[#6D5EF7]">
                                    Selected
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-slate-600">
                                {style.subtitle}
                              </p>
                            </div>
                          </div>

                          <span
                            className={cn(
                              "text-slate-400 transition",
                              isSelected && "text-[#6D5EF7]"
                            )}
                          >
                            →
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {style.vibeTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 text-center text-xs text-slate-500">
            Tip: replace emojis with real thumbnails later.
          </div>
        </motion.div>
      </div>
    </div>
  );
}

          
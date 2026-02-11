// src/components/funnelVersion/FunnelStyleSelect.tsx
import React, { useState } from "react";
import { motion, Variants } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

type GiftStyle = { id: string; name: string; script: string };
type GiftOccasion = { title: string; subtitle: string; styles: GiftStyle[] };

const GIFT_STYLES: Record<string, GiftOccasion> = {
  new_born: {
    title: "Choose your New Born Vibe",
    subtitle: "A gentle beginning deserves a timeless memory.",
    styles: [
      {
        id: "soft_pastel",
        name: "Soft Pastel",
        script:
          "Soft pastel newborn portrait, natural daylight, smooth skin tones, airy atmosphere, peaceful expression",
      },
      {
        id: "cozy_blanket",
        name: "Cozy Blanket",
        script:
          "Newborn wrapped in a soft cozy blanket, warm tones, close framing, intimate feeling, gentle light",
      },
      {
        id: "angel_sleep",
        name: "Angel Sleep",
        script:
          "Sleeping newborn portrait, angelic mood, soft glow, peaceful face, heavenly light",
      },
      {
        id: "first_light",
        name: "First Light",
        script:
          "Newborn portrait with soft morning light, fresh beginning mood, hopeful atmosphere",
      },
      {
        id: "minimal_studio",
        name: "Minimal Studio",
        script:
          "Minimal studio newborn portrait, clean background, neutral tones, elegant and timeless",
      },
      {
        id: "golden_memory",
        name: "Golden Memory",
        script:
          "Newborn portrait with warm golden tones, nostalgic feeling, timeless memory style",
      },
    ],
  },
};

export default function FunnelStyleSelect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const occasion = searchParams.get("occasion") || "new_born";
  const data = GIFT_STYLES[occasion];

  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    if (!data || !selected) return;
    const style = data.styles.find((s) => s.id === selected);
    if (!style) return;

    localStorage.setItem(
      "tdg_funnel_session",
      JSON.stringify({
        gift_type: occasion,
        style_id: style.id,
        script: style.script,
      })
    );

    navigate("/funnel/upload");
  };

  if (!data) {
    return <div className="p-10 text-center">Invalid occasion</div>;
  }

  return (
    <div className="min-h-screen w-full bg-[#F6F5FF] text-slate-900">
      <div className="relative mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          className="mx-auto max-w-2xl text-center"
        >
          <h1 className="text-3xl font-semibold sm:text-5xl">{data.title}</h1>
          <p className="mt-4 text-sm text-slate-600 sm:text-base">
            {data.subtitle}
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
                  <div className="text-xs text-slate-500">
                    Select one, then continue
                  </div>
                </div>
                <Badge className="border-slate-200 bg-white text-slate-600">
                  {data.styles.length} options
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.styles.map((style) => {
                  const isSelected = selected === style.id;

                  return (
                    <motion.button
                      key={style.id}
                      type="button"
                      initial="hidden"
                      animate="show"
                      variants={cardAnim}
                      onClick={() => setSelected(style.id)}
                      className={cn(
                        "group relative w-full rounded-2xl border p-4 text-left transition",
                        "border-slate-200 bg-white hover:bg-slate-50",
                        "shadow-[0_10px_24px_-18px_rgba(17,24,39,0.35)]",
                        isSelected &&
                          "border-[#6D5EF7]/40 ring-2 ring-[#6D5EF7]/15"
                      )}
                      aria-pressed={isSelected}
                    >
                      {/* simple thumbnail placeholder (Christmas-like) */}
                      <div className="mb-3 h-24 w-full rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-50" />

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {style.name}
                            </span>
                            {isSelected && (
                              <Badge className="border-[#6D5EF7]/20 bg-[#6D5EF7]/10 text-[#6D5EF7]">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            Tap to select
                          </p>
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
                    </motion.button>
                  );
                })}
              </div>

              {/* Continue */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!selected}
                  className={cn(
                    "rounded-2xl px-8 py-3 font-semibold transition",
                    selected
                      ? "bg-[#6D5EF7] text-white hover:brightness-105 active:brightness-95 shadow-lg shadow-black/10"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  )}
                >
                  Continue
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 text-center text-xs text-slate-500">
            Tip: we’ll add thumbnails later.
          </div>
        </motion.div>
      </div>
    </div>
  );
}

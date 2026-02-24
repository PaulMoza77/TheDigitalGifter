// src/components/funnelVersion/FunnelStyleSelect.tsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, Variants } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

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

// DB row shape for funnel
type TemplateDbRow = {
  id: string;
  title: string | null;
  prompt: string | null;
  occasion: string | null;

  // this is what links to your static "style ids" (first_light, etc.)
  style_id: string | null;

  preview_url: string | null;
  thumbnail_url: string | null;

  isactive: boolean | null;
};

type FunnelStyle = {
  id: string; // style_id
  name: string; // title
  script: string; // prompt
  previewUrl: string;
  thumbnailUrl: string | null;
};

export default function FunnelStyleSelect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const occasion = (searchParams.get("occasion") || "new_born").toLowerCase().trim();

  const [loading, setLoading] = useState(true);
  const [styles, setStyles] = useState<FunnelStyle[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Header text per occasion (optional)
  const header = useMemo(() => {
    if (occasion === "new_born") {
      return {
        title: "Choose your New Born Vibe",
        subtitle: "A gentle beginning deserves a timeless memory.",
      };
    }
    return {
      title: "Select a style",
      subtitle: "Pick one vibe to continue.",
    };
  }, [occasion]);

  useEffect(() => {
    let alive = true;

    const fetchStyles = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("templates")
        .select(
          [
            "id",
            "title",
            "prompt",
            "occasion",
            "style_id",
            "preview_url",
            "thumbnail_url",
            "isactive",
          ].join(",")
        )
        .eq("isactive", true)
        .eq("occasion", occasion)
        .order("style_id", { ascending: true });

      if (!alive) return;

      if (error) {
        console.error("[FunnelStyleSelect] fetch templates error:", error);
        setStyles([]);
        setLoading(false);
        return;
      }

      const mapped: FunnelStyle[] = (data ?? [])
        .map((r) => r as unknown as TemplateDbRow)
        .filter((r) => (r.style_id || "").trim().length > 0)
        .map((r) => ({
          id: String(r.style_id),
          name: String(r.title ?? "").trim() || String(r.style_id),
          script: String(r.prompt ?? "").trim(),
          previewUrl: r.preview_url ?? "",
          thumbnailUrl: r.thumbnail_url ?? null,
        }));

      setStyles(mapped);
      setLoading(false);

      // if current selected no longer exists, reset
      setSelected((prev) => (prev && mapped.some((x) => x.id === prev) ? prev : null));
    };

    void fetchStyles();

    return () => {
      alive = false;
    };
  }, [occasion]);

  const handleContinue = () => {
    if (!selected) return;
    const style = styles.find((s) => s.id === selected);
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
          <h1 className="text-3xl font-semibold sm:text-5xl">{header.title}</h1>
          <p className="mt-4 text-sm text-slate-600 sm:text-base">{header.subtitle}</p>
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
                  <div className="text-xs text-slate-500">Select one, then continue</div>
                </div>
                <Badge className="border-slate-200 bg-white text-slate-600">
                  {loading ? "…" : `${styles.length} options`}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_-18px_rgba(17,24,39,0.35)]"
                    >
                      <div className="mb-3 h-24 w-full rounded-xl border border-slate-200 bg-slate-100" />
                      <div className="h-3 w-32 rounded bg-slate-200" />
                      <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : styles.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-sm font-semibold">No styles found</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Create templates with <b>occasion = {occasion}</b> and a <b>style_id</b>.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {styles.map((style) => {
                    const isSelected = selected === style.id;
                    const imgSrc = style.thumbnailUrl || style.previewUrl || "";

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
                          isSelected && "border-[#6D5EF7]/40 ring-2 ring-[#6D5EF7]/15"
                        )}
                        aria-pressed={isSelected}
                      >
                        {/* Thumbnail */}
                        <div className="mb-3 h-24 w-full overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-50">
                          {imgSrc ? (
                            <img src={imgSrc} alt={style.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{style.name}</span>
                              {isSelected && (
                                <Badge className="border-[#6D5EF7]/20 bg-[#6D5EF7]/10 text-[#6D5EF7]">
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-600">Tap to select</p>
                          </div>

                          <span className={cn("text-slate-400 transition", isSelected && "text-[#6D5EF7]")}>
                            →
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Continue */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!selected || loading || styles.length === 0}
                  className={cn(
                    "rounded-2xl px-8 py-3 font-semibold transition",
                    selected && !loading && styles.length > 0
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
            Tip: thumbnails are taken from your Templates preview image automatically.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
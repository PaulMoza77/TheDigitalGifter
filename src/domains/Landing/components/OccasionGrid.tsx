import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OccasionRow = {
  id?: string | null;
  slug: string;
  title: string;
  active?: boolean | null;
  sort_order?: number | null;
  updated_at?: string | null;
};

function normalizeOccasionSlug(slug: string) {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

function funnelHrefForSlug(slug: string) {
  return `/funnel/homepage/${encodeURIComponent(normalizeOccasionSlug(slug))}`;
}

function templatesHrefForSlug(slug: string) {
  return `/templates?occasion=${encodeURIComponent(normalizeOccasionSlug(slug))}`;
}

function prettyLabelFromSlug(slug: string) {
  const s = String(slug || "").trim().toLowerCase();

  if (s.includes("christmas")) return "Cozy snowy magic";
  if (s.includes("new") && s.includes("year")) return "Gold & fireworks";
  if (s.includes("thank")) return "Warm & cozy dinner";
  if (s.includes("birthday")) return "Party & confetti";
  if (s.includes("baby") && s.includes("reveal")) return "Soft pastel surprise";
  if (s.includes("born")) return "Gentle & creamy";
  if (s.includes("pregnancy")) return "Soft glow";
  if (s.includes("wedding")) return "Timeless & elegant";
  if (s.includes("easter")) return "Spring & pastel";
  if (s.includes("valentine")) return "Romantic candlelight";
  if (s.includes("anniversary")) return "Classy & intimate";
  if (s.includes("mother")) return "Soft & floral";
  if (s.includes("father")) return "Bold & clean";
  if (s.includes("graduation")) return "Caps & confetti";

  return "New memories";
}

function fallbackDescription(slug: string) {
  const s = String(slug || "").trim().toLowerCase();

  if (s.includes("christmas")) return "Turn any photo into a warm, cinematic Christmas card.";
  if (s.includes("new") && s.includes("year")) return "Sparkling countdown vibes with neon lights and confetti.";
  if (s.includes("thank")) return "Autumn colors, candles and a grateful, family feel.";
  if (s.includes("birthday")) return "Balloons, cake and bright birthday energy.";
  if (s.includes("baby") && s.includes("reveal")) return "Gender reveal or baby news with dreamy pastel tones.";
  if (s.includes("born")) return "Minimal, clean layouts that keep the baby in focus.";
  if (s.includes("pregnancy")) return "Elegant silhouettes, warm light and calm tones.";
  if (s.includes("wedding")) return "Luxury, editorial-style wedding announcement cards.";
  if (s.includes("easter")) return "Fresh colors, flowers and soft daylight.";
  if (s.includes("valentine")) return "Cinematic couples, roses and candlelight.";
  if (s.includes("anniversary")) return "Elegant layouts to celebrate any milestone.";
  if (s.includes("mother")) return "Delicate florals and warm light for mom.";
  if (s.includes("father")) return "Minimal, modern layouts with strong contrast.";
  if (s.includes("graduation")) return "Sharp, modern cards to celebrate the big day.";

  return "Create something beautiful in seconds.";
}

function fallbackGradientFrom(slug: string) {
  const s = String(slug || "").trim().toLowerCase();

  if (s.includes("christmas")) return "from-blue-700/60";
  if (s.includes("new") && s.includes("year")) return "from-amber-700/60";
  if (s.includes("thank")) return "from-orange-700/60";
  if (s.includes("birthday")) return "from-fuchsia-700/60";
  if (s.includes("baby") && s.includes("reveal")) return "from-violet-700/60";
  if (s.includes("born")) return "from-emerald-700/60";
  if (s.includes("pregnancy")) return "from-rose-700/60";
  if (s.includes("wedding")) return "from-indigo-700/60";
  if (s.includes("easter")) return "from-green-700/60";
  if (s.includes("valentine")) return "from-red-700/60";
  if (s.includes("anniversary")) return "from-slate-700/60";
  if (s.includes("mother")) return "from-pink-700/60";
  if (s.includes("father")) return "from-slate-700/60";
  if (s.includes("graduation")) return "from-teal-700/60";

  return "from-slate-700/60";
}

function fallbackGradientTo() {
  return "to-slate-950/85";
}

function fallbackImage(slug: string) {
  const s = String(slug || "").trim().toLowerCase();

  if (s.includes("christmas")) return "/images/occasions/christmas.jpg";
  if (s.includes("new") && s.includes("year")) return "/images/occasions/new-years-eve.jpg";
  if (s.includes("thank")) return "/images/occasions/thanksgiving.jpg";
  if (s.includes("birthday")) return "/images/occasions/birthday.jpg";
  if (s.includes("baby") && s.includes("reveal")) return "/images/occasions/baby-reveal.jpg";
  if (s.includes("born")) return "/images/occasions/new-born.jpg";
  if (s.includes("pregnancy")) return "/images/occasions/pregnancy.jpg";
  if (s.includes("wedding")) return "/images/occasions/wedding.jpg";
  if (s.includes("easter")) return "/images/occasions/easter.jpg";
  if (s.includes("valentine")) return "/images/occasions/valentines-day.jpg";
  if (s.includes("anniversary")) return "/images/occasions/anniversary.jpg";
  if (s.includes("mother")) return "/images/occasions/mothers-day.jpg";
  if (s.includes("father")) return "/images/occasions/fathers-day.jpg";
  if (s.includes("graduation")) return "/images/occasions/graduation.jpg";

  return "/images/occasions/default.jpg";
}

const FALLBACK_OCCASIONS: OccasionRow[] = [
  { slug: "christmas", title: "Christmas", active: true, sort_order: 1 },
  { slug: "birthday", title: "Birthday", active: true, sort_order: 2 },
  { slug: "new-years-eve", title: "New Year's Eve", active: true, sort_order: 3 },
  { slug: "thanksgiving", title: "Thanksgiving", active: true, sort_order: 4 },
  { slug: "baby-reveal", title: "Baby Reveal", active: true, sort_order: 5 },
  { slug: "new-born", title: "New Born", active: true, sort_order: 6 },
];

export default function OccasionGrid() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OccasionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("occasions")
        .select("id, slug, title, active, sort_order, updated_at")
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("[OccasionGrid] supabase error:", error);
        setRows(FALLBACK_OCCASIONS);
        return;
      }

      const safeRows = ((data as OccasionRow[]) || []).filter(
        (x) => x?.slug && x?.title
      );

      setRows(safeRows.length > 0 ? safeRows : FALLBACK_OCCASIONS);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const occasions = useMemo(() => {
    const source = rows ?? FALLBACK_OCCASIONS;

    return [...source].sort((a, b) => {
      const aOrder = typeof a.sort_order === "number" ? a.sort_order : 999999;
      const bOrder = typeof b.sort_order === "number" ? b.sort_order : 999999;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }, [rows]);

  if (rows === null) {
    return (
      <section id="categories" className="w-full px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 space-y-4 text-center">
            <div className="mx-auto h-10 w-[520px] max-w-full rounded-xl bg-white/10" />
            <div className="mx-auto h-6 w-[720px] max-w-full rounded-xl bg-white/10" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"
              >
                <div className="h-64 bg-white/10" />
                <div className="space-y-3 p-4">
                  <div className="h-7 w-40 rounded-lg bg-white/10" />
                  <div className="h-4 w-72 rounded-lg bg-white/10" />
                  <div className="h-10 w-full rounded-xl bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="categories" className="w-full px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mb-16 space-y-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold text-white sm:text-5xl">
            Choose Your Perfect{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Occasion
            </span>
          </h2>

          <p className="mx-auto max-w-2xl text-xl text-slate-400">
            From festive holidays to milestone celebrations, find the perfect
            style for every special moment.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {occasions.map((occ, index) => {
            const slug = String(occ.slug || "").trim();
            const key = String(occ.id || slug || index);

            const funnelHref = funnelHrefForSlug(slug);
            const templatesHref = templatesHrefForSlug(slug);

            const label = prettyLabelFromSlug(slug);
            const description = fallbackDescription(slug);
            const image = fallbackImage(slug);
            const gradientFrom = fallbackGradientFrom(slug);
            const gradientTo = fallbackGradientTo();

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                whileHover={{ scale: 1.03 }}
              >
                <Card className="group relative overflow-hidden border-slate-800 bg-slate-900/50 transition-all duration-300 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20">
                  <CardContent className="relative isolate p-0">
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={image}
                        alt={occ.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />

                      <div
                        className={cn(
                          "absolute inset-0 z-10 bg-gradient-to-br opacity-80",
                          gradientFrom,
                          gradientTo
                        )}
                      />

                      <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-70" />

                      <div className="absolute left-4 top-4 z-30 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        {label}
                      </div>
                    </div>

                    <div className="relative z-30 space-y-4 p-4">
                      <div>
                        <h3 className="mb-2 text-2xl font-bold text-white transition-colors group-hover:text-blue-400">
                          {occ.title}
                        </h3>

                        <p className="mb-2 text-sm text-slate-400">
                          {description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => navigate(funnelHref)}
                          variant="ghost"
                          className={cn(
                            "w-full rounded-xl text-white group/btn",
                            "bg-gray-800 hover:bg-gray-700"
                          )}
                        >
                          See More
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                        </Button>

                        <Button
                          type="button"
                          onClick={() => navigate(templatesHref)}
                          className="w-full rounded-xl bg-blue-600 text-white group/btn hover:bg-blue-700"
                        >
                          Explore Templates
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
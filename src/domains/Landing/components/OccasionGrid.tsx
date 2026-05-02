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
  const s = String(slug || "").trim().toLowerCase();

  if (s === "newborn") return "new-born";
  if (s === "new_born") return "new-born";
  if (s === "valentines_day") return "valentines-day";
  if (s === "mothers_day") return "mothers-day";
  if (s === "fathers_day") return "fathers-day";
  if (s === "new_years_eve") return "new-years-eve";
  if (s === "baby_reveal") return "baby-reveal";

  return s.replace(/_/g, "-").replace(/\s+/g, "-");
}

function normalizeOccasionKey(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s === "new-born") return "newborn";
  if (s === "valentines-day") return "valentines_day";
  if (s === "mothers-day") return "mothers_day";
  if (s === "fathers-day") return "fathers_day";
  if (s === "new-years-eve") return "new_years_eve";
  if (s === "baby-reveal") return "baby_reveal";

  return s;
}

function funnelHrefForSlug(slug: string) {
  return `/funnel/homepage/${encodeURIComponent(normalizeOccasionSlug(slug))}`;
}

function templatesHrefForSlug(slug: string) {
  return `/templates?occasion=${encodeURIComponent(normalizeOccasionKey(slug))}`;
}

function prettyLabelFromSlug(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s.includes("christmas")) return "Cozy snowy magic";
  if (s.includes("new") && s.includes("year")) return "Gold & fireworks";
  if (s.includes("thank") && s.includes("you")) return "Warm gratitude";
  if (s.includes("thank") && s.includes("giving")) return "Warm family dinner";
  if (s.includes("birthday")) return "Party & confetti";
  if (s.includes("baby") && s.includes("reveal")) return "Soft pastel surprise";
  if (s.includes("born") || s.includes("newborn")) return "Gentle & creamy";
  if (s.includes("pregnancy")) return "Soft glow";
  if (s.includes("wedding")) return "Timeless & elegant";
  if (s.includes("easter")) return "Spring & pastel";
  if (s.includes("valentine")) return "Romantic candlelight";
  if (s.includes("anniversary")) return "Classy & intimate";
  if (s.includes("mother")) return "Soft & floral";
  if (s.includes("father")) return "Warm family moment";
  if (s.includes("graduation")) return "Caps & celebration";
  if (s.includes("sorry")) return "Emotional apology";

  return "New memories";
}

function fallbackDescription(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s.includes("christmas")) {
    return "Turn any photo into a warm, cinematic Christmas memory.";
  }

  if (s.includes("new") && s.includes("year")) {
    return "Sparkling countdown vibes with lights, confetti and celebration.";
  }

  if (s.includes("thank") && s.includes("you")) {
    return "Elegant gratitude cards with warm, heartfelt emotion.";
  }

  if (s.includes("thank") && s.includes("giving")) {
    return "Cozy autumn tones, gratitude and beautiful family dinner energy.";
  }

  if (s.includes("birthday")) {
    return "Balloons, cake and bright birthday emotion.";
  }

  if (s.includes("baby") && s.includes("reveal")) {
    return "Dreamy pastel moments for your big baby reveal.";
  }

  if (s.includes("born") || s.includes("newborn")) {
    return "Beautiful newborn layouts with soft, gentle warmth.";
  }

  if (s.includes("pregnancy")) {
    return "Elegant maternity styles with calm light and emotion.";
  }

  if (s.includes("wedding")) {
    return "Luxury wedding visuals with timeless romantic atmosphere.";
  }

  if (s.includes("easter")) {
    return "Fresh spring colors, flowers and joyful Easter charm.";
  }

  if (s.includes("valentine")) {
    return "Romantic couple moments with roses and candlelight.";
  }

  if (s.includes("anniversary")) {
    return "Celebrate milestone love stories with elegant, heartfelt visuals.";
  }

  if (s.includes("mother")) {
    return "Warm, floral moments made to honor mom beautifully.";
  }

  if (s.includes("father")) {
    return "Meaningful, warm family visuals for Father's Day.";
  }

  if (s.includes("graduation")) {
    return "Celebrate the big win with bold, joyful graduation energy.";
  }

  if (s.includes("sorry")) {
    return "Create a heartfelt apology card with soft, honest emotion.";
  }

  return "Create something beautiful in seconds.";
}

function fallbackGradientFrom(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s.includes("christmas")) return "from-blue-700/40";
  if (s.includes("new") && s.includes("year")) return "from-amber-700/40";
  if (s.includes("thank") && s.includes("you")) return "from-rose-700/40";
  if (s.includes("thank") && s.includes("giving")) return "from-orange-700/40";
  if (s.includes("birthday")) return "from-fuchsia-700/40";
  if (s.includes("baby") && s.includes("reveal")) return "from-pink-700/40";
  if (s.includes("born") || s.includes("newborn")) return "from-stone-700/40";
  if (s.includes("pregnancy")) return "from-rose-700/40";
  if (s.includes("wedding")) return "from-indigo-700/40";
  if (s.includes("easter")) return "from-emerald-700/40";
  if (s.includes("valentine")) return "from-red-700/40";
  if (s.includes("anniversary")) return "from-yellow-700/40";
  if (s.includes("mother")) return "from-pink-700/40";
  if (s.includes("father")) return "from-slate-700/40";
  if (s.includes("graduation")) return "from-sky-700/40";
  if (s.includes("sorry")) return "from-rose-700/40";

  return "from-slate-700/40";
}

function fallbackGradientTo() {
  return "to-slate-950/85";
}

function fallbackImage(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s.includes("christmas")) return "/images/occasions/christmas.png";
  if (s.includes("birthday")) return "/images/occasions/happy-birthday.png";
  if (s.includes("new") && s.includes("year")) {
    return "/images/occasions/new-years-eve.png";
  }
  if (s.includes("thank") && s.includes("you")) {
    return "/images/occasions/thank-you.png";
  }
  if (s.includes("thank") && s.includes("giving")) {
    return "/images/occasions/thanks-giving.png";
  }
  if (s.includes("baby") && s.includes("reveal")) {
    return "/images/occasions/gender-reveal.png";
  }
  if (s.includes("born") || s.includes("newborn")) {
    return "/images/occasions/newborn.png";
  }
  if (s.includes("pregnancy")) return "/images/occasions/pregnancy.png";
  if (s.includes("wedding")) return "/images/occasions/wedding.png";
  if (s.includes("easter")) return "/images/occasions/easter.png";
  if (s.includes("valentine")) return "/images/occasions/valentines-day.png";
  if (s.includes("anniversary")) return "/images/occasions/anniversary.png";
  if (s.includes("mother")) return "/images/occasions/mothers-day.png";
  if (s.includes("father")) return "/images/occasions/fathers-day.png";
  if (s.includes("graduation")) return "/images/occasions/graduation.png";
  if (s.includes("sorry")) return "/images/occasions/sorry.png";

  return "/images/occasions/default.png";
}

const FALLBACK_OCCASIONS: OccasionRow[] = [
  { slug: "christmas", title: "Christmas", active: true, sort_order: 1 },
  { slug: "birthday", title: "Birthday", active: true, sort_order: 2 },
  { slug: "new-years-eve", title: "New Year's Eve", active: true, sort_order: 3 },
  { slug: "thank-you", title: "Thank You", active: true, sort_order: 4 },
  { slug: "thanksgiving", title: "Thanksgiving", active: true, sort_order: 5 },
  { slug: "baby-reveal", title: "Baby Reveal", active: true, sort_order: 6 },
  { slug: "new-born", title: "New Born", active: true, sort_order: 7 },
  { slug: "pregnancy", title: "Pregnancy", active: true, sort_order: 8 },
  { slug: "wedding", title: "Wedding", active: true, sort_order: 9 },
  { slug: "easter", title: "Easter", active: true, sort_order: 10 },
  { slug: "valentines-day", title: "Valentine's Day", active: true, sort_order: 11 },
  { slug: "anniversary", title: "Anniversary", active: true, sort_order: 12 },
  { slug: "mothers-day", title: "Mother's Day", active: true, sort_order: 13 },
  { slug: "fathers-day", title: "Father's Day", active: true, sort_order: 14 },
  { slug: "graduation", title: "Graduation", active: true, sort_order: 15 },
  { slug: "sorry", title: "Sorry", active: true, sort_order: 16 },
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
                whileHover={{ y: -4 }}
              >
                <Card className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 transition-all duration-300 hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/10">
                  <CardContent className="p-0">
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={image}
                        alt={occ.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      <div
                        className={cn(
                          "absolute inset-0 bg-gradient-to-br opacity-80",
                          gradientFrom,
                          gradientTo
                        )}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />

                      <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs text-white backdrop-blur-sm">
                        {label}
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <div>
                        <h3 className="mb-2 text-2xl font-bold text-white transition-colors group-hover:text-blue-400">
                          {occ.title}
                        </h3>

                        <p className="text-sm leading-6 text-slate-400">
                          {description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => navigate(funnelHref)}
                          variant="ghost"
                          className="w-full rounded-xl bg-white/5 text-white hover:bg-white/10"
                        >
                          See More
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          onClick={() => navigate(templatesHref)}
                          className="w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Explore Templates
                          <ArrowRight className="ml-2 h-4 w-4" />
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
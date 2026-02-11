// src/domains/Landing/components/OccasionGrid.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

import { cn } from "@/lib/utils";

/**
 * DB shape (current):
 * occasions: { slug, title, active, sortOrder, updatedAt }
 *
 * Until you add media fields in DB, we use lightweight fallbacks
 * (label/description/gradient/image) based on slug.
 */
type OccasionRow = {
  _id: string;
  slug: string;
  title: string;
  active?: boolean;
  sortOrder?: number;
  updatedAt?: number;
};

function slugToHref(slug: string) {
  // keep your routes dashed
  return `/${String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")}`;
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
  if (s.includes("christmas"))
    return "Turn any photo into a warm, cinematic Christmas card.";
  if (s.includes("new") && s.includes("year"))
    return "Sparkling countdown vibes with neon lights and confetti.";
  if (s.includes("thank"))
    return "Autumn colors, candles and a grateful, family feel.";
  if (s.includes("birthday"))
    return "Balloons, cake and bright birthday energy.";
  if (s.includes("baby") && s.includes("reveal"))
    return "Gender reveal or baby news with dreamy pastel tones.";
  if (s.includes("born"))
    return "Minimal, clean layouts that keep the baby in focus.";
  if (s.includes("pregnancy"))
    return "Elegant silhouettes, warm light and calm tones.";
  if (s.includes("wedding"))
    return "Luxury, editorial-style wedding announcement cards.";
  if (s.includes("easter"))
    return "Fresh colors, flowers and soft daylight.";
  if (s.includes("valentine"))
    return "Cinematic couples, roses and candlelight.";
  if (s.includes("anniversary"))
    return "Elegant layouts to celebrate any milestone.";
  if (s.includes("mother"))
    return "Delicate florals and warm light for mom.";
  if (s.includes("father"))
    return "Minimal, modern layouts with strong contrast.";
  if (s.includes("graduation"))
    return "Sharp, modern cards to celebrate the big day.";
  return "Create something beautiful in seconds.";
}

function fallbackGradientFrom(slug: string) {
  const s = String(slug || "").trim().toLowerCase();
  if (s.includes("christmas")) return "from-blue-700/60";
  if (s.includes("new") && s.includes("year")) return "from-amber-700/60";
  if (s.includes("thank")) return "from-orange-700/60"; // ✅ thanksgiving
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

function fallbackGradientTo(slug: string) {
  const s = String(slug || "").trim().toLowerCase();
  if (s.includes("christmas")) return "to-slate-900/70";
  if (s.includes("new") && s.includes("year")) return "to-slate-900/70";
  if (s.includes("thank")) return "to-slate-900/70"; // ✅ thanksgiving
  if (s.includes("birthday")) return "to-slate-900/70";
  if (s.includes("baby") && s.includes("reveal")) return "to-slate-900/70";
  if (s.includes("born")) return "to-slate-900/70";
  if (s.includes("pregnancy")) return "to-slate-900/70";
  if (s.includes("wedding")) return "to-slate-900/70";
  if (s.includes("easter")) return "to-slate-900/70";
  if (s.includes("valentine")) return "to-slate-900/70";
  if (s.includes("anniversary")) return "to-slate-900/70";
  if (s.includes("mother")) return "to-slate-900/70";
  if (s.includes("father")) return "to-slate-900/70";
  if (s.includes("graduation")) return "to-slate-900/70";
  return "to-slate-900/70";
}

/**
 * Placeholder images (until DB has imageUrl).
 * If you already have real images in /public, swap these paths.
 */
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

export const OccasionGrid = () => {
  const navigate = useNavigate();

  // ✅ IMPORTANT: use FunctionReference from `api`
  const rows = useQuery(api.occasions.listActive, {}) as OccasionRow[] | undefined;

  // loading
  if (rows === undefined) {
    return (
      <section id="categories" className="w-full py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="h-10 w-[520px] max-w-full mx-auto rounded-xl bg-white/10" />
            <div className="h-6 w-[720px] max-w-full mx-auto rounded-xl bg-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="h-64 bg-white/10" />
                <div className="p-4 space-y-3">
                  <div className="h-7 w-40 bg-white/10 rounded-lg" />
                  <div className="h-4 w-72 bg-white/10 rounded-lg" />
                  <div className="h-10 w-full bg-white/10 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // sort safety (even if query already sorts)
  const occasions = [...rows].sort((a, b) => {
    const ao = typeof a.sortOrder === "number" ? a.sortOrder : 999999;
    const bo = typeof b.sortOrder === "number" ? b.sortOrder : 999999;
    if (ao !== bo) return ao - bo;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  return (
    <section id="categories" className="w-full py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-16 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Choose Your Perfect{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Occasion
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            From festive holidays to milestone celebrations, find the perfect
            style for every special moment
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {occasions.map((occ, index) => {
            const slug = String(occ.slug || "").trim();
            const href = slugToHref(slug);

            const label = prettyLabelFromSlug(slug);
            const description = fallbackDescription(slug);
            const image = fallbackImage(slug);
            const gradientFrom = fallbackGradientFrom(slug);
            const gradientTo = fallbackGradientTo(slug);

            return (
              <motion.div
                key={occ._id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => navigate(href)}
                className="cursor-pointer"
              >
                <Card className="group relative overflow-hidden bg-slate-900/50 border-slate-800 transition-all duration-300 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20">
                  <CardContent className="p-0 relative isolate">
                    {/* Image */}
                    <div className="relative h-64 overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-0 bg-gradient-to-br opacity-80 z-10",
                          gradientFrom,
                          gradientTo
                        )}
                      />
                      <img
                        src={image}
                        alt={occ.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Label */}
                      <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-xs text-white">
                        {label}
                      </div>

                      <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4 relative z-20">
                      <div>
                        <h3 className="text-2xl font-bold mb-2 text-white group-hover:text-blue-400 transition-colors">
                          {occ.title}
                        </h3>
                        <p className="text-slate-400 text-sm mb-2">{description}</p>
                      </div>

                      <div className="flex gap-2 items-center">
                        <Link to={href} className="w-full" onClick={(e) => e.stopPropagation()}>
                          <Button
                            className={cn(
                              "w-full text-white rounded-xl group/btn",
                              "bg-gray-800 hover:bg-gray-700"
                            )}
                            variant="ghost"
                          >
                            See More
                            <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </Link>

                        <Link
                          to={`/templates?occasion=${encodeURIComponent(slug)}`}
                          className="w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl group/btn">
                            Explore Templates
                            <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
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
};

export default OccasionGrid;

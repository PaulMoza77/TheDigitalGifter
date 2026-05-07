import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  PawPrint,
  Plus,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CategoryKey = "occasions" | "personal" | "spiritual" | "pets";

type OccasionRow = {
  id?: string | null;
  slug: string;
  title: string;
  active?: boolean | null;
  sort_order?: number | null;
  updated_at?: string | null;
};

type TemplateImageRow = {
  title?: string | null;
  occasion?: string | null;
  category?: string | null;
  previewurl?: string | null;
  preview_url?: string | null;
  preview_image_url?: string | null;
  thumbnailurl?: string | null;
  thumbnail_url?: string | null;
  isactive?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type OccasionItem = OccasionRow & {
  group: CategoryKey;
};

const categoryTabs: {
  key: CategoryKey;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}[] = [
  {
    key: "occasions",
    title: "Occasions",
    subtitle: "Birthdays, holidays",
    icon: CalendarDays,
  },
  {
    key: "personal",
    title: "Personal",
    subtitle: "Names, kids, love",
    icon: Heart,
  },
  {
    key: "spiritual",
    title: "Spiritual",
    subtitle: "Faith, prayer, hope",
    icon: Plus,
  },
  {
    key: "pets",
    title: "Pets",
    subtitle: "Dogs, cats, memories",
    icon: PawPrint,
  },
];

function normalizeOccasionSlug(slug: string) {
  const s = String(slug || "").trim().toLowerCase();

  if (s === "newborn") return "new-born";
  if (s === "new_born") return "new-born";
  if (s === "valentines_day") return "valentines-day";
  if (s === "mothers_day") return "mothers-day";
  if (s === "fathers_day") return "fathers-day";
  if (s === "new_years_eve") return "new-years-eve";
  if (s === "baby_reveal") return "baby-reveal";
  if (s === "name_cards") return "name-cards";
  if (s === "bible_verses") return "bible-verses";
  if (s === "pet_loss") return "pet-loss";

  return s.replace(/_/g, "-").replace(/\s+/g, "-");
}

function normalizeOccasionKey(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s === "new-born") return "new_born";
  if (s === "valentines-day") return "valentines_day";
  if (s === "mothers-day") return "mothers_day";
  if (s === "fathers-day") return "fathers_day";
  if (s === "new-years-eve") return "new_years_eve";
  if (s === "baby-reveal") return "baby_reveal";
  if (s === "name-cards") return "name_cards";
  if (s === "bible-verses") return "bible_verses";
  if (s === "pet-loss") return "pet_loss";

  return s;
}

function groupFromSlug(slug: string): CategoryKey {
  const s = normalizeOccasionKey(slug);

  if (
    ["name_cards", "kids", "sorry", "valentines_day", "anniversary"].includes(s)
  ) {
    return "personal";
  }

  if (["bible_verses", "prayer"].includes(s)) {
    return "spiritual";
  }

  if (["dogs", "cats", "pet_loss"].includes(s)) {
    return "pets";
  }

  return "occasions";
}

function funnelHrefForSlug(slug: string) {
  return `/funnel/homepage/${encodeURIComponent(normalizeOccasionSlug(slug))}`;
}

function getTemplateImage(row: TemplateImageRow) {
  return (
    row.preview_image_url ||
    row.preview_url ||
    row.previewurl ||
    row.thumbnail_url ||
    row.thumbnailurl ||
    null
  );
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
  if (s.includes("name")) return "Name portraits";
  if (s.includes("kids")) return "Playful memories";
  if (s.includes("bible")) return "Faith & peace";
  if (s.includes("prayer")) return "Hope & comfort";
  if (s.includes("dogs")) return "Dog memories";
  if (s.includes("cats")) return "Cat memories";
  if (s.includes("pet")) return "Forever remembered";

  return "New memories";
}

function fallbackDescription(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s.includes("christmas")) {
    return "Turn any photo into a warm, cinematic Christmas memory.";
  }

  if (s.includes("birthday")) {
    return "Balloons, cake and bright birthday emotion.";
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

  if (s.includes("name")) {
    return "Create a personal name portrait with a face, mood and signature style.";
  }

  if (s.includes("kids")) {
    return "Fun, colorful creations made for children and playful moments.";
  }

  if (s.includes("bible")) {
    return "Create meaningful verse visuals filled with peace and hope.";
  }

  if (s.includes("prayer")) {
    return "Turn a prayer or message into a comforting visual keepsake.";
  }

  if (s.includes("dogs")) {
    return "Celebrate your dog with a warm, personal memory.";
  }

  if (s.includes("cats")) {
    return "Create beautiful cat portraits and emotional pet memories.";
  }

  if (s.includes("pet")) {
    return "Honor a pet memory with something gentle and meaningful.";
  }

  return "Create something beautiful and personal.";
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
  if (s.includes("name")) return "/images/occasions/name-cards.png";
  if (s.includes("kids")) return "/images/occasions/kids.png";
  if (s.includes("bible")) return "/images/occasions/bible-verses.png";
  if (s.includes("prayer")) return "/images/occasions/prayer.png";
  if (s.includes("dogs")) return "/images/occasions/dogs.png";
  if (s.includes("cats")) return "/images/occasions/cats.png";
  if (s.includes("pet")) return "/images/occasions/pet-loss.png";

  return "/images/occasions/default.png";
}

function fallbackGradientFrom(slug: string) {
  const s = normalizeOccasionSlug(slug);

  if (s.includes("christmas")) return "from-blue-700/40";
  if (s.includes("birthday")) return "from-fuchsia-700/40";
  if (s.includes("sorry")) return "from-rose-700/40";
  if (s.includes("name")) return "from-yellow-700/40";
  if (s.includes("pet") || s.includes("dogs") || s.includes("cats")) {
    return "from-emerald-700/40";
  }

  return "from-slate-700/40";
}

const FALLBACK_OCCASIONS: OccasionRow[] = [
  { slug: "birthday", title: "Birthday", active: true, sort_order: 1 },
  { slug: "christmas", title: "Christmas", active: true, sort_order: 2 },
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
  { slug: "name-cards", title: "Name Cards", active: true, sort_order: 16 },
  { slug: "sorry", title: "Sorry", active: true, sort_order: 17 },
  { slug: "kids", title: "Kids", active: true, sort_order: 18 },
  { slug: "bible-verses", title: "Bible Verses", active: true, sort_order: 19 },
  { slug: "prayer", title: "Prayer", active: true, sort_order: 20 },
  { slug: "dogs", title: "Dogs", active: true, sort_order: 21 },
  { slug: "cats", title: "Cats", active: true, sort_order: 22 },
  { slug: "pet-loss", title: "Pet Loss", active: true, sort_order: 23 },
];

export default function OccasionGrid() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OccasionRow[] | null>(null);
  const [templateImagesByOccasion, setTemplateImagesByOccasion] = useState<
    Record<string, string>
  >({});
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryKey>("occasions");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [occasionsResult, templatesResult] = await Promise.all([
        supabase
          .from("occasions")
          .select("id, slug, title, active, sort_order, updated_at")
          .eq("active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("templates")
          .select(
            "title, occasion, category, previewurl, preview_url, preview_image_url, thumbnailurl, thumbnail_url, isactive, is_active, created_at"
          )
          .not("occasion", "is", null)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      if (cancelled) return;

      if (occasionsResult.error) {
        console.error("[OccasionGrid] occasions error:", occasionsResult.error);
        setRows(FALLBACK_OCCASIONS);
      } else {
        const safeRows = ((occasionsResult.data as OccasionRow[]) || []).filter(
          (item) => item?.slug && item?.title
        );

        const merged = [...safeRows];

        for (const fallback of FALLBACK_OCCASIONS) {
          const exists = merged.some(
            (item) =>
              normalizeOccasionKey(item.slug) ===
              normalizeOccasionKey(fallback.slug)
          );

          if (!exists) merged.push(fallback);
        }

        setRows(merged.length > 0 ? merged : FALLBACK_OCCASIONS);
      }

      if (templatesResult.error) {
        console.error("[OccasionGrid] templates error:", templatesResult.error);
        setTemplateImagesByOccasion({});
        return;
      }

      const imageMap: Record<string, string> = {};
      const templateRows = (templatesResult.data as TemplateImageRow[]) || [];

      for (const template of templateRows) {
        const occasion = String(template.occasion || "").trim();
        const image = getTemplateImage(template);

        if (!occasion || !image) continue;

        const key = normalizeOccasionKey(occasion);
        const slugKey = normalizeOccasionSlug(occasion);

        if (!imageMap[key]) imageMap[key] = image;
        if (!imageMap[slugKey]) imageMap[slugKey] = image;
      }

      setTemplateImagesByOccasion(imageMap);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const occasions = useMemo<OccasionItem[]>(() => {
    const source = rows ?? FALLBACK_OCCASIONS;

    return [...source]
      .map((item) => ({
        ...item,
        group: groupFromSlug(item.slug),
      }))
      .sort((a, b) => {
        const aOrder = typeof a.sort_order === "number" ? a.sort_order : 999999;
        const bOrder = typeof b.sort_order === "number" ? b.sort_order : 999999;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
  }, [rows]);

  const visibleOccasions = useMemo(
    () => occasions.filter((item) => item.group === selectedCategory),
    [occasions, selectedCategory]
  );

  if (rows === null) {
    return (
      <section id="categories" className="w-full px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 h-40 rounded-[2rem] border border-white/10 bg-white/[0.04]" />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
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
    <section id="categories" className="w-full px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <Sparkles className="h-7 w-7 text-yellow-200" />
                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Choose a category and occasion
                  </h2>
                </div>

                <p className="text-lg font-medium text-white/55">
                  Start with the moment, then personalize it.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => navigate("/templates")}
                variant="ghost"
                className="rounded-2xl border border-white/10 bg-black/20 px-6 py-6 text-base font-bold text-white hover:bg-white/10"
              >
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {categoryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = selectedCategory === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedCategory(tab.key)}
                    className={cn(
                      "flex items-center gap-4 rounded-3xl border p-5 text-left transition",
                      isActive
                        ? "border-yellow-300 bg-yellow-300 text-black shadow-2xl shadow-yellow-500/10"
                        : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-7 w-7 shrink-0",
                        isActive ? "text-black" : "text-white/80"
                      )}
                    />

                    <span>
                      <span className="block text-xl font-black">
                        {tab.title}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-sm font-medium",
                          isActive ? "text-black/65" : "text-white/45"
                        )}
                      >
                        {tab.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleOccasions.map((occ, index) => {
            const slug = String(occ.slug || "").trim();
            const normalizedKey = normalizeOccasionKey(slug);
            const normalizedSlug = normalizeOccasionSlug(slug);
            const key = String(occ.id || slug || index);
            const funnelHref = funnelHrefForSlug(slug);
            const image =
              templateImagesByOccasion[normalizedKey] ||
              templateImagesByOccasion[normalizedSlug] ||
              fallbackImage(slug);

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.35 }}
                whileHover={{ y: -4 }}
              >
                <Card className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition duration-300 hover:border-yellow-300/35 hover:shadow-2xl hover:shadow-yellow-500/10">
                  <CardContent className="p-0">
                    <button
                      type="button"
                      onClick={() => navigate(funnelHref)}
                      className="block w-full text-left"
                    >
                      <div className="relative h-64 overflow-hidden bg-white/5">
                        <img
                          src={image}
                          alt={occ.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          onError={(event) => {
                            event.currentTarget.src = fallbackImage(slug);
                          }}
                        />

                        <div
                          className={cn(
                            "absolute inset-0 bg-gradient-to-br opacity-65",
                            fallbackGradientFrom(slug),
                            "to-black"
                          )}
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                        <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                          {prettyLabelFromSlug(slug)}
                        </div>
                      </div>

                      <div className="space-y-5 p-5">
                        <div>
                          <h3 className="mb-2 text-2xl font-black text-white transition-colors group-hover:text-yellow-200">
                            {occ.title}
                          </h3>

                          <p className="text-sm leading-6 text-white/55">
                            {fallbackDescription(slug)}
                          </p>
                        </div>

                        <div className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 py-4 font-black text-black transition hover:opacity-95">
                          Create
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                      </div>
                    </button>
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
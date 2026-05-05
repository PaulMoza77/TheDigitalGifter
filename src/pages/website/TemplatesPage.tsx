import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import TemplatesGrid from "@/components/TemplatesGrid";
import { PageHead } from "@/components/PageHead";
import { occasions } from "@/constants/occasions";
import { TemplateSummary } from "@/types/templates";

type CategoryKey = "all" | "occasions" | "personal" | "spiritual" | "pets";

const categoryTabs: Array<{
  key: CategoryKey;
  title: string;
  description: string;
}> = [
  {
    key: "all",
    title: "All",
    description: "Everything in one place",
  },
  {
    key: "occasions",
    title: "Occasions",
    description: "Birthdays, holidays, weddings",
  },
  {
    key: "personal",
    title: "Personal",
    description: "Names, kids, love, apology",
  },
  {
    key: "spiritual",
    title: "Spiritual",
    description: "Faith, prayer, encouragement",
  },
  {
    key: "pets",
    title: "Pets",
    description: "Dogs, cats, pet memories",
  },
];

function normalizeCategory(value: string | null): CategoryKey {
  if (
    value === "occasions" ||
    value === "personal" ||
    value === "spiritual" ||
    value === "pets"
  ) {
    return value;
  }

  return "all";
}

function normalizeOccasion(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized || normalized === "all") return null;

  if (normalized === "newborn" || normalized === "new_born") {
    return "new-born";
  }

  if (normalized === "valentines" || normalized === "valentines_day") {
    return "valentines-day";
  }

  if (normalized === "mothers_day") return "mothers-day";
  if (normalized === "fathers_day") return "fathers-day";
  if (normalized === "new_years_eve") return "new-years-eve";
  if (normalized === "baby_reveal") return "baby-reveal";
  if (normalized === "thank_you") return "thank-you";
  if (normalized === "name_cards") return "name-cards";
  if (normalized === "bible_verses") return "bible-verses";
  if (normalized === "pet_loss") return "pet-loss";

  return normalized.replace(/_/g, "-");
}

export default function TemplatesPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const occasionParam = normalizeOccasion(params.get("occasion"));
  const categoryParam = normalizeCategory(params.get("category"));

  const [activeCategory, setActiveCategory] =
    useState<CategoryKey>(categoryParam);

  useEffect(() => {
    setActiveCategory(categoryParam);
  }, [categoryParam]);

  const visibleCategories = useMemo(() => {
    if (activeCategory === "all") return occasions;

    return occasions.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const handleCategoryChange = (category: CategoryKey) => {
    setActiveCategory(category);

    const nextParams = new URLSearchParams(location.search);

    if (category === "all") {
      nextParams.delete("category");
    } else {
      nextParams.set("category", category);
    }

    nextParams.delete("occasion");

    const query = nextParams.toString();
    navigate(query ? `/templates?${query}` : "/templates");
  };

  const handleTemplatePick = (template: TemplateSummary) => {
    const urlParams = new URLSearchParams();

    const templateOccasion = normalizeOccasion(template.occasion);
    const occasion = templateOccasion || occasionParam;

    if (occasion) {
      urlParams.set("occasion", occasion);
    }

    urlParams.set("template", String(template._id));

    navigate(`/generator?${urlParams.toString()}`);
  };

  return (
    <>
      <PageHead
        title="Browse Templates | The Digital Gifter"
        description="Explore emotional card and video templates for occasions, personal messages, spiritual cards and pets."
      />

      <main className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-[#050816] via-[#07111f] to-[#050816] text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-pink-500/10 blur-3xl" />
        </div>

        <section className="relative z-10 mx-auto max-w-7xl px-4 pt-12 sm:px-6 md:pt-16 lg:px-8">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Templates
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Choose the feeling first.
              <span className="block bg-gradient-to-r from-blue-300 via-cyan-200 to-pink-300 bg-clip-text text-transparent">
                Then make it personal.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
              Browse emotional templates for birthdays, love, faith, pets,
              family moments and messages that deserve more than a normal text.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {categoryTabs.map((tab) => {
              const isActive = activeCategory === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleCategoryChange(tab.key)}
                  className={[
                    "rounded-2xl border p-4 text-left transition-all",
                    isActive
                      ? "border-cyan-300/50 bg-cyan-400/10 shadow-lg shadow-cyan-500/10"
                      : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
                  ].join(" ")}
                >
                  <div className="text-base font-bold text-white">
                    {tab.title}
                  </div>

                  <div className="mt-1 text-xs leading-5 text-white/55">
                    {tab.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-10">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Quick categories
                </h2>

                <p className="mt-1 text-sm text-white/55">
                  Start from a category or scroll down to browse templates.
                </p>
              </div>

              <Link
                to="/generator"
                className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 sm:inline-flex"
              >
                Open generator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-4">
                {visibleCategories.map((item) => (
                  <Link
                    key={item.id}
                    to={`/funnel/homepage/${item.id}`}
                    className="group relative w-[220px] shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.07] sm:w-[260px]"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      <div
                        className={[
                          "absolute inset-0 bg-gradient-to-t from-black via-black/25 opacity-90",
                          item.gradientFrom,
                          item.gradientTo,
                        ].join(" ")}
                      />

                      <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white/85 backdrop-blur">
                        {item.label}
                      </div>

                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-xl font-bold text-white">
                          {item.title}
                        </h3>

                        <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/70">
                          {item.description}
                        </p>

                        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-black">
                          Create now
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <TemplatesGrid
            occasionFilter={occasionParam}
            categoryFilter={activeCategory}
            onPick={handleTemplatePick}
          />
        </section>
      </main>
    </>
  );
}
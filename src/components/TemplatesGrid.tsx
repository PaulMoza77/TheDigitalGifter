import { memo, useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";

import VideoModal from "./VideoModal";
import TemplateCard from "./TemplateCard";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import type { TemplateSummary } from "@/types/templates";
import { useTemplatesQuery } from "@/data";
import { occasions } from "@/constants/occasions";

type Template = TemplateSummary;

type CategoryKey = "all" | "occasions" | "personal" | "spiritual" | "pets";

interface TemplatesGridProps {
  onPick?: (template: Template) => void;
  selectedTemplateId?: string | null;
  occasionFilter?: string | null;
  categoryFilter?: CategoryKey | null;
}

function normalizeOccasion(value?: string | null) {
  const v = String(value || "").trim().toLowerCase();

  if (!v || v === "all") return "all";

  if (v === "new-born" || v === "new_born") return "newborn";
  if (v === "valentines-day" || v === "valentines") return "valentines_day";
  if (v === "mothers-day") return "mothers_day";
  if (v === "fathers-day") return "fathers_day";
  if (v === "new-years-eve") return "new_years_eve";
  if (v === "baby-reveal") return "baby_reveal";
  if (v === "thank-you") return "thank_you";
  if (v === "name-cards") return "name_cards";
  if (v === "bible-verses") return "bible_verses";
  if (v === "pet-loss") return "pet_loss";

  return v.replace(/-/g, "_");
}

function normalizeCategory(value?: string | null): CategoryKey {
  const v = String(value || "").trim().toLowerCase();

  if (
    v === "occasions" ||
    v === "personal" ||
    v === "spiritual" ||
    v === "pets"
  ) {
    return v;
  }

  return "all";
}

function getCategoryForOccasion(occasion?: string | null): CategoryKey {
  const normalized = normalizeOccasion(occasion);

  const match = occasions.find(
    (item) => normalizeOccasion(item.id) === normalized
  );

  return normalizeCategory(match?.category);
}

function emojiForOccasion(occasion?: string | null) {
  const o = normalizeOccasion(occasion);

  if (!o || o === "all") return "✨";
  if (o.includes("christ")) return "🎄";
  if (o.includes("birth")) return "🎂";
  if (o.includes("new_year")) return "🎆";
  if (o.includes("thanksgiving")) return "🦃";
  if (o.includes("thank_you")) return "💌";
  if (o.includes("baby")) return "👶";
  if (o.includes("wedding")) return "💍";
  if (o.includes("anniversary")) return "❤️";
  if (o.includes("valentine")) return "🌹";
  if (o.includes("mother")) return "🌸";
  if (o.includes("father")) return "👨‍👧";
  if (o.includes("graduation")) return "🎓";
  if (o.includes("sorry")) return "💔";
  if (o.includes("bible") || o.includes("prayer")) return "✝️";
  if (o.includes("dog") || o.includes("cat") || o.includes("pet")) return "🐾";
  if (o.includes("kid")) return "🧸";
  if (o.includes("name")) return "✨";

  return "✨";
}

function prettyOccasion(occasion?: string | null) {
  const o = normalizeOccasion(occasion);

  if (!o || o === "all") return "this category";

  const map: Record<string, string> = {
    newborn: "Newborn",
    birthday: "Birthday",
    wedding: "Wedding",
    anniversary: "Anniversary",
    christmas: "Christmas",
    valentines_day: "Valentine’s Day",
    mothers_day: "Mother’s Day",
    fathers_day: "Father’s Day",
    graduation: "Graduation",
    baby_reveal: "Baby Reveal",
    pregnancy: "Pregnancy",
    new_years_eve: "New Year’s Eve",
    thanksgiving: "Thanksgiving",
    thank_you: "Thank You",
    sorry: "Sorry",
    name_cards: "Name Cards",
    kids: "Kids",
    bible_verses: "Bible Verses",
    prayer: "Prayer",
    dogs: "Dogs",
    cats: "Cats",
    pet_loss: "Pet Loss",
  };

  return map[o] ?? o.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseRange(range: string): { min: number; max: number } | null {
  const parts = String(range || "")
    .split("-")
    .map((n) => Number(n));

  if (parts.length !== 2) return null;

  const [min, max] = parts;

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  return { min, max };
}

function TemplatesGridComponent({
  onPick,
  selectedTemplateId,
  occasionFilter,
  categoryFilter,
}: TemplatesGridProps) {
  const [modal, setModal] = useState<{
    open: boolean;
    src: string;
    title: string;
  }>({
    open: false,
    src: "",
    title: "",
  });

  const [scene, setScene] = useState<string>("all");
  const [orientation, setOrientation] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");

  const { data: allTemplates = [] } = useTemplatesQuery();

  const templatesArray = useMemo(() => {
    return Array.isArray(allTemplates) ? (allTemplates as TemplateSummary[]) : [];
  }, [allTemplates]);

  const activeOccasion = useMemo(
    () => normalizeOccasion(occasionFilter),
    [occasionFilter]
  );

  const activeCategory = useMemo(
    () => normalizeCategory(categoryFilter),
    [categoryFilter]
  );

  const categoryOccasionKeys = useMemo(() => {
    if (activeCategory === "all") return null;

    return new Set(
      occasions
        .filter((item) => normalizeCategory(item.category) === activeCategory)
        .map((item) => normalizeOccasion(item.id))
    );
  }, [activeCategory]);

  const baseTemplates = useMemo(() => {
    if (activeOccasion && activeOccasion !== "all") {
      return templatesArray.filter((template) => {
        return normalizeOccasion(template.occasion) === activeOccasion;
      });
    }

    if (categoryOccasionKeys) {
      return templatesArray.filter((template) => {
        const occasion = normalizeOccasion(template.occasion);
        return categoryOccasionKeys.has(occasion);
      });
    }

    return templatesArray;
  }, [templatesArray, activeOccasion, categoryOccasionKeys]);

  const handleClearFilters = useCallback(() => {
    setScene("all");
    setOrientation("all");
    setPriceRange("all");
  }, []);

  const filteredTemplates = useMemo(() => {
    const parsedRange = priceRange !== "all" ? parseRange(priceRange) : null;

    return baseTemplates.filter((template) => {
      const matchesScene = scene !== "all" ? template.scene === scene : true;

      const matchesOrientation =
        orientation !== "all" ? template.orientation === orientation : true;

      const matchesPrice =
        priceRange !== "all"
          ? parsedRange
            ? Number(template.creditCost) >= parsedRange.min &&
              Number(template.creditCost) <= parsedRange.max
            : true
          : true;

      return matchesScene && matchesOrientation && matchesPrice;
    });
  }, [baseTemplates, scene, orientation, priceRange]);

  const sceneCounts = useMemo(() => {
    return baseTemplates.reduce<Record<string, number>>((acc, template) => {
      const key = template.scene || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [baseTemplates]);

  const uniqueScenes = useMemo(() => {
    return Object.keys(sceneCounts).sort();
  }, [sceneCounts]);

  const sceneOptions = useMemo(
    () => [
      { label: `All Scenes (${baseTemplates.length})`, value: "all" },
      ...uniqueScenes.map((item) => ({
        label: `${item.charAt(0).toUpperCase() + item.slice(1)} (${
          sceneCounts[item] ?? 0
        })`,
        value: item,
      })),
    ],
    [uniqueScenes, sceneCounts, baseTemplates.length]
  );

  const orientationOptions = useMemo(
    () => [
      { label: "All Orientations", value: "all" },
      { label: "Portrait", value: "portrait" },
      { label: "Landscape", value: "landscape" },
    ],
    []
  );

  const priceRangeOptions = useMemo(
    () => [
      { label: "All", value: "all" },
      { label: "Budget (10-12)", value: "10-12" },
      { label: "Premium (13-16)", value: "13-16" },
      { label: "Luxury (17-20)", value: "17-20" },
    ],
    []
  );

  const hasActiveFilters =
    scene !== "all" || orientation !== "all" || priceRange !== "all";

  const emptyLabel =
    activeOccasion && activeOccasion !== "all"
      ? prettyOccasion(activeOccasion)
      : activeCategory !== "all"
        ? activeCategory
        : "this category";

  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#fffef5]">Filters</h2>
            <p className="mt-1 text-sm text-[#c1c8d8]">
              Refine by scene, format and credit range.
            </p>
          </div>

          <p className="text-sm text-[#c1c8d8]">
            <span className="font-semibold text-[#dfe6f1]">
              {filteredTemplates.length}
            </span>
            {" of "}
            <span className="font-semibold text-[#dfe6f1]">
              {baseTemplates.length}
            </span>
            {" templates found"}
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-sm text-[#ff9866] transition-colors hover:text-[#ffd976]"
              aria-label="Clear all filters"
            >
              <X size={14} />
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-[#c1c8d8]">
              Scene
            </label>

            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger className="w-full border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.1)] text-white">
                <SelectValue placeholder="Select scene" />
              </SelectTrigger>

              <SelectContent className="border-[rgba(255,255,255,.2)] bg-[#0b1220] text-white">
                {sceneOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-[#c1c8d8]">
              Orientation
            </label>

            <Select value={orientation} onValueChange={setOrientation}>
              <SelectTrigger className="w-full border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.1)] text-white">
                <SelectValue placeholder="Select orientation" />
              </SelectTrigger>

              <SelectContent className="border-[rgba(255,255,255,.2)] bg-[#0b1220] text-white">
                {orientationOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-[#c1c8d8]">
              Price Range
            </label>

            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger className="w-full border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.1)] text-white">
                <SelectValue placeholder="Select price range" />
              </SelectTrigger>

              <SelectContent className="border-[rgba(255,255,255,.2)] bg-[#0b1220] text-white">
                {priceRangeOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="focus:bg-[rgba(255,255,255,.1)] focus:text-white"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={String(template._id)}
              template={template}
              isSelected={Boolean(
                selectedTemplateId &&
                  String(template._id) === String(selectedTemplateId)
              )}
              onSelect={onPick}
              onOpenModal={(src, title) =>
                setModal({ open: true, src, title: title ?? "" })
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-4 text-6xl">
              {emojiForOccasion(occasionFilter)}
            </div>

            <h3 className="mb-2 text-xl font-bold text-[#fffef5]">
              No Templates Found
            </h3>

            <p className="mb-6 text-[#c1c8d8]">
              Try adjusting your filters to find the perfect template for{" "}
              {emptyLabel}.
            </p>

            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] px-6 py-3 font-semibold text-[#1a1a1a] transition-all hover:brightness-110"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {modal.open && (
        <VideoModal
          src={modal.src}
          title={modal.title}
          onClose={() => setModal({ open: false, src: "", title: "" })}
        />
      )}
    </div>
  );
}

export default memo(TemplatesGridComponent);
import React from "react";
import {
  CalendarDays,
  Cross,
  Heart,
  LayoutGrid,
  PawPrint,
  Sparkles,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";

import type { CategoryKey, FilterOption } from "./generatorTypes";
import {
  ALL_CATEGORIES,
  ALL_OCCASIONS,
  ALL_STYLES,
} from "./generatorTypes";

const CATEGORY_OPTIONS: Array<{
  value: CategoryKey;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { value: "all", label: "All", description: "Everything", icon: LayoutGrid },
  {
    value: "occasions",
    label: "Occasions",
    description: "Birthdays, holidays",
    icon: CalendarDays,
  },
  {
    value: "personal",
    label: "Personal",
    description: "Names, kids, love",
    icon: Heart,
  },
  {
    value: "spiritual",
    label: "Spiritual",
    description: "Faith, prayer, hope",
    icon: Cross,
  },
  {
    value: "pets",
    label: "Pets",
    description: "Dogs, cats, memories",
    icon: PawPrint,
  },
];

type Props = {
  selectedCategory: CategoryKey;
  selectedOccasion: string;
  selectedStyle: string;
  selectedCategoryLabel: string;
  selectedOccasionLabel: string;
  selectedStyleLabel: string;
  filteredTemplatesLength: number;
  typeFilter: "all" | "image" | "video";
  setTypeFilter: (value: "all" | "image" | "video") => void;
  occasionOptions: FilterOption[];
  styleOptions: FilterOption[];
  updateFilterParams: (updates: {
    category?: CategoryKey;
    occasion?: string;
    style?: string;
    type?: "all" | "image" | "video";
  }) => void;
};

export default function GeneratorFilters({
  selectedCategory,
  selectedOccasion,
  selectedStyle,
  selectedCategoryLabel,
  selectedOccasionLabel,
  selectedStyleLabel,
  filteredTemplatesLength,
  typeFilter,
  setTypeFilter,
  occasionOptions,
  styleOptions,
  updateFilterParams,
}: Props) {
  return (
    <section className="mx-auto mb-7 max-w-5xl px-4">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_60px_rgba(0,0,0,.28)] backdrop-blur-xl">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#ffd976]" />

              <h2 className="text-base font-semibold text-white">
                Choose a category and occasion
              </h2>
            </div>

            <p className="mt-1 text-sm text-[#9ca8bd]">
              {selectedCategoryLabel} · {selectedOccasionLabel}
              {selectedOccasion !== ALL_OCCASIONS ? ` · ${selectedStyleLabel}` : ""} ·{" "}
              {filteredTemplatesLength} template
              {filteredTemplatesLength === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as "all" | "image" | "video")
              }
            >
              <SelectTrigger className="h-11 w-full min-w-[160px] rounded-2xl border-white/10 bg-black/25 text-white">
                <SelectValue placeholder="Media type" />
              </SelectTrigger>

              <SelectContent className="border-white/15 bg-[#0b1220] text-white">
                <SelectItem value="all">All Media</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CATEGORY_OPTIONS.map((category) => {
            const Icon = category.icon;
            const isActive = selectedCategory === category.value;

            return (
              <button
                key={category.value}
                type="button"
                onClick={() => updateFilterParams({ category: category.value })}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition",
                  isActive
                    ? "border-[#ffd976]/70 bg-[#ffd976] text-[#171717] shadow-[0_0_22px_rgba(255,217,118,.22)]"
                    : "border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-bold">{category.label}</span>
                </div>

                <p className={cn("mt-1 text-xs", isActive ? "text-black/65" : "text-white/45")}>
                  {category.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => updateFilterParams({ occasion: ALL_OCCASIONS })}
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
              selectedOccasion === ALL_OCCASIONS
                ? "border-[#ffd976]/70 bg-[#ffd976] text-[#171717] shadow-[0_0_22px_rgba(255,217,118,.22)]"
                : "border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09]"
            )}
          >
            All Occasions
          </button>

          {occasionOptions.map((occasion) => (
            <button
              key={occasion.value}
              type="button"
              onClick={() => updateFilterParams({ occasion: occasion.value })}
              className={cn(
                "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                selectedOccasion === occasion.value
                  ? "border-[#ffd976]/70 bg-[#ffd976] text-[#171717] shadow-[0_0_22px_rgba(255,217,118,.22)]"
                  : "border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09]"
              )}
            >
              {occasion.label}
            </button>
          ))}
        </div>

        {selectedOccasion !== ALL_OCCASIONS ? (
          <div className="border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9ca8bd]">
                Styles for {selectedOccasionLabel}
              </p>

              {selectedStyle !== ALL_STYLES && (
                <button
                  type="button"
                  onClick={() => updateFilterParams({ style: ALL_STYLES })}
                  className="text-xs font-semibold text-[#ffd976] hover:underline"
                >
                  Reset style
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateFilterParams({ style: ALL_STYLES })}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                  selectedStyle === ALL_STYLES
                    ? "border-white/25 bg-white text-black"
                    : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.08]"
                )}
              >
                All Styles
              </button>

              {styleOptions.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => updateFilterParams({ style: style.value })}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                    selectedStyle === style.value
                      ? "border-white/25 bg-white text-black"
                      : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.08]"
                  )}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-white/10 pt-4">
            <p className="text-sm text-[#9ca8bd]">
              Select an occasion first to see available styles.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
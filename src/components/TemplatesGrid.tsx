import React, { memo, useCallback, useMemo, useState } from "react";
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

type Template = TemplateSummary;

interface TemplatesGridProps {
  onPick?: (template: Template) => void;
  selectedTemplateId?: string | null; // ✅ fără Convex
  occasionFilter?: string | null;
}

function emojiForOccasion(occasion?: string | null) {
  const o = String(occasion || "").toLowerCase().trim();
  if (!o || o === "all") return "✨";
  if (o.includes("christ")) return "🎄";
  if (o.includes("birth")) return "🎂";
  if (o.includes("new")) return "🎆";
  if (o.includes("thank")) return "🦃";
  if (o.includes("baby")) return "👶";
  return "✨";
}

function prettyOccasion(occasion?: string | null) {
  const o = String(occasion || "").trim();
  if (!o) return "this occasion";
  return o.charAt(0).toUpperCase() + o.slice(1);
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
}: TemplatesGridProps) {
  const [modal, setModal] = useState<{ open: boolean; src: string; title: string }>({
    open: false,
    src: "",
    title: "",
  });

  const [scene, setScene] = useState<string>("all");
  const [orientation, setOrientation] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");

  const { data: allTemplates = [] } = useTemplatesQuery();

  const templatesArray = useMemo(
    () => (Array.isArray(allTemplates) ? (allTemplates as TemplateSummary[]) : []),
    [allTemplates]
  );

  const handleClearFilters = useCallback(() => {
    setScene("all");
    setOrientation("all");
    setPriceRange("all");
  }, []);

  const filteredTemplates = useMemo(() => {
    const pr = priceRange !== "all" ? parseRange(priceRange) : null;

    return templatesArray.filter((template) => {
      const matchesScene = scene !== "all" ? template.scene === scene : true;

      const matchesOrientation =
        orientation !== "all" ? template.orientation === orientation : true;

      const matchesPrice =
        priceRange !== "all"
          ? pr
            ? Number(template.creditCost) >= pr.min && Number(template.creditCost) <= pr.max
            : true
          : true;

      const matchesOccasion = occasionFilter
        ? String(template.occasion || "").toLowerCase().trim() ===
          String(occasionFilter || "").toLowerCase().trim()
        : true;

      return matchesScene && matchesOrientation && matchesPrice && matchesOccasion;
    });
  }, [templatesArray, scene, orientation, priceRange, occasionFilter]);

  const sceneCounts = useMemo(() => {
    return templatesArray.reduce<Record<string, number>>((acc, template) => {
      const key = template.scene || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [templatesArray]);

  const uniqueScenes = useMemo(() => Object.keys(sceneCounts).sort(), [sceneCounts]);

  const sceneOptions = useMemo(
    () => [
      { label: `All Scenes (${templatesArray.length})`, value: "all" },
      ...uniqueScenes.map((s) => ({
        label: `${s.charAt(0).toUpperCase() + s.slice(1)} (${sceneCounts[s] ?? 0})`,
        value: s,
      })),
    ],
    [uniqueScenes, sceneCounts, templatesArray.length]
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

  const hasActiveFilters = scene !== "all" || orientation !== "all" || priceRange !== "all";

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold text-[#fffef5]">Filters</h2>

          <p className="text-sm text-[#c1c8d8]">
            <span className="font-semibold text-[#dfe6f1]">{filteredTemplates.length}</span>
            {" of "}
            <span className="font-semibold text-[#dfe6f1]">{templatesArray.length}</span>
            {" templates found"}
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-sm text-[#ff9866] hover:text-[#ffd976] transition-colors"
              aria-label="Clear all filters"
            >
              <X size={14} />
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#c1c8d8] mb-2">Scene</label>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger className="w-full bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
                <SelectValue placeholder="Select scene" />
              </SelectTrigger>
              <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
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
            <label className="block text-xs font-medium text-[#c1c8d8] mb-2">Orientation</label>
            <Select value={orientation} onValueChange={setOrientation}>
              <SelectTrigger className="w-full bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
                <SelectValue placeholder="Select orientation" />
              </SelectTrigger>
              <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
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
            <label className="block text-xs font-medium text-[#c1c8d8] mb-2">Price Range</label>
            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger className="w-full bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white">
                <SelectValue placeholder="Select price range" />
              </SelectTrigger>
              <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white">
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

      {/* Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={String(template._id)}
              template={template}
              isSelected={Boolean(selectedTemplateId && String(template._id) === String(selectedTemplateId))}
              onSelect={onPick}
              onOpenModal={(src, title) => setModal({ open: true, src, title: title ?? "" })}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 px-6">
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">{emojiForOccasion(occasionFilter)}</div>
            <h3 className="text-xl font-bold text-[#fffef5] mb-2">No Templates Found</h3>
            <p className="text-[#c1c8d8] mb-6">
              Try adjusting your filters to find the perfect template for {prettyOccasion(occasionFilter)}.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-[#1a1a1a] border border-transparent bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 transition-all"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
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

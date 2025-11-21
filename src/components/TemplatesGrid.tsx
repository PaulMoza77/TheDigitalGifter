import React, { memo, useCallback, useMemo, useState, useRef } from "react";
import VideoModal from "./VideoModal";
import TemplateCard from "./TemplateCard";
import { Id } from "../../convex/_generated/dataModel";
import { TemplateSummary } from "@/types/templates";
import { useTemplatesQuery } from "@/data";

type Template = TemplateSummary;

interface TemplatesGridProps {
  onPick?: (template: Template) => void;
  selectedTemplateId?: Id<"templates">;
}

export default memo(TemplatesGridComponent);

function TemplatesGridComponent({
  onPick,
  selectedTemplateId,
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
  // (no inline video refs needed — we load full video only on modal open)
  const [scene, setScene] = useState<string>("");
  const [orientation, setOrientation] = useState<string>("");
  const [priceRange, setPriceRange] = useState<string>("");
  const { data: allTemplates = [] } = useTemplatesQuery();
  // Ensure the query result is treated as TemplateSummary[] for correct typing
  const templatesArray = useMemo(
    () => (allTemplates ?? []) as TemplateSummary[],
    [allTemplates]
  );
  const handleClearFilters = useCallback(() => {
    setScene("");
    setOrientation("");
    setPriceRange("");
  }, []);

  const filteredTemplates = useMemo(() => {
    return templatesArray.filter((template) => {
      const matchesScene = scene ? template.scene === scene : true;
      const matchesOrientation = orientation
        ? template.orientation === orientation
        : true;

      const matchesPrice = priceRange
        ? (() => {
            const [min, max] = priceRange.split("-").map(Number);
            return template.creditCost >= min && template.creditCost <= max;
          })()
        : true;

      return matchesScene && matchesOrientation && matchesPrice;
    });
  }, [templatesArray, scene, orientation, priceRange]);

  const sceneCounts = useMemo(() => {
    return templatesArray.reduce<Record<string, number>>((acc, template) => {
      acc[template.scene] = (acc[template.scene] ?? 0) + 1;
      return acc;
    }, {});
  }, [templatesArray]);

  const uniqueScenes = useMemo(
    () => Object.keys(sceneCounts).sort(),
    [sceneCounts]
  );
  const priceRanges = [
    { label: "Budget (10-12)", value: "10-12" },
    { label: "Premium (13-16)", value: "13-16" },
    { label: "Luxury (17-20)", value: "17-20" },
  ];

  return (
    <div className="space-y-6">
      {/* Enhanced Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          className="festive-select text-sm"
        >
          <option value="">All scenes ({templatesArray.length})</option>
          {uniqueScenes.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({sceneCounts[s] ?? 0})
            </option>
          ))}
        </select>

        <select
          value={orientation}
          onChange={(e) => setOrientation(e.target.value)}
          className="festive-select text-sm"
        >
          <option value="">All orientations</option>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>

        <select
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          className="festive-select text-sm"
        >
          <option value="">All prices</option>
          {priceRanges.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>

        {/* Clear filters button */}
        {(scene || orientation || priceRange) && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-festive-red hover:text-red-300 underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-light-muted">
        Showing {filteredTemplates.length} of {templatesArray.length} templates
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-96 overflow-y-auto">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template._id}
            template={template}
            isSelected={selectedTemplateId === template._id}
            onSelect={(t) => onPick?.(t)}
            onOpenModal={(src, title) =>
              setModal({ open: true, src, title: title ?? "" })
            }
            aspectClass={
              template.orientation === "portrait"
                ? "aspect-[3/4]"
                : "aspect-[4/3]"
            }
          />
        ))}
      </div>

      {modal.open && (
        <VideoModal
          src={modal.src}
          title={modal.title}
          onClose={() => setModal({ open: false, src: "", title: "" })}
        />
      )}

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 glass-card">
          <div className="text-4xl mb-4">🎄</div>
          <p className="text-light-muted mb-4">
            No templates found for the selected filters.
          </p>
          <button onClick={handleClearFilters} className="btn-ghost text-sm">
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

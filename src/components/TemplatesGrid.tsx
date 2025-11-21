import React, { memo, useCallback, useMemo, useState } from "react";
import VideoModal from "./VideoModal";
import TemplateCard from "./TemplateCard";
import { Select } from "./ui/Select";
import { Id } from "../../convex/_generated/dataModel";
import { TemplateSummary } from "@/types/templates";
import { useTemplatesQuery } from "@/data";
import { X } from "lucide-react";

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

  const [scene, setScene] = useState<string>("");
  const [orientation, setOrientation] = useState<string>("");
  const [priceRange, setPriceRange] = useState<string>("");

  const { data: allTemplates = [] } = useTemplatesQuery();

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

  const sceneOptions = useMemo(
    () => [
      { label: `All Scenes (${templatesArray.length})`, value: "" },
      ...uniqueScenes.map((s) => ({
        label: `${s.charAt(0).toUpperCase() + s.slice(1)} (${sceneCounts[s] ?? 0})`,
        value: s,
      })),
    ],
    [uniqueScenes, sceneCounts, templatesArray.length]
  );

  const orientationOptions = [
    { label: "All Orientations", value: "" },
    { label: "Portrait", value: "portrait" },
    { label: "Landscape", value: "landscape" },
  ];

  const priceRangeOptions = [
    { label: "All", value: "" },
    { label: "Budget (10-12)", value: "10-12" },
    { label: "Premium (13-16)", value: "13-16" },
    { label: "Luxury (17-20)", value: "17-20" },
  ];

  const hasActiveFilters = scene || orientation || priceRange;

  return (
    <div className="space-y-8">
      {/* Filters Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#fffef5]">Filters</h2>
          {/* Results info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#c1c8d8]">
                <span className="font-semibold text-[#dfe6f1]">
                  {filteredTemplates.length}
                </span>
                {" of "}
                <span className="font-semibold text-[#dfe6f1]">
                  {templatesArray.length}
                </span>
                {" templates found"}
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-sm text-[#ff9866] hover:text-[#ffd976] transition-colors"
              aria-label="Clear all filters"
            >
              <X size={14} />
              Clear all
            </button>
          )}
        </div>

        {/* Filter controls grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#c1c8d8] mb-2">
              Scene
            </label>
            <Select
              value={scene}
              onValueChange={setScene}
              options={sceneOptions}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#c1c8d8] mb-2">
              Orientation
            </label>
            <Select
              value={orientation}
              onValueChange={setOrientation}
              options={orientationOptions}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#c1c8d8] mb-2">
              Price Range
            </label>
            <Select
              value={priceRange}
              onValueChange={setPriceRange}
              options={priceRangeOptions}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Templates Grid - Full page responsive */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template._id}
              template={template}
              onOpenModal={(src, title) =>
                setModal({ open: true, src, title: title ?? "" })
              }
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="py-16 px-6">
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">🎄</div>
            <h3 className="text-xl font-bold text-[#fffef5] mb-2">
              No Templates Found
            </h3>
            <p className="text-[#c1c8d8] mb-6">
              Try adjusting your filters to find the perfect template for your
              holiday card.
            </p>
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-[#1a1a1a] border border-transparent bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 transition-all"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Video Modal */}
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

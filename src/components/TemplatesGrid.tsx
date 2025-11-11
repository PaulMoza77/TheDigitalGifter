import React, { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";

type Template = Doc<"templates">;

interface TemplatesGridProps {
  onPick?: (template: Template) => void;
  selectedTemplateId?: string;
}

export default function TemplatesGrid({ onPick, selectedTemplateId }: TemplatesGridProps) {
  const [scene, setScene] = useState<string>("");
  const [orientation, setOrientation] = useState<string>("");
  const [priceRange, setPriceRange] = useState<string>("");
  const allTemplates = useQuery(api.templates.list) || [];
  
  // Filter templates by scene, orientation, and price
  let filteredTemplates = allTemplates;
  if (scene) {
    filteredTemplates = filteredTemplates.filter(t => t.scene === scene);
  }
  if (orientation) {
    filteredTemplates = filteredTemplates.filter(t => (t.orientation || "landscape") === orientation);
  }
  if (priceRange) {
    const [min, max] = priceRange.split("-").map(Number);
    filteredTemplates = filteredTemplates.filter(t => t.creditCost >= min && t.creditCost <= max);
  }

  // Get unique scenes and price ranges for dropdowns
  const uniqueScenes = Array.from(new Set(allTemplates.map(t => t.scene))).sort();
  const priceRanges = [
    { label: "Budget (10-12)", value: "10-12" },
    { label: "Premium (13-16)", value: "13-16" },
    { label: "Luxury (17-20)", value: "17-20" }
  ];

  return (
    <div className="space-y-6">
      {/* Enhanced Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select 
          value={scene} 
          onChange={e => setScene(e.target.value)}
          className="festive-select text-sm"
        >
          <option value="">All scenes ({allTemplates.length})</option>
          {uniqueScenes.map(s => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({allTemplates.filter(t => t.scene === s).length})
            </option>
          ))}
        </select>

        <select 
          value={orientation} 
          onChange={e => setOrientation(e.target.value)}
          className="festive-select text-sm"
        >
          <option value="">All orientations</option>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>

        <select 
          value={priceRange} 
          onChange={e => setPriceRange(e.target.value)}
          className="festive-select text-sm"
        >
          <option value="">All prices</option>
          {priceRanges.map(range => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>

        {/* Clear filters button */}
        {(scene || orientation || priceRange) && (
          <button
            onClick={() => {
              setScene("");
              setOrientation("");
              setPriceRange("");
            }}
            className="text-sm text-festive-red hover:text-red-300 underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-light-muted">
        Showing {filteredTemplates.length} of {allTemplates.length} templates
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-96 overflow-y-auto">
        {filteredTemplates.map(template => (
          <button 
            key={template._id} 
            onClick={() => onPick?.(template)}
            className={`template-card group ${
              selectedTemplateId === template._id ? "selected" : ""
            }`}
          >
            <div 
              className={`w-full bg-gray-800/50 relative ${
                template.orientation === "portrait" ? "aspect-[3/4]" : "aspect-[4/3]"
              }`}
              style={{
                backgroundImage: `url(${template.previewUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              {/* Overlay for better text readability */}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all" />
              
              {/* Selection indicator */}
              {selectedTemplateId === template._id && (
                <div className="absolute top-3 right-3">
                  <div className="bg-festive-gradient text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg">
                    ✓
                  </div>
                </div>
              )}

              {/* Orientation badge */}
              <div className="absolute top-3 left-3">
                <span className="glass-effect text-light px-3 py-1 rounded-full text-xs font-medium">
                  {template.orientation === "portrait" ? "📱" : "🖥️"}
                </span>
              </div>

              {/* Tags overlay */}
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 2).map(tag => (
                    <span 
                      key={tag}
                      className="glass-effect text-light px-2 py-1 rounded text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                  {template.tags.length > 2 && (
                    <span className="glass-effect text-light px-2 py-1 rounded text-xs font-medium">
                      +{template.tags.length - 2}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 text-left">
              <p className="font-semibold text-light text-sm line-clamp-1 mb-2">{template.title}</p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-light-muted capitalize">{template.scene}</p>
                <p className="text-xs font-semibold text-festive-red">{template.creditCost} credits</p>
              </div>
              <p className="text-xs text-light-muted line-clamp-2 italic">
                "{template.textDefault}"
              </p>
            </div>
          </button>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 glass-card">
          <div className="text-4xl mb-4">🎄</div>
          <p className="text-light-muted mb-4">No templates found for the selected filters.</p>
          <button
            onClick={() => {
              setScene("");
              setOrientation("");
              setPriceRange("");
            }}
            className="btn-ghost text-sm"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

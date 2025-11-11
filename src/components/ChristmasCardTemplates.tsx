import React, { useState } from "react";
import { Gift, Heart, Star, Snowflake, TreePine, Sparkles } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  category: "classic" | "modern" | "family" | "religious";
  colors: string[];
  icon: React.ReactNode;
  preview: string;
}

const templates: Template[] = [
  {
    id: "classic-red-gold",
    name: "Classic Red & Gold",
    description: "Traditional Christmas elegance with warm colors",
    category: "classic",
    colors: ["#DC2626", "#F59E0B", "#FBBF24"],
    icon: <Gift className="h-5 w-5" />,
    preview: "bg-gradient-to-br from-red-600 via-red-500 to-yellow-500"
  },
  {
    id: "snowy-night",
    name: "Snowy Night Scene",
    description: "Peaceful winter wonderland with twinkling lights",
    category: "modern",
    colors: ["#1E3A8A", "#FFFFFF", "#60A5FA"],
    icon: <Snowflake className="h-5 w-5" />,
    preview: "bg-gradient-to-br from-blue-900 via-blue-600 to-blue-300"
  },
  {
    id: "minimal-evergreen",
    name: "Minimal Evergreen",
    description: "Clean, modern design with subtle pine elements",
    category: "modern",
    colors: ["#059669", "#FFFFFF", "#D1FAE5"],
    icon: <TreePine className="h-5 w-5" />,
    preview: "bg-gradient-to-br from-emerald-600 via-emerald-400 to-emerald-100"
  },
  {
    id: "family-collage",
    name: "Family Memories",
    description: "Perfect for showcasing family photos",
    category: "family",
    colors: ["#7C3AED", "#EC4899", "#F472B6"],
    icon: <Heart className="h-5 w-5" />,
    preview: "bg-gradient-to-br from-purple-600 via-pink-500 to-pink-400"
  },
  {
    id: "golden-star",
    name: "Golden Star",
    description: "Luxurious gold theme with celestial elements",
    category: "classic",
    colors: ["#F59E0B", "#FBBF24", "#FEF3C7"],
    icon: <Star className="h-5 w-5" />,
    preview: "bg-gradient-to-br from-yellow-600 via-yellow-400 to-yellow-200"
  },
  {
    id: "winter-sparkle",
    name: "Winter Sparkle",
    description: "Magical winter theme with sparkling effects",
    category: "modern",
    colors: ["#6366F1", "#A855F7", "#EC4899"],
    icon: <Sparkles className="h-5 w-5" />,
    preview: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
  }
];

interface ChristmasCardTemplatesProps {
  onTemplateSelect?: (template: Template) => void;
  showHeader?: boolean;
}

export function ChristmasCardTemplates({ onTemplateSelect, showHeader = true }: ChristmasCardTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  const categories = [
    { id: "all", name: "All Templates" },
    { id: "classic", name: "Classic" },
    { id: "modern", name: "Modern" },
    { id: "family", name: "Family" },
    { id: "religious", name: "Religious" }
  ];

  const filteredTemplates = selectedCategory === "all" 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="w-full">
      {showHeader && (
        <div className="mb-8 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
            Beautiful Christmas Card Templates
          </h2>
          <p className="text-white/80 max-w-2xl mx-auto">
            Choose from our collection of professionally designed templates, 
            then let AI customize them with your personal touch
          </p>
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === category.id
                ? "bg-gradient-to-r from-red-500 to-emerald-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur transition-all hover:bg-white/10 hover:scale-105 cursor-pointer"
            onMouseEnter={() => setHoveredTemplate(template.id)}
            onMouseLeave={() => setHoveredTemplate(null)}
            onClick={() => onTemplateSelect?.(template)}
          >
            {/* Template Preview */}
            <div className="aspect-[3/4] p-4">
              <div className={`h-full w-full rounded-xl ${template.preview} relative overflow-hidden`}>
                {/* Decorative Elements */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-4 left-4">
                    {template.icon}
                  </div>
                  <div className="absolute top-4 right-4">
                    <Snowflake className="h-4 w-4" />
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <Star className="h-3 w-3" />
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
                
                {/* Sample Text */}
                <div className="absolute inset-0 flex flex-col justify-center items-center text-white p-4">
                  <h3 className="text-lg font-bold mb-2 text-center">Merry Christmas</h3>
                  <p className="text-sm text-center opacity-80">& Happy New Year</p>
                </div>

                {/* Hover Overlay */}
                {hoveredTemplate === template.id && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-white/90 text-black px-4 py-2 rounded-lg font-medium">
                      Use This Template
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Template Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-white">{template.name}</h3>
                  <p className="text-sm text-white/70">{template.description}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-white/80 capitalize">
                  {template.category}
                </span>
              </div>
              
              {/* Color Palette */}
              <div className="flex gap-1 mt-3">
                {template.colors.map((color, index) => (
                  <div
                    key={index}
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Call to Action */}
      {showHeader && (
        <div className="mt-12 text-center">
          <p className="text-white/60 mb-4">
            Don't see what you're looking for? Our AI can create custom designs based on your description!
          </p>
          <button className="bg-gradient-to-r from-red-500 to-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform">
            Create Custom Design
          </button>
        </div>
      )}
    </div>
  );
}

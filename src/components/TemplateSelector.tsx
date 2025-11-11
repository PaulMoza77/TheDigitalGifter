import React from "react";

type TemplateSelectorProps = {
  templates: { id: string; title: string }[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
};

export default function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: TemplateSelectorProps) {
  return (
    <div className="flex gap-4 overflow-x-auto py-4 px-2 max-w-4xl mx-auto">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelectTemplate(template.id)}
          className={`px-4 py-2 rounded-lg border-2 transition-colors duration-300 whitespace-nowrap ${
            selectedTemplateId === template.id
              ? "border-[#f45c5c] bg-[#f45c5c]/20"
              : "border-gray-300 hover:border-[#2dd4bf]"
          }`}
        >
          {template.title}
        </button>
      ))}
    </div>
  );
}

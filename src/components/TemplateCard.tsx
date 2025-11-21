import React from "react";
import { Play, Maximize } from "lucide-react";
import { Coins } from "lucide-react";
import { TemplateSummary } from "@/types/templates";

type WrapperType = "div" | "button";

type Props = {
  template: TemplateSummary;
  isSelected?: boolean;
  onSelect?: (template: TemplateSummary) => void;
  onOpenModal?: (src: string, title?: string) => void;
  wrapper?: WrapperType;
  className?: string;
  aspectClass?: string;
};

export default function TemplateCard({
  template,
  isSelected = false,
  onSelect,
  onOpenModal,
  wrapper = "div",
  className = "",
  aspectClass,
}: Props) {
  const Container: any = wrapper === "button" ? "button" : "div";

  return (
    <Container
      onClick={() => onSelect?.(template)}
      className={`rounded-3xl border overflow-hidden hover:-translate-y-0.5 transition group cursor-pointer ${
        isSelected
          ? "border-[#ffd976] ring-2 ring-[#ffd976] shadow-[0_0_20px_rgba(255,217,118,0.5)]"
          : "border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)]"
      } ${className}`}
    >
      <div className={`relative ${aspectClass ?? "aspect-[4/5]"} w-full`}>
        {template.type === "video" ? (
          <>
            <img
              src={template.thumbnailUrl || template.previewUrl}
              alt={template.title + " thumbnail"}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />

            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onOpenModal)
                  onOpenModal(template.previewUrl, template.title);
              }}
              aria-label={`Preview ${template.title}`}
              className="absolute left-3 top-3 p-1 rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg"
            >
              <Play size={18} fill="white" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onOpenModal)
                  onOpenModal(template.previewUrl, template.title);
              }}
              aria-label={`Full view ${template.title}`}
              className="absolute right-3 top-3 p-1 rounded-full bg-white/10 text-white text-xs font-bold shadow-lg"
            >
              <Maximize size={16} />
            </button>
          </>
        ) : (
          <img
            src={template.previewUrl}
            alt={template.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        <div className="absolute top-3 right-3 flex items-center gap-2 bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] text-[#1a1a1a] text-xs font-extrabold px-2 py-1 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
          <Coins size={14} className="text-[#1a1a1a]" /> {template.creditCost}
        </div>

        {isSelected && (
          <div className="absolute inset-0 bg-[rgba(255,217,118,0.2)] flex items-center justify-center">
            <span className="text-4xl">✓</span>
          </div>
        )}
      </div>

      <div className=" p-2 sm:p-4 bg-[rgba(255,255,255,.06)]">
        <h3 className="font-semibold text-sm sm:text-base leading-tight text-[#fffef5]">
          {template.title}
        </h3>
        <p className="text-xs text-[#c1c8d8] mt-1">{template.category}</p>
      </div>
    </Container>
  );
}

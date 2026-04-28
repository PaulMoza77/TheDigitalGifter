import React, { useMemo, useState } from "react";
import { Play, Maximize, Coins, ImageIcon } from "lucide-react";
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

function readTemplateImage(template: TemplateSummary): string {
  const t = template as TemplateSummary & Record<string, unknown>;

  const candidates = [
    t.previewUrl,
    t.thumbnailUrl,
    t.preview_image_url,
    t.thumbnail_url,
    t.image_url,
    t.imageUrl,
    t.url,
    t.src,
  ];

  for (const value of candidates) {
    const url = String(value ?? "").trim();
    if (url) return url;
  }

  return "";
}

export default function TemplateCard({
  template,
  isSelected = false,
  onSelect,
  onOpenModal,
  wrapper = "div",
  className = "",
  aspectClass,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  const isButton = wrapper === "button";
  const Container = isButton ? "button" : "div";

  const imageUrl = useMemo(() => readTemplateImage(template), [template]);
  const hasImage = Boolean(imageUrl) && !imageFailed;
  const isVideo = template.type === "video";

  return (
    <Container
      type={isButton ? "button" : undefined}
      onClick={() => onSelect?.(template)}
      className={`rounded-3xl border overflow-hidden hover:-translate-y-0.5 transition group cursor-pointer ${
        isSelected
          ? "border-[#ffd976] ring-2 ring-[#ffd976] shadow-[0_0_20px_rgba(255,217,118,0.5)]"
          : "border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.06)]"
      } ${className}`}
    >
      <div className={`relative ${aspectClass ?? "aspect-[4/5]"} w-full bg-slate-900/70`}>
        {hasImage ? (
          <img
            src={imageUrl}
            alt={template.title || "Template preview"}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4 text-center">
            <ImageIcon className="h-8 w-8 text-white/35" />
            <div className="mt-3 text-xs font-medium text-white/50">
              Preview image missing
            </div>
          </div>
        )}

        {isVideo && imageUrl ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenModal?.(imageUrl, template.title);
              }}
              aria-label={`Preview ${template.title}`}
              className="absolute left-3 top-3 rounded-full bg-purple-600 p-1 text-xs font-bold text-white shadow-lg"
            >
              <Play size={18} fill="white" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenModal?.(imageUrl, template.title);
              }}
              aria-label={`Full view ${template.title}`}
              className="absolute right-3 top-3 rounded-full bg-white/10 p-1 text-xs font-bold text-white shadow-lg"
            >
              <Maximize size={16} />
            </button>
          </>
        ) : null}

        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] px-2 py-1 text-xs font-extrabold text-[#1a1a1a] shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
          <Coins size={14} className="text-[#1a1a1a]" />
          {template.creditCost ?? 1}
        </div>

        {isSelected ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,217,118,0.2)]">
            <span className="text-4xl">✓</span>
          </div>
        ) : null}
      </div>

      <div className="h-full bg-[rgba(255,255,255,.06)] p-2 sm:p-4">
        <h3 className="text-sm font-semibold leading-tight text-[#fffef5] sm:text-base">
          {template.title}
        </h3>
        <p className="mt-1 text-xs text-[#c1c8d8]">
          {template.category || template.occasion || "Template"}
        </p>
      </div>
    </Container>
  );
}
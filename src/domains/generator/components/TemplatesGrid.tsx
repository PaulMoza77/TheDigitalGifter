import TemplateCard from "@/components/TemplateCard";
import type { TemplateSummary } from "@/types/templates";
import type { AnyTemplate } from "./generatorTypes";
import { getTemplateId, normalizeTemplate } from "./generatorUtils";

type Props = {
  filteredTemplates: AnyTemplate[];
  selectedTemplateId: string | null;
  onTemplateSelect: (template: AnyTemplate) => void;
  onOpenModal: (src: string, title?: string) => void;
};

export default function TemplatesGrid({
  filteredTemplates,
  selectedTemplateId,
  onTemplateSelect,
  onOpenModal,
}: Props) {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 px-4 pb-8 md:grid-cols-3 lg:grid-cols-4">
      {filteredTemplates.map((template) => {
        const normalized = normalizeTemplate(template);
        const id = getTemplateId(normalized);
        const isSelected = selectedTemplateId === id;

        return (
          <TemplateCard
            key={id}
            template={normalized as TemplateSummary}
            isSelected={isSelected}
            onSelect={onTemplateSelect as any}
            onOpenModal={onOpenModal}
          />
        );
      })}

      {filteredTemplates.length === 0 && (
        <div className="col-span-full rounded-[28px] border border-white/10 bg-white/[0.045] px-6 py-14 text-center">
          <p className="text-lg font-semibold text-white">No templates found</p>
          <p className="mt-2 text-sm text-[#9ca8bd]">
            Try All Categories, All Occasions, or another media type.
          </p>
        </div>
      )}
    </div>
  );
}
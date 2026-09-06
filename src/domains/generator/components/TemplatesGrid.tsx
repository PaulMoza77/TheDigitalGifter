import TemplateCard from "@/components/TemplateCard";
import GiftBrowseEmptyState from "@/components/GiftBrowseEmptyState";
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
        <div className="col-span-full">
          <GiftBrowseEmptyState label="this selection" />
        </div>
      )}
    </div>
  );
}
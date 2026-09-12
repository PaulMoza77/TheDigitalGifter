import { useId } from "react";
import { PET_SUBTYPE_OPTIONS } from "../catalog";
import { usePetT } from "../i18n";
import type { PetSubtype } from "../types";
import { cn } from "@/lib/utils";
import { FieldError, petFieldClass } from "./FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SubtypePicker({
  value,
  detail,
  error,
  onChange,
}: {
  value: PetSubtype | null;
  detail: string | null;
  error?: string;
  onChange: (subtype: PetSubtype, detail?: string) => void;
}) {
  const t = usePetT();
  const errorId = useId();
  const detailId = useId();
  const detailErrorId = useId();

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-3">
      <legend className="text-sm font-medium text-[#f6efe4]">{t("species.tablist")}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PET_SUBTYPE_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors",
                "focus-within:ring-2 focus-within:ring-[#d4a84b]",
                selected
                  ? "border-[#d4a84b] bg-[#d4a84b] text-[#1a140e]"
                  : "border-[#f6efe4]/12 text-[#f6efe4] hover:border-[#f6efe4]/30",
              )}
            >
              <input
                type="radio"
                name="pet-subtype"
                className="sr-only"
                checked={selected}
                value={option.id}
                onChange={() => onChange(option.id, option.id === "other" ? detail || "" : "")}
              />
              {t(`subtype.${option.id}`)}
            </label>
          );
        })}
      </div>
      {value === "other" ? (
        <div>
          <Label htmlFor={detailId} className="text-sm text-[#f6efe4]">
            {t("species.otherHint")}
          </Label>
          <Input
            id={detailId}
            value={detail || ""}
            maxLength={40}
            placeholder="e.g. hedgehog"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? detailErrorId : undefined}
            className={`mt-2 ${petFieldClass(Boolean(error))}`}
            onChange={(event) => onChange("other", event.target.value)}
          />
        </div>
      ) : null}
      <FieldError id={error ? detailErrorId : errorId} message={error} />
    </fieldset>
  );
}

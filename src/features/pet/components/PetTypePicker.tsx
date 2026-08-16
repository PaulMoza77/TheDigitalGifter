import { useId } from "react";
import { PET_SPECIES_OPTIONS } from "../catalog";
import type { PetSpecies } from "../types";
import { cn } from "@/lib/utils";
import { FieldError } from "./FieldError";

export function PetTypePicker({
  value,
  onChange,
  error,
}: {
  value: PetSpecies | null;
  onChange: (value: PetSpecies) => void;
  error?: string;
}) {
  const errorId = useId();

  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-3 text-sm font-medium text-[#f6efe4]">
        What kind of legend is this?
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PET_SPECIES_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "cursor-pointer rounded-2xl border px-4 py-3 transition-colors",
                "focus-within:ring-2 focus-within:ring-[#d4a84b]",
                selected
                  ? "border-[#d4a84b] bg-[#d4a84b]/12"
                  : "border-[#f6efe4]/12 bg-[#1a1410]/50 hover:border-[#f6efe4]/25"
              )}
            >
              <input
                type="radio"
                name="pet-species"
                className="sr-only"
                checked={selected}
                onChange={() => onChange(option.id)}
                value={option.id}
              />
              <span className="block text-sm font-semibold text-[#f6efe4]">
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#f6efe4]/65">
                {option.hint}
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

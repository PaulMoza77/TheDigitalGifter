import { useId } from "react";
import { PET_PERSONALITY_OPTIONS } from "../catalog";
import type { PetPersonality } from "../types";
import { cn } from "@/lib/utils";
import { FieldError } from "./FieldError";

export function PersonalityPicker({
  value,
  onChange,
  error,
}: {
  value: PetPersonality | null;
  onChange: (value: PetPersonality) => void;
  error?: string;
}) {
  const errorId = useId();

  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="mb-3 text-sm font-medium text-[#f6efe4]">
        Personality for every scene
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PET_PERSONALITY_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "cursor-pointer rounded-2xl border px-3 py-3 text-left transition-colors",
                "focus-within:ring-2 focus-within:ring-[#d4a84b]",
                selected
                  ? "border-[#d4a84b] bg-[#d4a84b]/12"
                  : "border-[#f6efe4]/12 bg-[#1a1410]/50 hover:border-[#f6efe4]/25"
              )}
            >
              <input
                type="radio"
                name="pet-personality"
                className="sr-only"
                checked={selected}
                value={option.id}
                onChange={() => onChange(option.id)}
              />
              <span className="block text-sm font-semibold text-[#f6efe4]">
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#f6efe4]/65">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

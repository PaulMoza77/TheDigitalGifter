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
      <legend className="mb-2 text-sm font-medium text-[#f6efe4]">Vibe</legend>
      <div className="grid grid-cols-3 gap-2">
        {PET_PERSONALITY_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors",
                "focus-within:ring-2 focus-within:ring-[#d4a84b]",
                selected
                  ? "border-[#d4a84b] bg-[#d4a84b] text-[#1a140e]"
                  : "border-[#f6efe4]/12 text-[#f6efe4] hover:border-[#f6efe4]/30"
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
              {option.label}
            </label>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

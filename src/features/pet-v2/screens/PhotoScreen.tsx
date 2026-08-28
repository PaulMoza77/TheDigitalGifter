import type { RefObject } from "react";
import { ImagePlus, Replace, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "../../pet/components/FieldError";
import { SubtypePicker } from "../../pet/components/SubtypePicker";
import type { PetSubtype } from "../../pet/types";
import type { PetV2Species } from "../types";
import { speciesConfirmLabel } from "../../pet-funnel-shared/speciesConfirm";

export function V2PhotoScreen({
  species,
  previewUrl,
  fileName,
  error,
  inputId,
  inputRef,
  onClear,
  onGenerate,
  onViewPreview,
  generating,
  subtype,
  subtypeDetail,
  onSubtype,
  speciesConfirmed,
  onSpeciesConfirmed,
}: {
  species: PetV2Species;
  previewUrl: string | null;
  fileName?: string | null;
  error?: string;
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onClear: () => void;
  onGenerate: () => void;
  onViewPreview?: () => void;
  generating?: boolean;
  subtype?: PetSubtype | null;
  subtypeDetail?: string | null;
  onSubtype?: (subtype: PetSubtype, detail?: string) => void;
  speciesConfirmed?: boolean;
  onSpeciesConfirmed?: (confirmed: boolean) => void;
}) {
  const pet = species === "cat" ? "cat" : species === "other" ? "pet" : "dog";
  const confirmKind = species === "dog" || species === "cat" ? species : null;
  const confirmed = Boolean(speciesConfirmed);
  const canGenerate = Boolean(previewUrl) && !generating && (confirmKind ? confirmed : true);

  return (
    <div className="space-y-6 pb-28">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#f6efe4]">One clear photo.</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          Face toward the camera, both eyes visible, even light. One {pet} only — no group shots or heavy filters.
        </p>
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-[#f6efe4]/12 bg-[#1a1410]">
          <img
            src={previewUrl}
            alt={fileName ? `Selected ${fileName}` : "Selected pet photo"}
            className="aspect-[4/5] w-full object-cover"
          />
          <div className="flex gap-2 p-3">
            <Button
              type="button"
              variant="secondary"
              className="h-11 flex-1 rounded-full bg-[#f6efe4] text-[#1a140e] hover:bg-white"
              onClick={() => inputRef.current?.click()}
            >
              <Replace className="h-4 w-4" />
              Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full border-[#f6efe4]/30 bg-transparent text-[#f6efe4]"
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#f6efe4]/20 px-6 py-10 text-center hover:border-[#d4a84b]/70"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#d4a84b] text-[#1a140e]">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="mt-3 text-base font-semibold">Choose a photo</span>
          <span className="mt-1 text-sm text-[#f6efe4]/65">JPEG, PNG, or WebP · 15 MB max</span>
        </button>
      )}

      <FieldError id={`${inputId}-error`} message={error} />

      {species === "other" && onSubtype ? (
        <SubtypePicker value={subtype ?? null} detail={subtypeDetail ?? null} onChange={onSubtype} />
      ) : null}

      {confirmKind && previewUrl && onSpeciesConfirmed ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#f6efe4]/12 bg-[#1a1410] px-4 py-3 text-sm leading-5 text-[#f6efe4]/85">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[#d4a84b]"
            checked={confirmed}
            disabled={generating}
            onChange={(event) => onSpeciesConfirmed(event.target.checked)}
          />
          <span>{speciesConfirmLabel(confirmKind)}</span>
        </label>
      ) : null}

      <Button
        type="button"
        disabled={!canGenerate}
        onClick={onGenerate}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] disabled:opacity-40"
      >
        Create my free preview
      </Button>
      {onViewPreview ? (
        <button
          type="button"
          disabled={generating}
          onClick={onViewPreview}
          className="block w-full text-center text-sm text-[#f6efe4]/60 underline-offset-4 hover:underline"
        >
          View my preview
        </button>
      ) : null}
    </div>
  );
}

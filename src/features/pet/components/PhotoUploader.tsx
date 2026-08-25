import { useId, useRef, useState } from "react";
import { ImagePlus, Replace, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize, validatePetPhotoFile } from "../validation";
import { normalizePetPhotoFile } from "../photoNormalize";
import { PET_PHOTO_MAX_BYTES } from "../types";
import { FieldError } from "./FieldError";

type PhotoUploaderProps = {
  previewUrl: string | null;
  fileName?: string | null;
  byteSize?: number | null;
  needsOriginalFile?: boolean;
  uploadLabel?: string;
  error?: string;
  guidance?: string;
  successMessage?: string;
  onFileAccepted: (file: File) => void | Promise<void>;
  onFileRejected: (message: string) => void;
  onClear: () => void;
};

export function PhotoUploader({
  previewUrl,
  fileName,
  byteSize,
  needsOriginalFile = false,
  uploadLabel = "Upload a photo",
  error,
  guidance = "Use one clear photo with one pet, both eyes visible and even lighting.",
  successMessage,
  onFileAccepted,
  onFileRejected,
  onClear,
}: PhotoUploaderProps) {
  const inputId = useId();
  const errorId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || busy) return;

    if (file.size <= 0) {
      onFileRejected("That file looks empty. Try another photo.");
      return;
    }
    if (file.size > PET_PHOTO_MAX_BYTES) {
      onFileRejected("Photos must be 15 MB or smaller. Try a slightly smaller file.");
      return;
    }

    setBusy(true);
    try {
      const normalized = await normalizePetPhotoFile(file);
      if (!normalized.ok) {
        onFileRejected(normalized.message);
        return;
      }
      const result = validatePetPhotoFile(normalized.file);
      if (!result.ok) {
        onFileRejected(result.message);
        return;
      }
      await onFileAccepted(normalized.file);
    } catch {
      onFileRejected("We couldn’t read that photo. Try a JPEG or PNG instead.");
    } finally {
      setBusy(false);
    }
  }

  function openPicker() {
    if (busy) return;
    inputRef.current?.click();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-[#f6efe4]">
          Pet photo
        </label>
        <span id={helpId} className="text-xs text-[#f6efe4]/50">
          JPEG, PNG, WebP · 15 MB max
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.heic,.heif,image/heic,image/heif"
        className="sr-only"
        aria-invalid={Boolean(error)}
        aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-[#f6efe4]/12 bg-[#1a1410]">
          <div className="relative aspect-[4/5] sm:aspect-[5/4]">
            <img
              src={previewUrl}
              alt={fileName ? `Preview of ${fileName}` : "Uploaded pet photo preview"}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div>
                <p className="text-sm font-medium text-[#f6efe4]">{fileName ?? "Pet photo"}</p>
                {typeof byteSize === "number" ? (
                  <p className="text-xs text-[#f6efe4]/70">{formatFileSize(byteSize)}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 min-h-[44px] rounded-full bg-[#f6efe4] text-[#1a140e] hover:bg-white"
                  onClick={openPicker}
                  disabled={busy}
                >
                  <Replace className="h-4 w-4" aria-hidden="true" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-[44px] rounded-full border-[#f6efe4]/30 bg-transparent text-[#f6efe4] hover:bg-[#f6efe4]/10"
                  onClick={onClear}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
          {needsOriginalFile ? (
            <p className="border-t border-[#f6efe4]/10 px-4 py-3 text-sm text-[#f3d48a]">
              Re-attach the original photo before paying.
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "relative flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors sm:min-h-[280px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]",
            "disabled:opacity-70",
            dragging ? "border-[#d4a84b] bg-[#d4a84b]/10" : "border-[#f6efe4]/25 bg-[#1a1410] hover:border-[#d4a84b]/70",
          )}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d4a84b] text-[#1a140e]">
            {dragging || busy ? <Upload className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
          </span>
          <span className="mt-4 text-lg font-semibold text-[#f6efe4]">
            {busy ? "Preparing photo…" : uploadLabel}
          </span>
          <span className="mt-1 text-sm text-[#f6efe4]/65">Tap to choose · or drop a file</span>
        </button>
      )}

      {successMessage && previewUrl && !error ? (
        <p className="text-sm text-[#d4a84b]" role="status">
          {successMessage}
        </p>
      ) : guidance ? (
        <p className="text-sm text-[#f6efe4]/55">{guidance}</p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

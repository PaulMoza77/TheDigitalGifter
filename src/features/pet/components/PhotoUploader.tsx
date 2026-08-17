import { useId, useRef, useState } from "react";
import { ImagePlus, Replace, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PET_DEMO_SOURCE_IMAGE } from "../catalog";
import { formatFileSize, validatePetPhotoFile } from "../validation";
import { FieldError } from "./FieldError";

type PhotoUploaderProps = {
  previewUrl: string | null;
  fileName?: string | null;
  byteSize?: number | null;
  needsOriginalFile?: boolean;
  exampleImage?: string;
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
  exampleImage = PET_DEMO_SOURCE_IMAGE,
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

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const result = validatePetPhotoFile(file);
    if (!result.ok) {
      onFileRejected(result.message);
      return;
    }
    void onFileAccepted(file);
  }

  function openPicker() {
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
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        aria-invalid={Boolean(error)}
        aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
        onChange={(event) => {
          handleFiles(event.target.files);
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
                >
                  <Replace className="h-4 w-4" aria-hidden="true" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-h-[44px] rounded-full border-[#f6efe4]/30 bg-transparent text-[#f6efe4] hover:bg-[#f6efe4]/10"
                  onClick={onClear}
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
            handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "relative flex min-h-[220px] w-full overflow-hidden rounded-2xl border border-dashed text-center transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]",
            dragging ? "border-[#d4a84b]" : "border-[#f6efe4]/20 hover:border-[#d4a84b]/70"
          )}
        >
          <img
            src={exampleImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
            width={640}
            height={960}
          />
          <span className="absolute inset-0 bg-[#140e0a]/55" />
          <span className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#d4a84b] text-[#1a140e]">
              {dragging ? <Upload className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
            </span>
            <span className="mt-3 text-base font-semibold text-[#f6efe4]">Drop a photo</span>
            <span className="mt-1 text-sm text-[#f6efe4]/70">One clear face, like this.</span>
          </span>
        </button>
      )}

      {successMessage && previewUrl && !error ? (
        <p className="text-sm text-[#d4a84b]" role="status">
          {successMessage}
        </p>
      ) : (
        <p className="text-sm text-[#f6efe4]/55">{guidance}</p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

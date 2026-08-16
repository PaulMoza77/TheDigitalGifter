import { useId, useRef, useState } from "react";
import { ImagePlus, Replace, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize, validatePetPhotoFile } from "../validation";
import { FieldError } from "./FieldError";

type PhotoUploaderProps = {
  previewUrl: string | null;
  fileName?: string | null;
  byteSize?: number | null;
  needsOriginalFile?: boolean;
  error?: string;
  onFileAccepted: (file: File) => void;
  onFileRejected: (message: string) => void;
  onClear: () => void;
};

export function PhotoUploader({
  previewUrl,
  fileName,
  byteSize,
  needsOriginalFile = false,
  error,
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
    onFileAccepted(file);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-[#f6efe4]">
          Pet photo
        </label>
        <span id={helpId} className="text-xs text-[#f6efe4]/55">
          JPEG, PNG or WebP · max 15 MB
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
        <div className="overflow-hidden rounded-3xl border border-[#f6efe4]/12 bg-[#1a1410]">
          <div className="relative aspect-[4/5] sm:aspect-[5/4]">
            <img
              src={previewUrl}
              alt={fileName ? `Preview of ${fileName}` : "Uploaded pet photo preview"}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-4">
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
                  className="h-10 rounded-full bg-[#f6efe4] text-[#1a140e] hover:bg-white"
                  onClick={openPicker}
                >
                  <Replace className="h-4 w-4" aria-hidden="true" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-[#f6efe4]/30 bg-transparent text-[#f6efe4] hover:bg-[#f6efe4]/10"
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
              Preview restored. Re-attach the original photo before paying — we never store the full file in this browser.
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
            "flex min-h-[240px] w-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-10 text-center transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]",
            dragging
              ? "border-[#d4a84b] bg-[#d4a84b]/12"
              : "border-[#f6efe4]/20 bg-[#1a1410]/60 hover:border-[#d4a84b]/70"
          )}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d4a84b]/15 text-[#d4a84b]">
            {dragging ? <Upload className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
          </span>
          <span className="mt-4 text-base font-semibold text-[#f6efe4]">
            Drop a photo or browse
          </span>
          <span className="mt-2 max-w-sm text-sm leading-6 text-[#f6efe4]/65">
            One clear face photo. Same pet, twelve lives. No group shots if we can help it.
          </span>
        </button>
      )}

      <FieldError id={errorId} message={error} />
    </div>
  );
}

import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2, Upload } from "lucide-react";
import { MEMORIES_PLANS_ROUTE, MEMORIES_ROUTE } from "../config";
import type { MemoriesDraft, MemoriesUploadItem } from "../types";

export function MemoriesCreateScreen({
  draft,
  busy,
  uploadError,
  onFiles,
  onRemove,
  onEmailChange,
  onConsentChange,
  onContinue,
}: {
  draft: MemoriesDraft;
  busy: boolean;
  uploadError?: string;
  onFiles: (files: FileList | null) => void;
  onRemove: (uploadId: string) => void;
  onEmailChange: (patch: Partial<Pick<MemoriesDraft, "email" | "fullName">>) => void;
  onConsentChange: (
    patch: Partial<Pick<MemoriesDraft, "marketingOptIn" | "processingConsent" | "authorityAck">>,
  ) => void;
  onContinue: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const canContinue =
    draft.uploads.some((u) => u.status === "uploaded" || u.status === "local") &&
    draft.email.includes("@") &&
    draft.processingConsent &&
    draft.authorityAck &&
    !busy;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-5 py-10 sm:px-8">
      <div>
        <Link to={MEMORIES_ROUTE} className="text-sm text-[#D4AF7A] hover:underline">
          ← Memories
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF7A]">
          Step 1 of 3
        </p>
        <h1 className="memories-display mt-2 text-3xl font-semibold text-[#F7F0E4]">
          Upload &amp; contact
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#F4EDE3]/7">
          Photos stay private. They are not sent to AI providers in Memories V1.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload photographs"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? "border-[#D4AF7A] bg-[#D4AF7A]/10" : "border-[#F4EDE3]/25 bg-[#F4EDE3]/05"
        }`}
      >
        <Upload className="mx-auto h-8 w-8 text-[#D4AF7A]" aria-hidden />
        <p className="mt-3 font-semibold text-[#F7F0E4]">Drag &amp; drop photos</p>
        <p className="mt-1 text-sm text-[#F4EDE3]/6">or tap to choose · JPEG, PNG, WebP · max 15MB each</p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      {uploadError ? <p className="text-sm text-red-300">{uploadError}</p> : null}

      {draft.uploads.length > 0 && (
        <ul className="space-y-3">
          {draft.uploads.map((item: MemoriesUploadItem) => (
            <li
              key={item.uploadId}
              className="flex items-center gap-3 border border-[#F4EDE3]/12 bg-[#221b15] p-3"
            >
              {item.previewDataUrl ? (
                <img
                  src={item.previewDataUrl}
                  alt=""
                  className="h-16 w-16 object-cover"
                />
              ) : (
                <div className="h-16 w-16 bg-[#3d2f24]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                <p className="text-xs text-[#F4EDE3]/55">
                  {item.status === "uploading"
                    ? `Uploading ${item.progress ?? 0}%`
                    : item.status === "failed"
                      ? item.error || "Upload failed"
                      : item.status === "uploaded"
                        ? "Uploaded securely"
                        : "Ready"}
                </p>
                {item.status === "uploading" && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#F4EDE3]/15">
                    <div
                      className="h-full bg-[#D4AF7A] transition-all"
                      style={{ width: `${item.progress ?? 10}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.fileName}`}
                onClick={() => onRemove(item.uploadId)}
                className="rounded p-2 text-[#F4EDE3]/7 hover:bg-[#F4EDE3]/10 hover:text-[#F4EDE3]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4 border-t border-[#F4EDE3]/12 pt-8">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={draft.email}
            onChange={(e) => onEmailChange({ email: e.target.value })}
            className="w-full border border-[#F4EDE3]/2 bg-[#1a1510] px-3 py-3 text-[#F4EDE3] outline-none ring-[#D4AF7A] focus:ring-2"
            placeholder="you@example.com"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name (optional)</span>
          <input
            type="text"
            autoComplete="name"
            value={draft.fullName}
            onChange={(e) => onEmailChange({ fullName: e.target.value })}
            className="w-full border border-[#F4EDE3]/2 bg-[#1a1510] px-3 py-3 text-[#F4EDE3] outline-none ring-[#D4AF7A] focus:ring-2"
          />
        </label>

        <label className="flex gap-3 text-sm leading-6 text-[#F4EDE3]/8">
          <input
            type="checkbox"
            checked={draft.processingConsent}
            onChange={(e) => onConsentChange({ processingConsent: e.target.checked })}
            className="mt-1 accent-[#D4AF7A]"
          />
          <span>
            I consent to The Digital Gifter processing these materials for Memories early access
            (storage, account linkage, and future product notification). Photos are not sent to AI
            providers in V1.
          </span>
        </label>
        <label className="flex gap-3 text-sm leading-6 text-[#F4EDE3]/8">
          <input
            type="checkbox"
            checked={draft.authorityAck}
            onChange={(e) => onConsentChange({ authorityAck: e.target.checked })}
            className="mt-1 accent-[#D4AF7A]"
          />
          <span>
            I confirm I have authority to upload and use these materials. This acknowledgment alone
            does not establish every legal right that may be required.
          </span>
        </label>
        <label className="flex gap-3 text-sm leading-6 text-[#F4EDE3]/65">
          <input
            type="checkbox"
            checked={draft.marketingOptIn}
            onChange={(e) => onConsentChange({ marketingOptIn: e.target.checked })}
            className="mt-1 accent-[#D4AF7A]"
          />
          <span>Optional: send me product updates and offers (separate from transactional emails).</span>
        </label>
      </div>

      <button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D4AF7A] px-6 py-3.5 text-sm font-semibold text-[#1a1510] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continue to plans
        <span className="sr-only"> — next {MEMORIES_PLANS_ROUTE}</span>
      </button>
    </div>
  );
}

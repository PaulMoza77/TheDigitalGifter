type Props = {
  previewUrls: string[];
  onRemoveFile: (index: number) => void;
  onReplace: () => void;
  onRemoveAll: () => void;
};

export default function UploadedPreviewStrip({
  previewUrls,
  onRemoveFile,
  onReplace,
  onRemoveAll,
}: Props) {
  if (previewUrls.length === 0) return null;
  const primary = previewUrls[0];

  return (
    <div className="mx-auto mt-8 w-full max-w-3xl px-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--tdg-home-accent)]">
        Photo added
      </p>
      <div className="mt-3 flex items-center gap-4 rounded-3xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] p-3">
        <img src={primary} alt="Selected photo" className="h-20 w-20 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--tdg-home-text)]">Photo added</p>
          <p className="text-sm text-[var(--tdg-home-text-muted)]">
            {previewUrls.length === 1 ? "1 photo" : `${previewUrls.length} photos`} will be used.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onReplace}
              className="min-h-11 rounded-full border border-[var(--tdg-home-border)] px-4 py-2 text-sm font-semibold"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemoveAll}
              className="min-h-11 rounded-full px-4 py-2 text-sm font-semibold text-[var(--tdg-home-text-muted)]"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      {previewUrls.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {previewUrls.map((url, index) => (
            <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
              <img src={url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => onRemoveFile(index)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  previewUrls: string[];
  onRemoveFile: (index: number) => void;
};

export default function UploadedPreviewStrip({ previewUrls, onRemoveFile }: Props) {
  if (previewUrls.length === 0) return null;

  return (
    <div className="mx-auto my-6 max-w-4xl px-4">
      <div className="flex flex-wrap justify-center gap-3">
        {previewUrls.map((url, index) => (
          <div
            key={url}
            className="group relative h-24 w-24 overflow-hidden rounded-xl border border-white/15 bg-white/[0.06]"
          >
            <img
              src={url}
              alt={`Preview ${index + 1}`}
              className="h-full w-full object-cover"
            />

            <button
              onClick={(event) => {
                event.stopPropagation();
                onRemoveFile(index);
              }}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-xs font-bold text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
              aria-label="Remove image"
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
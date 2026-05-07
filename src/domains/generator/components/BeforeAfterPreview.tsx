import { cn } from "@/lib/utils";
import type { AnyTemplate, JobRow } from "./generatorTypes";

type Props = {
  previewUrls: string[];
  previewAfter: string | null;
  isGenerating: boolean;
  currentJob: JobRow | null;
  selectedTemplateObj: AnyTemplate | null;
  onDownload: (url: string, filename: string) => void;
};

export default function BeforeAfterPreview({
  previewUrls,
  previewAfter,
  isGenerating,
  currentJob,
  selectedTemplateObj,
  onDownload,
}: Props) {
  return (
    <>
      <div
        id="preview-section"
        className="mx-auto mt-4 grid w-[92%] max-w-5xl grid-cols-2 gap-6 text-center font-bold text-[#c1c8d8]"
      >
        <span>Before</span>
        <span>After</span>
      </div>

      <div
        className={cn(
          "mx-auto mt-2 grid w-[92%] max-w-5xl grid-cols-1 gap-6 px-4 pb-32 sm:grid-cols-2",
          selectedTemplateObj && selectedTemplateObj.type === "video"
            ? "pb-72"
            : selectedTemplateObj?.type === "image"
              ? "pb-64"
              : ""
        )}
      >
        <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)]">
          {previewUrls.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {previewUrls.map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt={`Input ${index + 1}`}
                  className="max-h-[240px] max-w-full rounded-lg object-contain"
                />
              ))}
            </div>
          ) : (
            <span>No images uploaded</span>
          )}
        </div>

        <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-5 text-[#c1c8d8] shadow-[0_8px_26px_rgba(0,0,0,.45)]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#ffd976] border-t-transparent" />
              <span className="text-sm">Generating magic...</span>
            </div>
          ) : previewAfter ? (
            <>
              {currentJob?.type === "video" ? (
                <video
                  src={previewAfter}
                  controls
                  className="max-h-full max-w-full rounded-lg object-contain"
                  autoPlay
                  loop
                />
              ) : (
                <img
                  src={previewAfter}
                  alt="After"
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              )}

              <button
                onClick={() => {
                  const ext = currentJob?.type === "video" ? "mp4" : "png";
                  const filename =
                    currentJob?.type === "video"
                      ? `video-${Date.now()}.${ext}`
                      : `generated-card-${Date.now()}.${ext}`;

                  onDownload(previewAfter, filename);
                }}
                className="absolute bottom-4 right-4 rounded-lg bg-[#ffd976] px-4 py-2 font-semibold text-[#1e1e1e] transition hover:brightness-110 active:scale-95"
                type="button"
              >
                Download
              </button>
            </>
          ) : (
            <span>No image generated yet</span>
          )}
        </div>
      </div>
    </>
  );
}
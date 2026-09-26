import { downloadNameForResult } from "../../../../supabase/functions/_shared/higgsfieldImage";
import type { AnyTemplate } from "./generatorTypes";

type Props = {
  previewAfter: string | null;
  resultContentType: string | null;
  isGenerating: boolean;
  hasPhoto: boolean;
  hasStyle: boolean;
  selectedTemplateObj: AnyTemplate | null;
  creditCost: number | null;
  onDownload: (url: string, filename: string) => void;
  onTryAnotherStyle: () => void;
  onCreateAnother: () => void;
  onRegenerate: () => void;
};

export default function BeforeAfterPreview({
  previewAfter,
  resultContentType,
  isGenerating,
  hasPhoto,
  hasStyle,
  selectedTemplateObj,
  creditCost,
  onDownload,
  onTryAnotherStyle,
  onCreateAnother,
  onRegenerate,
}: Props) {
  if (!isGenerating && !previewAfter) return null;

  const cost = Number(creditCost || selectedTemplateObj?.creditCost || 0);

  return (
    <section id="preview-section" className="mx-auto w-full max-w-3xl px-4 py-8">
      {isGenerating ? (
        <div className="rounded-3xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] p-6">
          <h2 className="font-serif text-3xl text-[var(--tdg-home-text)]">Creating your gift…</h2>
          <ul className="mt-4 space-y-2 text-sm text-[var(--tdg-home-text)]">
            <li>{hasPhoto ? "✓ Photo ready" : "Add a photo"}</li>
            <li>{hasStyle ? "✓ Style selected" : "Choose a style"}</li>
            <li>● Creating your personalized image</li>
          </ul>
        </div>
      ) : null}

      {previewAfter && !isGenerating ? (
        <div>
          <h2 className="font-serif text-3xl text-[var(--tdg-home-text)]">Your creation is ready</h2>
          <img
            src={previewAfter}
            alt="Your creation"
            className="mt-4 max-h-[70vh] w-full rounded-3xl object-contain"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-[var(--tdg-home-accent)] px-5 font-bold text-[#1a1208]"
              onClick={() =>
                onDownload(
                  previewAfter,
                  downloadNameForResult({ contentType: resultContentType, url: previewAfter }),
                )
              }
            >
              Download
            </button>
            <button type="button" className="min-h-12 rounded-2xl border border-[var(--tdg-home-border)] px-4" onClick={onTryAnotherStyle}>
              Try another style
            </button>
            <button type="button" className="min-h-12 rounded-2xl border border-[var(--tdg-home-border)] px-4" onClick={onCreateAnother}>
              Create another
            </button>
            <button type="button" className="min-h-12 rounded-2xl px-4 text-[var(--tdg-home-text-muted)]" onClick={onRegenerate}>
              {cost > 0 ? `Regenerate · ${cost} credit${cost === 1 ? "" : "s"}` : "Regenerate"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

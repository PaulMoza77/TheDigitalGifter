import { GENERATOR_ASPECT_CHOICES, aspectLabel, isPrimaryAspectRatio } from "../../../../supabase/functions/_shared/higgsfieldImage";

type Props = {
  canGenerate: boolean;
  isGenerating: boolean;
  creditCost: number | null;
  summary: string;
  customInstructions: string;
  setCustomInstructions: (value: string) => void;
  personalizedName: string;
  setPersonalizedName: (value: string) => void;
  showName: boolean;
  selectedAspectRatio: string;
  setSelectedAspectRatio: (value: string) => void;
  showMoreSizes: boolean;
  setShowMoreSizes: (value: boolean) => void;
  onGenerate: () => void;
};

export default function GenerationBar({
  canGenerate,
  isGenerating,
  creditCost,
  summary,
  customInstructions,
  setCustomInstructions,
  personalizedName,
  setPersonalizedName,
  showName,
  selectedAspectRatio,
  setSelectedAspectRatio,
  showMoreSizes,
  setShowMoreSizes,
  onGenerate,
}: Props) {
  const costLabel = creditCost && creditCost > 0 ? `${creditCost} credit${creditCost === 1 ? "" : "s"}` : "credits";
  const visibleChoices = GENERATOR_ASPECT_CHOICES.filter((choice) =>
    showMoreSizes ? true : isPrimaryAspectRatio(choice.id) || choice.id === selectedAspectRatio,
  );

  return (
    <div className="sticky bottom-0 z-40 border-t border-[var(--tdg-home-border)] bg-[#090909]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {showName ? (
          <input
            value={personalizedName}
            onChange={(event) => setPersonalizedName(event.target.value)}
            placeholder="Name to include"
            disabled={isGenerating}
            className="min-h-11 rounded-2xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] px-3 text-sm text-[var(--tdg-home-text)]"
          />
        ) : null}
        <label className="text-sm text-[var(--tdg-home-text-muted)]">
          Anything you'd like to change?
          <textarea
            value={customInstructions}
            onChange={(event) => setCustomInstructions(event.target.value.slice(0, 2000))}
            placeholder="Example: Keep our faces natural and make the background snowy."
            disabled={isGenerating}
            rows={2}
            className="mt-1 min-h-11 w-full resize-none rounded-2xl border border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] p-3 text-sm text-[var(--tdg-home-text)]"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto">
          {visibleChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              disabled={isGenerating}
              onClick={() => setSelectedAspectRatio(choice.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                selectedAspectRatio === choice.id
                  ? "bg-[var(--tdg-home-accent)] text-[#1a1208]"
                  : "border border-[var(--tdg-home-border)] text-[var(--tdg-home-text)]"
              }`}
            >
              {choice.group === "primary" ? choice.label : choice.detail}
            </button>
          ))}
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-full px-3 text-sm text-[var(--tdg-home-text-muted)]"
            onClick={() => setShowMoreSizes(!showMoreSizes)}
          >
            {showMoreSizes ? "Fewer sizes" : "More sizes"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-[var(--tdg-home-text-muted)]">
            {summary || aspectLabel(selectedAspectRatio)}
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            className="min-h-12 shrink-0 rounded-2xl bg-[var(--tdg-home-accent)] px-5 py-3 text-base font-bold text-[#1a1208] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? "Creating…" : `Create my image · ${costLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}

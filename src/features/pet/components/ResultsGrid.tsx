import { Download, Printer, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PetOrderResults, PetResultFormatKind, PetSceneResult } from "../types";
import { getSceneById } from "../catalog";
import { sceneIcon } from "./SceneCard";

const FORMAT_ICONS: Record<PetResultFormatKind, typeof Download> = {
  high_res: Download,
  wallpaper: Smartphone,
  social: Share2,
  poster: Printer,
};

export function ResultsGrid({
  results,
  onPlaceholderDownload,
}: {
  results: PetOrderResults;
  onPlaceholderDownload?: (sceneTitle: string, formatLabel: string) => void;
}) {
  return (
    <section aria-labelledby="pet-results-heading" className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">Downloads</p>
        <h2 id="pet-results-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[#f6efe4]">
          {results.petName}’s secret gallery
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/70">
          12 QC-approved portraits of the same pet. Extra wallpaper, social, and poster crops are Coming
          later and are not part of this purchase.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {results.scenes.map((scene) => (
          <ResultCard
            key={scene.sceneId}
            scene={scene}
            onPlaceholderDownload={onPlaceholderDownload}
          />
        ))}
      </div>
    </section>
  );
}

function ResultCard({
  scene,
  onPlaceholderDownload,
}: {
  scene: PetSceneResult;
  onPlaceholderDownload?: (sceneTitle: string, formatLabel: string) => void;
}) {
  const definition = getSceneById(scene.sceneId);
  const Icon = sceneIcon(scene.sceneId);
  const ready = scene.status === "ready";

  return (
    <article className="overflow-hidden rounded-3xl border border-[#f6efe4]/10 bg-[#1a1410]">
      <div
        className="relative aspect-[4/5]"
        style={{
          background: `linear-gradient(160deg, ${definition.art.from}, ${definition.art.to})`,
        }}
      >
        {scene.previewUrl && !scene.previewUrl.startsWith("preview://") ? (
          <img
            src={scene.previewUrl}
            alt={`${scene.title} portrait of this pet`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col justify-between p-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/30 text-[#f6efe4]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-semibold text-[#f6efe4]">{scene.title}</p>
              <p className="text-sm text-[#f6efe4]/75">
                {ready ? "Portrait ready" : "Waiting on this scene"}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {scene.assets.map((asset) => {
          const FormatIcon = FORMAT_ICONS[asset.format];
          return (
            <Button
              key={asset.format}
              type="button"
              variant="outline"
              disabled={!asset.ready}
              className="h-auto justify-start rounded-2xl border-[#f6efe4]/12 bg-transparent px-3 py-2 text-left text-[#f6efe4] hover:bg-[#f6efe4]/8 disabled:opacity-40"
              onClick={() => {
                if (!asset.ready) return;
                if (!asset.url || asset.url.startsWith("preview://")) {
                  onPlaceholderDownload?.(scene.title, asset.label);
                  toast.message("Download placeholder", {
                    description: `${asset.label} for ${scene.title} will connect after the backend is live.`,
                  });
                  return;
                }
                window.open(asset.url, "_blank", "noopener,noreferrer");
              }}
            >
              <FormatIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-xs leading-4">{asset.label}</span>
            </Button>
          );
        })}
      </div>
    </article>
  );
}

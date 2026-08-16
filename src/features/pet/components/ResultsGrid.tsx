import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PetOrderResults, PetSceneResult } from "../types";
import { getSceneById } from "../catalog";
import { SceneImage } from "./SceneCard";

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
        <h2 id="pet-results-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4]">
          {results.petName}’s gallery
        </h2>
        <p className="mt-1 text-sm text-[#f6efe4]/65">12 portraits. Same pet.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
  const ready = scene.status === "ready";
  const livePreview =
    scene.previewUrl && !scene.previewUrl.startsWith("preview://") ? scene.previewUrl : null;
  const download = scene.assets.find((asset) => asset.format === "high_res");

  return (
    <article className="overflow-hidden rounded-2xl bg-[#1a1410]">
      <div className="relative aspect-[3/4]">
        {livePreview ? (
          <img
            src={livePreview}
            alt={`${scene.title} portrait of this pet`}
            className="h-full w-full object-cover"
          />
        ) : (
          <SceneImage
            sceneId={scene.sceneId}
            alt={`${definition.title} preview`}
            className={`h-full w-full object-cover ${ready ? "" : "opacity-70"}`}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-sm font-semibold text-white">{scene.title}</p>
        </div>
      </div>
      {download ? (
        <div className="p-2">
          <Button
            type="button"
            variant="outline"
            disabled={!download.ready}
            className="h-9 w-full rounded-xl border-[#f6efe4]/12 bg-transparent text-sm text-[#f6efe4] hover:bg-[#f6efe4]/8 disabled:opacity-40"
            onClick={() => {
              if (!download.ready) return;
              if (!download.url || download.url.startsWith("preview://")) {
                onPlaceholderDownload?.(scene.title, download.label);
                toast.message("Download ready after QC", {
                  description: `${scene.title} will download from this page when the file is live.`,
                });
                return;
              }
              window.open(download.url, "_blank", "noopener,noreferrer");
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {download.ready ? "Download" : "Waiting"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

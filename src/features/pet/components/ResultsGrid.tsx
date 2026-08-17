import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PetOrderResults, PetSceneResult, PetSpecies, PetVideoClipResult } from "../types";
import { getSceneById } from "../catalog";
import { SceneImage } from "./SceneCard";

export function ResultsGrid({
  results,
  species = "dog",
  onPlaceholderDownload,
}: {
  results: PetOrderResults;
  species?: PetSpecies;
  onPlaceholderDownload?: (sceneTitle: string, formatLabel: string) => void;
}) {
  return (
    <section aria-labelledby="pet-results-heading" className="space-y-5">
      <div>
        <h2 id="pet-results-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4]">
          {results.petName}’s gallery
        </h2>
        <p className="mt-1 text-sm text-[#f6efe4]/65">12 portraits and 2 cinematic clips. Same pet.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {results.scenes.map((scene) => (
          <ResultCard
            key={scene.sceneId}
            scene={scene}
            species={species}
            onPlaceholderDownload={onPlaceholderDownload}
          />
        ))}
      </div>

      <ClipResults clips={results.clips || []} />
    </section>
  );
}

function ClipResults({ clips }: { clips: PetVideoClipResult[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xl font-semibold tracking-tight text-[#f6efe4]">Cinematic clips</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {clips.map((clip) => (
          <article key={clip.id} className="overflow-hidden rounded-2xl bg-[#1a1410]">
            {clip.ready && clip.previewUrl ? (
              <video
                src={clip.previewUrl}
                muted
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black"
              >
                Your browser cannot play this MP4 clip.
              </video>
            ) : (
              <div className="grid aspect-video place-items-center bg-[#2a2018] px-4 text-center text-sm text-[#f6efe4]/60">
                {clip.status === "failed"
                  ? clip.title + " needs a retry."
                  : clip.status === "generating"
                    ? "Creating this 5-second clip…"
                    : "Clip available after QC."}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 p-3">
              <p className="text-sm font-semibold text-[#f6efe4]">{clip.title}</p>
              <Button
                type="button"
                variant="outline"
                disabled={!clip.ready || !clip.downloadUrl}
                className="h-9 rounded-xl border-[#f6efe4]/12 bg-transparent text-sm text-[#f6efe4] hover:bg-[#f6efe4]/8 disabled:opacity-40"
                onClick={() => {
                  if (!clip.ready || !clip.downloadUrl) return;
                  window.open(clip.downloadUrl, "_blank", "noopener,noreferrer");
                }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {clip.ready ? "Download MP4" : "Waiting"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ResultCard({
  scene,
  species = "dog",
  onPlaceholderDownload,
}: {
  scene: PetSceneResult;
  species?: PetSpecies;
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
            species={species}
            alt={`${definition.title} preview`}
            animateOnHover={false}
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

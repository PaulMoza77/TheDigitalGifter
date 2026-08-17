import { useState } from "react";
import { Download, LockOpen, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PetFunnelApi } from "../api";
import type { PetOrderResults, PetSceneResult, PetSpecies, PetVideoClipResult } from "../types";
import { getSceneById } from "../catalog";
import { downloadFromUrl, portraitFileName, sharePortrait } from "../shareDownload";
import { UPSELL_UNLOCK_LABEL } from "../upsellUi";
import { PortraitUpsellSheet } from "./PortraitUpsellSheet";
import { SceneImage } from "./SceneCard";

export function ResultsGrid({
  results,
  species = "dog",
  publicToken,
  api,
  onRefresh,
  onPlaceholderDownload,
}: {
  results: PetOrderResults;
  species?: PetSpecies;
  publicToken?: string;
  api?: PetFunnelApi;
  onRefresh?: () => void;
  onPlaceholderDownload?: (sceneTitle: string, formatLabel: string) => void;
}) {
  const [activeScene, setActiveScene] = useState<PetSceneResult | null>(null);
  const readyCount = results.scenes.filter((scene) => scene.status === "ready").length;

  return (
    <section aria-labelledby="pet-results-heading" className="space-y-5">
      <div>
        <h2 id="pet-results-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4]">
          {results.petName}’s gallery
        </h2>
        <p className="mt-1 text-sm text-[#f6efe4]/65">
          {readyCount} portrait{readyCount === 1 ? "" : "s"} ready. Tap{" "}
          <span className="font-medium text-[#d4af37]">{UPSELL_UNLOCK_LABEL}</span> for gift packs,
          print files, or a 3-scene retry.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {results.scenes.map((scene) => (
          <ResultCard
            key={scene.sceneId}
            scene={scene}
            petName={results.petName}
            species={species}
            showUnlock={Boolean(publicToken && api && scene.status === "ready")}
            onOpenUnlock={() => setActiveScene(scene)}
            onPlaceholderDownload={onPlaceholderDownload}
          />
        ))}
      </div>

      <ClipResults clips={results.clips || []} />

      {publicToken && api ? (
        <PortraitUpsellSheet
          open={Boolean(activeScene)}
          onOpenChange={(open) => {
            if (!open) setActiveScene(null);
          }}
          scene={activeScene}
          sceneUpsell={
            activeScene
              ? results.upsells?.sceneUpsells.find((item) => item.sceneKey === activeScene.sceneId) ?? null
              : null
          }
          petName={results.petName}
          publicToken={publicToken}
          api={api}
          upsells={results.upsells}
          allScenes={results.scenes.filter((scene) => scene.status === "ready")}
          onPurchased={onRefresh}
        />
      ) : null}
    </section>
  );
}

function ClipResults({ clips }: { clips: PetVideoClipResult[] }) {
  if (!clips.length) return null;
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
                  : "Creating this 5-second clip…"}
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
                  void downloadFromUrl(clip.downloadUrl, `${clip.title.replace(/\s+/g, "-").toLowerCase()}.mp4`);
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
  petName,
  species = "dog",
  showUnlock,
  onOpenUnlock,
  onPlaceholderDownload,
}: {
  scene: PetSceneResult;
  petName: string;
  species?: PetSpecies;
  showUnlock?: boolean;
  onOpenUnlock?: () => void;
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
        {showUnlock ? (
          <button
            type="button"
            onClick={onOpenUnlock}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#d4af37] px-3 py-1.5 text-xs font-bold text-[#120f0c] shadow-lg transition hover:bg-[#e0bc4a]"
          >
            <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {UPSELL_UNLOCK_LABEL}
          </button>
        ) : null}
      </div>
      {download ? (
        <div className="grid grid-cols-2 gap-2 p-2">
          <Button
            type="button"
            variant="outline"
            disabled={!download.ready}
            className="h-9 rounded-xl border-[#f6efe4]/12 bg-transparent text-sm text-[#f6efe4] hover:bg-[#f6efe4]/8 disabled:opacity-40"
            onClick={() => {
              if (!download.ready) return;
              if (!download.url || download.url.startsWith("preview://")) {
                onPlaceholderDownload?.(scene.title, download.label);
                toast.message("Download is preparing", {
                  description: `${scene.title} will download from this page when the file is live.`,
                });
                return;
              }
              void downloadFromUrl(download.url, portraitFileName(petName, scene.title));
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {download.ready ? "Download" : "Waiting"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!download.ready || !livePreview}
            className="h-9 rounded-xl border-[#f6efe4]/12 bg-transparent text-sm text-[#f6efe4] hover:bg-[#f6efe4]/8 disabled:opacity-40"
            onClick={async () => {
              if (!livePreview) return;
              const result = await sharePortrait({
                url: livePreview,
                title: scene.title,
                text: scene.title,
                fileName: portraitFileName(petName, scene.title),
                pageUrl: window.location.href,
              });
              if (result === "copied") toast.success("Link copied");
            }}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </Button>
        </div>
      ) : null}
    </article>
  );
}

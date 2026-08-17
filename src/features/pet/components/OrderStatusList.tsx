import type {
  PetSceneProgress,
  PetSceneStatus,
  PetSpecies,
  PetVideoClipProgress,
  PetVideoClipStatus,
} from "../types";
import { cn } from "@/lib/utils";
import { SceneImage } from "./SceneCard";

const STATUS_COPY: Record<PetSceneStatus, string> = {
  queued: "Queued",
  generating: "Creating",
  quality_control: "Checking face",
  ready: "Ready",
  failed: "Needs a retry",
};

const CLIP_STATUS_COPY: Record<PetVideoClipStatus, string> = {
  queued: "Waiting for portraits",
  generating: "Creating clip",
  quality_control: "Checking clip",
  ready: "Ready",
  failed: "Needs a retry",
};

export function OrderStatusList({
  scenes,
  petName,
  species = "dog",
  clips = [],
}: {
  scenes: PetSceneProgress[];
  petName: string;
  species?: PetSpecies;
  clips?: PetVideoClipProgress[];
}) {
  const readyCount = scenes.filter((scene) => scene.status === "ready").length;
  const clipReady = clips.filter((clip) => clip.status === "ready").length;

  return (
    <section aria-labelledby="pet-order-status-heading" className="space-y-4">
      <div>
        <h2 id="pet-order-status-heading" className="text-2xl font-semibold tracking-tight text-[#f6efe4]">
          {petName}’s twelve lives
        </h2>
        <p className="mt-1 text-sm text-[#f6efe4]/65">
          {readyCount} of {scenes.length} portraits ready
          {clips.length ? ` · ${clipReady} of ${clips.length} clips ready` : " · 2 cinematic clips after portrait QC"}
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {scenes.map((scene) => (
          <li
            key={scene.sceneId}
            className="flex items-center gap-3 rounded-2xl border border-[#f6efe4]/10 p-2.5"
          >
            <div className="h-14 w-11 overflow-hidden rounded-lg">
              <SceneImage
                sceneId={scene.sceneId}
                species={species}
                alt=""
                animateOnHover={false}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#f6efe4]">{scene.title}</p>
              <p className="mt-0.5 text-xs text-[#f6efe4]/55">{STATUS_COPY[scene.status]}</p>
              {scene.errorMessage ? (
                <p className="mt-1 text-xs text-[#f0b4a0]">{scene.errorMessage}</p>
              ) : null}
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-[#f6efe4]/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={scene.progressPercent}
                aria-label={`${scene.title} progress`}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    scene.status === "failed" ? "bg-[#e07a5f]" : "bg-[#d4a84b]"
                  )}
                  style={{ width: `${scene.progressPercent}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      {clips.length ? (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[#f6efe4]">Cinematic clips</h3>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {clips.map((clip) => (
              <li key={clip.id} className="rounded-2xl border border-[#f6efe4]/10 p-3">
                <p className="text-sm font-medium text-[#f6efe4]">{clip.title}</p>
                <p className="mt-0.5 text-xs text-[#f6efe4]/55">{CLIP_STATUS_COPY[clip.status]}</p>
                {clip.errorMessage ? (
                  <p className="mt-1 text-xs text-[#f0b4a0]">{clip.errorMessage}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}


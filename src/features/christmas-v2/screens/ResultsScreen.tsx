import { useState } from "react";
import { Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChristmasSceneResult, ChristmasVideoResult } from "../api";

function statusLabel(status: string): string {
  switch (status) {
    case "succeeded":
    case "ready":
      return "Ready";
    case "generating":
      return "Creating…";
    case "queued":
      return "Queued";
    case "failed":
      return "Failed — we will retry";
    default:
      return status || "Processing";
  }
}

export function ChristmasResultsScreen({
  scenes,
  videos,
  onContinueUpsell,
}: {
  scenes: ChristmasSceneResult[];
  videos: ChristmasVideoResult[];
  onContinueUpsell?: () => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const ready = scenes.filter((s) => s.imageUrl && (s.status === "succeeded" || s.status === "ready"));
  const pendingScenes = scenes.filter((s) => !["succeeded", "ready", "failed"].includes(s.status));
  const failedScenes = scenes.filter((s) => s.status === "failed");
  const pendingVideos = videos.filter((v) => ["queued", "generating"].includes(v.status));
  const failedVideos = videos.filter((v) => v.status === "failed");
  const readyVideos = videos.filter((v) => v.videoUrl && (v.status === "succeeded" || v.status === "ready"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="cv2-display text-3xl font-semibold text-[#F7F0E4] sm:text-4xl">
          Your Christmas portraits are ready 🎄
        </h1>
        <p className="mt-2 text-sm text-[#F7F0E4]/70">
          Download, share, or keep exploring more Christmas scenarios below.
        </p>
        {pendingScenes.length || pendingVideos.length ? (
          <p className="mt-2 text-sm text-[#F3D98A]">
            {pendingVideos.length
              ? "Your short AI video is still rendering — this page updates automatically."
              : "Remaining portraits are still rendering — this page updates automatically."}
          </p>
        ) : null}
        {failedScenes.length || failedVideos.length ? (
          <p className="mt-2 text-sm text-[#F7F0E4]/75">
            Some items did not finish. Completed downloads below are still yours to keep.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ready.map((scene) => (
          <article
            key={scene.sceneKey}
            className="overflow-hidden rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/08"
          >
            <button
              type="button"
              className="group relative block aspect-[3/4] w-full overflow-hidden"
              onClick={() => setLightbox(scene.imageUrl || null)}
            >
              <img src={scene.imageUrl || ""} alt={scene.title} className="h-full w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                <Maximize2 className="h-6 w-6 text-white" />
              </span>
            </button>
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <p className="text-sm font-semibold text-[#F7F0E4]">{scene.title}</p>
              {scene.imageUrl ? (
                <a
                  href={scene.imageUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1B4332] text-[#F7F0E4]"
                  aria-label={`Download ${scene.title}`}
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {videos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="cv2-display text-2xl font-semibold text-[#F7F0E4]">Your Christmas videos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {readyVideos.map((video) => (
              <article
                key={video.id}
                className="overflow-hidden rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/08"
              >
                <video
                  src={video.videoUrl || ""}
                  controls
                  playsInline
                  className="aspect-[9/16] w-full bg-black object-contain"
                />
                <div className="flex items-center justify-between gap-2 px-3 py-3">
                  <p className="text-sm text-[#F7F0E4]/80">
                    Clip from {video.sourceSceneKey} · {statusLabel(video.status)}
                  </p>
                  {video.videoUrl ? (
                    <a
                      href={video.videoUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1B4332] text-[#F7F0E4]"
                      aria-label="Download Christmas video"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
            {pendingVideos.map((video) => (
              <div
                key={video.id}
                className="rounded-2xl border border-dashed border-[#F3D98A]/40 bg-[#F7F0E4]/05 px-4 py-8 text-center text-sm text-[#F3D98A]"
              >
                Video {statusLabel(video.status).toLowerCase()} ({video.sourceSceneKey})
              </div>
            ))}
            {failedVideos.map((video) => (
              <div
                key={video.id}
                className="rounded-2xl border border-[#F7F0E4]/20 bg-[#F7F0E4]/05 px-4 py-8 text-center text-sm text-[#F7F0E4]/75"
              >
                Video failed ({video.sourceSceneKey}). Status is not marked complete.
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {onContinueUpsell ? (
        <Button
          type="button"
          onClick={onContinueUpsell}
          className="h-12 w-full rounded-full bg-[#C9A227] text-base font-semibold text-[#3b0610] hover:bg-[#dbb84a]"
        >
          Love your photos? See more Christmas scenarios
        </Button>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <img src={lightbox} alt="Full size Christmas portrait" className="max-h-[90vh] max-w-full rounded-xl" />
        </div>
      ) : null}
    </div>
  );
}

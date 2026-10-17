import { useEffect, useId, useRef, useState } from "react";
import { Download, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChristmasSceneResult, ChristmasVideoResult } from "../api";

export type ChristmasResultsOutcome = "complete" | "partial_failure" | "failed" | "unknown";

export function ChristmasResultsScreen({
  scenes,
  videos,
  onContinueUpsell,
  emailHint,
  outcome = "unknown",
}: {
  scenes: ChristmasSceneResult[];
  videos: ChristmasVideoResult[];
  onContinueUpsell?: () => void;
  emailHint?: string | null;
  /** Terminal order status — never invent success copy on failure. */
  outcome?: ChristmasResultsOutcome;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const ready = scenes.filter((s) => s.imageUrl && (s.status === "succeeded" || s.status === "ready"));
  const readyVideos = videos.filter((v) => v.videoUrl);
  const failedScenes = scenes.filter((s) => s.status === "failed").length;
  const failedVideos = videos.filter((v) => v.status === "failed").length;
  const isPartial = outcome === "partial_failure" || (ready.length > 0 && (failedScenes > 0 || failedVideos > 0));
  const isTotalFail = outcome === "failed" || (ready.length === 0 && outcome !== "unknown" && outcome !== "complete");

  useEffect(() => {
    if (!lightbox) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const heading = isTotalFail
    ? "We couldn’t finish your Christmas portraits"
    : isPartial
      ? "Some of your Christmas portraits are ready"
      : "Your Christmas portraits are ready";

  const supportLine =
    isTotalFail || isPartial
      ? " If something is missing, contact support@thedigitalgifter.com with your order email — see also our Refund Policy."
      : "";

  return (
    <div className="space-y-6" data-testid="cv2-results">
      <div>
        <h1 className="cv2-display text-3xl font-semibold text-[#F7F0E4] sm:text-4xl">{heading}</h1>
        <p className="mt-2 text-sm text-[#F7F0E4]/70" data-testid="cv2-results-summary">
          {isTotalFail
            ? "Payment was received, but generation did not produce downloadable portraits."
            : "Download below. Signed links expire — save copies you want to keep."}
          {!isTotalFail && emailHint
            ? ` A delivery email may also have been sent to ${emailHint}.`
            : !isTotalFail
              ? " A delivery email is sent when at least one portrait finishes (check spam if needed)."
              : ""}
          {supportLine}
        </p>
        {isPartial || isTotalFail ? (
          <p
            className="mt-3 rounded-2xl border border-[#C9A227]/35 bg-[#C9A227]/10 px-3 py-2 text-xs text-[#F3D98A]"
            data-testid="cv2-results-failure-note"
            role="status"
          >
            {isTotalFail
              ? "No finished assets yet. Support can review the order — we do not auto-claim a refund here."
              : `Finished: ${ready.length} photo${ready.length === 1 ? "" : "s"}${
                  readyVideos.length ? ` · ${readyVideos.length} clip${readyVideos.length === 1 ? "" : "s"}` : ""
                }. Failed attempts: ${failedScenes} photo${failedScenes === 1 ? "" : "s"}${
                  failedVideos ? ` · ${failedVideos} clip${failedVideos === 1 ? "" : "s"}` : ""
                }.`}
          </p>
        ) : null}
      </div>

      {ready.length === 0 ? (
        <p className="rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/06 p-4 text-sm text-[#F7F0E4]/70">
          {isTotalFail
            ? "No finished portraits to download. Keep your order email for support."
            : "No finished portraits yet. If payment succeeded, keep this page open or refresh — generation continues in the background."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {ready.map((scene) => (
            <article
              key={scene.sceneKey}
              className="overflow-hidden rounded-2xl border border-[#F7F0E4]/12 bg-[#F7F0E4]/08"
            >
              <button
                type="button"
                className="group relative block aspect-[3/4] w-full min-h-11 overflow-hidden"
                onClick={() => setLightbox(scene.imageUrl || null)}
                aria-label={`View ${scene.title} full size`}
              >
                <img
                  src={scene.imageUrl || ""}
                  alt={scene.title}
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100 group-focus-visible:bg-black/25 group-focus-visible:opacity-100">
                  <Maximize2 className="h-6 w-6 text-white" aria-hidden="true" />
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
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1B4332] text-[#F7F0E4]"
                    aria-label={`Download ${scene.title}`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {readyVideos.length > 0 ? (
        <section className="space-y-3" aria-labelledby="cv2-videos-heading">
          <h2 id="cv2-videos-heading" className="cv2-display text-2xl font-semibold text-[#F7F0E4]">
            Your Christmas videos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {readyVideos.map((video) => (
              <video
                key={video.id}
                src={video.videoUrl || ""}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-2xl border border-[#F7F0E4]/12"
              >
                Your browser does not support this video.
              </video>
            ))}
          </div>
        </section>
      ) : null}

      {onContinueUpsell && !isTotalFail ? (
        <Button
          type="button"
          data-testid="cv2-continue-upsell"
          onClick={onContinueUpsell}
          className="h-12 w-full rounded-full bg-[#C9A227] text-base font-semibold text-[#3b0610] hover:bg-[#dbb84a]"
        >
          Optional: see more Christmas scenarios
        </Button>
      ) : null}
      <p className="text-center text-xs text-[#F7F0E4]/45">
        <a className="underline-offset-2 hover:underline" href="/refunds">
          Refund Policy
        </a>
        {" · "}
        <a className="underline-offset-2 hover:underline" href="/privacy">
          Privacy Policy
        </a>
        {" · "}
        <a className="underline-offset-2 hover:underline" href="mailto:support@thedigitalgifter.com">
          Contact support
        </a>
      </p>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <p id={titleId} className="sr-only">
            Full size Christmas portrait
          </p>
          <button
            ref={closeRef}
            type="button"
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
            aria-label="Close full size preview"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <img
            src={lightbox}
            alt="Full size Christmas portrait"
            className="max-h-[90vh] max-w-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

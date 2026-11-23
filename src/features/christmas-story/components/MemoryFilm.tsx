import { useEffect, useRef, useState } from "react";
import type { FilmAsset } from "../types";
import { isStoryApiEnabled, signMediaAsset } from "../storyApi";

type Props = {
  film: FilmAsset;
  /** When set with durable API, playback uses short-lived signed URLs only. */
  signedAssetId?: string | null;
  orderId?: string;
  asRecipient?: boolean;
};

/** User-controlled media; captions remain available when photographs cannot load. */
export function MemoryFilm({ film, signedAssetId, orderId, asRecipient }: Props) {
  const [index, setIndex] = useState(0);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const renewTimer = useRef<number | null>(null);
  const frame = film.frames[Math.min(index, Math.max(0, film.frames.length - 1))];

  const useSigned = Boolean(signedAssetId && isStoryApiEnabled());
  const playbackUrl = useSigned ? signedUrl : film.videoUrl;

  useEffect(() => {
    if (!useSigned || !signedAssetId) return;
    let cancelled = false;

    async function issue(renew = false) {
      const res = await signMediaAsset({
        assetId: signedAssetId!,
        orderId,
        asRecipient,
        renew,
      });
      if (cancelled) return;
      if (!res.ok) {
        setSignedUrl(null);
        setSignError(res.code || "sign_failed");
        return;
      }
      if (!res.data.url) {
        setSignedUrl(null);
        setSignError("sign_failed");
        return;
      }
      setSignError(null);
      setSignedUrl(res.data.url);
      const renewAtMs = Math.max(15, Number(res.data.renewAt || res.data.expiresIn - 30)) * 1000;
      if (renewTimer.current) window.clearTimeout(renewTimer.current);
      renewTimer.current = window.setTimeout(() => {
        void issue(true);
      }, renewAtMs);
    }

    void issue(false);
    return () => {
      cancelled = true;
      if (renewTimer.current) window.clearTimeout(renewTimer.current);
    };
  }, [useSigned, signedAssetId, orderId, asRecipient]);

  return (
    <div className="cs-memory-film">
      {film.isExample ? (
        <p className="cs-media-note">
          Fictional sample film · {film.videoUrl ? "licensed stock imagery, not customer photos" : "no finished film yet"}
        </p>
      ) : null}
      {useSigned && signError ? (
        <p role="status" className="cs-media-note">
          Private media is unavailable ({signError}). There is no public playback fallback.
        </p>
      ) : null}
      {playbackUrl && playbackUrl !== failedVideo ? (
        <video
          key={playbackUrl}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          aria-label={film.title}
          poster={film.isExample ? "/assets/christmas-story-demo/emma-poster.jpg" : frame?.src || undefined}
          onError={() => setFailedVideo(playbackUrl)}
        >
          <source src={playbackUrl} type="video/mp4" />
        </video>
      ) : (
        <>
          {failedVideo ? (
            <p role="status" className="cs-media-note">
              The film could not load. You can still explore the memories below.
            </p>
          ) : null}
          <figure className="cs-film">
            {frame?.src && !failedSources.includes(frame.src) ? (
              <img
                className="cs-film__img"
                src={frame.src}
                alt={frame.caption || `Memory ${index + 1}`}
                loading="lazy"
                onError={() => setFailedSources((sources) => [...sources, frame.src])}
              />
            ) : (
              <div className="cs-film__placeholder">
                <span className="cs-kicker">{frame ? `Memory ${index + 1}` : "A moment to remember"}</span>
                <p>{frame?.caption || "Your memory film is not available yet."}</p>
                {frame?.src ? <small>Photo unavailable</small> : <small>{frame ? "Photo placeholder" : ""}</small>}
              </div>
            )}
            {frame?.src && !failedSources.includes(frame.src) && frame.caption ? (
              <figcaption>{frame.caption}</figcaption>
            ) : null}
          </figure>
          {film.frames.length > 1 ? (
            <div className="cs-film-controls">
              <button
                className="cs-btn cs-btn--ghost"
                type="button"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
                aria-label="Previous memory"
              >
                ←
              </button>
              <span role="status" aria-live="polite">
                {index + 1} / {film.frames.length}
              </span>
              <button
                className="cs-btn cs-btn--ghost"
                type="button"
                disabled={index >= film.frames.length - 1}
                onClick={() => setIndex((i) => i + 1)}
                aria-label="Next memory"
              >
                →
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

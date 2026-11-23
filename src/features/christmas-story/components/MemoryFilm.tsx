import { useState } from "react";
import type { FilmAsset } from "../types";

/** User-controlled media; captions remain available when photographs cannot load. */
export function MemoryFilm({ film }: { film: FilmAsset }) {
  const [index, setIndex] = useState(0);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const frame = film.frames[Math.min(index, Math.max(0, film.frames.length - 1))];
  return (
    <div className="cs-memory-film">
      {film.isExample ? <p className="cs-media-note">Sample memory sequence · {film.videoUrl ? "example video" : "no finished film yet"}</p> : null}
      {film.videoUrl && film.videoUrl !== failedVideo ? <video key={film.videoUrl} controls playsInline preload="none" aria-label={film.title} poster={frame?.src || undefined} onError={() => setFailedVideo(film.videoUrl)}><source src={film.videoUrl} /></video> : (
        <>
          {failedVideo ? <p role="status" className="cs-media-note">The film could not load. You can still explore the memories below.</p> : null}
          <figure className="cs-film">
            {frame?.src && !failedSources.includes(frame.src) ? <img className="cs-film__img" src={frame.src} alt={frame.caption || `Memory ${index + 1}`} loading="lazy" onError={() => setFailedSources(sources => [...sources, frame.src])} /> : <div className="cs-film__placeholder"><span className="cs-kicker">{frame ? `Memory ${index + 1}` : "A moment to remember"}</span><p>{frame?.caption || "Your memory film is not available yet."}</p>{frame?.src ? <small>Photo unavailable</small> : <small>{frame ? "Photo placeholder" : ""}</small>}</div>}
            {frame?.src && !failedSources.includes(frame.src) && frame.caption ? <figcaption>{frame.caption}</figcaption> : null}
          </figure>
          {film.frames.length > 1 ? <div className="cs-film-controls"><button className="cs-btn cs-btn--ghost" type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)} aria-label="Previous memory">←</button><span role="status" aria-live="polite">{index + 1} / {film.frames.length}</span><button className="cs-btn cs-btn--ghost" type="button" disabled={index >= film.frames.length - 1} onClick={() => setIndex(i => i + 1)} aria-label="Next memory">→</button></div> : null}
        </>
      )}
    </div>
  );
}

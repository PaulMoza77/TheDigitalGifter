import { useState } from "react";
import type { SongAsset } from "../types";

type Props = { song: SongAsset; onPlay?: () => void };

/** Real media only. Missing audio is a lyrics preview, never a synthesized song. */
export function ExampleAudioPlayer({ song, onPlay }: Props) {
  const [activeLine, setActiveLine] = useState(-1);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = Boolean(song.audioUrl && song.audioUrl === failedUrl);
  return (
    <div className="cs-player">
      <div className="cs-player__meta">
        <div className="cs-player__cover" aria-hidden="true">{song.coverLabel.slice(0, 1).toUpperCase()}</div>
        <div><p className="cs-kicker">A song for you</p><h3>{song.title}</h3>{song.isExample ? <span className="cs-player__badge">Sample lyrics{song.audioUrl ? " & audio" : ""}</span> : null}</div>
      </div>
      {song.audioUrl ? (
        <>
          <audio key={song.audioUrl} controls src={song.audioUrl} preload="none" aria-label={song.title}
            onPlay={onPlay} onEnded={() => setActiveLine(-1)} onError={() => setFailedUrl(song.audioUrl)}
            onTimeUpdate={e => {
              const time = e.currentTarget.currentTime * 1000;
              setActiveLine(song.lyrics.findIndex((line, i) => time >= line.timeMs && time < (song.lyrics[i + 1]?.timeMs ?? Infinity)));
            }} />
          {failed ? <p role="status" className="cs-media-note">This audio could not load. Please try again later.</p> : null}
        </>
      ) : (
        <p className="cs-media-note" role="status">
          {song.isExample
            ? "Song not attached yet. Lyrics only — no playback until an authorized commercial master is uploaded."
            : song.status === "failed"
              ? "The song is unavailable right now. Please check back later."
              : "Your song is not available yet. Your words are here to read."}
        </p>
      )}
      {song.lyrics.length ? <details className="cs-lyrics-details" open={!song.audioUrl}><summary>Read the lyrics</summary><ul className="cs-lyrics">{song.lyrics.map((line, i) => <li key={`${line.timeMs}-${i}`} className={i === activeLine ? "is-active" : undefined}>{line.text}</li>)}</ul></details> : null}
    </div>
  );
}

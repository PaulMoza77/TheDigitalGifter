import { useEffect, useRef, useState } from "react";
import type { SongAsset } from "../types";

type Props = {
  song: SongAsset;
  onPlay?: () => void;
};

/**
 * Accessible player. No autoplay.
 * When audioUrl is null, plays a short procedural demo tone labeled as Example.
 */
export function ExampleAudioPlayer({ song, onPlay }: Props) {
  const [playing, setPlaying] = useState(false);
  const [activeLine, setActiveLine] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      void ctxRef.current?.close();
    };
  }, []);

  function stopTone() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setPlaying(false);
  }

  async function playProcedural() {
    stopTone();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const notes = [392, 440, 493.88, 523.25, 587.33, 523.25, 493.88, 440];
    let i = 0;
    const tick = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = notes[i % notes.length];
      gain.gain.value = 0.045;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      setActiveLine(i % Math.max(1, song.lyrics.length));
      i += 1;
      if (i >= 16) stopTone();
    };
    tick();
    timerRef.current = window.setInterval(tick, 450);
    setPlaying(true);
    onPlay?.();
  }

  async function toggle() {
    if (playing) {
      audioRef.current?.pause();
      stopTone();
      return;
    }
    if (song.audioUrl) {
      const el = audioRef.current;
      if (!el) return;
      try {
        await el.play();
        setPlaying(true);
        onPlay?.();
      } catch {
        /* ignore autoplay policy */
      }
      return;
    }
    await playProcedural();
  }

  return (
    <div className="cs-player">
      <div className="cs-player__cover" aria-hidden>
        {song.coverLabel.slice(0, 1).toUpperCase()}
      </div>
      <div className="cs-player__meta">
        <div>
          <strong className="cs-display" style={{ fontSize: "1.35rem" }}>
            {song.title}
          </strong>
        </div>
        {song.isExample ? <span className="cs-player__badge">Example song</span> : null}
      </div>
      <button type="button" className="cs-btn cs-btn--primary" onClick={() => void toggle()}>
        {playing ? "Pause" : "Play"}
      </button>
      {song.audioUrl ? (
        <audio
          ref={audioRef}
          src={song.audioUrl}
          preload="none"
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime * 1000;
            const idx = song.lyrics.findIndex((line, i) => {
              const next = song.lyrics[i + 1]?.timeMs ?? Number.POSITIVE_INFINITY;
              return t >= line.timeMs && t < next;
            });
            if (idx >= 0) setActiveLine(idx);
          }}
        />
      ) : null}
      <ul className="cs-lyrics" aria-live="polite">
        {song.lyrics.map((line, i) => (
          <li key={`${line.timeMs}-${i}`} className={i === activeLine ? "is-active" : undefined}>
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

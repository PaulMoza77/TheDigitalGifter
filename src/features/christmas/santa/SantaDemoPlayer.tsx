import { useState } from "react";
import type { SantaDemoExample } from "./santaExamples";

export function SantaDemoPlayer({
  example,
  featured,
}: {
  example: SantaDemoExample;
  featured?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setLineIndex(0);
  }

  function onAdvance() {
    if (lineIndex >= example.lines.length - 1) {
      setPlaying(false);
      setLineIndex(0);
      return;
    }
    setLineIndex((i) => i + 1);
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-[#d4af37]/25 bg-[#0f1f1a]/70 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
        featured ? "sm:col-span-2" : ""
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0c1814]">
        <img
          src={example.posterSrc}
          alt={example.posterAlt}
          className="h-full w-full object-cover opacity-80"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1814] via-[#0c1814]/40 to-transparent" />
        <p className="absolute left-3 top-3 rounded-md bg-[#0c1814]/70 px-2 py-1 text-[11px] uppercase tracking-wide text-[#d4af37]">
          {example.recipientLabel}
        </p>
        <button
          type="button"
          onClick={togglePlay}
          className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-[#F5EDE0] px-3 py-2 text-sm font-semibold text-[#1a0f0c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
          aria-pressed={playing}
        >
          {playing ? "Pause demo" : "Play demo"}
        </button>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div>
          <h3 className="font-[family-name:var(--santa-display)] text-xl text-[#F5EDE0]">{example.title}</h3>
          <p className="text-sm text-[#F5EDE0]/65">{example.subtitle}</p>
        </div>
        <blockquote className="min-h-[4.5rem] border-l-2 border-[#d4af37]/50 pl-3 text-sm leading-relaxed text-[#F5EDE0]/90">
          {playing ? example.lines[lineIndex] : example.lines[0]}
        </blockquote>
        {playing ? (
          <button
            type="button"
            className="text-sm font-medium text-[#d4af37] underline-offset-2 hover:underline"
            onClick={onAdvance}
          >
            Next line
          </button>
        ) : null}
        <ul className="flex flex-wrap gap-2" aria-label="Demo themes">
          {example.tags.map((tag) => (
            <li key={tag} className="text-xs text-[#F5EDE0]/55">
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

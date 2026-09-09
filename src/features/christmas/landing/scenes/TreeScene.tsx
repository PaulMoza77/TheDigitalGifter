import { useEffect, useRef, useState } from "react";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { SceneShell } from "../SceneShell";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

export function TreeScene({
  locale,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onCta: () => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const reduced = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(reduced ? 1 : 0.18);

  useEffect(() => {
    if (reduced) return;
    const el = stageRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        const view = window.innerHeight || 1;
        const raw = 1 - rect.top / (view * 0.85);
        setProgress(Math.min(1, Math.max(0.12, raw)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const lights = progress;
  const giftCount = progress > 0.75 ? 5 : progress > 0.45 ? 3 : 1;

  return (
    <SceneShell
      id="tree"
      kicker={t("tree.kicker")}
      title={t("tree.h2")}
      lede={t("tree.lede")}
      visual={
        <div className="xmas-tree-stage" ref={stageRef}>
          <div className="xmas-tree-visual" role="img" aria-label={t("tree.h2")}>
            <svg viewBox="0 0 200 260" aria-hidden="true">
              <defs>
                <linearGradient id="xmas-foliage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f7a4a" />
                  <stop offset="100%" stopColor="#12351f" />
                </linearGradient>
              </defs>
              <ellipse cx="100" cy="248" rx="56" ry="8" fill="rgba(0,0,0,0.22)" />
              <rect x="90" y="214" width="20" height="34" rx="3" fill="#5c3a1e" />
              <polygon points="100,16 30,96 170,96" fill="url(#xmas-foliage)" />
              <polygon points="100,52 22,150 178,150" fill="url(#xmas-foliage)" />
              <polygon points="100,96 16,214 184,214" fill="url(#xmas-foliage)" />
              {[
                [70, 78],
                [128, 88],
                [56, 132],
                [146, 138],
                [82, 168],
                [118, 176],
                [100, 108],
              ].map(([x, y], i) => (
                <circle
                  key={`${x}-${y}`}
                  className="xmas-ornament"
                  cx={x}
                  cy={y}
                  r="5"
                  fill={["#d4b36a", "#c0392b", "#f4e1b5", "#c0392b", "#d4b36a", "#7a1d28", "#f0d59a"][i]}
                  style={{ animationDelay: `${i * 0.18}s`, opacity: 0.35 + lights * 0.65 }}
                />
              ))}
              <polygon points="100,10 106,24 122,26 110,36 114,52 100,42 86,52 90,36 78,26 94,24" fill="#f0d59a" />
              {Array.from({ length: giftCount }).map((_, i) => (
                <rect
                  key={i}
                  x={58 + i * 18}
                  y={226}
                  width="16"
                  height="12"
                  rx="1.5"
                  fill={["#7a1d28", "#1d4a36", "#8a5a22", "#f4e1b5", "#3b0810"][i]}
                />
              ))}
            </svg>
          </div>
        </div>
      }
    >
      <div className="xmas-actions">
        <button type="button" className="xmas-btn xmas-btn--gold" onClick={onCta}>
          {t("tree.cta")}
        </button>
      </div>
    </SceneShell>
  );
}

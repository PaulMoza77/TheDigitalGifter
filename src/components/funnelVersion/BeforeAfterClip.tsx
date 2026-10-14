import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import "./beforeAfterClip.css";

type Props = {
  beforeSrc: string;
  posterSrc: string;
  clipSrc?: string;
  beforeAlt: string;
  afterAlt: string;
  beforeLabel?: string;
  afterLabel?: string;
  eager?: boolean;
  /** Gently open the filter once so the clip is visible without a first drag. */
  nudge?: boolean;
  durationLabel?: string;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Drag-to-compare filter. The after side plays a short clip when one is provided.
 * Same handle, labels, and clip mask as the memories before/after slider.
 */
export function BeforeAfterClip({
  beforeSrc,
  posterSrc,
  clipSrc,
  beforeAlt,
  afterAlt,
  beforeLabel = "Before",
  afterLabel = "After",
  eager = false,
  nudge = false,
  durationLabel = "5s",
}: Props) {
  const [pos, setPos] = useState(nudge ? 78 : 52);
  const [boxW, setBoxW] = useState(0);
  const [reduced, setReduced] = useState(false);
  const dragging = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!nudge || prefersReducedMotion()) return;
    const start = performance.now();
    const from = 78;
    const to = 42;
    let raf = 0;
    const tick = (now: number) => {
      if (dragging.current) return;
      const t = Math.min(1, (now - start) / 1400);
      const eased = 1 - Math.pow(1 - t, 3);
      setPos(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nudge]);

  useEffect(() => {
    const video = videoRef.current;
    const root = rootRef.current;
    if (!video || !root || !clipSrc || reduced) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [clipSrc, reduced]);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    setPos(Math.min(96, Math.max(4, next)));
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const showClip = Boolean(clipSrc) && !reduced;

  return (
    <div
      ref={rootRef}
      className="funnel-ba"
      role="slider"
      aria-label="Before and after. Drag to compare the original photo with the short clip."
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        updateFromClientX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
        if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
      }}
    >
      {showClip ? (
        <video
          ref={videoRef}
          className="funnel-ba__media"
          src={clipSrc}
          poster={posterSrc}
          muted
          loop
          playsInline
          autoPlay
          preload={eager ? "auto" : "metadata"}
          aria-label={afterAlt}
        />
      ) : (
        <img
          className="funnel-ba__media"
          src={posterSrc}
          alt={afterAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      <div className="funnel-ba__before-clip" style={{ width: `${pos}%` }}>
        <img
          className="funnel-ba__media funnel-ba__before"
          src={beforeSrc}
          alt={beforeAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={boxW ? { width: boxW } : undefined}
        />
      </div>
      <div className="funnel-ba__handle" style={{ insetInlineStart: `${pos}%` }}>
        <span className="funnel-ba__knob" aria-hidden="true" />
      </div>
      <span className="funnel-ba__label funnel-ba__label--before">{beforeLabel}</span>
      <span className="funnel-ba__label funnel-ba__label--after">{afterLabel}</span>
      <span className="funnel-ba__time">{durationLabel}</span>
    </div>
  );
}

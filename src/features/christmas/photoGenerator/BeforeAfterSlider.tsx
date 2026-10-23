import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Props = {
  beforeSrc: string;
  afterSrc: string;
  afterVideoSrc?: string;
  beforeAlt: string;
  afterAlt: string;
  beforeLabel: string;
  afterLabel: string;
  ariaLabel: string;
  /** Eager for LCP hero; lazy elsewhere */
  eager?: boolean;
  className?: string;
};

/**
 * Touch-friendly before/after slider. No heavy animation libs.
 */
export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  afterVideoSrc,
  beforeAlt,
  afterAlt,
  beforeLabel,
  afterLabel,
  ariaLabel,
  eager = false,
  className = "",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playClip = () => { void videoRef.current?.play()?.catch(() => {}); };
  const [pos, setPos] = useState(55);
  const dragging = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    setPos(Math.min(96, Math.max(4, next)));
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    playClip();
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={rootRef}
      className={`pg-ba ${className}`}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); playClip(); }
        if (e.key === "Home") setPos(4);
        if (e.key === "End") setPos(96);
        if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 4));
        if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 4));
      }}
    >
      {afterVideoSrc ? (
        <video ref={videoRef} className="pg-ba__img pg-ba__img--after" src={afterVideoSrc}
          poster={afterSrc} muted loop playsInline preload="none" aria-label={afterAlt} />
      ) : (
        <img className="pg-ba__img pg-ba__img--after" src={afterSrc} alt={afterAlt}
          loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "high" : "auto"} />
      )}
      <div className="pg-ba__before-clip" style={{ width: "100%", clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img
          className="pg-ba__img pg-ba__img--before"
          src={beforeSrc}
          alt={beforeAlt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={{ width: "100%" }}
        />
      </div>
      <div className="pg-ba__handle" style={{ insetInlineStart: `${pos}%` }}>
        <span className="pg-ba__knob" aria-hidden="true" />
      </div>
      <span className="pg-ba__label pg-ba__label--before">{beforeLabel}</span>
      <span className="pg-ba__label pg-ba__label--after">{afterLabel}</span>
    </div>
  );
}

import { useEffect, useRef } from "react";

type Flake = {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  alpha: number;
  phase: number;
};

/**
 * Extra outdoor snowfall over the window panes. Complements the baked 5s loop
 * so flakes stay crisp even after video compression.
 */
export function ChristmasClubSnow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let flakes: Flake[] = [];
    let w = 0;
    let h = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(260, Math.max(90, (w * h) / 14000)));
      flakes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.7 + Math.random() * 2.4,
        speed: 0.35 + Math.random() * 0.85,
        drift: (Math.random() - 0.5) * 0.35,
        alpha: 0.35 + Math.random() * 0.55,
        phase: i * 0.37,
      }));
    };

    /** Soft window-pane gate in normalized screen space (object-fit cover approx). */
    const inWindow = (x: number, y: number) => {
      const nx = x / w;
      const ny = y / h;
      if (nx < 0.06 || nx > 0.66 || ny < 0.02 || ny > 0.56) return 0;
      // Soften over sofa / tree intrusion
      if (ny > 0.48 && nx < 0.36) return 0.15;
      if (nx > 0.56 && ny > 0.12) return 0.35;
      return 1;
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const flake of flakes) {
        flake.y += flake.speed;
        flake.x += flake.drift + Math.sin(flake.y * 0.01 + flake.phase) * 0.15;
        if (flake.y > h + 4) {
          flake.y = -4;
          flake.x = Math.random() * w;
        }
        if (flake.x < -4) flake.x = w + 4;
        if (flake.x > w + 4) flake.x = -4;

        const gate = inWindow(flake.x, flake.y);
        if (gate < 0.08) continue;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${flake.alpha * gate})`;
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas className="cc-scene__snow" ref={canvasRef} aria-hidden="true" />;
}

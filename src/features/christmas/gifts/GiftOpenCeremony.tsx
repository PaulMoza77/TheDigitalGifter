import type { CSSProperties } from "react";

type Props = {
  open: boolean;
  reduceMotion?: boolean;
  /** Generated MP4 of a gift opening (falls back to CSS ceremony). */
  clipSrc?: string;
};

/**
 * Cute gift-opening ceremony shown while a present is being opened.
 * Prefers a short generated clip; otherwise a CSS 3D unwrap.
 */
export function GiftOpenCeremony({ open, reduceMotion, clipSrc }: Props) {
  if (!open) return null;

  const panel: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    display: "grid",
    placeItems: "center",
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 50% 48%, rgba(255,210,120,0.22), rgba(5,4,3,0.55) 55%, rgba(5,4,3,0.72) 100%)",
    animation: reduceMotion ? undefined : "gt-open-veil 220ms ease-out forwards",
  };

  return (
    <div style={panel} aria-hidden>
      {clipSrc && !reduceMotion ? (
        <video
          className="gt-open-clip"
          src={clipSrc}
          autoPlay
          muted
          playsInline
          style={{
            width: "min(420px, 72vw)",
            height: "min(420px, 72vw)",
            objectFit: "cover",
            borderRadius: 24,
            boxShadow:
              "0 0 0 1px rgba(255,230,170,0.25), 0 24px 80px rgba(0,0,0,0.55), 0 0 60px rgba(255,190,90,0.35)",
          }}
        />
      ) : (
        <div className={`gt-open-stage ${reduceMotion ? "gt-open-static" : ""}`}>
          <div className="gt-open-glow" />
          <div className="gt-open-box">
            <div className="gt-open-lid">
              <span className="gt-open-bow" />
            </div>
            <div className="gt-open-body">
              <span className="gt-open-ribbon-v" />
              <span className="gt-open-ribbon-h" />
              <span className="gt-open-spark" />
            </div>
          </div>
          <p className="gt-open-caption">Opening your gift…</p>
        </div>
      )}

      <style>{`
        @keyframes gt-open-veil {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .gt-open-stage {
          position: relative;
          width: min(280px, 70vw);
          height: min(300px, 74vw);
          display: grid;
          place-items: center;
          animation: gt-open-pop 520ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .gt-open-static { animation: none; }
        @keyframes gt-open-pop {
          from { transform: translateY(18px) scale(0.86); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .gt-open-glow {
          position: absolute;
          inset: 8% 4% 18%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,220,140,0.55), transparent 68%);
          filter: blur(8px);
          animation: gt-open-pulse 1.1s ease-in-out infinite;
        }
        @keyframes gt-open-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        .gt-open-box {
          position: relative;
          width: 148px;
          height: 148px;
          transform-style: preserve-3d;
          perspective: 700px;
        }
        .gt-open-body {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 78%;
          border-radius: 14px;
          background: linear-gradient(160deg, #9a2430 0%, #6b1520 55%, #3e0d14 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 18px 36px rgba(0,0,0,0.45);
          overflow: hidden;
        }
        .gt-open-lid {
          position: absolute;
          left: -4%; right: -4%;
          top: 0;
          height: 34%;
          border-radius: 14px 14px 6px 6px;
          background: linear-gradient(180deg, #b8323c, #7a1c26);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 16px rgba(0,0,0,0.35);
          transform-origin: top center;
          animation: gt-open-lid 900ms cubic-bezier(0.22,1,0.36,1) 120ms both;
          z-index: 2;
        }
        @keyframes gt-open-lid {
          0% { transform: rotateX(0deg) translateY(0); }
          100% { transform: rotateX(-72deg) translateY(-8px); }
        }
        .gt-open-bow {
          position: absolute;
          left: 50%; top: 42%;
          width: 34px; height: 18px;
          transform: translate(-50%, -50%);
          background: #e0c078;
          border-radius: 50%;
          box-shadow: -16px 0 0 #e0c078, 16px 0 0 #e0c078, 0 2px 6px rgba(0,0,0,0.35);
        }
        .gt-open-ribbon-v {
          position: absolute;
          top: 0; bottom: 0; left: 42%;
          width: 16%;
          background: linear-gradient(90deg, transparent, #e0c078 30%, #e0c078 70%, transparent);
        }
        .gt-open-ribbon-h {
          position: absolute;
          left: 0; right: 0; top: 38%;
          height: 14%;
          background: linear-gradient(180deg, transparent, #e0c078 28%, #e0c078 72%, transparent);
        }
        .gt-open-spark {
          position: absolute;
          left: 50%; top: 18%;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: #fff6d0;
          box-shadow:
            0 0 20px 8px rgba(255,220,140,0.85),
            -28px 18px 0 0 #ffe7a8,
            30px 22px 0 -2px #ffd27a,
            4px 40px 0 -1px #fff1c2,
            -18px 48px 0 -3px #ffc86a;
          transform: translateX(-50%) scale(0.2);
          opacity: 0;
          animation: gt-open-spark 900ms ease-out 280ms both;
        }
        @keyframes gt-open-spark {
          0% { opacity: 0; transform: translateX(-50%) scale(0.2); }
          40% { opacity: 1; transform: translateX(-50%) scale(1.15); }
          100% { opacity: 0.85; transform: translateX(-50%) translateY(-28px) scale(1); }
        }
        .gt-open-caption {
          margin-top: 18px;
          font-size: 13px;
          letter-spacing: 0.04em;
          color: rgba(255,236,200,0.88);
          text-shadow: 0 2px 10px rgba(0,0,0,0.45);
        }
        .gt-open-static .gt-open-lid { animation: none; transform: rotateX(-55deg); }
        .gt-open-static .gt-open-spark { animation: none; opacity: 0.8; transform: translateX(-50%) translateY(-18px) scale(1); }
        .gt-open-static .gt-open-glow { animation: none; }
        @media (prefers-reduced-motion: reduce) {
          .gt-open-lid, .gt-open-spark, .gt-open-glow, .gt-open-stage { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

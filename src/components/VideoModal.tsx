import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

type VideoModalProps = {
  src: string;
  title?: string;
  onClose: () => void;
};

export default function VideoModal({ src, title, onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Try to autoplay when modal opens; catch any promise rejection
    v.muted = false;
    v.play().catch(() => {
      // autoplay may be blocked; that's fine — user can press play
    });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  //   const handleFullscreen = () => {
  //     const el = videoRef.current as any;
  //     if (!el) return;
  //     if (el.requestFullscreen) el.requestFullscreen();
  //     else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  //   };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center justify-center max-w-[95vw] max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - always visible at top right */}
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -top-12 right-0 z-50 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-2.5 shadow-lg transition-colors border border-white/20"
        >
          <X size={20} />
        </button>

        {/* Video container with proper aspect ratio handling */}
        <div className="bg-black rounded-lg overflow-hidden shadow-2xl max-w-full max-h-full">
          {title && (
            <div className="px-4 py-3 border-b border-white/10 text-white font-semibold bg-black/50 backdrop-blur-sm">
              {title}
            </div>
          )}
          <video
            ref={videoRef}
            src={src}
            controls
            className="max-w-[90vw] max-h-[85vh] w-auto h-auto bg-black"
            playsInline
          />
        </div>
      </div>
    </div>
  );
}

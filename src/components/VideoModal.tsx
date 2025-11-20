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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-4xl">
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -top-4 -right-4 bg-[#111827] text-white rounded-full p-2 shadow-lg"
        >
          <X size={18} />
        </button>

        <div className="bg-black rounded-lg overflow-hidden">
          {title && (
            <div className="px-4 py-3 border-b border-white/10 text-white font-semibold">
              {title}
            </div>
          )}
          <video
            ref={videoRef}
            src={src}
            controls
            className="w-full h-auto bg-black"
            playsInline
          />
          {/* <div className="flex items-center justify-end gap-2 p-3">
            <button
              onClick={handleFullscreen}
              className="px-3 py-1 rounded-md bg-white/10 text-white text-sm"
            >
              Fullscreen
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
}

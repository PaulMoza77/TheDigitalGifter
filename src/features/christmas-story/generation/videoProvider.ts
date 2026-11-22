import type { FilmAsset } from "../types";
import type { ImageHandler, VideoProvider } from "./providers";

/** Client-side image normalize — keep processing local when possible. */
export const localImageHandler: ImageHandler = {
  id: "local-canvas-v1",
  async normalize(dataUrl, maxEdge = 1280) {
    if (typeof document === "undefined") return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  },
};

/**
 * Mock film renderer — builds a frame sequence for in-browser cinematic slideshow.
 * Real MP4 export should run async on VPS FFmpeg (not in the web request).
 */
export const mockVideoProvider: VideoProvider = {
  id: "mock-film-v1",
  async render({ frames, title }) {
    const asset: FilmAsset = {
      id: `film_${crypto.randomUUID().slice(0, 8)}`,
      title,
      frames: frames.length
        ? frames.slice(0, 10)
        : [
            {
              src: "",
              caption: "Add photos after checkout for a personal memory film.",
            },
          ],
      videoUrl: null,
      isExample: frames.length === 0,
      status: "ready",
    };
    return asset;
  },
};

export const activeVideoProvider: VideoProvider = mockVideoProvider;

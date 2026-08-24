import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { useCanAutoplayHeroVideo } from "../useMotionPreference";
import {
  Bath,
  Briefcase,
  ChefHat,
  Clapperboard,
  Crown,
  Flag,
  Frame,
  Gift,
  Newspaper,
  Palmtree,
  Rocket,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sceneClipSrc, sceneHasMotionClip, sceneImageSrc } from "../catalog";
import type { PetSceneDefinition, PetSceneId, PetSpecies } from "../types";

const SCENE_ICONS: Record<PetSceneId, LucideIcon> = {
  "royal-portrait": Crown,
  "luxury-ceo": Briefcase,
  astronaut: Rocket,
  "formula-racer": Flag,
  "spa-bathtub": Bath,
  newspaper: Newspaper,
  "cinema-boss": Clapperboard,
  renaissance: Frame,
  "beach-vacation": Palmtree,
  "head-chef": ChefHat,
  "original-superhero": Shield,
  "christmas-portrait": Gift,
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SceneImage({
  sceneId,
  alt,
  className,
  species = "dog",
  eager = false,
  animateOnHover = true,
}: {
  sceneId: PetSceneId;
  alt: string;
  className?: string;
  species?: PetSpecies;
  eager?: boolean;
  animateOnHover?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const poster = sceneImageSrc(sceneId, species);
  const clip = sceneClipSrc(sceneId, species);
  const motionClip = animateOnHover && sceneHasMotionClip(sceneId);

  useEffect(() => {
    setHovered(false);
    setLoaded(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }, [sceneId, species]);

  useEffect(() => {
    if (!hovered || !loaded || !motionClip) return;
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => undefined);
  }, [hovered, loaded, clip, motionClip]);

  function canHover() {
    return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  function start() {
    if (!motionClip || prefersReducedMotion()) return;
    setLoaded(true);
    setHovered(true);
  }

  function stop() {
    setHovered(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }

  function onPointerEnter(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    start();
  }

  function onPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    stop();
  }

  function onClick() {
    if (canHover()) return;
    if (hovered) stop();
    else start();
  }

  if (!motionClip) {
    return (
      <img
        src={poster}
        alt={alt}
        className={className}
        width={720}
        height={1080}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <div
      className={cn("relative cursor-pointer overflow-hidden", className)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onFocus={start}
      onBlur={stop}
    >
      <img
        src={poster}
        alt={alt}
        className="h-full w-full object-cover"
        width={720}
        height={1080}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      <video
        ref={videoRef}
        src={loaded ? clip : undefined}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
          hovered ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />
    </div>
  );
}

/** Muted looping clip that starts on its own — no hover or tap. */
export function AutoSceneClip({
  sceneId,
  alt,
  className,
  species = "dog",
  eager = false,
}: {
  sceneId: PetSceneId;
  alt: string;
  className?: string;
  species?: PetSpecies;
  eager?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { prefersReducedMotion, canAutoplay } = useCanAutoplayHeroVideo();
  const poster = sceneImageSrc(sceneId, species);
  const clip = sceneClipSrc(sceneId, species);
  const allowAutoplay = sceneHasMotionClip(sceneId) && canAutoplay && !prefersReducedMotion;

  useEffect(() => {
    if (!allowAutoplay) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    void video.play().catch(() => undefined);
  }, [allowAutoplay, clip, sceneId, species]);

  if (!allowAutoplay) {
    return (
      <img
        src={poster}
        alt={alt}
        className={className}
        width={720}
        height={1080}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={clip}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload={eager ? "auto" : "metadata"}
      className={className}
      aria-label={alt}
      onCanPlay={(event) => {
        event.currentTarget.muted = true;
        void event.currentTarget.play().catch(() => undefined);
      }}
    />
  );
}

export function SceneCard({
  scene,
  species = "dog",
  overlayTitle,
  eager = false,
}: {
  scene: PetSceneDefinition;
  species?: PetSpecies;
  overlayTitle?: string;
  eager?: boolean;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-[#1a1410]">
      <div className="relative aspect-[3/4] w-full">
        <SceneImage
          sceneId={scene.id}
          species={species}
          alt={`${overlayTitle ?? scene.title} example`}
          eager={eager}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-3 pt-12">
          {overlayTitle && overlayTitle !== scene.title ? (
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">{scene.title}</p>
          ) : null}
          <h3 className="text-sm font-semibold tracking-tight text-white sm:text-base">
            {overlayTitle ?? scene.title}
          </h3>
        </div>
      </div>
    </article>
  );
}

export function sceneIcon(id: PetSceneId): LucideIcon {
  return SCENE_ICONS[id];
}

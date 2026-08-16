import type { LucideIcon } from "lucide-react";
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
import { sceneImageSrc } from "../catalog";
import type { PetSceneDefinition, PetSceneId } from "../types";

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

export function SceneImage({
  sceneId,
  alt,
  className,
  eager = false,
}: {
  sceneId: PetSceneId;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      src={sceneImageSrc(sceneId)}
      alt={alt}
      className={className}
      width={720}
      height={1080}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function SceneCard({
  scene,
  eager = false,
}: {
  scene: PetSceneDefinition;
  eager?: boolean;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-[#1a1410]">
      <div className="relative aspect-[3/4] w-full">
        <SceneImage
          sceneId={scene.id}
          alt={`${scene.title} example`}
          eager={eager}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-3 pt-12">
          <h3 className="text-sm font-semibold tracking-tight text-white sm:text-base">
            {scene.title}
          </h3>
        </div>
      </div>
    </article>
  );
}

export function sceneIcon(id: PetSceneId): LucideIcon {
  return SCENE_ICONS[id];
}

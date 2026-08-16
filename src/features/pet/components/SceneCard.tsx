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
import type { PetSceneDefinition, PetSceneId } from "../types";
import { cn } from "@/lib/utils";

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

export function SceneCard({
  scene,
  featured = false,
}: {
  scene: PetSceneDefinition;
  featured?: boolean;
}) {
  const Icon = SCENE_ICONS[scene.id];

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-[#f6efe4]/10 bg-[#1a1410] shadow-[0_12px_40px_rgba(0,0,0,0.28)]",
        featured ? "col-span-2 sm:row-span-2" : ""
      )}
    >
      <div
        className="relative aspect-[4/5] w-full sm:aspect-[3/4]"
        style={{
          background: `linear-gradient(160deg, ${scene.art.from} 0%, ${scene.art.to} 78%)`,
        }}
      >
        <SceneDecor sceneId={scene.id} accent={scene.art.accent} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_42%)]" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f6efe4]/90 backdrop-blur-sm">
          <span>{String(scene.number).padStart(2, "0")}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pt-16">
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-black/35 text-[#f6efe4] backdrop-blur-sm">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-[#f6efe4]">
            {scene.title}
          </h3>
          <p className="mt-1 text-sm leading-5 text-[#f6efe4]/75">{scene.tagline}</p>
        </div>
      </div>
    </article>
  );
}

function SceneDecor({ sceneId, accent }: { sceneId: PetSceneId; accent: string }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-70"
      viewBox="0 0 300 380"
      aria-hidden="true"
    >
      {sceneId === "royal-portrait" && (
        <>
          <rect x="38" y="48" width="224" height="284" rx="16" fill="none" stroke={accent} strokeWidth="6" />
          <path d="M90 86 L150 58 L210 86 L198 118 H102 Z" fill={accent} opacity="0.85" />
        </>
      )}
      {sceneId === "luxury-ceo" && (
        <>
          <rect x="70" y="210" width="160" height="90" fill={accent} opacity="0.18" />
          <rect x="40" y="160" width="28" height="140" fill={accent} opacity="0.25" />
          <rect x="230" y="120" width="36" height="180" fill={accent} opacity="0.2" />
        </>
      )}
      {sceneId === "astronaut" && (
        <>
          <circle cx="150" cy="150" r="72" fill="none" stroke={accent} strokeWidth="8" />
          <circle cx="64" cy="70" r="4" fill={accent} />
          <circle cx="240" cy="92" r="3" fill={accent} />
          <circle cx="220" cy="40" r="2" fill={accent} />
        </>
      )}
      {sceneId === "formula-racer" && (
        <>
          <path d="M40 300 H260" stroke={accent} strokeWidth="10" strokeDasharray="18 12" />
          <path d="M70 240 L150 120 L230 240 Z" fill="none" stroke={accent} strokeWidth="6" />
        </>
      )}
      {sceneId === "spa-bathtub" && (
        <>
          <ellipse cx="150" cy="230" rx="96" ry="40" fill={accent} opacity="0.25" />
          <circle cx="110" cy="150" r="14" fill={accent} opacity="0.45" />
          <circle cx="170" cy="128" r="10" fill={accent} opacity="0.4" />
          <circle cx="200" cy="168" r="8" fill={accent} opacity="0.35" />
        </>
      )}
      {sceneId === "newspaper" && (
        <>
          <rect x="70" y="80" width="160" height="210" fill={accent} opacity="0.16" />
          <rect x="86" y="104" width="128" height="12" fill={accent} opacity="0.5" />
          <rect x="86" y="130" width="128" height="6" fill={accent} opacity="0.35" />
          <rect x="86" y="148" width="90" height="6" fill={accent} opacity="0.3" />
        </>
      )}
      {sceneId === "cinema-boss" && (
        <>
          <rect x="90" y="180" width="120" height="80" rx="8" fill={accent} opacity="0.2" />
          <path d="M70 180 Q150 110 230 180" fill="none" stroke={accent} strokeWidth="5" />
        </>
      )}
      {sceneId === "renaissance" && (
        <>
          <rect x="50" y="60" width="200" height="250" rx="8" fill="none" stroke={accent} strokeWidth="10" />
          <rect x="68" y="78" width="164" height="214" fill="none" stroke={accent} strokeWidth="2" opacity="0.5" />
        </>
      )}
      {sceneId === "beach-vacation" && (
        <>
          <circle cx="220" cy="80" r="28" fill={accent} opacity="0.8" />
          <path d="M20 250 Q150 200 280 250 L280 340 L20 340 Z" fill={accent} opacity="0.18" />
        </>
      )}
      {sceneId === "head-chef" && (
        <>
          <rect x="120" y="70" width="60" height="36" rx="10" fill={accent} opacity="0.7" />
          <rect x="108" y="102" width="84" height="18" rx="8" fill={accent} opacity="0.55" />
          <circle cx="150" cy="230" r="54" fill="none" stroke={accent} strokeWidth="6" />
        </>
      )}
      {sceneId === "original-superhero" && (
        <>
          <path d="M150 70 L186 160 H114 Z" fill={accent} opacity="0.8" />
          <path d="M90 210 Q150 250 210 210 L210 300 L90 300 Z" fill={accent} opacity="0.2" />
        </>
      )}
      {sceneId === "christmas-portrait" && (
        <>
          <circle cx="150" cy="150" r="70" fill="none" stroke={accent} strokeWidth="14" />
          <rect x="142" y="70" width="16" height="22" fill={accent} />
        </>
      )}
    </svg>
  );
}

export function sceneIcon(id: PetSceneId): LucideIcon {
  return SCENE_ICONS[id];
}

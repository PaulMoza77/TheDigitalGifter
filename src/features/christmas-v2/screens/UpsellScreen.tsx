import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CHRISTMAS_PACKS,
  CHRISTMAS_UPSELL_SCENES,
  pickSurpriseScenes,
  type ChristmasSceneKey,
} from "../config";
import type { ChristmasSceneResult } from "../api";
import { cn } from "@/lib/utils";

export function ChristmasUpsellScreen({
  starterScenes,
  busyPack,
  onCheckout,
}: {
  starterScenes: ChristmasSceneResult[];
  busyPack?: "magic" | "ultimate" | null;
  onCheckout: (input: {
    packKey: "magic" | "ultimate";
    sceneKeys: ChristmasSceneKey[];
    videoSourceSceneKeys: ChristmasSceneKey[];
    surpriseMe: boolean;
  }) => void;
}) {
  const [surpriseMe, setSurpriseMe] = useState(true);
  const [selected, setSelected] = useState<ChristmasSceneKey[]>([]);
  const [videoSources, setVideoSources] = useState<ChristmasSceneKey[]>(() => {
    const first = starterScenes.find((s) => s.sceneKey)?.sceneKey as ChristmasSceneKey | undefined;
    return first ? [first] : [];
  });

  const previewSelection = useMemo(() => {
    if (surpriseMe) return pickSurpriseScenes(12);
    return selected;
  }, [surpriseMe, selected]);

  function toggleScene(key: ChristmasSceneKey) {
    setSurpriseMe(false);
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key].slice(0, 12),
    );
  }

  function toggleVideoSource(key: ChristmasSceneKey) {
    setVideoSources((current) => {
      if (current.includes(key)) return current.filter((k) => k !== key);
      return [...current, key].slice(0, 2);
    });
  }

  function start(packKey: "magic" | "ultimate") {
    const need = CHRISTMAS_PACKS[packKey].imageCount;
    const scenes = surpriseMe
      ? pickSurpriseScenes(need)
      : (selected.length >= need ? selected.slice(0, need) : [...selected, ...pickSurpriseScenes(need, selected)].slice(0, need));
    const videosNeeded = CHRISTMAS_PACKS[packKey].videoCount;
    const videoKeys =
      videoSources.length >= videosNeeded
        ? videoSources.slice(0, videosNeeded)
        : [
            ...videoSources,
            ...(starterScenes.map((s) => s.sceneKey as ChristmasSceneKey).filter((k) => !videoSources.includes(k)) ||
              []),
          ].slice(0, videosNeeded);
    onCheckout({
      packKey,
      sceneKeys: scenes,
      videoSourceSceneKeys: videoKeys,
      surpriseMe,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="cv2-display text-3xl font-semibold text-[#F7F0E4] sm:text-4xl">
          Love your Christmas photos?
        </h1>
        <p className="mt-2 text-base text-[#F7F0E4]/75">Try these Christmas scenarios too</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setSurpriseMe(true)}
          className={cn(
            "rounded-full",
            surpriseMe ? "bg-[#C9A227] text-[#3b0610] hover:bg-[#dbb84a]" : "bg-[#F7F0E4]/10 text-[#F7F0E4]",
          )}
        >
          Surprise Me ✨
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSurpriseMe(false)}
          className={cn(
            "rounded-full",
            !surpriseMe ? "bg-[#F7F0E4]/15 text-[#F7F0E4]" : "text-[#F7F0E4]/65",
          )}
        >
          Choose scenarios
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CHRISTMAS_UPSELL_SCENES.slice(0, 12).map((scene) => {
          const active = surpriseMe || selected.includes(scene.key);
          return (
            <button
              key={scene.key}
              type="button"
              onClick={() => toggleScene(scene.key)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition",
                active
                  ? "border-[#C9A227] bg-[#C9A227]/15 text-[#F7F0E4]"
                  : "border-[#F7F0E4]/12 bg-[#F7F0E4]/05 text-[#F7F0E4]/75",
              )}
            >
              <p className="text-sm font-semibold">{scene.label}</p>
              <p className="mt-0.5 text-[11px] opacity-70">{scene.category}</p>
            </button>
          );
        })}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#F7F0E4]">Choose a photo to bring to life</h2>
        <div className="flex flex-wrap gap-2">
          {starterScenes
            .filter((s) => s.imageUrl)
            .map((scene) => {
              const key = scene.sceneKey as ChristmasSceneKey;
              const active = videoSources.includes(key);
              return (
                <button
                  key={scene.sceneKey}
                  type="button"
                  onClick={() => toggleVideoSource(key)}
                  className={cn(
                    "overflow-hidden rounded-xl border-2",
                    active ? "border-[#C9A227]" : "border-transparent opacity-80",
                  )}
                >
                  <img src={scene.imageUrl || ""} alt={scene.title} className="h-20 w-16 object-cover" />
                </button>
              );
            })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[1.4rem] border border-[#F7F0E4]/15 bg-[#F7F0E4]/08 p-4">
          <p className="text-sm font-medium text-[#F7F0E4]/70">{CHRISTMAS_PACKS.magic.name}</p>
          <p className="cv2-display mt-1 text-3xl font-semibold text-[#F7F0E4]">
            {CHRISTMAS_PACKS.magic.priceDisplay}
          </p>
          <p className="mt-1 text-sm text-[#F7F0E4]/65">{CHRISTMAS_PACKS.magic.description}</p>
          <Button
            type="button"
            disabled={busyPack != null}
            onClick={() => start("magic")}
            className="mt-4 h-11 w-full rounded-full bg-[#1B4332] text-[#F7F0E4] hover:bg-[#245C41]"
          >
            {busyPack === "magic" ? "Starting checkout…" : CHRISTMAS_PACKS.magic.cta}
          </Button>
        </article>

        <article className="relative rounded-[1.4rem] border border-[#C9A227]/50 bg-[#F7F0E4] p-4 text-[#3b0610]">
          <span className="absolute -top-2 right-4 rounded-full bg-[#C9A227] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#3b0610]">
            BEST VALUE
          </span>
          <p className="text-sm font-medium text-[#5c0a14]/70">{CHRISTMAS_PACKS.ultimate.name}</p>
          <p className="cv2-display mt-1 text-3xl font-semibold">{CHRISTMAS_PACKS.ultimate.priceDisplay}</p>
          <p className="mt-1 text-sm text-[#5c0a14]/65">{CHRISTMAS_PACKS.ultimate.description}</p>
          <Button
            type="button"
            disabled={busyPack != null}
            onClick={() => start("ultimate")}
            className="mt-4 h-11 w-full rounded-full bg-[#1B4332] text-[#F7F0E4] hover:bg-[#245C41]"
          >
            {busyPack === "ultimate" ? "Starting checkout…" : CHRISTMAS_PACKS.ultimate.cta}
          </Button>
        </article>
      </div>

      <p className="text-xs text-[#F7F0E4]/40">
        Selected for this pack: {previewSelection.length} scenarios
        {surpriseMe ? " (Surprise Me)" : ""}
      </p>
    </div>
  );
}

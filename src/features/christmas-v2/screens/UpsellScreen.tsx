import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CHRISTMAS_PACKS,
  CHRISTMAS_UPSELL_SCENES,
  pickSurpriseScenes,
  type ChristmasPackKey,
  type ChristmasSceneKey,
} from "../config";
import type { ChristmasSceneResult } from "../api";
import { cn } from "@/lib/utils";

/** Post-purchase optional upgrades only — never mixed with pre-purchase pack picker. */
export function availableUpsellPacks(
  purchasedPack: ChristmasPackKey,
): Array<"magic" | "ultimate"> {
  if (purchasedPack === "starter") return ["magic", "ultimate"];
  if (purchasedPack === "magic") return ["ultimate"];
  return [];
}

export function ChristmasUpsellScreen({
  purchasedPackKey = "starter",
  starterScenes,
  busyPack,
  onCheckout,
  onSkip,
}: {
  purchasedPackKey?: ChristmasPackKey;
  starterScenes: ChristmasSceneResult[];
  busyPack?: "magic" | "ultimate" | null;
  onCheckout: (input: {
    packKey: "magic" | "ultimate";
    sceneKeys: ChristmasSceneKey[];
    videoSourceSceneKeys: ChristmasSceneKey[];
    surpriseMe: boolean;
  }) => void;
  onSkip?: () => void;
}) {
  const upsellPacks = availableUpsellPacks(purchasedPackKey);
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
      return [...current, key].slice(0, 3);
    });
  }

  function start(packKey: "magic" | "ultimate") {
    const need = CHRISTMAS_PACKS[packKey].imageCount;
    const scenes = surpriseMe
      ? pickSurpriseScenes(need)
      : (selected.length >= need
          ? selected.slice(0, need)
          : [...selected, ...pickSurpriseScenes(need, selected)].slice(0, need));
    const videosNeeded = CHRISTMAS_PACKS[packKey].videoCount;
    const fromStarter = starterScenes
      .map((s) => s.sceneKey as ChristmasSceneKey)
      .filter((k) => !videoSources.includes(k));
    const videoKeys =
      videoSources.length >= videosNeeded
        ? videoSources.slice(0, videosNeeded)
        : [...videoSources, ...fromStarter].slice(0, videosNeeded);
    onCheckout({
      packKey,
      sceneKeys: scenes,
      videoSourceSceneKeys: videoKeys,
      surpriseMe,
    });
  }

  if (upsellPacks.length === 0) {
    return (
      <div className="space-y-4 rounded-[1.4rem] border border-[#F7F0E4]/12 bg-[#F7F0E4]/06 p-5" data-testid="cv2-upsell-none">
        <h2 className="cv2-display text-2xl font-semibold text-[#F7F0E4]">You already have the largest pack</h2>
        <p className="text-sm text-[#F7F0E4]/70">
          No additional Christmas pack upgrades are available for this order. Download your portraits
          above anytime.
        </p>
        {onSkip ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 text-[#F7F0E4]/80"
            onClick={onSkip}
          >
            Back to my portraits
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cv2-upsell">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A227]">
          Optional upgrade
        </p>
        <h1 className="cv2-display mt-1 text-3xl font-semibold text-[#F7F0E4] sm:text-4xl">
          Add more Christmas scenes?
        </h1>
        <p className="mt-2 text-base text-[#F7F0E4]/75">
          Separate one-time purchase — not included in your current pack, and not a subscription.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setSurpriseMe(true)}
          className={cn(
            "min-h-11 rounded-full",
            surpriseMe
              ? "bg-[#C9A227] text-[#3b0610] hover:bg-[#dbb84a]"
              : "bg-[#F7F0E4]/10 text-[#F7F0E4]",
          )}
        >
          Surprise Me
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setSurpriseMe(false)}
          className={cn(
            "min-h-11 rounded-full",
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
                "min-h-11 rounded-xl border px-3 py-3 text-left transition",
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
        <h2 className="text-sm font-semibold text-[#F7F0E4]">
          Choose a finished photo to animate (for packs with video)
        </h2>
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
                  aria-pressed={active}
                  aria-label={`Use ${scene.title} for video`}
                  className={cn(
                    "min-h-11 overflow-hidden rounded-xl border-2",
                    active ? "border-[#C9A227]" : "border-transparent opacity-80",
                  )}
                >
                  <img
                    src={scene.imageUrl || ""}
                    alt=""
                    className="h-20 w-16 object-cover"
                  />
                </button>
              );
            })}
        </div>
      </section>

      <div className={cn("grid gap-3", upsellPacks.length > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
        {upsellPacks.map((key) => {
          const pack = CHRISTMAS_PACKS[key];
          const highlight = key === "ultimate";
          return (
            <article
              key={key}
              data-testid={`cv2-upsell-pack-${key}`}
              className={cn(
                "relative rounded-[1.4rem] border p-4",
                highlight
                  ? "border-[#C9A227]/50 bg-[#F7F0E4] text-[#3b0610]"
                  : "border-[#F7F0E4]/15 bg-[#F7F0E4]/08 text-[#F7F0E4]",
              )}
            >
              {pack.badge ? (
                <span className="absolute -top-2 right-4 rounded-full bg-[#C9A227] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#3b0610]">
                  {pack.badge}
                </span>
              ) : null}
              <p
                className={cn(
                  "text-sm font-medium",
                  highlight ? "text-[#5c0a14]/70" : "text-[#F7F0E4]/70",
                )}
              >
                {pack.name}
              </p>
              <p className="cv2-display mt-1 text-3xl font-semibold">{pack.priceDisplay}</p>
              <p className={cn("mt-1 text-sm", highlight ? "text-[#5c0a14]/65" : "text-[#F7F0E4]/65")}>
                {pack.description}
              </p>
              <Button
                type="button"
                disabled={busyPack != null}
                onClick={() => start(key)}
                className="mt-4 h-11 w-full rounded-full bg-[#1B4332] text-[#F7F0E4] hover:bg-[#245C41]"
              >
                {busyPack === key ? "Starting checkout…" : pack.cta}
              </Button>
            </article>
          );
        })}
      </div>

      {onSkip ? (
        <button
          type="button"
          className="mx-auto block min-h-11 text-sm text-[#F7F0E4]/55 underline-offset-2 hover:underline"
          onClick={onSkip}
        >
          No thanks — keep my current portraits
        </button>
      ) : null}

      <p className="text-xs text-[#F7F0E4]/40">
        Selected for this upgrade: {previewSelection.length} scenarios
        {surpriseMe ? " (Surprise Me)" : ""}
      </p>
    </div>
  );
}

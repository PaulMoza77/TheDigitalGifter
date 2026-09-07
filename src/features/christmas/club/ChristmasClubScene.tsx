import { ChristmasSnowfall } from "@/features/christmas-v2/ChristmasSnowfall";
import { CHRISTMAS_CLUB_ASSETS } from "./config";

export function ChristmasClubScene() {
  return (
    <div className="cc-scene" aria-hidden="true">
      <img
        className="cc-scene__photo cc-scene__photo--mobile"
        src={CHRISTMAS_CLUB_ASSETS.tree}
        alt=""
        width={768}
        height={1024}
        decoding="async"
        fetchPriority="high"
      />
      <img
        className="cc-scene__photo cc-scene__photo--desktop"
        src={CHRISTMAS_CLUB_ASSETS.hero}
        alt=""
        width={1376}
        height={768}
        decoding="async"
        fetchPriority="high"
      />
      <div className="cc-scene__veil" />
      <div className="cc-scene__glow" />
      <div className="cc-scene__twinkle" />
      <ChristmasSnowfall />
    </div>
  );
}

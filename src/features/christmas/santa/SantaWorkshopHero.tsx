import { memo } from "react";
import { LANDING_ASSETS } from "../landing/assets";
import { SantaPresence } from "../landing/SantaPresence";

/**
 * Immersive Santa workshop stage: cinematic room + transparent Santa + live caption.
 * Presentation only — no generation.
 */
export const SantaWorkshopHero = memo(function SantaWorkshopHero({
  childName,
  caption,
  compact = false,
}: {
  childName?: string;
  caption: string;
  compact?: boolean;
}) {
  const alt = childName
    ? `Santa preparing a Christmas message for ${childName}`
    : "Santa in his Christmas workshop";

  return (
    <div
      className={`sv-hero${compact ? " sv-hero--compact" : ""}`}
      role="img"
      aria-label={alt}
    >
      <div
        className="sv-hero__room"
        style={{ backgroundImage: `url(${LANDING_ASSETS.hero})` }}
      />
      <div className="sv-hero__veil" aria-hidden="true" />
      <div className="sv-hero__glow" aria-hidden="true" />
      <div className="sv-hero__twinkle" aria-hidden="true" />

      <div className="sv-hero__stage">
        <SantaPresence alt={alt} acknowledge={Boolean(childName)} />
      </div>

      <div className="sv-hero__letter" aria-live="polite">
        <p className="sv-hero__letter-text">{caption}</p>
      </div>

      {childName ? (
        <p className="sv-hero__for">Prepared for {childName}</p>
      ) : null}
    </div>
  );
});

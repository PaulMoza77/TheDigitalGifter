import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CHRISTMAS_CLUB_COUNTDOWN_PRODUCTS,
  type ChristmasClubConfig,
  type ChristmasClubCountdownUnit,
} from "./config";
import {
  padCountdownValue,
  remainingUntilChristmas,
  type ChristmasCountdownParts,
} from "./countdown";

const UNITS: Array<{ key: ChristmasClubCountdownUnit; label: string }> = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

export function productForCountdownUnit(unit: ChristmasClubCountdownUnit) {
  return CHRISTMAS_CLUB_COUNTDOWN_PRODUCTS.find((product) => product.unit === unit) ?? null;
}

export function ChristmasCountdown({
  config,
  compact = false,
}: {
  config: ChristmasClubConfig;
  compact?: boolean;
}) {
  const [parts, setParts] = useState<ChristmasCountdownParts>(() =>
    remainingUntilChristmas(new Date(), config),
  );

  useEffect(() => {
    const tick = () => setParts(remainingUntilChristmas(new Date(), config));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [config]);

  if (parts.expired) {
    return (
      <div className="cc-arrived" role="status">
        <h2>Merry Christmas ✨</h2>
        <p>Your Christmas surprise is ready.</p>
      </div>
    );
  }

  return (
    <div
      className="cc-countdown"
      role="timer"
      aria-live="polite"
      aria-label={`${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds until Christmas`}
      data-compact={compact ? "true" : "false"}
    >
      {UNITS.map((unit) => {
        const product = productForCountdownUnit(unit.key);
        const digit = (
          <>
            <span className="cc-digit">{padCountdownValue(parts[unit.key])}</span>
            <span className="cc-label">{unit.label}</span>
            {product && !compact ? <span className="cc-product-name">{product.name}</span> : null}
          </>
        );

        if (compact || !product) {
          return (
            <div className="cc-unit" key={unit.key}>
              {digit}
            </div>
          );
        }

        return (
          <Link
            className="cc-unit cc-unit--product"
            key={unit.key}
            to={product.href}
            aria-label={`${padCountdownValue(parts[unit.key])} ${unit.label} · ${product.name}`}
          >
            <span className="cc-print">
              <img src={product.image} alt="" width={480} height={600} loading="lazy" />
            </span>
            {digit}
          </Link>
        );
      })}
    </div>
  );
}

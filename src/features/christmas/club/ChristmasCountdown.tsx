import { useEffect, useState } from "react";
import {
  padCountdownValue,
  remainingUntilChristmas,
  type ChristmasCountdownParts,
} from "./countdown";
import type { ChristmasClubConfig } from "./config";

const UNITS: Array<{ key: keyof Pick<ChristmasCountdownParts, "days" | "hours" | "minutes" | "seconds">; label: string }> = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

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
      {UNITS.map((unit) => (
        <div className="cc-unit" key={unit.key}>
          <span className="cc-digit">{padCountdownValue(parts[unit.key])}</span>
          <span className="cc-label">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}

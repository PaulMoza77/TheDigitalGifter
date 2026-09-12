import { useEffect, useState } from "react";
import {
  padCountdownValue,
  remainingUntilChristmas,
  type ChristmasCountdownParts,
} from "./countdown";
import { landingT, type ChristmasLandingLocale } from "./copy";

const UNITS = [
  { key: "days" as const, labelKey: "hero.countdown.days" },
  { key: "hours" as const, labelKey: "hero.countdown.hours" },
  { key: "minutes" as const, labelKey: "hero.countdown.minutes" },
  { key: "seconds" as const, labelKey: "hero.countdown.seconds" },
];

export function HeroCountdown({ locale }: { locale: ChristmasLandingLocale }) {
  const t = (key: string) => landingT(key, locale);
  const [parts, setParts] = useState<ChristmasCountdownParts>(() => remainingUntilChristmas());

  useEffect(() => {
    const tick = () => setParts(remainingUntilChristmas());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (parts.expired) {
    return (
      <p className="xmas-countdown xmas-countdown--arrived" role="status">
        {t("hero.countdown.arrived")}
      </p>
    );
  }

  const digits = UNITS.map((unit) => padCountdownValue(parts[unit.key])).join(" : ");
  const labels = UNITS.map((unit) => t(unit.labelKey)).join(" · ");
  const aria = `${parts.days} ${t("hero.countdown.days")}, ${parts.hours} ${t("hero.countdown.hours")}, ${parts.minutes} ${t("hero.countdown.minutes")}, ${parts.seconds} ${t("hero.countdown.seconds")} ${t("hero.countdown.until")}`;

  return (
    <div className="xmas-countdown" role="timer" aria-live="polite" aria-label={aria}>
      <p className="xmas-countdown__eyebrow">{t("hero.countdown.eyebrow")}</p>
      <p className="xmas-countdown__digits" aria-hidden="true">
        {digits}
      </p>
      <p className="xmas-countdown__labels" aria-hidden="true">
        {labels}
      </p>
    </div>
  );
}

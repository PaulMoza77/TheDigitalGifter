import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CHRISTMAS_CLUB_COUNTDOWN_PRODUCTS,
  type ChristmasClubConfig,
  type ChristmasClubCountdownUnit,
} from "./config";
import { clubT, type ClubLocale } from "./copy";
import {
  padCountdownValue,
  remainingUntilChristmas,
  type ChristmasCountdownParts,
} from "./countdown";

const UNIT_KEYS: Array<{ key: ChristmasClubCountdownUnit; labelKey: string }> = [
  { key: "days", labelKey: "countdown.days" },
  { key: "hours", labelKey: "countdown.hours" },
  { key: "minutes", labelKey: "countdown.minutes" },
  { key: "seconds", labelKey: "countdown.seconds" },
];

export function productForCountdownUnit(unit: ChristmasClubCountdownUnit) {
  return CHRISTMAS_CLUB_COUNTDOWN_PRODUCTS.find((product) => product.unit === unit) ?? null;
}

export function ChristmasCountdown({
  config,
  compact = false,
  locale = "en",
}: {
  config: ChristmasClubConfig;
  compact?: boolean;
  locale?: ClubLocale;
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
        <h2>{clubT("countdown.merry", locale)}</h2>
        <p>{clubT("countdown.ready", locale)}</p>
      </div>
    );
  }

  return (
    <div
      className="cc-countdown"
      role="timer"
      aria-live="polite"
      aria-label={clubT("countdown.aria", locale, {
        days: String(parts.days),
        hours: String(parts.hours),
        minutes: String(parts.minutes),
        seconds: String(parts.seconds),
      })}
      data-compact={compact ? "true" : "false"}
    >
      {UNIT_KEYS.map((unit) => {
        const product = productForCountdownUnit(unit.key);
        const label = clubT(unit.labelKey, locale);
        const digit = (
          <>
            <span className="cc-digit">{padCountdownValue(parts[unit.key])}</span>
            <span className="cc-label">{label}</span>
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
            aria-label={clubT("countdown.unitAria", locale, {
              value: padCountdownValue(parts[unit.key]),
              label,
              product: product.name,
            })}
          >
            <span className="cc-print">
              <img
                src={product.image}
                srcSet={product.imageSrcSet}
                sizes="(max-width: 959px) 22vw, 7.5rem"
                alt=""
                width={480}
                height={720}
                loading="eager"
                decoding="async"
                fetchPriority="low"
              />
            </span>
            {digit}
          </Link>
        );
      })}
    </div>
  );
}

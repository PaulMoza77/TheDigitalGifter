import { memo, useMemo } from "react";
import { doorVariantForDay } from "./assets";
import type { AdventDoorState } from "../tree/treeLogic";
import { adventT, type AdventLocale } from "./copy";

type Props = {
  day: number;
  state: AdventDoorState;
  opening: boolean;
  openedVisually: boolean;
  locale: AdventLocale;
  onSelect: (day: number) => void;
};

function decoKind(variant: string): "wreath" | "bow" | "star" | "tree" | null {
  if (variant.includes("wreath")) return "wreath";
  if (variant.includes("bow")) return "bow";
  if (variant.includes("star")) return "star";
  if (variant.includes("tree")) return "tree";
  return null;
}

export const AdventDoor = memo(function AdventDoor({
  day,
  state,
  opening,
  openedVisually,
  locale,
  onSelect,
}: Props) {
  const variant = doorVariantForDay(day);
  const deco = decoKind(variant);
  const isToday = state === "available";
  const isOpened = state === "claimed" || openedVisually;
  const isLocked = state === "future" || state === "preseason" || state === "ended";

  const aria = useMemo(() => {
    if (isOpened) return adventT("door.aria.opened", locale, { day });
    if (isToday) return adventT("door.aria.today", locale, { day });
    if (state === "openable") return adventT("door.aria.openable", locale, { day });
    if (isLocked) return adventT("door.aria.locked", locale, { day });
    return adventT("door.aria", locale, { day });
  }, [day, isLocked, isOpened, isToday, locale, state]);

  return (
    <li>
      <button
        type="button"
        className={[
          "advent-door",
          isToday ? "is-today" : "",
          isOpened ? "is-opened" : "",
          opening ? "is-opening" : "",
          isLocked ? "is-locked" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-variant={variant}
        data-state={state}
        aria-label={aria}
        onClick={() => onSelect(day)}
      >
        <span className="advent-door__inner" aria-hidden="true" />
        <span className="advent-door__panel">
          <span className="advent-door__face advent-door__face--front">
            {deco ? <span className={`advent-door__deco advent-door__deco--${deco}`} aria-hidden="true" /> : null}
            <span className="advent-door__number">{day}</span>
            <span className="advent-door__check" aria-hidden="true" />
          </span>
        </span>
      </button>
    </li>
  );
});

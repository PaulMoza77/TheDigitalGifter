import { GIFT_TREE_REWARD_CATALOG, type GiftTreeRewardDef } from "./rewardCatalog";

type Props = {
  className?: string;
  compact?: boolean;
  side?: "left" | "right" | "all";
  limit?: number;
  onSeeAll?: () => void;
};

const PREVIEW_IDS = [
  "credits_25",
  "free_image",
  "christmas_portrait",
  "santa_discount_15",
  "credits_50",
  "pet_portrait",
] as const;

function rarityTone(rarity: GiftTreeRewardDef["rarity"]): string {
  switch (rarity) {
    case "rare":
      return "text-amber-300/85";
    case "uncommon":
      return "text-violet-300/80";
    case "medium":
      return "text-sky-200/75";
    default:
      return "text-white/45";
  }
}

function RewardIcon({ id, compact }: { id: string; compact?: boolean }) {
  const label = id.includes("credit")
    ? "✦"
    : id.includes("portrait") || id.includes("image")
      ? "🖼"
      : id.includes("santa") || id.includes("discount")
        ? "%"
        : "🎁";
  const size = compact ? 28 : 32;
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        fontSize: compact ? 11 : 13,
        background:
          "linear-gradient(145deg, rgba(232,201,122,0.28), rgba(80,50,30,0.45))",
        border: "1px solid rgba(232,201,122,0.28)",
      }}
    >
      {label}
    </span>
  );
}

/**
 * Compact floating glass prize previews — no full-height dark columns.
 * Each rail floats independently over the room.
 */
export function PrizeRail({
  className,
  compact,
  side = "all",
  limit,
  onSeeAll,
}: Props) {
  const all = GIFT_TREE_REWARD_CATALOG.filter((r) =>
    (PREVIEW_IDS as readonly string[]).includes(r.id),
  );
  const split =
    side === "left"
      ? all.filter((_, i) => i % 2 === 0)
      : side === "right"
        ? all.filter((_, i) => i % 2 === 1)
        : all;
  const items = typeof limit === "number" ? split.slice(0, limit) : split;

  return (
    <aside
      className={className}
      aria-label="Possible Christmas surprises"
      style={{
        background: compact
          ? "rgba(15, 12, 10, 0.40)"
          : "rgba(15, 12, 10, 0.42)",
        border: "1px solid rgba(235,190,90,0.22)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 16,
        padding: compact ? "7px" : "9px",
        boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
      }}
    >
      <p
        className={`mb-1.5 font-semibold uppercase tracking-[0.14em] text-amber-200/70 ${
          compact ? "text-[8px]" : "text-[9px]"
        }`}
      >
        Possible surprises
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-xl"
            style={{
              minHeight: compact ? 52 : 56,
              padding: compact ? "8px" : "8px 10px",
              background: "rgba(255,255,255,0.035)",
            }}
          >
            <RewardIcon id={item.id} compact={compact} />
            <div className="min-w-0 flex-1">
              <p
                className={`line-clamp-2 font-medium leading-tight text-amber-50/95 ${
                  compact ? "text-[10px]" : "text-[12px]"
                }`}
              >
                {item.title}
              </p>
              <p
                className={`capitalize ${rarityTone(item.rarity)} ${
                  compact ? "text-[9px]" : "text-[10px]"
                }`}
              >
                {item.rarity}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-2 w-full text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200/70 hover:text-amber-100"
        >
          See all
        </button>
      ) : null}
    </aside>
  );
}

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

function RewardIcon({ id }: { id: string }) {
  const label = id.includes("credit")
    ? "✦"
    : id.includes("portrait") || id.includes("image")
      ? "🖼"
      : id.includes("santa") || id.includes("discount")
        ? "%"
        : "🎁";
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] md:h-9 md:w-9"
      style={{
        background:
          "linear-gradient(145deg, rgba(232,201,122,0.28), rgba(80,50,30,0.55))",
        border: "1px solid rgba(232,201,122,0.28)",
      }}
    >
      {label}
    </span>
  );
}

/** Compact glass prize previews — secondary to the tree. */
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
        background:
          "linear-gradient(165deg, rgba(12,10,9,0.55), rgba(12,10,9,0.32))",
        border: "1px solid rgba(232,201,122,0.22)",
        backdropFilter: "blur(16px)",
        borderRadius: 16,
        padding: compact ? "8px 8px" : "10px 10px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
      }}
    >
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-200/70">
        Possible surprises
      </p>
      <ul className={compact ? "space-y-1.5" : "space-y-1.5"}>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1.5"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <RewardIcon id={item.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium leading-tight text-amber-50/95 md:text-[12px]">
                {item.title}
              </p>
              <p className={`text-[10px] capitalize ${rarityTone(item.rarity)}`}>
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
          className="mt-2 w-full text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/70 hover:text-amber-100"
        >
          See all
        </button>
      ) : null}
    </aside>
  );
}

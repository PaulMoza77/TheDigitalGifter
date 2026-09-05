import { GIFT_TREE_REWARD_CATALOG } from "./rewardCatalog";

type Props = {
  className?: string;
  compact?: boolean;
};

/** Elegant prize preview rail — uses real reward titles, no clutter. */
export function PrizeRail({ className, compact }: Props) {
  const items = GIFT_TREE_REWARD_CATALOG.filter((r) =>
    ["credits_25", "free_image", "christmas_portrait", "santa_discount_15", "credits_50"].includes(
      r.id,
    ),
  );

  return (
    <aside
      className={className}
      aria-label="Possible Christmas rewards"
      style={{
        background:
          "linear-gradient(165deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(14px)",
        borderRadius: 18,
        padding: compact ? "10px 10px" : "14px 12px",
      }}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/60">
        Possible surprises
      </p>
      <ul className={compact ? "flex gap-2 overflow-x-auto pb-1" : "space-y-2"}>
        {items.map((item) => (
          <li
            key={item.id}
            className={
              compact
                ? "min-w-[132px] shrink-0 rounded-xl bg-black/20 px-3 py-2"
                : "rounded-xl bg-black/20 px-3 py-2.5"
            }
          >
            <p className="text-[11px] font-medium leading-snug text-amber-50/95">{item.title}</p>
            <p className="mt-0.5 text-[10px] capitalize text-rose-100/45">{item.rarity}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Public-read DTO + share/owner token invariants for Christmas Wishlist. */

export const WISHLIST_WRITE_CAPABILITY_KEYS = [
  "owner_token",
  "owner_token_hash",
  "user_id",
  "reservation_status",
  "reservation_token_hash",
] as const;

export const PUBLIC_WISHLIST_KEYS = ["share_id", "title", "description", "locale", "items"] as const;

export const PUBLIC_WISHLIST_ITEM_KEYS = [
  "id",
  "sort_order",
  "title",
  "note",
  "external_url",
  "priority",
  "budget_amount",
  "currency",
  "source_type",
] as const;

export type PublicWishlistItem = {
  id: unknown;
  sort_order: unknown;
  title: unknown;
  note: string;
  external_url: unknown;
  priority: unknown;
  budget_amount: unknown;
  currency: unknown;
  source_type: "gift_finder" | "tdg_product" | "manual";
};

export type PublicWishlistDto = {
  share_id: unknown;
  title: unknown;
  description: unknown;
  locale: unknown;
  items: PublicWishlistItem[];
};

export function assertOwnerTokenHashDistinctFromShareId(
  ownerTokenHash: string | null | undefined,
  shareId: string,
): void {
  if (ownerTokenHash && ownerTokenHash === shareId) {
    throw new Error("owner_token_hash_eq_share_id");
  }
}

export function toPublicWishlistItem(
  item: Record<string, unknown>,
  showBudgets: boolean,
): PublicWishlistItem {
  const sourceType = item.source_type;
  return {
    id: item.id,
    sort_order: item.sort_order,
    title: item.title,
    note: typeof item.note === "string" ? item.note : "",
    external_url: item.external_url || null,
    priority: item.priority,
    budget_amount: showBudgets ? item.budget_amount ?? null : null,
    currency: showBudgets ? item.currency ?? null : null,
    source_type:
      sourceType === "gift_finder" ? "gift_finder" : sourceType === "tdg_product" ? "tdg_product" : "manual",
  };
}

export function toPublicWishlistDto(
  list: Record<string, unknown>,
  items: Record<string, unknown>[],
): PublicWishlistDto {
  const showBudgets = Boolean(list.show_budgets_public);
  return {
    share_id: list.share_id,
    title: list.title,
    description: list.description,
    locale: list.locale,
    items: items.map((it) => toPublicWishlistItem(it, showBudgets)),
  };
}

export function publicWishlistLeaksWriteCapability(payload: unknown): boolean {
  const raw = JSON.stringify(payload);
  return WISHLIST_WRITE_CAPABILITY_KEYS.some((key) => raw.includes(`"${key}"`));
}

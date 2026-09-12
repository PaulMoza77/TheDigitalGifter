/** Public-read DTO for shared wishlists. Keep in sync with src/features/christmas/wishlist/wishlistShare.ts */

export function assertOwnerTokenHashDistinctFromShareId(
  ownerTokenHash: string | null | undefined,
  shareId: string,
): void {
  if (ownerTokenHash && ownerTokenHash === shareId) {
    throw new Error("owner_token_hash_eq_share_id");
  }
}

export function toPublicWishlistItem(item: Record<string, unknown>, showBudgets: boolean) {
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

export function toPublicWishlistDto(list: Record<string, unknown>, items: Record<string, unknown>[]) {
  const showBudgets = Boolean(list.show_budgets_public);
  return {
    share_id: list.share_id,
    title: list.title,
    description: list.description,
    locale: list.locale,
    items: items.map((it) => toPublicWishlistItem(it, showBudgets)),
  };
}

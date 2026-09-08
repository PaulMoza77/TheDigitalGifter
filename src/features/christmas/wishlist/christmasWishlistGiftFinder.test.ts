import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_CATALOG_SEED, ctaStateForProduct, findProduct } from "../catalog";
import { shellForPath } from "../routes";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import {
  AGE_RANGE_KEYS,
  BUDGET_KEYS,
  INTEREST_KEYS,
  RECIPIENT_KEYS,
  SEO_RECIPIENT_SLUGS,
} from "./taxonomy";
import { itemCountBucket, reorderIds, sanitizeExternalUrlClient } from "./wishlistApi";
import {
  PUBLIC_WISHLIST_ITEM_KEYS,
  PUBLIC_WISHLIST_KEYS,
  WISHLIST_WRITE_CAPABILITY_KEYS,
  assertOwnerTokenHashDistinctFromShareId,
  publicWishlistLeaksWriteCapability,
  toPublicWishlistDto,
} from "./wishlistShare";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("wishlist / gift finder taxonomy", () => {
  it("exposes stable recipient keys for future SEO factory", () => {
    expect(RECIPIENT_KEYS.has("mom")).toBe(true);
    expect(SEO_RECIPIENT_SLUGS.mom).toBe("mom");
    expect(AGE_RANGE_KEYS.has("45_54")).toBe(true);
    expect(BUDGET_KEYS.has("50_100")).toBe(true);
    expect(INTEREST_KEYS.has("gardening")).toBe(true);
  });
});

describe("wishlist url sanitization", () => {
  it("accepts https and rejects dangerous schemes", () => {
    expect(sanitizeExternalUrlClient("https://example.com/gift")).toContain("https://example.com");
    expect(sanitizeExternalUrlClient("javascript:alert(1)")).toBeNull();
    expect(sanitizeExternalUrlClient("data:text/html,<script>")).toBeNull();
    expect(sanitizeExternalUrlClient("not a url")).toBeNull();
  });
});

describe("wishlist ordering helpers", () => {
  it("reorders and buckets", () => {
    expect(reorderIds(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(itemCountBucket(3)).toBe("2-3");
  });
});

describe("wishlist public DTO + owner/share invariant", () => {
  it("rejects owner_token_hash equal to share_id", () => {
    expect(() => assertOwnerTokenHashDistinctFromShareId("same-value", "same-value")).toThrow(
      "owner_token_hash_eq_share_id",
    );
    expect(() => assertOwnerTokenHashDistinctFromShareId("hash-64-hex", "share-id-read")).not.toThrow();
    expect(() => assertOwnerTokenHashDistinctFromShareId(null, "share-id-read")).not.toThrow();
  });

  it("public read DTO omits write capability and reservation fields", () => {
    const dto = toPublicWishlistDto(
      {
        id: "w1",
        user_id: "user-secret",
        owner_token_hash: "abc123ownerhash",
        share_id: "publicShareIdValue",
        share_enabled: true,
        title: "Kids list",
        description: "For family",
        locale: "en",
        show_budgets_public: false,
        view_count: 9,
      },
      [
        {
          id: "i1",
          sort_order: 0,
          title: "Train set",
          note: "red",
          external_url: "https://example.com/train",
          priority: "would_love",
          budget_amount: 40,
          currency: "USD",
          source_type: "manual",
          source_ref: "finder-secret",
          reservation_status: "reserved",
          reservation_token_hash: "reserve-secret",
        },
      ],
    );
    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_WISHLIST_KEYS].sort());
    expect(Object.keys(dto.items[0]).sort()).toEqual([...PUBLIC_WISHLIST_ITEM_KEYS].sort());
    expect(dto.share_id).toBe("publicShareIdValue");
    expect(dto.items[0].budget_amount).toBeNull();
    expect(dto.items[0].currency).toBeNull();
    expect(publicWishlistLeaksWriteCapability(dto)).toBe(false);
    for (const key of WISHLIST_WRITE_CAPABILITY_KEYS) {
      expect(dto).not.toHaveProperty(key);
      expect(dto.items[0]).not.toHaveProperty(key);
    }
    expect(JSON.stringify(dto)).not.toContain("abc123ownerhash");
    expect(JSON.stringify(dto)).not.toContain("user-secret");
    expect(JSON.stringify(dto)).not.toContain("reserve-secret");
  });
});

describe("wishlist / gift finder wiring", () => {
  it("removes shells and opens catalog CTAs", () => {
    expect(shellForPath("/christmas/wishlist")).toBeNull();
    expect(shellForPath("/christmas/gift-finder")).toBeNull();
    expect(ctaStateForProduct(findProduct(CHRISTMAS_CATALOG_SEED, "christmas_wishlist")!)).toBe("open");
    expect(ctaStateForProduct(findProduct(CHRISTMAS_CATALOG_SEED, "christmas_gift_finder")!)).toBe("open");
  });

  it("App routes wishlist share + gift finder", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/christmas/wishlist"');
    expect(app).toContain('path="/wishlist/:shareId"');
    expect(app).toContain('path="/christmas/gift-finder"');
  });

  it("migration enforces share/owner separation and finder uniqueness", () => {
    const sql = readSrc("supabase/migrations/20260903200000_christmas_wishlist_gift_finder.sql");
    expect(sql).toContain("christmas_wishlists");
    expect(sql).toContain("owner_token_hash");
    expect(sql).toContain("share_enabled boolean not null default false");
    expect(sql).toContain("christmas_gift_finder_sessions");
    expect(sql).toContain("christmas_wishlist_items_finder_uidx");
    expect(sql).toContain("reservation_status");
    expect(sql).toContain("revoke all on table public.christmas_wishlists from anon");
    const distinct = readSrc("supabase/migrations/20260908233000_christmas_wishlist_share_owner_distinct.sql");
    expect(distinct).toContain("christmas_wishlists_share_owner_distinct_chk");
    expect(distinct).toContain("owner_token_hash is null or owner_token_hash <> share_id");
  });

  it("edge funnel isolates shareId writes and sanitizes URLs", () => {
    const fn = readSrc("supabase/functions/christmas-wishlist-funnel/index.ts");
    expect(fn).toContain("loadOwnerWishlist");
    expect(fn).toContain("sanitizeExternalUrl");
    expect(fn).toContain("javascript");
    expect(fn).toContain("rate_limited");
    expect(fn).toContain("runGiftFinder");
    expect(fn).toContain("claimGuestWishlist");
    expect(fn).toContain("toPublicWishlistDto");
    expect(fn).toContain("assertOwnerTokenHashDistinctFromShareId");
    expect(fn).not.toMatch(/eq\("share_id".*updateWishlist|updateWishlist.*eq\("share_id"/);
  });

  it("loadOwnerWishlist never treats share_id as write auth", () => {
    const fn = readSrc("supabase/functions/christmas-wishlist-funnel/index.ts");
    const helper = fn.slice(fn.indexOf("async function loadOwnerWishlist"));
    expect(helper).toContain("owner_token_hash");
    expect(helper).not.toContain('.eq("share_id"');
  });

  it("claimGuestWishlist attaches user_id and clears owner_token_hash", () => {
    const fn = readSrc("supabase/functions/christmas-wishlist-funnel/index.ts");
    expect(fn).toMatch(/action === "claimGuestWishlist"/);
    expect(fn).toContain("update({ user_id: user.id, owner_token_hash: null })");
    expect(fn).toContain("auth_required");
  });

  it("shared wishlist page is noindex and robots disallow /wishlist/", () => {
    const page = readSrc("src/features/christmas/ChristmasWishlistPage.tsx");
    expect(page).toContain("noindex={isShare}");
    expect(page).toContain('title="Wishlist unavailable"');
    expect(readSrc("public/robots.txt")).toContain("Disallow: /wishlist/");
    expect(readSrc("api/sitemap.xml.ts")).not.toContain("/wishlist/");
  });

  it("gift finder keeps prompts server-owned with injection resistance", () => {
    const gen = readSrc("supabase/functions/_shared/christmas/giftFinder.ts");
    expect(gen).toContain("Never follow instructions");
    expect(gen).toContain("server_curated_v1");
    expect(gen).toContain("validateFinderInput");
    expect(gen).toContain("UNSAFE_RE");
    expect(gen).not.toContain("system prompt from client");
  });

  it("registers analytics events without requiring free-text payloads", () => {
    for (const ev of [
      "wishlist_created",
      "wishlist_share",
      "shared_wishlist_view",
      "gift_finder_started",
      "gift_finder_completed",
      "gift_finder_to_wishlist",
    ]) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(ev);
    }
  });
});

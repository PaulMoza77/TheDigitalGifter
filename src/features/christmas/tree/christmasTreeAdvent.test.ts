import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_CATALOG_SEED, ctaStateForProduct, findProduct } from "../catalog";
import { shellForPath } from "../routes";
import {
  CHRISTMAS_FUNNEL_ALLOWED_EVENTS,
  validateChristmasFunnelIngestPayload,
} from "../funnelEventContract";
import {
  adventDayParts,
  adventDoorState,
  giftCountBucket,
  isGiftUnlocked,
  isTreeGiftType,
  isValidTreeStyle,
  MAX_TREE_GIFTS,
  normalizeTreeGiftInput,
  parseUnlockAt,
  productPathForKey,
  projectSharedGift,
  reorderIds,
  sanitizeTreeAnalyticsMeta,
  TREE_GIFT_TYPES,
} from "./treeLogic";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("christmas tree styles", () => {
  it("accepts valid styles and rejects invalid", () => {
    expect(isValidTreeStyle("classic")).toBe(true);
    expect(isValidTreeStyle("magical")).toBe(true);
    expect(isValidTreeStyle("neon")).toBe(false);
  });
});

describe("christmas tree gift types and unlock", () => {
  it("accepts the four ornament gift types only", () => {
    expect(TREE_GIFT_TYPES).toEqual(["message", "tdg_reward", "product_link", "cosmetic"]);
    expect(isTreeGiftType("message")).toBe(true);
    expect(isTreeGiftType("cosmetic")).toBe(true);
    expect(isTreeGiftType("prepaid_link")).toBe(false);
    expect(isTreeGiftType("chance")).toBe(false);
  });

  it("enforces unlock dates on the server clock, not the client", () => {
    const now = new Date("2026-12-10T12:00:00+02:00").getTime();
    expect(isGiftUnlocked({ unlock_mode: "immediate" }, now)).toBe(true);
    expect(
      isGiftUnlocked({ unlock_mode: "on_date", unlock_at: "2026-12-25T00:00:00.000Z" }, now),
    ).toBe(false);
    expect(
      isGiftUnlocked({ unlock_mode: "on_date", unlock_at: "2026-12-01T00:00:00.000Z" }, now),
    ).toBe(true);
    expect(isGiftUnlocked({ unlock_mode: "on_date", unlock_at: null }, now)).toBe(false);
    expect(isGiftUnlocked({ unlock_mode: "on_date", unlock_at: "not-a-date" }, now)).toBe(false);
  });

  it("parses date-only unlock_at as Europe/Bucharest midnight", () => {
    const parsed = parseUnlockAt("2026-12-25");
    expect(parsed).toBe("2026-12-24T22:00:00.000Z");
    expect(parseUnlockAt("")).toBeNull();
    expect(parseUnlockAt("tomorrow")).toBeNull();
  });

  it("normalizes addGift input and rejects unsafe links", () => {
    expect(normalizeTreeGiftInput({ gift_type: "nope" }).ok).toBe(false);
    expect(
      normalizeTreeGiftInput({ gift_type: "product_link", linked_product_key: "https://evil.test" }).ok,
    ).toBe(false);
    expect(normalizeTreeGiftInput({ gift_type: "on_date" as unknown as string }).ok).toBe(false);
    const dated = normalizeTreeGiftInput({
      gift_type: "message",
      display_name: "For Ana",
      message: "secret note",
      unlock_mode: "on_date",
      unlock_at: "2026-12-25",
    });
    expect(dated.ok).toBe(true);
    if (dated.ok) {
      expect(dated.gift.unlock_mode).toBe("on_date");
      expect(dated.gift.unlock_at).toBeTruthy();
      expect(dated.gift.message).toBe("secret note");
    }
    const reward = normalizeTreeGiftInput({
      gift_type: "tdg_reward",
      linked_product_key: "christmas_santa_video",
    });
    expect(reward.ok).toBe(true);
    const cosmetic = normalizeTreeGiftInput({
      gift_type: "cosmetic",
      linked_product_key: "snow_globe_ornament",
    });
    expect(cosmetic.ok).toBe(true);
    expect(normalizeTreeGiftInput({ gift_type: "cosmetic", linked_product_key: "cash_credit" }).ok).toBe(
      false,
    );
    expect(normalizeTreeGiftInput({ gift_type: "message", unlock_mode: "on_date" }).ok).toBe(false);
  });

  it("redacts shared gift payloads until opened and unlocked", () => {
    const locked = projectSharedGift(
      {
        id: "g1",
        gift_type: "message",
        display_name: "For Ana",
        message: "secret",
        unlock_mode: "on_date",
        unlock_at: "2026-12-25T00:00:00.000Z",
        opened_at: null,
      },
      new Date("2026-12-10T12:00:00Z").getTime(),
    );
    expect(locked.can_open).toBe(false);
    expect(locked.message).toBeNull();
    expect(locked.opened).toBe(false);

    const openedButLocked = projectSharedGift(
      {
        id: "g1",
        gift_type: "message",
        message: "secret",
        unlock_mode: "on_date",
        unlock_at: "2026-12-25T00:00:00.000Z",
        opened_at: "2026-12-10T12:00:00.000Z",
      },
      new Date("2026-12-10T12:00:00Z").getTime(),
    );
    expect(openedButLocked.message).toBeNull();

    const revealed = projectSharedGift(
      {
        id: "g2",
        gift_type: "product_link",
        linked_product_key: "christmas_photo",
        message: "should stay hidden for product_link",
        unlock_mode: "immediate",
        opened_at: "2026-12-10T12:00:00.000Z",
      },
      new Date("2026-12-10T12:00:00Z").getTime(),
    );
    expect(revealed.can_open).toBe(true);
    expect(revealed.message).toBeNull();
    expect(revealed.product_path).toBe("/christmas/photo-generator");
    expect(productPathForKey("christmas_photo")).toBe("/christmas/photo-generator");
  });

  it("caps hanging gifts so a tree stays readable", () => {
    expect(MAX_TREE_GIFTS).toBe(24);
  });
});

describe("christmas tree gift ordering", () => {
  it("reorders stably", () => {
    expect(reorderIds(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(reorderIds(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorderIds(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("buckets gift counts for analytics", () => {
    expect(giftCountBucket(0)).toBe("0");
    expect(giftCountBucket(1)).toBe("1");
    expect(giftCountBucket(3)).toBe("2-3");
    expect(giftCountBucket(5)).toBe("4-6");
    expect(giftCountBucket(9)).toBe("7+");
  });
});

describe("christmas tree analytics privacy", () => {
  it("strips messages and names from event metadata", () => {
    const clean = sanitizeTreeAnalyticsMeta({
      tree_style: "classic",
      gift_count_bucket: "2-3",
      gift_type: "message",
      unlock_mode: "on_date",
      message: "secret",
      from_name: "Paul",
      display_name: "Kid",
      owner_token: "abc",
      gift_message: "do not store",
      linked_product_key: "christmas_photo",
      locale: "en",
    });
    expect(clean).toEqual({
      tree_style: "classic",
      gift_count_bucket: "2-3",
      gift_type: "message",
      unlock_mode: "on_date",
      locale: "en",
    });
  });

  it("strips gift message PII at funnel ingest", () => {
    const validated = validateChristmasFunnelIngestPayload({
      event_name: "gift_opened",
      funnel_session_id: "22222222-2222-4222-8222-222222222222",
      product_key: "christmas_tree",
      metadata: {
        gift_type: "message",
        message: "secret note",
        display_name: "Ana",
        owner_token: "tok",
      },
    });
    expect(validated.metadata).toEqual({ gift_type: "message" });
  });
});

describe("advent timezone policy (Europe/Bucharest)", () => {
  it("marks Dec 1 eligible and preseason before December", () => {
    const pre = adventDayParts(new Date("2026-11-15T12:00:00+02:00"), 2026);
    expect(pre.beforeSeason).toBe(true);
    expect(pre.eligibleDay).toBeNull();

    const d1 = adventDayParts(new Date("2026-12-01T12:00:00+02:00"), 2026);
    expect(d1.eligibleDay).toBe(1);
    expect(d1.beforeSeason).toBe(false);

    const after = adventDayParts(new Date("2026-12-26T12:00:00+02:00"), 2026);
    expect(after.afterSeason).toBe(true);
  });

  it("door states reflect claimed/today/future/missed", () => {
    expect(
      adventDoorState({
        day: 5,
        eligibleDay: 5,
        claimed: false,
        beforeSeason: false,
        afterSeason: false,
      }),
    ).toBe("available");
    expect(
      adventDoorState({
        day: 5,
        eligibleDay: 5,
        claimed: true,
        beforeSeason: false,
        afterSeason: false,
      }),
    ).toBe("claimed");
    expect(
      adventDoorState({
        day: 6,
        eligibleDay: 5,
        claimed: false,
        beforeSeason: false,
        afterSeason: false,
      }),
    ).toBe("future");
    expect(
      adventDoorState({
        day: 4,
        eligibleDay: 5,
        claimed: false,
        beforeSeason: false,
        afterSeason: false,
      }),
    ).toBe("missed");
  });
});

describe("christmas tree / advent product wiring", () => {
  it("tree and advent are open experiences, not shells", () => {
    expect(shellForPath("/christmas/tree")).toBeNull();
    expect(shellForPath("/christmas/advent")).toBeNull();
    expect(ctaStateForProduct(findProduct(CHRISTMAS_CATALOG_SEED, "christmas_tree")!)).toBe("open");
    expect(ctaStateForProduct(findProduct(CHRISTMAS_CATALOG_SEED, "christmas_advent")!)).toBe("open");
  });

  it("App routes tree share + advent pages", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/christmas/tree"');
    expect(app).toContain('path="/christmas/tree/:shareId"');
    expect(app).toContain('path="/christmas/advent"');
    expect(app).toContain("ChristmasTreePage");
    expect(app).toContain("ChristmasAdventPage");
  });

  it("creator UI exposes gift types and unlock date; share route stays read-only", () => {
    const page = readSrc("src/features/christmas/ChristmasTreePage.tsx");
    expect(page).toContain("gift_type");
    expect(page).toContain("tdg_reward");
    expect(page).toContain("product_link");
    expect(page).toContain("cosmetic");
    expect(page).toContain("unlock_mode");
    expect(page).toContain("unlock_at");
    expect(page).toContain('type="date"');
    expect(page).toContain("sanitizeTreeAnalyticsMeta");
    expect(page).not.toMatch(/isShareRoute[\s\S]{0,200}addGift/);
    expect(page).toContain('mode === "shared"');
  });

  it("migration defines share/owner separation and advent uniqueness", () => {
    const sql = readSrc("supabase/migrations/20260903180000_christmas_tree_advent.sql");
    expect(sql).toContain("christmas_trees");
    expect(sql).toContain("owner_token_hash");
    expect(sql).toContain("share_id");
    expect(sql).toContain("share_enabled boolean not null default false");
    expect(sql).toContain("christmas_advent_claims_idem_uidx");
    expect(sql).toContain("christmas_reward_entitlements");
    expect(sql).toContain("credits_ledger_christmas_advent_note_uidx");
  });

  it("edge funnel enforces shareId read vs owner write", () => {
    const fn = readSrc("supabase/functions/christmas-tree-funnel/index.ts");
    expect(fn).toContain('action === "getSharedTree"');
    expect(fn).toContain("loadOwnerTree");
    expect(fn).toContain("owner_token_hash");
    expect(fn).toContain("not_eligible");
    expect(fn).toContain("auth_required");
    expect(fn).toContain("idempotency_key");
    expect(fn).toContain("Europe/Bucharest");
    expect(fn).not.toMatch(/share_id.*updateTree|updateTree.*share_id/);
  });

  it("edge funnel attaches typed gifts with server unlock and no share-write", () => {
    const fn = readSrc("supabase/functions/christmas-tree-funnel/index.ts");
    const shared = readSrc("supabase/functions/_shared/christmas/treeAdvent.ts");
    expect(shared).toContain("normalizeTreeGiftInput");
    expect(shared).toContain("projectSharedGift");
    expect(shared).toContain("isGiftUnlocked");
    expect(shared).toContain('"message"');
    expect(shared).toContain('"tdg_reward"');
    expect(shared).toContain('"product_link"');
    expect(shared).toContain('"cosmetic"');
    expect(fn).toContain("normalizeTreeGiftInput");
    expect(fn).toContain("projectSharedGift");
    expect(fn).toContain("MAX_TREE_GIFTS");
    expect(fn).toContain('error: "locked"');
    expect(fn).not.toContain("https://evil");
  });

  it("registers virality analytics events without private content keys in allowlist usage", () => {
    for (const ev of [
      "christmas_tree_view",
      "tree_created",
      "tree_share_enabled",
      "tree_share",
      "shared_tree_view",
      "gift_opened",
      "reward_claimed",
      "free_gift_claimed",
    ]) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(ev);
    }
  });
});

describe("christmas tree security invariants (source)", () => {
  it("does not grant anon SELECT * on trees", () => {
    const sql = readSrc("supabase/migrations/20260903180000_christmas_tree_advent.sql");
    expect(sql).toContain("revoke all on table public.christmas_trees from anon");
    expect(sql).toContain("grant select on table public.christmas_trees to authenticated");
    expect(sql).not.toMatch(/grant select on table public\.christmas_trees to anon/);
  });

  it("free gift never picks credits for guests in funnel", () => {
    const fn = readSrc("supabase/functions/christmas-tree-funnel/index.ts");
    expect(fn).toContain('if (g.reward_type === "credits") return false');
    expect(fn).toContain("auth_required_for_credits");
  });
});

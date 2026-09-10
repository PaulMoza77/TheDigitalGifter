import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHRISTMAS_CATALOG_SEED, ctaStateForProduct, findProduct } from "../catalog";
import { shellForPath } from "../routes";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "../funnelEventContract";
import {
  evaluateAdventClaimRequest,
  parseAdventNow,
} from "../../../../supabase/functions/_shared/christmas/adventClaimPolicy";
import {
  adventDayParts,
  adventDoorState,
  giftCountBucket,
  isValidTreeStyle,
  reorderIds,
  sanitizeTreeAnalyticsMeta,
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
      message: "secret",
      from_name: "Paul",
      display_name: "Kid",
      owner_token: "abc",
      locale: "en",
    });
    expect(clean).toEqual({
      tree_style: "classic",
      gift_count_bucket: "2-3",
      locale: "en",
    });
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

  it("uses Europe/Bucharest midnight, not UTC, for Dec 1 and Dec 25", () => {
    // 2026-12-01 00:00 EET = 2026-11-30 22:00 UTC
    const open = adventDayParts(new Date("2026-11-30T22:00:00.000Z"), 2026);
    expect(open.eligibleDay).toBe(1);
    expect(open.beforeSeason).toBe(false);

    const stillNov = adventDayParts(new Date("2026-11-30T21:59:00.000Z"), 2026);
    expect(stillNov.eligibleDay).toBeNull();
    expect(stillNov.beforeSeason).toBe(true);

    // 2026-12-24 23:59 EET = 2026-12-24 21:59 UTC
    const lastDoor = adventDayParts(new Date("2026-12-24T21:59:00.000Z"), 2026);
    expect(lastDoor.eligibleDay).toBe(24);

    // 2026-12-25 00:00 EET = 2026-12-24 22:00 UTC
    const christmas = adventDayParts(new Date("2026-12-24T22:00:00.000Z"), 2026);
    expect(christmas.eligibleDay).toBeNull();
    expect(christmas.afterSeason).toBe(true);
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

  it("migration defines share/owner separation and advent uniqueness", () => {
    const sql = readSrc("supabase/migrations/20260903180000_christmas_tree_advent.sql");
    expect(sql).toContain("christmas_trees");
    expect(sql).toContain("owner_token_hash");
    expect(sql).toContain("share_id");
    expect(sql).toContain("share_enabled boolean not null default false");
    expect(sql).toContain("christmas_advent_claims_idem_uidx");
    expect(sql).toContain("christmas_advent_claims_user_day_uidx");
    expect(sql).toMatch(/christmas_advent_claims_user_day_uidx[\s\S]*\(user_id, season_year, day\)/);
    expect(sql).toContain("christmas_reward_entitlements");
    expect(sql).toContain("credits_ledger_christmas_advent_note_uidx");
  });

  it("edge funnel enforces shareId read vs owner write", () => {
    const fn = readSrc("supabase/functions/christmas-tree-funnel/index.ts");
    const policy = readSrc("supabase/functions/_shared/christmas/adventClaimPolicy.ts");
    expect(fn).toContain('action === "getSharedTree"');
    expect(fn).toContain("loadOwnerTree");
    expect(fn).toContain("owner_token_hash");
    expect(fn).toContain("evaluateAdventClaimRequest");
    expect(fn).toContain("auth_required");
    expect(fn).toContain("idempotency_key");
    expect(fn).toContain("Europe/Bucharest");
    expect(policy).toContain("not_eligible");
    expect(fn).not.toMatch(/share_id.*updateTree|updateTree.*share_id/);
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

describe("advent claim engine acceptance", () => {
  it("rejects claims when CHRISTMAS_ADVENT_ENABLED is off, even with client __test_force", () => {
    expect(
      evaluateAdventClaimRequest({
        adventEnabled: false,
        testHooksEnabled: false,
        testForce: true,
        requestedDay: 1,
        eligibleDay: 1,
      }),
    ).toEqual({ ok: false, error: "advent_disabled", status: 403 });
  });

  it("allows only the Bucharest-eligible day in Dec 1–24 when the season flag is on", () => {
    expect(
      evaluateAdventClaimRequest({
        adventEnabled: true,
        testHooksEnabled: false,
        testForce: false,
        requestedDay: 12,
        eligibleDay: 12,
      }),
    ).toEqual({ ok: true, day: 12 });
    expect(
      evaluateAdventClaimRequest({
        adventEnabled: true,
        testHooksEnabled: false,
        testForce: false,
        requestedDay: 11,
        eligibleDay: 12,
      }).error,
    ).toBe("not_eligible");
    expect(
      evaluateAdventClaimRequest({
        adventEnabled: true,
        testHooksEnabled: false,
        testForce: false,
        requestedDay: 25,
        eligibleDay: 25,
      }).error,
    ).toBe("invalid_day");
  });

  it("ignores injected test dates unless CHRISTMAS_ADVENT_TEST_HOOKS is on", () => {
    const frozen = new Date("2026-06-01T12:00:00.000Z");
    expect(parseAdventNow("2026-12-01", false, frozen)).toBe(frozen);
    expect(parseAdventNow("2026-12-01", true, frozen).toISOString()).toBe(
      new Date("2026-12-01T12:00:00+02:00").toISOString(),
    );
  });

  it("wires unique (user, season, day) + default-off flags + gated test hooks", () => {
    const sql = readSrc("supabase/migrations/20260903180000_christmas_tree_advent.sql");
    expect(sql).toContain("christmas_advent_claims_user_day_uidx");
    expect(sql).toContain("(user_id, season_year, day)");
    expect(sql).toMatch(/active boolean not null default false/);
    expect(sql).toContain('"live_offer":false');

    const flags = readSrc("supabase/functions/_shared/christmas/treeAdvent.ts");
    expect(flags).toContain('envFlagEnabled("CHRISTMAS_ADVENT_ENABLED")');
    expect(flags).toContain("CHRISTMAS_ADVENT_TEST_HOOKS");
    expect(flags).toMatch(/Deno\.env\.get\(name\) \|\| "false"/);

    const fn = readSrc("supabase/functions/christmas-tree-funnel/index.ts");
    expect(fn).toContain("evaluateAdventClaimRequest");
    expect(fn).toContain("adventTestHooksEnabled");
    expect(fn).not.toMatch(/!adventEnabled\(\) && !body\.__test_force/);
    expect(fn).not.toContain("parseInjectedDate");

    const advent = findProduct(CHRISTMAS_CATALOG_SEED, "christmas_advent")!;
    expect(advent.routePath).toBe("/christmas/advent");
    expect(advent.metadata.live_offer).toBe(false);
  });
});

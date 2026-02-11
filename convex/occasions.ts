// convex/occasions.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * 🔹 Admin list (ALL occasions)
 */
export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("occasions").collect();

    return rows.sort((a, b) => {
      const ao = typeof a.sortOrder === "number" ? a.sortOrder : 999999;
      const bo = typeof b.sortOrder === "number" ? b.sortOrder : 999999;
      if (ao !== bo) return ao - bo;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  },
});

/**
 * 🔹 Public list (ONLY active occasions)
 * - treat missing active as "true" (so old rows still show)
 */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("occasions").collect();

    return rows
      .filter((r) => r.active !== false)
      .sort((a, b) => {
        const ao = typeof a.sortOrder === "number" ? a.sortOrder : 999999;
        const bo = typeof b.sortOrder === "number" ? b.sortOrder : 999999;
        if (ao !== bo) return ao - bo;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
  },
});

/**
 * 🔹 Get one by slug (requires index "by_slug" in schema)
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("occasions")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    return row ?? null;
  },
});

/**
 * 🔹 Create or Update (by slug)
 */
export const upsert = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    active: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("occasions")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        slug: args.slug,
        title: args.title,
        active: args.active ?? true,
        sortOrder: args.sortOrder ?? 0,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("occasions", {
      slug: args.slug,
      title: args.title,
      active: args.active ?? true,
      sortOrder: args.sortOrder ?? 0,
      createdAt: now, // ✅ schema has this now
      updatedAt: now,
    });
  },
});

/**
 * 🔹 Delete
 */
export const remove = mutation({
  args: { id: v.id("occasions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return true;
  },
});

/**
 * 🔹 Toggle active
 */
export const setActive = mutation({
  args: {
    id: v.id("occasions"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      active: args.active,
      updatedAt: Date.now(),
    });
    return true;
  },
});

import { mutation } from "./_generated/server";

export const seedOccasions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const items = [
      { slug: "christmas", title: "Christmas", active: true, sortOrder: 10 },
      { slug: "birthday", title: "Birthday", active: true, sortOrder: 20 },
      { slug: "new_born", title: "New Born", active: true, sortOrder: 30 },
      { slug: "valentines_day", title: "Valentine's Day", active: true, sortOrder: 40 },
      { slug: "wedding", title: "Wedding", active: true, sortOrder: 50 },
    ];

    // upsert simplistic: if exists by slug, patch, else insert
    for (const it of items) {
      const existing = await ctx.db
        .query("occasions")
        .withIndex("by_slug", (q) => q.eq("slug", it.slug))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { ...it, updatedAt: now });
      } else {
        await ctx.db.insert("occasions", { ...it, createdAt: now, updatedAt: now });
      }
    }

    return { ok: true, count: items.length };
  },
});

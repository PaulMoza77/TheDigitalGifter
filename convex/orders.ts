import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    pack: v.string(),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if order already exists (idempotency)
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_session_id", (q) =>
        q.eq("stripeSessionId", args.stripeSessionId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      amount: args.amount,
      pack: args.pack,
      stripeSessionId: args.stripeSessionId,
      status: "completed",
      createdAt: Date.now(),
    });

    return orderId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

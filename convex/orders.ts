import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    amount: v.number(),
    pack: v.string(),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

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
      userId,
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

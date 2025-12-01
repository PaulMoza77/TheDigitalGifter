import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Unsubscribe from marketing emails (public, no auth required for email links)
export const unsubscribe = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Find user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        emailMarketingConsent: false,
      });
    }

    return { success: true };
  },
});

// Resubscribe to marketing emails (requires auth)
export const subscribe = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        emailMarketingConsent: true,
      });
    }

    return { success: true };
  },
});

// Get current user's email preferences
export const getMyPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      emailMarketingConsent: profile?.emailMarketingConsent ?? true, // default true
    };
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_START_CREDITS } from "./constants";

export const ensureUserProfile = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    if (!userId) {
      throw new Error("Must be logged in");
    }

    // Check if user profile already exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) return existing._id;

    // Create new user profile with default credits
    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      credits: DEFAULT_START_CREDITS,
      createdAt: Date.now(),
    });

    return profileId;
  },
});

export const getMe = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    if (!userId) return null;

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return userProfile;
  },
});

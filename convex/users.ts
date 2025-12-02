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

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch all user profiles
    const profiles = await ctx.db.query("userProfiles").collect();

    // 2. Fetch all users to get names/emails (this might be heavy, but okay for now)
    const users = await ctx.db.query("users").collect();
    const usersMap = new Map(users.map((u) => [u._id, u]));

    // 3. Fetch all jobs to calculate credit usage stats
    const jobs = await ctx.db.query("jobs").collect();
    console.log("[listAdmin] Total jobs found:", jobs.length);
    if (jobs.length > 0) {
      console.log("[listAdmin] Sample job:", {
        userId: jobs[0].userId,
        debited: jobs[0].debited,
        type: jobs[0].type,
      });
    }

    // 4. Fetch all orders to calculate monetary stats
    const orders = await ctx.db.query("orders").collect();
    console.log("[listAdmin] Total orders found:", orders.length);

    // Calculate stats per user
    const userStats = new Map<
      string,
      {
        creditsUsed: number;
        generations: number;
        lastActivity: number;
        totalMoneySpent: number;
        ordersCount: number;
      }
    >();

    // Process Jobs (Credits & Generations)
    for (const job of jobs) {
      const current = userStats.get(job.userId) || {
        creditsUsed: 0,
        generations: 0,
        lastActivity: 0,
        totalMoneySpent: 0,
        ordersCount: 0,
      };

      // Handle legacy jobs without debited field
      let creditsForJob = job.debited;
      if (creditsForJob === undefined || creditsForJob === null) {
        // Fallback: estimate based on job type
        // Old image jobs typically cost 1 credit, videos cost more
        creditsForJob = job.type === "video" ? 8 : 1;
      }

      current.creditsUsed += creditsForJob;
      current.generations += 1;
      current.lastActivity = Math.max(
        current.lastActivity,
        job._creationTime || 0
      );

      userStats.set(job.userId, current);
    }

    console.log(
      "[listAdmin] User stats after processing jobs:",
      userStats.size,
      "users"
    );

    // Process Orders (Money & Purchases)
    for (const order of orders) {
      const current = userStats.get(order.userId) || {
        creditsUsed: 0,
        generations: 0,
        lastActivity: 0,
        totalMoneySpent: 0,
        ordersCount: 0,
      };

      if (order.status === "completed") {
        current.totalMoneySpent += order.amount;
        current.ordersCount += 1;
      }
      // Also update last activity based on purchase date
      current.lastActivity = Math.max(
        current.lastActivity,
        order.createdAt || 0
      );

      userStats.set(order.userId, current);
    }

    // Combine data
    const result = profiles.map((profile) => {
      const user = usersMap.get(profile.userId as any); // userId in profile matches user._id
      const stats = userStats.get(profile.userId) || {
        creditsUsed: 0,
        generations: 0,
        lastActivity: 0,
        totalMoneySpent: 0,
        ordersCount: 0,
      };

      // Debug: Log first profile to see userId format
      if (profiles.indexOf(profile) === 0) {
        console.log("[listAdmin] First profile userId:", profile.userId);
        console.log("[listAdmin] Stats for this user:", stats);
        console.log("[listAdmin] Total userStats entries:", userStats.size);
      }

      return {
        _id: profile._id,
        userId: profile.userId,
        name: user?.name || "Unknown",
        email: user?.email || "No email",
        image: user?.image,
        credits: profile.credits,
        createdAt: profile._creationTime, // Use system creation time
        creditsUsed: stats.creditsUsed,
        generations: stats.generations,
        totalMoneySpent: stats.totalMoneySpent,
        ordersCount: stats.ordersCount,
        lastActivity: stats.lastActivity || profile._creationTime,
      };
    });

    // Sort by most recent activity
    return result.sort((a, b) => b.lastActivity - a.lastActivity);
  },
});

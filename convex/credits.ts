// convex/credits.ts
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DEFAULT_START_CREDITS } from "./constants";

/* =========================
   QUERIES
   ========================= */

export const getUserCredits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return userProfile?.credits ?? DEFAULT_START_CREDITS;
  },
});

/* =========================
   PUBLIC MUTATIONS
   ========================= */

export const addCredits = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      await ctx.db.insert("userProfiles", {
        userId: args.userId,
        credits: args.amount,
        createdAt: Date.now(),
      });
      return args.amount;
    }

    const newCredits = (profile.credits ?? 0) + args.amount;
    await ctx.db.patch(profile._id, { credits: newCredits });
    return newCredits;
  },
});

export const deductCredits = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Must be logged in");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Dacă nu există profil, inițializăm din DEFAULT_START_CREDITS
    if (!profile) {
      if (DEFAULT_START_CREDITS < args.amount)
        throw new Error("Insufficient credits");
      const newCredits = DEFAULT_START_CREDITS - args.amount;
      await ctx.db.insert("userProfiles", {
        userId,
        credits: newCredits,
        createdAt: Date.now(),
      });
      return newCredits;
    }

    if ((profile.credits ?? 0) < args.amount)
      throw new Error("Insufficient credits");
    const newCredits = (profile.credits ?? 0) - args.amount;
    await ctx.db.patch(profile._id, { credits: newCredits });
    return newCredits;
  },
});

/**
 * Folosit de webhook când avem un userId (serializat în metadata).
 * userId este primit ca string; îl folosim direct pentru că este deja
 * Id<"users"> serializat de Convex în client.
 */
export const addCreditsByExternalId = mutation({
  args: { userId: v.string(), amount: v.number() },
  handler: async (ctx, { userId, amount }) => {
    if (!amount || amount <= 0) return;

    try {
      const anyId = userId as any;
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", anyId))
        .first();

      if (profile) {
        await ctx.db.patch(profile._id, {
          credits: (profile.credits ?? 0) + amount,
        });
        return;
      }

      await ctx.db.insert("userProfiles", {
        userId: anyId,
        credits: amount,
        createdAt: Date.now(),
      });
    } catch {
      console.warn("⚠️ Invalid userId in addCreditsByExternalId:", userId);
    }
  },
});

/**
 * Fallback când utilizatorul a plătit ca vizitator.
 * Necesită:
 *  - tabelul "users" cu index "by_email"
 *  - tabelul "userProfiles" cu index "by_user"
 */
export const addCreditsByEmail = mutation({
  args: { email: v.string(), amount: v.number() },
  handler: async (ctx, { email, amount }) => {
    if (!amount || amount <= 0) return;

    // ✅ Use filter instead of withIndex
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first()
      .catch(() => null);

    if (!user) return;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        credits: (profile.credits ?? 0) + amount,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: user._id,
        credits: amount,
        createdAt: Date.now(),
      });
    }
  },
});

/* =========================
   INTERNAL MUTATIONS
   ========================= */

export const internalAddCredits = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      await ctx.db.insert("userProfiles", {
        userId: args.userId,
        credits: args.amount,
        createdAt: Date.now(),
      });
      return args.amount;
    }

    const newCredits = (profile.credits ?? 0) + args.amount;
    await ctx.db.patch(profile._id, { credits: newCredits });
    return newCredits;
  },
});

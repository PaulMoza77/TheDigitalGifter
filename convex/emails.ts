import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Internal query to get template data for email (no prompt - security!)
export const getTemplateForEmail = internalQuery({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;

    return {
      title: template.title,
      category: template.category || "General",
      subCategory: template.subCategory,
      type: template.type || "image",
      scene: template.scene,
      orientation: template.orientation,
      creditCost: template.creditCost,
      previewUrl: template.previewUrl,
      thumbnailUrl: template.thumbnailUrl,
      // DO NOT include prompt - it's sensitive business data!
    };
  },
});

// Internal query to get subscribed users
export const getEmailSubscribers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all users from auth
    const users = await ctx.db.query("users").collect();

    // Get all user profiles
    const profiles = await ctx.db.query("userProfiles").collect();

    // Create a map of userId to emailMarketingConsent
    const consentMap = new Map(
      profiles.map((p) => [p.userId, p.emailMarketingConsent ?? true])
    );

    // Filter users who have email and are subscribed (default: subscribed)
    return users
      .filter((user) => {
        const hasEmail = !!user.email;
        const isSubscribed = consentMap.get(user._id) !== false; // Default true
        return hasEmail && isSubscribed;
      })
      .map((user) => ({
        email: user.email!,
        userId: user._id,
      }));
  },
});

// Log email campaign for analytics
export const logEmailCampaign = internalMutation({
  args: {
    templateId: v.id("templates"),
    recipientCount: v.number(),
    successCount: v.number(),
    errorCount: v.number(),
  },
  handler: async (ctx, args) => {
    const successRate =
      args.recipientCount > 0
        ? ((args.successCount / args.recipientCount) * 100).toFixed(1)
        : "0";

    console.log(`
      ═══════════════════════════════════════
      📧 Email Campaign Summary
      ═══════════════════════════════════════
      Template ID: ${args.templateId}
      Total Recipients: ${args.recipientCount}
      Successfully Sent: ${args.successCount}
      Failed: ${args.errorCount}
      Success Rate: ${successRate}%
      ═══════════════════════════════════════
    `);

    // TODO: You could create an emailCampaigns table to track this for analytics dashboard
  },
});

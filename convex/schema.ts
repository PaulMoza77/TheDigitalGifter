// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Extend the existing users table from authTables with credits
  userProfiles: defineTable({
    userId: v.string(),
    credits: v.number(), // balance of credits
    createdAt: v.number(),
    // Email marketing preference (true by default, false if unsubscribed)
    emailMarketingConsent: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  // ✅ Occasions stored in DB (for dropdowns + funnel filtering)
  occasions: defineTable({
    slug: v.string(), // ex: "new_born"
    title: v.string(), // ex: "New Born"

    // keep optional if you already have existing rows without these fields
    active: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),

    // timestamps
    createdAt: v.number(), // ✅ REQUIRED because you insert it
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_active", ["active"])
    .index("by_sort", ["sortOrder"]),

  jobs: defineTable({
    userId: v.string(),
    type: v.union(v.literal("image"), v.literal("card"), v.literal("video")),
    prompt: v.string(),

    // Backwards-compatible single-file field (legacy)
    inputFileId: v.optional(v.id("_storage")),
    // New optional array for multiple input frames/files (video starter frames)
    inputFileIds: v.optional(v.array(v.id("_storage"))),

    // Video-specific optional fields (all optional to avoid breaking existing jobs)
    videoUrl: v.optional(v.union(v.string(), v.null())),
    duration: v.optional(v.union(v.literal(4), v.literal(6), v.literal(8))),
    resolution: v.optional(v.union(v.literal("720p"), v.literal("1080p"))),

    // Keep aspectRatio permissive (string) for Phase 1 to avoid breaking existing jobs.
    aspectRatio: v.optional(v.string()),
    generateAudio: v.optional(v.boolean()),
    negativePrompt: v.optional(v.union(v.string(), v.null())),
    seed: v.optional(v.union(v.number(), v.null())),

    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),

    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),

    debited: v.optional(v.number()), // optional for backward compatibility
    createdAt: v.optional(v.number()), // optional for backward compatibility
    updatedAt: v.optional(v.number()), // optional for backward compatibility

    templateId: v.optional(v.id("templates")),
    creditBreakdown: v.optional(
      v.object({
        perSecondCost: v.number(),
        seconds: v.number(),
        audioMultiplier: v.number(),
        totalCost: v.number(),
      })
    ),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_template", ["templateId"]),

  templates: defineTable({
    occasion: v.optional(v.string()),
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    type: v.optional(v.string()),

    title: v.string(),
    scene: v.string(),
    orientation: v.union(v.literal("portrait"), v.literal("landscape")),

    previewUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),

    prompt: v.string(),
    textDefault: v.string(),

    defaultDuration: v.optional(v.union(v.literal(4), v.literal(6), v.literal(8))),
    defaultAspectRatio: v.optional(v.string()),
    defaultResolution: v.optional(v.union(v.literal("720p"), v.literal("1080p"))),
    generateAudioDefault: v.optional(v.boolean()),
    negativePromptDefault: v.optional(v.union(v.string(), v.null())),

    creditCost: v.number(),
    tags: v.array(v.string()),
    isActive: v.optional(v.boolean()),
  })
    .index("by_occasion", ["occasion"])
    .index("by_scene", ["scene"])
    .index("by_category", ["category"])
    .index("by_credit_cost", ["creditCost"])
    .index("by_orientation", ["orientation"])
    .index("by_tags", ["tags"]),

  orders: defineTable({
    userId: v.string(),
    amount: v.number(), // Amount in Euros
    pack: v.string(), // "starter", "creator", "pro", "enterprise"
    stripeSessionId: v.string(),
    status: v.union(v.literal("completed"), v.literal("refunded")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_session_id", ["stripeSessionId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});

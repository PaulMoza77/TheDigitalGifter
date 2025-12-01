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

  jobs: defineTable({
    userId: v.string(),
    // Temporarily allow old types for migration - will be changed back to v.literal("image") after migration
    // Extend job `type` to support video jobs alongside existing values.
    // Keep existing literals to remain backward-compatible with current data.
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
    debited: v.optional(v.number()), // Make optional for backward compatibility
    createdAt: v.optional(v.number()), // Make optional for backward compatibility
    updatedAt: v.optional(v.number()), // Make optional for backward compatibility
    templateId: v.optional(v.id("templates")),
    creditBreakdown: v.optional(
      v.object({
        perSecondCost: v.number(),
        seconds: v.number(),
        audioMultiplier: v.number(),
        totalCost: v.number(),
      })
    ),
    // (note: aspectRatio already defined above for video jobs as an optional enum)
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    // Add index on type to allow efficient filtering by job type (image/video)
    .index("by_type", ["type"]),

  templates: defineTable({
    // Occasion (e.g., "christmas", "birthday", "wedding") - links to occasions.ts
    occasion: v.optional(v.string()),
    // Categories and sub-categories for UI filtering and organization
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    // Add optional `type` to templates so templates can represent video templates as well.
    // Kept as a free-form string in the DB for backward compatibility; frontend normalizes to 'image'|'video'.
    type: v.optional(v.string()),
    title: v.string(),
    scene: v.string(), // "tree","globes","cookies","fireplace","outdoor","workshop","market","gingerbread","skating","morning","vintage","snowglobe","cabin","forest","lake","village","church","aurora","enchanted","reading","baking","ballroom","victorian","sledding","snowangels","modern","hygge"
    orientation: v.union(v.literal("portrait"), v.literal("landscape")), // portrait | landscape
    previewUrl: v.string(),
    thumbnailUrl: v.optional(v.string()),
    prompt: v.string(), // prompt de bază pt AI
    textDefault: v.string(), // default text for the card
    // Video-specific optional defaults for templates (backwards-compatible)
    defaultDuration: v.optional(
      v.union(v.literal(4), v.literal(6), v.literal(8))
    ),
    defaultAspectRatio: v.optional(v.string()),
    defaultResolution: v.optional(
      v.union(v.literal("720p"), v.literal("1080p"))
    ),
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
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});

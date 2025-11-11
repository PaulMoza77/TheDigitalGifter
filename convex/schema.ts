import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Extend the existing users table from authTables with credits
  userProfiles: defineTable({
    userId: v.string(),
    credits: v.number(),         // balance of credits
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  jobs: defineTable({
    userId: v.string(),
    type: v.union(v.literal("image"), v.literal("video"), v.literal("card")),
    prompt: v.string(),
    inputFileId: v.optional(v.id("_storage")),
    status: v.union(v.literal("queued"), v.literal("processing"), v.literal("done"), v.literal("error")),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    debited: v.optional(v.number()), // Make optional for backward compatibility
    createdAt: v.optional(v.number()), // Make optional for backward compatibility
    updatedAt: v.optional(v.number()), // Make optional for backward compatibility
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  templates: defineTable({
    title: v.string(),
    scene: v.string(), // "tree","globes","cookies","fireplace","outdoor","workshop","market","gingerbread","skating","morning","vintage","snowglobe","cabin","forest","lake","village","church","aurora","enchanted","reading","baking","ballroom","victorian","sledding","snowangels","modern","hygge"
    orientation: v.union(v.literal("portrait"), v.literal("landscape")), // portrait | landscape
    previewUrl: v.string(),
    prompt: v.string(), // prompt de bază pt AI
    textDefault: v.string(), // default text for the card
    creditCost: v.number(),
    tags: v.array(v.string()),
  }).index("by_scene", ["scene"])
    .index("by_credit_cost", ["creditCost"])
    .index("by_orientation", ["orientation"])
    .index("by_tags", ["tags"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});

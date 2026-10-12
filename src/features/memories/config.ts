/**
 * Memories V1 funnel — centralized pricing and product config.
 * Do not hardcode prices in components; import from here.
 */

export const MEMORIES_ROUTE = "/memories" as const;
export const MEMORIES_CREATE_ROUTE = "/memories/create" as const;
export const MEMORIES_PLANS_ROUTE = "/memories/plans" as const;
export const MEMORIES_SUCCESS_ROUTE = "/memories/success" as const;

export const MEMORIES_DRAFT_KEY = "tdg.memories.draft.v1" as const;
export const MEMORIES_SESSION_KEY = "tdg.memories.session.v1" as const;
export const MEMORIES_EVENT_PATH = "/api/memories-funnel-event" as const;
export const MEMORIES_EVENT_EDGE_ACTION = "memories-funnel-event" as const;
export const MEMORIES_API_PATH = "/api/memories-funnel" as const;
export const MEMORIES_API_EDGE_ACTION = "memories-funnel" as const;

export const MEMORIES_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const MEMORIES_FUNNEL_VARIANT = "memories_v1" as const;
export const MEMORIES_PRODUCT_TYPE = "memories_subscription" as const;

export type MemoriesPlanKey = "starter" | "plus" | "legacy";
export type MemoriesCommercialMode = "waitlist" | "test" | "paid_early_access";

export const MEMORIES_PLANS = {
  starter: {
    key: "starter" as const,
    sku: "memories-starter-monthly",
    name: "Memories Starter",
    amountCents: 900,
    priceDisplay: "$9/month",
    badge: null as string | null,
    features: [
      "Limited monthly photo animations (when available)",
      "Personal memory library",
      "Basic preservation features",
    ],
    provisionalNote: "Entitlements are provisional until product launch.",
  },
  plus: {
    key: "plus" as const,
    sku: "memories-plus-monthly",
    name: "Memories Plus",
    amountCents: 1900,
    priceDisplay: "$19/month",
    badge: "Most Popular",
    features: [
      "More monthly animations (when available)",
      "Advanced memory experiences",
      "Expanded library",
    ],
    provisionalNote: "Entitlements are provisional until product launch.",
  },
  legacy: {
    key: "legacy" as const,
    sku: "memories-legacy-monthly",
    name: "Memories Legacy",
    amountCents: 4900,
    priceDisplay: "$49/month",
    badge: null as string | null,
    features: [
      "Premium memory experiences (when available)",
      "Advanced voice and storytelling features, subject to rights and feasibility",
      "Future interactive features",
    ],
    provisionalNote: "Entitlements are provisional until product launch.",
  },
} as const;

export const MEMORIES_EVENTS = [
  "memories_page_view",
  "memories_hero_cta",
  "memories_upload_started",
  "memories_upload_completed",
  "memories_email_submitted",
  "memories_plan_viewed",
  "memories_plan_selected",
  "memories_checkout_started",
  "memories_checkout_completed",
  "memories_payment_verified",
  "memories_subscription_cancelled",
  "memories_waitlist_joined",
  "memories_checkout_canceled",
] as const;

export type MemoriesEventName = (typeof MEMORIES_EVENTS)[number];

export const MEMORIES_FAQ = [
  {
    q: "Is Memories available today?",
    a: "Memories is in early access while we validate demand. AI animation and voice features are not available yet. You can join the waitlist or, when approved, subscribe with clear early-access terms.",
  },
  {
    q: "When does billing start?",
    a: "In waitlist mode, no payment is collected. In an approved paid early-access mode, recurring monthly billing begins only after Stripe confirms a successful checkout.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Subscribers can cancel anytime through the Stripe billing portal. Waitlist members can ask support to remove their email.",
  },
  {
    q: "Are my photos private?",
    a: "Uploads are stored in private object storage by default and are not made publicly accessible. Photos are not sent to AI providers in Memories V1.",
  },
  {
    q: "Does this recreate a real recording of someone who has passed away?",
    a: "No. Memories does not claim that generated content is a real recording of a deceased person. Future features will require careful rights review and will not be enabled in this release.",
  },
] as const;

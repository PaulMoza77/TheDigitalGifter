/**
 * Memories V1 funnel — centralized pricing and product config.
 * Do not hardcode prices in components; import from here.
 *
 * Monthly creation limits and feature rows below are proposed product specs
 * for early-access memberships. They are not live generation entitlements yet.
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
    name: "Starter",
    displayName: "Memories Starter",
    amountCents: 900,
    priceAmount: "$9",
    priceDisplay: "$9/month",
    pricePeriod: "/month",
    badge: null as string | null,
    tagline: "Bring a few special moments to life.",
    ctaLabel: "Choose Starter",
    monthlyAnimations: 5,
    features: [
      "5 photo animations per month",
      "Short animated memories",
      "Personal memory gallery",
      "Download your creations",
      "Standard processing",
    ],
  },
  plus: {
    key: "plus" as const,
    sku: "memories-plus-monthly",
    name: "Plus",
    displayName: "Memories Plus",
    amountCents: 1900,
    priceAmount: "$19",
    priceDisplay: "$19/month",
    pricePeriod: "/month",
    badge: "Best Value",
    tagline: "Turn your favorite memories into beautiful stories.",
    ctaLabel: "Choose Plus",
    monthlyAnimations: 20,
    features: [
      "20 photo animations per month",
      "Everything in Starter",
      "Longer memory clips",
      "Photo enhancement",
      "Personalized memory stories",
      "Priority processing",
    ],
  },
  legacy: {
    key: "legacy" as const,
    sku: "memories-legacy-monthly",
    name: "Legacy",
    displayName: "Memories Legacy",
    amountCents: 4900,
    priceAmount: "$49",
    priceDisplay: "$49/month",
    pricePeriod: "/month",
    badge: null as string | null,
    tagline: "Build a lasting collection for generations.",
    ctaLabel: "Choose Legacy",
    monthlyAnimations: 60,
    features: [
      "60 photo animations per month",
      "Everything in Plus",
      "Premium memory films",
      "Family memory collections",
      "Advanced storytelling experiences",
      "Highest processing priority",
    ],
  },
} as const;

export const MEMORIES_PLAN_COMPARISON = [
  {
    label: "Monthly photo animations",
    starter: "5",
    plus: "20",
    legacy: "60",
  },
  {
    label: "Clip duration",
    starter: "Short",
    plus: "Longer",
    legacy: "Premium films",
  },
  {
    label: "Photo enhancement",
    starter: "—",
    plus: "Included",
    legacy: "Included",
  },
  {
    label: "Memory stories",
    starter: "—",
    plus: "Included",
    legacy: "Included",
  },
  {
    label: "Family collections",
    starter: "—",
    plus: "—",
    legacy: "Included",
  },
  {
    label: "Processing priority",
    starter: "Standard",
    plus: "Priority",
    legacy: "Highest",
  },
  {
    label: "Downloads",
    starter: "Included",
    plus: "Included",
    legacy: "Included",
  },
] as const;

export const MEMORIES_PLANS_FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Once memberships become available, you'll be able to manage or cancel your subscription according to the membership terms.",
  },
  {
    q: "Will I be charged today?",
    a: "No. You're joining our early-access waitlist. We'll let you know when Memories is ready.",
  },
  {
    q: "What happens after I choose a plan?",
    a: "We'll save your preferred plan and email you when early access becomes available.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes, you can choose a different plan when memberships launch.",
  },
] as const;

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
    a: "Memories is in early access while we validate demand. AI animation features are not available yet. You can choose a preferred membership and join the waitlist — no payment is taken until Memories is ready and memberships launch.",
  },
  {
    q: "When does billing start?",
    a: "No payment is collected on the waitlist. When memberships launch, recurring monthly billing begins only after you complete an approved checkout.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Once you have an active membership, you can cancel anytime through the billing portal. Waitlist members can ask support to remove their email.",
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

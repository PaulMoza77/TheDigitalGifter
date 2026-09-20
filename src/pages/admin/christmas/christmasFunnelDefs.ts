export type ChristmasFunnelStep = {
  event: string;
  label: string;
};

export type ChristmasFunnelDef = {
  id: string;
  label: string;
  productKeys: string[];
  pathIncludes: string[];
  eventPrefixes: string[];
  steps: ChristmasFunnelStep[];
  emailEvents: string[];
};

export const CHRISTMAS_FUNNELS: ChristmasFunnelDef[] = [
  {
    id: "club",
    label: "Christmas Club",
    productKeys: ["christmas_club", "christmas_hub"],
    pathIncludes: ["/christmas"],
    eventPrefixes: ["christmas_join_", "christmas_google_auth_", "christmas_hub_"],
    steps: [
      { event: "christmas_page_view", label: "Landing" },
      { event: "christmas_join_started", label: "Join started" },
      { event: "christmas_join_completed", label: "Email collected" },
    ],
    emailEvents: ["christmas_join_completed"],
  },
  {
    id: "photo",
    label: "Photo generator",
    productKeys: ["christmas_photo"],
    pathIncludes: ["/christmas/photo-generator"],
    eventPrefixes: ["christmas_photo_"],
    steps: [
      { event: "christmas_photo_generator_page_view", label: "Page view" },
      { event: "christmas_photo_upload_completed", label: "Upload done" },
      { event: "christmas_photo_style_selected", label: "Style selected" },
      { event: "christmas_photo_generation_completed", label: "Generated" },
      { event: "checkout_started", label: "Checkout" },
      { event: "purchase", label: "Purchase" },
    ],
    emailEvents: [],
  },
  {
    id: "family",
    label: "Family",
    productKeys: ["christmas_family"],
    pathIncludes: ["/christmas/family"],
    eventPrefixes: ["christmas_family_"],
    steps: [
      { event: "christmas_family_page_view", label: "Page view" },
      { event: "christmas_family_upload_completed", label: "Upload done" },
      { event: "christmas_family_style_selected", label: "Style selected" },
      { event: "christmas_family_generation_completed", label: "Generated" },
    ],
    emailEvents: [],
  },
  {
    id: "couple",
    label: "Couples",
    productKeys: ["christmas_couple"],
    pathIncludes: ["/christmas/couples"],
    eventPrefixes: ["christmas_couple_"],
    steps: [
      { event: "christmas_product_view", label: "Page view" },
      { event: "upload_completed", label: "Upload done" },
      { event: "checkout_started", label: "Checkout" },
      { event: "purchase", label: "Purchase" },
    ],
    emailEvents: [],
  },
  {
    id: "pet",
    label: "Pets",
    productKeys: ["christmas_pet"],
    pathIncludes: ["/christmas/pets", "/christmas/dogs", "/christmas/cats"],
    eventPrefixes: ["christmas_pet_"],
    steps: [
      { event: "christmas_product_view", label: "Page view" },
      { event: "upload_completed", label: "Upload done" },
      { event: "checkout_started", label: "Checkout" },
      { event: "purchase", label: "Purchase" },
    ],
    emailEvents: [],
  },
  {
    id: "santa",
    label: "Santa video",
    productKeys: ["christmas_santa_video"],
    pathIncludes: ["/christmas/santa-video"],
    eventPrefixes: ["christmas_santa_", "santa_"],
    steps: [
      { event: "christmas_santa_page_view", label: "Page view" },
      { event: "christmas_santa_started", label: "Form started" },
      { event: "christmas_santa_preview_viewed", label: "Preview" },
      { event: "christmas_santa_checkout_started", label: "Checkout" },
      { event: "purchase", label: "Purchase" },
      { event: "christmas_santa_generation_completed", label: "Video ready" },
    ],
    emailEvents: [],
  },
  {
    id: "tree",
    label: "Tree",
    productKeys: ["christmas_tree"],
    pathIncludes: ["/christmas/tree"],
    eventPrefixes: ["christmas_tree_", "tree_", "gift_added", "gift_opened", "shared_tree_"],
    steps: [
      { event: "christmas_tree_view", label: "Page view" },
      { event: "tree_creation_started", label: "Create started" },
      { event: "tree_created", label: "Tree created" },
      { event: "tree_share_enabled", label: "Share enabled" },
    ],
    emailEvents: [],
  },
  {
    id: "gift_tree",
    label: "Gift tree / chance",
    productKeys: ["christmas_gift_tree"],
    pathIncludes: ["/christmas/tree-gifts", "/christmas/gifts"],
    eventPrefixes: ["christmas_gift_", "christmas_present_", "christmas_reward_", "christmas_email_claim_", "christmas_extra_gift_", "christmas_free_"],
    steps: [
      { event: "christmas_gift_tree_view", label: "Page view" },
      { event: "christmas_present_selected", label: "Gift selected" },
      { event: "christmas_reward_revealed", label: "Reward revealed" },
      { event: "christmas_email_claim_view", label: "Email claim shown" },
      { event: "christmas_email_claim_success", label: "Email collected" },
      { event: "christmas_checkout_started", label: "Paid offer checkout" },
      { event: "christmas_purchase", label: "Purchase" },
    ],
    emailEvents: ["christmas_email_claim_submit", "christmas_email_claim_success"],
  },
  {
    id: "wishlist",
    label: "Wishlist",
    productKeys: ["christmas_wishlist"],
    pathIncludes: ["/christmas/wishlist", "/wishlist/"],
    eventPrefixes: ["wishlist_"],
    steps: [
      { event: "wishlist_page_view", label: "Page view" },
      { event: "wishlist_creation_started", label: "Create started" },
      { event: "wishlist_created", label: "Created" },
      { event: "wishlist_first_wish_added", label: "First wish" },
      { event: "wishlist_share", label: "Shared" },
    ],
    emailEvents: [],
  },
  {
    id: "gift_finder",
    label: "Gift finder",
    productKeys: ["christmas_gift_finder"],
    pathIncludes: ["/christmas/gift-finder"],
    eventPrefixes: ["gift_finder_"],
    steps: [
      { event: "gift_finder_page_view", label: "Page view" },
      { event: "gift_finder_started", label: "Started" },
      { event: "gift_finder_completed", label: "Completed" },
      { event: "gift_finder_results_viewed", label: "Results" },
      { event: "gift_finder_result_clicked", label: "Result clicked" },
      { event: "gift_concierge_opened", label: "Planner concierge opened" },
      { event: "gift_concierge_generated", label: "Planner concierge generated" },
    ],
    emailEvents: [],
  },
  {
    id: "cards",
    label: "Cards",
    productKeys: ["christmas_card"],
    pathIncludes: ["/christmas/cards"],
    eventPrefixes: ["card_", "christmas_card_"],
    steps: [
      { event: "christmas_card_page_view", label: "Page view" },
      { event: "card_creation_started", label: "Create started" },
      { event: "card_preview_seen", label: "Preview" },
      { event: "card_generated", label: "Generated" },
      { event: "card_download", label: "Download" },
    ],
    emailEvents: [],
  },
  {
    id: "messages",
    label: "Messages",
    productKeys: ["christmas_message"],
    pathIncludes: ["/christmas/messages"],
    eventPrefixes: ["message_", "christmas_message_"],
    steps: [
      { event: "christmas_message_page_view", label: "Page view" },
      { event: "message_generator_started", label: "Started" },
      { event: "message_generator_completed", label: "Completed" },
      { event: "message_copied", label: "Copied" },
    ],
    emailEvents: [],
  },
  {
    id: "planner",
    label: "Planner",
    productKeys: ["christmas_planner_2026"],
    pathIncludes: ["/christmas/planner"],
    eventPrefixes: ["planner_", "gift_concierge_", "affiliate_product"],
    steps: [
      { event: "planner_landing_view", label: "Landing" },
      { event: "planner_cta_clicked", label: "CTA" },
      { event: "planner_personalization_completed", label: "Personalization" },
      { event: "planner_paywall_viewed", label: "Paywall" },
      { event: "planner_checkout_started", label: "Checkout" },
      { event: "planner_purchase", label: "Purchase" },
    ],
    emailEvents: ["planner_claim_completed"],
  },
  {
    id: "photos_v2",
    label: "Photos V2",
    productKeys: ["christmas_v2"],
    pathIncludes: ["/christmas-ai-photos"],
    eventPrefixes: ["christmas_v2_"],
    steps: [
      { event: "christmas_v2_view", label: "Landing" },
      { event: "christmas_v2_upload_completed", label: "Upload done" },
      { event: "christmas_v2_offer_viewed", label: "Offer" },
      { event: "christmas_v2_checkout_started", label: "Checkout" },
      { event: "christmas_v2_purchase", label: "Purchase" },
      { event: "christmas_v2_results_viewed", label: "Results" },
    ],
    emailEvents: [],
  },
];

export type FunnelMatchRow = {
  event_name: string;
  product_key?: string | null;
  pathname?: string | null;
};

export function funnelById(id: string): ChristmasFunnelDef | null {
  return CHRISTMAS_FUNNELS.find((funnel) => funnel.id === id) || null;
}

export function eventMatchesFunnel(row: FunnelMatchRow, funnel: ChristmasFunnelDef): boolean {
  const product = String(row.product_key || "");
  if (product && funnel.productKeys.includes(product)) return true;

  const pathname = String(row.pathname || "");
  if (pathname) {
    for (const fragment of funnel.pathIncludes) {
      if (fragment === "/christmas") {
        if (pathname === "/christmas" || pathname === "/christmas/") return true;
        continue;
      }
      if (pathname.includes(fragment)) return true;
    }
  }

  const eventName = String(row.event_name || "");
  return funnel.eventPrefixes.some((prefix) => eventName.startsWith(prefix) || eventName === prefix);
}

export function uniqueSessionCount(
  rows: Array<{ event_name: string; funnel_session_id: string }>,
  eventName: string,
): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.event_name === eventName && row.funnel_session_id) ids.add(row.funnel_session_id);
  }
  return ids.size;
}

export type FunnelDropStep = {
  event: string;
  label: string;
  sessions: number;
  fromPreviousPct: string;
  dropped: number | null;
};

export function funnelDropoff(
  rows: Array<{ event_name: string; funnel_session_id: string }>,
  steps: ChristmasFunnelStep[],
): FunnelDropStep[] {
  const result: FunnelDropStep[] = [];
  let previous = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const sessions = uniqueSessionCount(rows, step.event);
    const dropped = i === 0 ? null : Math.max(0, previous - sessions);
    const fromPreviousPct =
      i === 0 ? "100%" : previous > 0 ? `${((sessions / previous) * 100).toFixed(1)}%` : "—";
    result.push({
      event: step.event,
      label: step.label,
      sessions,
      fromPreviousPct,
      dropped,
    });
    previous = sessions;
  }
  return result;
}

export function emailsCollectedInFunnel(
  rows: Array<{ event_name: string; funnel_session_id: string }>,
  funnel: ChristmasFunnelDef,
): number {
  if (!funnel.emailEvents.length) return 0;
  const ids = new Set<string>();
  const names = new Set(funnel.emailEvents);
  for (const row of rows) {
    if (names.has(row.event_name) && row.funnel_session_id) ids.add(row.funnel_session_id);
  }
  return ids.size;
}

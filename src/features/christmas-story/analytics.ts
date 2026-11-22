/** Privacy-conscious story gift events. Never invent Purchase without paid confirmation. */

export const STORY_FUNNEL_EVENTS = [
  "landing_view",
  "demo_play",
  "create_gift_click",
  "builder_started",
  "preview_view",
  "checkout_started",
  "purchase_completed",
  "gift_generation_started",
  "gift_ready",
  "gift_approved",
  "gift_sent",
  "gift_opened",
  "recipient_reaction",
  "upsell_purchased",
] as const;

export type StoryFunnelEvent = (typeof STORY_FUNNEL_EVENTS)[number];

type Meta = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE = /email|name|token|photo|lyric|memory|phone|address/i;

function scrub(meta?: Meta): Meta | undefined {
  if (!meta) return undefined;
  const out: Meta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE.test(k)) continue;
    if (typeof v === "string" && v.length > 80) {
      out[k] = `${v.slice(0, 40)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function trackStoryEvent(event: StoryFunnelEvent, meta?: Meta): void {
  if (!STORY_FUNNEL_EVENTS.includes(event)) return;
  // purchase_completed is reserved for verified paid webhooks in LIVE mode.
  if (event === "purchase_completed" && meta?.checkout_mode !== "live_verified") {
    console.info("[christmas-story] suppressed purchase_completed (not live_verified)", scrub(meta));
    return;
  }
  const payload = {
    product_family: "christmas_story",
    event,
    meta: scrub(meta),
    ts: new Date().toISOString(),
    path: typeof window !== "undefined" ? window.location.pathname : "",
  };
  if (typeof window !== "undefined") {
    const w = window as Window & { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: `story_${event}`, ...payload });
  }
  if (import.meta.env.DEV) {
    console.info("[christmas-story]", payload);
  }
}

export const PLANNER_FAQS = [
  {
    q: "Is this a PDF?",
    a: "No. Christmas Planner is an interactive planning experience in your browser — countdown, tasks, gifts, budget, meals, and more. It is not a downloadable worksheet.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. The Planner is built mobile-first for Instagram, Facebook, and TikTok traffic, and it also works on desktop.",
  },
  {
    q: "Can I return later?",
    a: "Yes. After payment, create an account or sign in. Your purchase stays attached to that account so you can come back on any device.",
  },
  {
    q: "Do I need the Digital Gifter app?",
    a: "No. You can buy and use the web Planner without the native app. A Christmas Planner app is planned; when it ships, the same account entitlements will unlock premium access.",
  },
  {
    q: "Will there be an app?",
    a: "A native Christmas Planner app is planned. It is not available yet. Web access is what you receive today.",
  },
  {
    q: "Is access tied to my account?",
    a: "Yes, once you sign in or create an account after purchase. Guest checkout is allowed first so you can pay without creating an account.",
  },
  {
    q: "Can I use the wishlist for family?",
    a: "Yes. Wishlist is included in Essentials and above, and can be used for family gift lists. The full Planner application ships in the next release.",
  },
  {
    q: "Can I buy individual packs?",
    a: "Yes. Recipe, hosting, activity, gift ideas, travel, and photo-credit packs can be purchased on their own. If a package already includes a pack, you are not charged for it again.",
  },
  {
    q: "What happens after payment?",
    a: "You land on a welcome page confirming that your Planner is ready. Sign in or create an account to attach access, then continue to your Christmas account.",
  },
  {
    q: "How do refunds and support work?",
    a: "If something goes wrong with payment or access, contact support at https://www.thedigitalgifter.com/support. We do not use fake urgency or hidden add-ons at checkout.",
  },
] as const;

export const PLANNER_AREAS = [
  { title: "My Christmas Plan", body: "One home for the season — countdown, next steps, and a plan that updates as December gets closer." },
  { title: "Gifts", body: "Track who you are buying for, what is bought, and what is still open." },
  { title: "Budget", body: "See spend versus plan so overspending is visible before Christmas Eve." },
  { title: "Christmas Food & Recipes", body: "Plan meals, shopping, and recipes without a pile of notes." },
  { title: "Cards & Messages", body: "Keep card lists and messages together so nobody is forgotten." },
  { title: "Hosting", body: "Guest lists, timing, and hosting tasks in one place." },
  { title: "Activities & Traditions", body: "Save the films, walks, and family rituals you actually want to do." },
  { title: "Travel", body: "Dates, bags, and visits — especially when Christmas is split across households." },
  { title: "Wishlist + Gift Finder", body: "Build lists and find gifts without bouncing between apps." },
  { title: "Christmas Memories", body: "A calm place for the photos and moments you want to keep." },
  { title: "Christmas Club", body: "Seasonal community and bonus content where it applies to your package." },
  { title: "Christmas AI Assistant", body: "Coming soon. All-In includes future assistant access when it ships — we will not pretend it is live today." },
] as const;

export const COMPARISON_ROWS: Array<{
  label: string;
  essentials: boolean;
  magic: boolean;
  all_in: boolean;
  soon?: boolean;
}> = [
  { label: "Countdown & Christmas plan", essentials: true, magic: true, all_in: true },
  { label: "Tasks, gifts, budget, shopping, wishlist", essentials: true, magic: true, all_in: true },
  { label: "Meals, hosting, cards, traditions, travel", essentials: false, magic: true, all_in: true },
  { label: "Advanced Gift Finder & Rescue Mode", essentials: false, magic: true, all_in: true },
  { label: "Recipe collection & premium planning", essentials: false, magic: false, all_in: true },
  { label: "Photo credit bonus", essentials: false, magic: false, all_in: true },
  { label: "Future AI Christmas Assistant", essentials: false, magic: false, all_in: true, soon: true },
  { label: "Premium Christmas Club content", essentials: false, magic: false, all_in: true },
];

import { Link } from "react-router-dom";

const PRODUCTS = [
  { label: "Portrait", to: "/admin/christmas-orders", note: "christmas_photo / family / couple / pet" },
  { label: "Santa Video", to: "/admin/christmas-orders", note: "christmas_santa_video jobs" },
  { label: "Tree / Gifts", to: "/admin/christmas-orders", note: "Tree share moderation panel" },
  { label: "Advent", to: "/christmas/advent", note: "Public experience; ledger via Christmas orders" },
  { label: "Wishlist", to: "/christmas/wishlist", note: "Public wishlist + share" },
  { label: "Gift Finder", to: "/christmas/gift-finder", note: "AI finder acquisition" },
  { label: "Cards", to: "/christmas/cards", note: "Card generator" },
  { label: "Messages", to: "/christmas/messages", note: "Message generator" },
  { label: "Send a Gift", to: "/admin/send-a-gift", note: "Prepaid gifts + entitlements" },
  { label: "Orders", to: "/admin/christmas-orders", note: "christmas_orders commerce" },
  { label: "Packages / Catalog", to: "/admin/christmas-orders", note: "christmas_products / packages" },
  { label: "Funnel Analytics", to: "/admin/funnel-analytics", note: "Unified registry" },
] as const;

export default function ChristmasControlCenterPage() {
  return (
    <div className="space-y-6 p-1">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin</p>
        <h1 className="text-2xl font-semibold text-slate-50">Christmas control center</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Discoverable coverage for every Christmas product surface. Private user messages and
          media stay hidden unless an explicit ops action requires them.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <Link
            key={p.label}
            to={p.to}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-600"
          >
            <h2 className="text-base font-medium text-slate-50">{p.label}</h2>
            <p className="mt-1 text-xs text-slate-400">{p.note}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

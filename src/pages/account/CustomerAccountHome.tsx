import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountOverview } from "@/hooks/useAccountOverview";
import { fetchPlannerAccess } from "@/features/christmas/planner/api";
import { PLANNER_BONUS_EVENT_TYPE, PLANNER_PURCHASE_BONUS_CREDITS } from "@/features/christmas/planner/bonusCredits";
import { PLANNER_ACCOUNT_ROUTE } from "@/features/christmas/planner/types";
import type { PlannerAccess } from "@/features/christmas/planner/types";

type OrderRow = {
  id: string;
  product: string;
  amount: string;
  status: string;
  date: string;
  receiptHref?: string | null;
};

type CreationRow = {
  id: string;
  title: string;
  href: string;
  kind: string;
  createdAt: string;
  imageUrl?: string | null;
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format((Number(cents) || 0) / 100);
  } catch {
    return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
  }
}

export default function CustomerAccountHome() {
  const { user } = useAuth();
  const { creditsRemaining, refresh } = useAccountOverview();
  const [access, setAccess] = useState<PlannerAccess | null>(null);
  const [bonusReceived, setBonusReceived] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [creations, setCreations] = useState<CreationRow[]>([]);
  const [busyDelete, setBusyDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    let cancelled = false;
    async function load() {
      const planner = await fetchPlannerAccess().catch(() => null);
      if (!cancelled) setAccess(planner);

      const uid = user?.id;
      if (!uid) return;

      const [{ data: bonusRows }, { data: xmasOrders }, { data: creditOrders }, { data: gens }] = await Promise.all([
        supabase.from("credits_ledger").select("id").eq("event_type", PLANNER_BONUS_EVENT_TYPE).eq("user_id", uid).limit(1),
        supabase
          .from("christmas_orders")
          .select("id,product_key,package_key,amount_cents,currency,payment_status,created_at,stripe_checkout_session_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("orders")
          .select("id,pack,product_type,amount_total_cents,amount,currency,status,created_at,stripe_session_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("generations")
          .select("id,status,final_image_url,result_image_url,preview_image_url,created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      setBonusReceived((bonusRows || []).length > 0);
      const mapped: OrderRow[] = [];
      for (const row of xmasOrders || []) {
        mapped.push({
          id: row.id,
          product: row.product_key === "christmas_planner_2026" ? "Christmas Planner 2026" : String(row.product_key),
          amount: money(Number(row.amount_cents || 0), String(row.currency || "usd")),
          status: String(row.payment_status || "unknown"),
          date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "",
        });
      }
      for (const row of creditOrders || []) {
        mapped.push({
          id: row.id,
          product: String(row.pack || row.product_type || "Credits"),
          amount: money(Number(row.amount_total_cents || Number(row.amount || 0) * 100), String(row.currency || "eur")),
          status: String(row.status || "unknown"),
          date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "",
        });
      }
      setOrders(mapped);
      setCreations(
        (gens || []).map((item) => ({
          id: item.id,
          title: `Creation ${item.id.slice(0, 8)}`,
          href: `/funnel/result?id=${encodeURIComponent(item.id)}`,
          kind: "image",
          createdAt: item.created_at ? new Date(item.created_at).toLocaleDateString() : "",
          imageUrl: item.final_image_url || item.result_image_url || item.preview_image_url,
        })),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh, user?.email, user?.id]);

  const productStatus = useMemo(() => {
    if (access?.access_source === "qa_grant") return "QA test access";
    if (access?.paid) return "Active";
    if (access?.ok) return "Free";
    return "Free";
  }, [access]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  async function deleteAccount() {
    if (!window.confirm("Permanently delete your account and personal data? This cannot be undone.")) return;
    setBusyDelete(true);
    setMessage(null);
    const { error } = await supabase.functions.invoke("delete-my-account", { body: {} });
    setBusyDelete(false);
    if (error) {
      setMessage(error.message || "Could not delete account.");
      return;
    }
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  return (
    <div className="space-y-8" data-testid="customer-account-home">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Your account</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Welcome back.</h1>
        <p className="mt-2 text-sm text-zinc-400">Your planner, credits, orders, and creations in one place.</p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold text-white">My products</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4">
          <div>
            <p className="font-medium text-white">Christmas Planner 2026</p>
            <p className="text-sm text-zinc-400">{productStatus}</p>
            {access?.access_source === "qa_grant" ? (
              <p className="mt-1 text-xs text-amber-200">Test access is on. It is not a paid order and does not include purchase credits.</p>
            ) : null}
          </div>
          {access?.paid ? (
            <Link className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950" to={PLANNER_ACCOUNT_ROUTE}>
              Open Planner
            </Link>
          ) : (
            <Link className="rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-zinc-950" to="/christmas/planner">
              Get my Planner
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold text-white">AI credits</h2>
        <p className="mt-2 text-3xl font-semibold text-[#ffd976]">{creditsRemaining}</p>
        <p className="mt-1 text-sm text-zinc-400">
          {bonusReceived
            ? `Founding Pass bonus of ${PLANNER_PURCHASE_BONUS_CREDITS} credits received.`
            : "No Founding Pass bonus on this account yet."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="rounded-full border border-white/15 px-4 py-2 text-sm" to="/pricing">
            Buy more credits
          </Link>
          <Link className="rounded-full border border-white/15 px-4 py-2 text-sm" to="/generator?category=image">
            Create image
          </Link>
          <Link className="rounded-full border border-white/15 px-4 py-2 text-sm" to="/generator?category=video">
            Create video
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold text-white">Recent creations</h2>
        {creations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No images or videos yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {creations.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-2xl border border-white/10">
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-36 w-full object-cover" /> : null}
                <div className="flex items-center justify-between p-3 text-sm">
                  <span>{item.title}</span>
                  <a className="text-amber-200" href={item.href}>
                    Open
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold text-white">Orders</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No orders yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2">Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-white/10">
                    <td className="py-2">{order.product}</td>
                    <td>{order.amount}</td>
                    <td>{order.status}</td>
                    <td>{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">Receipts are sent to your purchase email when Stripe provides them.</p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-semibold text-white">Account</h2>
        <p className="mt-2 text-sm text-zinc-300">{user?.email || "No email"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-full border border-white/15 px-4 py-2 text-sm" onClick={() => void logout()}>
            Log out
          </button>
          <button
            type="button"
            className="rounded-full border border-red-400/30 px-4 py-2 text-sm text-red-200"
            disabled={busyDelete}
            onClick={() => void deleteAccount()}
          >
            {busyDelete ? "Deleting…" : "Delete my account"}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-red-300">{message}</p> : null}
      </section>
    </div>
  );
}

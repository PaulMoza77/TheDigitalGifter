import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, RefreshCw, SlidersHorizontal, Workflow } from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/PageHead";
import { Button } from "@/components/ui/button";
import { SectionCard, StatCard } from "@/components/admin/overview/AdminOverviewCards";
import {
  buildChristmasControlSnapshot,
  CHRISTMAS_CONTROL_PRIMARY_LINKS,
  CHRISTMAS_ORDERS_PATH,
  isChristmasControlEmpty,
  type ControlFunnelRow,
  type ControlOrderRow,
  type ControlPackageRow,
  type ControlProductRow,
} from "@/features/christmas/adminControl/controlCore";
import { loadChristmasControlSources } from "@/features/christmas/adminControl/controlService";

const LINK_ICONS = {
  orders: Gift,
  "send-a-gift": Gift,
  funnels: Workflow,
} as const;

export default function ChristmasControlCenterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [orders, setOrders] = useState<ControlOrderRow[]>([]);
  const [events, setEvents] = useState<ControlFunnelRow[]>([]);
  const [products, setProducts] = useState<ControlProductRow[]>([]);
  const [packages, setPackages] = useState<ControlPackageRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await loadChristmasControlSources();
    if (result.errors.length === 4) {
      setError(result.errors.join(" · ") || "Failed to load Christmas ops");
      setOrders([]);
      setEvents([]);
      setProducts([]);
      setPackages([]);
      setPartialErrors([]);
      setLoading(false);
      return;
    }

    setOrders(result.orders);
    setEvents(result.events);
    setProducts(result.products);
    setPackages(result.packages);
    setPartialErrors(result.errors);
    setLoading(false);
    if (result.errors.length) {
      toast.message("Some Christmas ops sources failed", {
        description: result.errors.join(" · "),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snap = useMemo(
    () =>
      buildChristmasControlSnapshot({
        orders,
        events,
        products,
        packages,
      }),
    [orders, events, products, packages],
  );

  const empty = !loading && !error && isChristmasControlEmpty(snap);

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-5 text-white sm:px-6 lg:px-8">
      <PageHead
        title="Christmas Control"
        description="Christmas suite ops control center"
        noindex
      />

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Christmas · Ops
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
              <SlidersHorizontal className="h-6 w-6 text-slate-300" />
              Christmas control center
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              One admin surface for Christmas suite operations — orders, Send a Gift,
              and funnels. Counts and catalog flags only. No emails, tokens, media, or
              customer dumps. Founder conversion KPIs live on a separate dashboard.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 bg-slate-900"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {CHRISTMAS_CONTROL_PRIMARY_LINKS.map((link) => {
            const Icon = LINK_ICONS[link.id];
            return (
              <Link
                key={link.id}
                to={link.to}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-600"
              >
                <div className="flex items-center gap-2 text-slate-200">
                  <Icon className="h-4 w-4" />
                  <h2 className="text-base font-medium text-slate-50">{link.label}</h2>
                </div>
                <p className="mt-1 text-xs text-slate-400">{link.note}</p>
              </Link>
            );
          })}
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}
        {partialErrors.length ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Partial load: {partialErrors.join(" · ")}
          </p>
        ) : null}

        <SectionCard
          title="Needs attention"
          subtitle="Fulfillment and payment exceptions from christmas_orders. Not conversion KPIs."
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading live ops…</p>
          ) : empty ? (
            <p className="text-sm text-slate-500">
              No Christmas orders or funnel events in the live window. Suite links stay
              available; counts are not mocked.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Fulfillment failed"
                value={String(snap.attention.fulfillmentFailed)}
                helper="Open Christmas Orders to retry"
              />
              <StatCard
                label="Queued"
                value={String(snap.attention.fulfillmentQueued)}
              />
              <StatCard
                label="Processing"
                value={String(snap.attention.fulfillmentProcessing)}
              />
              <StatCard
                label="Payment failed"
                value={String(snap.attention.paymentFailed)}
              />
            </div>
          )}
        </SectionCard>

        <section id="send-a-gift" className="scroll-mt-20">
          <SectionCard
            title="Send a Gift"
            subtitle="Prepaid gift ops. Recipient emails and share tokens stay off this page."
          >
            {snap.sendAGift.inLiveCatalog ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Gift orders" value={String(snap.sendAGift.orders)} />
                <StatCard label="Paid" value={String(snap.sendAGift.paid)} />
                <StatCard
                  label="Funnel sessions"
                  value={String(snap.sendAGift.funnelSessions)}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Send-a-Gift is not in the live Christmas catalog on this environment.
                When the prepaid funnel ships, aggregates appear here. Use{" "}
                <Link className="text-indigo-300 underline" to={CHRISTMAS_ORDERS_PATH}>
                  Christmas Orders
                </Link>{" "}
                for commerce rows.
              </p>
            )}
            {snap.sendAGift.fulfillmentFailed > 0 ? (
              <p className="mt-3 text-sm text-amber-200">
                {snap.sendAGift.fulfillmentFailed} Send-a-Gift fulfillment failure
                {snap.sendAGift.fulfillmentFailed === 1 ? "" : "s"} — open orders to
                inspect (no PII on this surface).
              </p>
            ) : null}
          </SectionCard>
        </section>

        <section id="funnels" className="scroll-mt-20">
          <SectionCard
            title="Funnels"
            subtitle="Public Christmas suite routes plus first-party session volume. Unique sessions, not cohort conversion."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snap.products.map((product) => (
                <article
                  key={product.productKey}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-slate-50">{product.label}</h3>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">
                        {product.productKey}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      {product.ctaState.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {product.orders} orders · {product.paid} paid · {product.funnelSessions}{" "}
                    sessions
                    {product.fulfillmentFailed
                      ? ` · ${product.fulfillmentFailed} failed fulfill`
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <Link
                      className="text-indigo-300 underline"
                      to={product.routePath}
                    >
                      Open funnel
                    </Link>
                    <Link className="text-indigo-300 underline" to={product.adminHref}>
                      Orders
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </section>
      </div>
    </div>
  );
}

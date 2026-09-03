import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw, Search, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ChristmasOrderRow = {
  id: string;
  email: string | null;
  product_key: string;
  package_key: string;
  style_key?: string | null;
  portrait_type?: string | null;
  species?: string | null;
  source_route?: string | null;
  amount_cents: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  last_error: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  affiliate_ref: string | null;
  landing_path: string | null;
  created_at: string;
  paid_at: string | null;
  model_name?: string | null;
  generation_started_at?: string | null;
  generation_finished_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

const PRODUCT_FILTER_PRESETS = [
  { value: "", label: "All products" },
  { value: "christmas_photo", label: "Christmas Photo" },
  { value: "christmas_family", label: "Family" },
  { value: "christmas_couple", label: "Couple" },
  { value: "christmas_pet", label: "Pet" },
];

const SPECIES_FILTER_PRESETS = [
  { value: "", label: "All species" },
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
];

function money(cents: number, currency: string) {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function ChristmasOrdersPage() {
  const [rows, setRows] = useState<ChristmasOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [selected, setSelected] = useState<ChristmasOrderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("christmas_orders")
      .select(
        "id,email,product_key,package_key,style_key,portrait_type,species,source_route,amount_cents,currency,payment_status,fulfillment_status,stripe_checkout_session_id,stripe_payment_intent_id,last_error,utm_source,utm_campaign,affiliate_ref,landing_path,created_at,paid_at,model_name,generation_started_at,generation_finished_at,metadata",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error(error.message || "Failed to load Christmas orders");
      setRows([]);
    } else {
      setRows((data || []) as ChristmasOrderRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (paymentFilter && row.payment_status !== paymentFilter) return false;
      if (fulfillmentFilter && row.fulfillment_status !== fulfillmentFilter) return false;
      if (productFilter && row.product_key !== productFilter) return false;
      if (speciesFilter && row.species !== speciesFilter) return false;
      if (!q) return true;
      return (
        row.id.toLowerCase().includes(q) ||
        (row.email || "").toLowerCase().includes(q) ||
        row.product_key.toLowerCase().includes(q) ||
        (row.portrait_type || "").toLowerCase().includes(q) ||
        (row.species || "").toLowerCase().includes(q) ||
        (row.stripe_checkout_session_id || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, paymentFilter, fulfillmentFilter, productFilter, speciesFilter]);

  const products = useMemo(() => {
    const fromRows = Array.from(new Set(rows.map((r) => r.product_key)));
    const presets = PRODUCT_FILTER_PRESETS.map((p) => p.value).filter(Boolean);
    return Array.from(new Set([...presets, ...fromRows])).sort();
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-slate-300" />
          <div>
            <h1 className="text-xl font-semibold text-white">Christmas orders</h1>
            <p className="text-sm text-slate-400">
              Payment and fulfillment observability foundation (no child PII fields).
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            className="pl-8"
            placeholder="Search id, email, product, Stripe session"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
        >
          {PRODUCT_FILTER_PRESETS.map((p) => (
            <option key={p.value || "all"} value={p.value}>
              {p.label}
            </option>
          ))}
          {products
            .filter((p) => !PRODUCT_FILTER_PRESETS.some((x) => x.value === p))
            .map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
        </select>
        <select
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          value={speciesFilter}
          onChange={(e) => setSpeciesFilter(e.target.value)}
        >
          {SPECIES_FILTER_PRESETS.map((p) => (
            <option key={p.value || "all-species"} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
        >
          <option value="">All payment</option>
          {["draft", "pending", "paid", "failed", "refunded"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          value={fulfillmentFilter}
          onChange={(e) => setFulfillmentFilter(e.target.value)}
        >
          <option value="">All fulfillment</option>
          {["not_started", "queued", "processing", "completed", "failed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type / species</TableHead>
              <TableHead>Style</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Stripe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-slate-500">
                  {loading ? "Loading…" : "No Christmas orders yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-900/60"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="whitespace-nowrap text-xs text-slate-400">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm">
                    {row.email || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{row.product_key}</TableCell>
                  <TableCell className="text-sm">
                    {[row.portrait_type, row.species].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{row.style_key || "—"}</TableCell>
                  <TableCell className="text-sm">{row.package_key}</TableCell>
                  <TableCell className="text-sm">
                    {money(row.amount_cents, row.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.payment_status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.fulfillment_status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate font-mono text-xs text-slate-400">
                    {row.stripe_checkout_session_id || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Order detail</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Order id</dt>
              <dd className="font-mono text-xs">{selected.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Paid at</dt>
              <dd>{selected.paid_at ? new Date(selected.paid_at).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Payment intent</dt>
              <dd className="font-mono text-xs">{selected.stripe_payment_intent_id || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Last error</dt>
              <dd>{selected.last_error || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Landing</dt>
              <dd>{selected.landing_path || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">UTM</dt>
              <dd>
                {[selected.utm_source, selected.utm_campaign].filter(Boolean).join(" / ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Portrait / species</dt>
              <dd>
                {[selected.portrait_type, selected.species].filter(Boolean).join(" · ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Source route</dt>
              <dd className="font-mono text-xs">{selected.source_route || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Style / model</dt>
              <dd>
                {selected.style_key || "—"}
                {selected.model_name ? ` · ${selected.model_name}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">AI cost (est.)</dt>
              <dd>
                {typeof selected.metadata?.estimated_cost_usd === "number"
                  ? `~$${selected.metadata.estimated_cost_usd}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Generation window</dt>
              <dd className="text-xs">
                {selected.generation_started_at
                  ? new Date(selected.generation_started_at).toLocaleString()
                  : "—"}
                {" → "}
                {selected.generation_finished_at
                  ? new Date(selected.generation_finished_at).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Affiliate</dt>
              <dd>{selected.affiliate_ref || "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

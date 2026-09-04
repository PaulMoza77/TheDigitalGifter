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

type TreeAdminRow = {
  id: string;
  account: string;
  user_id: string | null;
  share_enabled: boolean;
  tree_style: string;
  moderation_status: string;
  gift_count: number;
  views: number;
  shares: number;
  opens: number;
  created_at: string;
  locale: string | null;
};

type SantaJobRow = {
  job_status: string;
  script_status: string;
  audio_status: string;
  video_status: string;
  language: string;
  template_key: string;
  provider_script: string | null;
  provider_tts: string | null;
  provider_video: string | null;
  model_script: string | null;
  model_tts: string | null;
  model_video: string | null;
  cost_script_usd: number | null;
  cost_tts_usd: number | null;
  cost_still_usd: number | null;
  cost_video_usd: number | null;
  cost_total_usd: number | null;
  error_code: string | null;
  error_message_safe: string | null;
  started_at: string | null;
  completed_at: string | null;
  result_video_path: string | null;
};

const PRODUCT_FILTER_PRESETS = [
  { value: "", label: "All products" },
  { value: "christmas_photo", label: "Christmas Photo" },
  { value: "christmas_family", label: "Family" },
  { value: "christmas_couple", label: "Couple" },
  { value: "christmas_pet", label: "Pet" },
  { value: "christmas_santa_video", label: "Santa Video" },
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
  const [trees, setTrees] = useState<TreeAdminRow[]>([]);
  const [treesLoading, setTreesLoading] = useState(false);
  const [wishlists, setWishlists] = useState<
    Array<{
      id: string;
      account: string;
      share_enabled: boolean;
      moderation_status: string;
      item_count: number;
      views: number;
      shares: number;
      external_clicks: number;
      created_at: string;
    }>
  >([]);
  const [wishlistsLoading, setWishlistsLoading] = useState(false);
  const [msgStats, setMsgStats] = useState<{
    totals?: { sessions: number; completed: number; failed: number; fallback: number };
    recent?: Array<Record<string, unknown>>;
  } | null>(null);
  const [cardStats, setCardStats] = useState<{
    totals?: {
      projects: number;
      rendered: number;
      downloads: number;
      shares: number;
      failures: number;
    };
    recent?: Array<Record<string, unknown>>;
  } | null>(null);
  const [cardsMsgLoading, setCardsMsgLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [selected, setSelected] = useState<ChristmasOrderRow | null>(null);
  const [santaJob, setSantaJob] = useState<SantaJobRow | null>(null);
  const [santaBusy, setSantaBusy] = useState(false);

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

  const loadTrees = useCallback(async () => {
    setTreesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("christmas-tree-funnel", {
        body: { action: "adminListTrees" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      setTrees((data?.trees || []) as TreeAdminRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load trees");
      setTrees([]);
    } finally {
      setTreesLoading(false);
    }
  }, []);

  const disableTreeShare = useCallback(async (treeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("christmas-tree-funnel", {
        body: { action: "adminDisableShare", tree_id: treeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success("Tree sharing disabled");
      void loadTrees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disable failed");
    }
  }, [loadTrees]);

  const loadWishlists = useCallback(async () => {
    setWishlistsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("christmas-wishlist-funnel", {
        body: { action: "adminListWishlists" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      setWishlists(data?.wishlists || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load wishlists");
      setWishlists([]);
    } finally {
      setWishlistsLoading(false);
    }
  }, []);

  const loadCardsMessagesStats = useCallback(async () => {
    setCardsMsgLoading(true);
    try {
      const [msg, cards] = await Promise.all([
        supabase.functions.invoke("christmas-cards-messages-funnel", {
          body: { action: "adminMessageStats" },
        }),
        supabase.functions.invoke("christmas-cards-messages-funnel", {
          body: { action: "adminCardStats" },
        }),
      ]);
      if (msg.error) throw msg.error;
      if (cards.error) throw cards.error;
      const m = (msg.data || {}) as Record<string, unknown>;
      const c = (cards.data || {}) as Record<string, unknown>;
      setMsgStats({
        totals: {
          sessions: Number(m.sessions ?? 0) || 0,
          completed: Number(m.completed ?? 0) || 0,
          failed: Number(m.failed ?? 0) || 0,
          fallback: Number(m.fallback_used ?? m.fallback ?? 0) || 0,
        },
        recent: Array.isArray(m.recent) ? (m.recent as Array<Record<string, unknown>>) : [],
      });
      setCardStats({
        totals: {
          projects: Number(c.projects ?? 0) || 0,
          rendered: Number(c.renders ?? c.rendered ?? 0) || 0,
          downloads: Number(c.downloads ?? 0) || 0,
          shares: Number(c.shares ?? 0) || 0,
          failures: Number(c.render_failures ?? c.failures ?? 0) || 0,
        },
        recent: Array.isArray(c.recent) ? (c.recent as Array<Record<string, unknown>>) : [],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load cards/messages stats");
    } finally {
      setCardsMsgLoading(false);
    }
  }, []);

  const disableWishlistShare = useCallback(async (wishlistId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("christmas-wishlist-funnel", {
        body: { action: "adminDisableWishlistShare", wishlist_id: wishlistId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success("Wishlist sharing disabled");
      void loadWishlists();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disable failed");
    }
  }, [loadWishlists]);

  useEffect(() => {
    void loadTrees();
  }, [loadTrees]);

  useEffect(() => {
    void loadWishlists();
  }, [loadWishlists]);

  useEffect(() => {
    void loadCardsMessagesStats();
  }, [loadCardsMessagesStats]);

  useEffect(() => {
    let cancelled = false;
    async function loadSanta() {
      setSantaJob(null);
      if (!selected || selected.product_key !== "christmas_santa_video") return;
      const { data, error } = await supabase
        .from("christmas_santa_video_jobs")
        .select(
          "job_status,script_status,audio_status,video_status,language,template_key,provider_script,provider_tts,provider_video,model_script,model_tts,model_video,cost_script_usd,cost_tts_usd,cost_still_usd,cost_video_usd,cost_total_usd,error_code,error_message_safe,started_at,completed_at,result_video_path",
        )
        .eq("order_id", selected.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error(error.message || "Failed to load Santa job");
        return;
      }
      setSantaJob((data || null) as SantaJobRow | null);
    }
    void loadSanta();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const retrySanta = useCallback(async () => {
    if (!selected || selected.product_key !== "christmas_santa_video") return;
    if (selected.payment_status !== "paid") {
      toast.error("Paid entitlement required");
      return;
    }
    setSantaBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("christmas-santa-funnel", {
        body: { action: "retryGeneration", order_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      toast.success("Santa retry queued (no new charge)");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setSantaBusy(false);
    }
  }, [selected, load]);

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

      <div className="rounded-lg border border-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Christmas trees</h2>
            <p className="text-xs text-slate-500">
              Aggregates only — no gift messages. Disable sharing for abuse.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadTrees()}
            disabled={treesLoading}
          >
            Refresh trees
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Style</TableHead>
              <TableHead>Share</TableHead>
              <TableHead>Gifts</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Opens</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {trees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-slate-500">
                  {treesLoading ? "Loading…" : "No trees yet"}
                </TableCell>
              </TableRow>
            ) : (
              trees.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id.slice(0, 8)}…</TableCell>
                  <TableCell>{t.account}</TableCell>
                  <TableCell>{t.tree_style}</TableCell>
                  <TableCell>{t.share_enabled ? "on" : "off"}</TableCell>
                  <TableCell>{t.gift_count}</TableCell>
                  <TableCell>{t.views}</TableCell>
                  <TableCell>{t.opens}</TableCell>
                  <TableCell>{t.moderation_status}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void disableTreeShare(t.id)}
                    >
                      Disable
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Christmas wishlists</h2>
            <p className="text-xs text-slate-500">Aggregates only — no item notes. Disable sharing for abuse.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadWishlists()}
            disabled={wishlistsLoading}
          >
            Refresh wishlists
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Share</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {wishlists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-slate-500">
                  {wishlistsLoading ? "Loading…" : "No wishlists yet"}
                </TableCell>
              </TableRow>
            ) : (
              wishlists.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono text-xs">{w.id.slice(0, 8)}…</TableCell>
                  <TableCell>{w.account}</TableCell>
                  <TableCell>{w.share_enabled ? "on" : "off"}</TableCell>
                  <TableCell>{w.item_count}</TableCell>
                  <TableCell>{w.views}</TableCell>
                  <TableCell>{w.external_clicks}</TableCell>
                  <TableCell>{w.moderation_status}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => void disableWishlistShare(w.id)}>
                      Disable
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Cards &amp; messages</h2>
            <p className="text-xs text-slate-500">
              Aggregates only — no message bodies or card photos.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadCardsMessagesStats()}
            disabled={cardsMsgLoading}
          >
            Refresh stats
          </Button>
        </div>
        <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
          <div className="rounded border border-slate-800 p-3">
            <p className="font-medium text-white">Message generator</p>
            <p className="mt-1">
              sessions {msgStats?.totals?.sessions ?? "—"} · completed {msgStats?.totals?.completed ?? "—"} ·
              failed {msgStats?.totals?.failed ?? "—"} · fallback {msgStats?.totals?.fallback ?? "—"}
            </p>
          </div>
          <div className="rounded border border-slate-800 p-3">
            <p className="font-medium text-white">Cards</p>
            <p className="mt-1">
              projects {cardStats?.totals?.projects ?? "—"} · rendered {cardStats?.totals?.rendered ?? "—"} ·
              downloads {cardStats?.totals?.downloads ?? "—"} · shares {cardStats?.totals?.shares ?? "—"} ·
              failures {cardStats?.totals?.failures ?? "—"}
            </p>
          </div>
        </div>
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
          {selected.product_key === "christmas_santa_video" ? (
            <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-white">Santa job</h3>
                {selected.payment_status === "paid" &&
                santaJob &&
                santaJob.job_status === "failed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={santaBusy}
                    onClick={() => void retrySanta()}
                  >
                    Retry failed Santa generation
                  </Button>
                ) : null}
              </div>
              {santaJob ? (
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Job / stages</dt>
                    <dd className="text-xs">
                      {santaJob.job_status} · script={santaJob.script_status} · audio=
                      {santaJob.audio_status} · video={santaJob.video_status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Language / template</dt>
                    <dd>
                      {santaJob.language} · {santaJob.template_key}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Providers</dt>
                    <dd className="text-xs">
                      {[santaJob.provider_script, santaJob.provider_tts, santaJob.provider_video]
                        .filter(Boolean)
                        .join(" → ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Models</dt>
                    <dd className="text-xs">
                      {[santaJob.model_script, santaJob.model_tts, santaJob.model_video]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Cost stages (est.)</dt>
                    <dd className="text-xs">
                      script {santaJob.cost_script_usd ?? "—"} · tts {santaJob.cost_tts_usd ?? "—"} ·
                      still {santaJob.cost_still_usd ?? "—"} · video {santaJob.cost_video_usd ?? "—"}{" "}
                      · total {santaJob.cost_total_usd ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Safe error</dt>
                    <dd className="text-xs">
                      {santaJob.error_code
                        ? `${santaJob.error_code}: ${santaJob.error_message_safe || ""}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Result path</dt>
                    <dd className="font-mono text-xs">{santaJob.result_video_path || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Timestamps</dt>
                    <dd className="text-xs">
                      {santaJob.started_at
                        ? new Date(santaJob.started_at).toLocaleString()
                        : "—"}
                      {" → "}
                      {santaJob.completed_at
                        ? new Date(santaJob.completed_at).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-slate-500">No Santa job row yet.</p>
              )}
              <p className="text-xs text-slate-500">
                Child free-text personalization is hidden by default for privacy.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

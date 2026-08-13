import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getPublicSupabaseConfig } from "@/lib/env";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { isCheckoutEnabled, productTruth } from "@/config/productTruth";
import { productModel } from "@/config/productModel";
import {
  RefreshCw,
  Sparkles,
  Crown,
  Puzzle,
  Image as ImageIcon,
  Download,
  ArrowLeft,
  Home,
  LayoutDashboard,
  Plus,
} from "lucide-react";

const HOME_ROUTE = "/";
const DASHBOARD_ROUTE = "/account/dashboard";
const NEW_GIFT_ROUTE = "/funnel/uploadPhoto";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type ActionType = "full_hd" | "regenerate" | "golden_frame" | "puzzle";
type CheckoutLoadingState = Record<ActionType, boolean>;

type ResultRow = {
  id: string;
  status: string | null;
  final_image_url: string | null;
  result_image_url: string | null;
  preview_image_url: string | null;
  source_image_url: string | null;
  template_id: string | null;
  style_id: string | null;
  style_slug: string | null;
  prompt: string | null;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UpgradeRpcRow = {
  fulfillment_id: string | null;
  generation_id: string | null;
  action_type: string | null;
  fulfillment_status: string | null;
  output_generation_id: string | null;
  output_image_url: string | null;
  final_image_url: string | null;
  generation_status: string | null;
  generation_created_at: string | null;
  generation_updated_at: string | null;
};

type PricingItemRow = {
  id: string;
  key: string;
  category: string | null;
  name: string | null;
  description: string | null;
  price_cents: number | string | null;
  currency: string | null;
  credits: number | string | null;
  stripe_price_id: string | null;
  active: boolean | null;
  sort_order: number | string | null;
  metadata: Record<string, unknown> | null;
};

type OfferItem = {
  actionType: ActionType;
  title: string;
  priceLabel: string;
  description: string;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  featured: boolean;
  sortOrder: number;
};

type EdgeJson = {
  url?: string;
  id?: string;
  error?: string;
  message?: string;
  imageUrl?: string;
  checkout_url?: string;
};

const FALLBACK_OFFERS: OfferItem[] = [
  {
    actionType: "full_hd",
    title: "Unlock additional download",
    priceLabel: "€0.99",
    description: "An additional download option for this result.",
    cta: "Continue",
    icon: ImageIcon,
    featured: false,
    sortOrder: 10,
  },
  {
    actionType: "golden_frame",
    title: "Add Golden Frame",
    priceLabel: "€4.99",
    description:
      "Your image is reprocessed with a premium golden-frame prompt for an elegant, gift-ready finish.",
    cta: "Add Golden Frame",
    icon: Crown,
    featured: true,
    sortOrder: 20,
  },
  {
    actionType: "puzzle",
    title: "Turn into Puzzle",
    priceLabel: "€14.99",
    description:
      "Your image is reprocessed with a premium puzzle-style prompt for a printable puzzle gift look.",
    cta: "Turn into Puzzle",
    icon: Puzzle,
    featured: false,
    sortOrder: 30,
  },
  {
    actionType: "regenerate",
    title: "Regenerate",
    priceLabel: "€0.70",
    description: "Create a fresh variation of your current gift image.",
    cta: "Regenerate",
    icon: Sparkles,
    featured: false,
    sortOrder: 40,
  },
];

async function getEdgeFunctionHeaders(
  anonKey: string
): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim();

  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
  };
}

async function safeReadJson(res: Response): Promise<EdgeJson> {
  try {
    return (await res.json()) as EdgeJson;
  } catch {
    return {};
  }
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test((value || "").trim());
}

function normalizeStatus(status: string | null) {
  return String(status || "").trim().toLowerCase();
}

function isTerminalSuccess(status: string | null) {
  const s = normalizeStatus(status);
  return ["completed", "ready", "succeeded", "saved"].includes(s);
}

function isTerminalFailure(status: string | null) {
  const s = normalizeStatus(status);
  return ["failed", "error", "canceled", "cancelled"].includes(s);
}

function formatStatus(status: string | null) {
  const s = normalizeStatus(status);
  if (!s) return "waiting";
  return s;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCurrency(value: unknown) {
  const currency = String(value || "eur").trim().toUpperCase();
  return currency || "EUR";
}

function formatMoney(cents: unknown, currency: unknown) {
  const amount = toNumber(cents, 0) / 100;
  const code = normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function actionTypeFromPricingKey(key: string): ActionType | null {
  const normalized = String(key || "").trim().toLowerCase();

  if (normalized === "offer_full_hd" || normalized === "full_hd") return "full_hd";
  if (normalized === "offer_regenerate" || normalized === "regenerate") return "regenerate";
  if (normalized === "offer_golden_frame" || normalized === "golden_frame") {
    return "golden_frame";
  }
  if (normalized === "offer_puzzle" || normalized === "puzzle") return "puzzle";

  return null;
}

function fallbackOfferFor(actionType: ActionType) {
  return FALLBACK_OFFERS.find((offer) => offer.actionType === actionType);
}

function iconForAction(actionType: ActionType) {
  if (actionType === "full_hd") return ImageIcon;
  if (actionType === "golden_frame") return Crown;
  if (actionType === "puzzle") return Puzzle;
  return Sparkles;
}

function boolFromMetadata(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(v)) return true;
    if (["false", "0", "no"].includes(v)) return false;
  }
  return fallback;
}

function ctaFromAction(actionType: ActionType, title: string) {
  if (actionType === "full_hd") return title || "Additional download";
  if (actionType === "golden_frame") return "Add Golden Frame";
  if (actionType === "puzzle") return "Turn into Puzzle";
  if (actionType === "regenerate") return "Regenerate";
  return title;
}

function mapPricingItemToOffer(item: PricingItemRow): OfferItem | null {
  const actionType = actionTypeFromPricingKey(item.key);
  if (!actionType) return null;

  const fallback = fallbackOfferFor(actionType);

  const title = String(item.name || fallback?.title || item.key).trim();
  const description = String(item.description || fallback?.description || "").trim();
  const priceLabel =
    item.price_cents !== null && item.price_cents !== undefined
      ? formatMoney(item.price_cents, item.currency)
      : fallback?.priceLabel || "";
  const sortOrder = toNumber(item.sort_order, fallback?.sortOrder ?? 999);
  const featured = boolFromMetadata(item.metadata?.featured, fallback?.featured ?? false);

  return {
    actionType,
    title,
    priceLabel,
    description,
    cta: String(item.metadata?.cta || ctaFromAction(actionType, title)),
    icon: iconForAction(actionType),
    featured,
    sortOrder,
  };
}

async function resolveImageUrl(row: ResultRow): Promise<string | null> {
  const candidates = [
    row.final_image_url,
    row.result_image_url,
    row.preview_image_url,
  ];

  for (const value of candidates) {
    const url = String(value || "").trim();
    if (url && isHttpUrl(url)) return url;
  }

  return null;
}

function normalizeResultRow(input: unknown): ResultRow | null {
  if (!input) return null;

  const row = Array.isArray(input) ? input[0] : input;
  if (!row || typeof row !== "object") return null;

  const r = row as Record<string, unknown>;

  return {
    id: String(r.id ?? ""),
    status: (r.status as string | null) ?? null,
    final_image_url: (r.final_image_url as string | null) ?? null,
    result_image_url: (r.result_image_url as string | null) ?? null,
    preview_image_url: (r.preview_image_url as string | null) ?? null,
    source_image_url: (r.source_image_url as string | null) ?? null,
    template_id: (r.template_id as string | null) ?? null,
    style_id: (r.style_id as string | null) ?? null,
    style_slug: (r.style_slug as string | null) ?? null,
    prompt: (r.prompt as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

function normalizeUpgradeRpcRow(input: unknown): UpgradeRpcRow | null {
  if (!input) return null;

  const row = Array.isArray(input) ? input[0] : input;
  if (!row || typeof row !== "object") return null;

  const r = row as Record<string, unknown>;

  return {
    fulfillment_id: (r.fulfillment_id as string | null) ?? null,
    generation_id: (r.generation_id as string | null) ?? null,
    action_type: (r.action_type as string | null) ?? null,
    fulfillment_status: (r.fulfillment_status as string | null) ?? null,
    output_generation_id: (r.output_generation_id as string | null) ?? null,
    output_image_url: (r.output_image_url as string | null) ?? null,
    final_image_url: (r.final_image_url as string | null) ?? null,
    generation_status: (r.generation_status as string | null) ?? null,
    generation_created_at: (r.generation_created_at as string | null) ?? null,
    generation_updated_at: (r.generation_updated_at as string | null) ?? null,
  };
}

export default function ResultPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const generationIdFromId = String(q.get("id") || "").trim();
  const generationIdFromUrl = String(q.get("generation_id") || "").trim();
  const generationId = generationIdFromId || generationIdFromUrl;

  const sessionId = String(q.get("session_id") || "").trim();
  const orderId = String(q.get("order_id") || "").trim();
  const checkoutSessionId = String(q.get("checkout_session_id") || "").trim();
  const upgradeSuccess = String(q.get("upgrade_success") || "").trim() === "1";
  const upgradeCanceled = String(q.get("upgrade_canceled") || "").trim() === "1";

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ResultRow | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [upgradeStatus, setUpgradeStatus] = useState("");
  const [offers, setOffers] = useState<OfferItem[]>(FALLBACK_OFFERS);
  const [offersLoading, setOffersLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<CheckoutLoadingState>({
    full_hd: false,
    regenerate: false,
    golden_frame: false,
    puzzle: false,
  });

  const [includedRegenLoading, setIncludedRegenLoading] = useState(false);
  const [regenUsed, setRegenUsed] = useState(0);
  const [regenAllowed, setRegenAllowed] = useState<number>(
    productModel.includedRegenerations,
  );
  const [resolvedOrderId, setResolvedOrderId] = useState(orderId);

  const stepLabel = useMemo(() => "3 of 3", []);
  const pageBg = useMemo(() => ({ background: "#f6f1ea" as const }), []);
  const normalizedStatus = useMemo(
    () => formatStatus(row?.status ?? null),
    [row?.status]
  );

  const anyCheckoutLoading = Object.values(checkoutLoading).some(Boolean);
  const canBuy = Boolean(imageUrl) && Boolean(row?.id) && !loading;

  const regenerateOffer = useMemo(
    () => offers.find((offer) => offer.actionType === "regenerate"),
    [offers]
  );

  const visibleBundleOffers = useMemo(
    () =>
      offers
        .filter((offer) => offer.actionType !== "regenerate")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [offers]
  );

  useEffect(() => {
    if (upgradeSuccess) toast.success("Payment successful.");
    if (upgradeCanceled) toast.error("Checkout canceled.");
  }, [upgradeSuccess, upgradeCanceled]);

  useEffect(() => {
    let alive = true;

    async function loadOffers() {
      setOffersLoading(true);

      try {
        const { data, error } = await supabase
          .from("pricing_items")
          .select(
            "id,key,category,name,description,price_cents,currency,credits,stripe_price_id,active,sort_order,metadata"
          )
          .eq("active", true)
          .in("key", [
            "offer_full_hd",
            "offer_regenerate",
            "offer_golden_frame",
            "offer_puzzle",
          ])
          .order("sort_order", { ascending: true });

        if (error) {
          console.warn("[ResultPage] pricing_items load failed:", error.message);
          if (alive) setOffers(FALLBACK_OFFERS);
          return;
        }

        const mapped = ((data ?? []) as PricingItemRow[])
          .map(mapPricingItemToOffer)
          .filter(Boolean) as OfferItem[];

        const mergedByAction = new Map<ActionType, OfferItem>();

        for (const fallback of FALLBACK_OFFERS) {
          mergedByAction.set(fallback.actionType, fallback);
        }

        for (const item of mapped) {
          mergedByAction.set(item.actionType, item);
        }

        if (alive) {
          setOffers(
            Array.from(mergedByAction.values()).sort(
              (a, b) => a.sortOrder - b.sortOrder
            )
          );
        }
      } finally {
        if (alive) setOffersLoading(false);
      }
    }

    void loadOffers();

    return () => {
      alive = false;
    };
  }, []);

  async function fetchGenerationById(genId: string) {
    const { data, error } = await supabase
      .from("generations")
      .select(
        [
          "id",
          "status",
          "final_image_url",
          "result_image_url",
          "preview_image_url",
          "source_image_url",
          "template_id",
          "style_id",
          "style_slug",
          "prompt",
          "error",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("id", genId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load generation");
    }

    return normalizeResultRow(data);
  }

  async function fetchGenerationBySession(sess: string) {
    const { data, error } = await supabase.rpc("get_result_page_generation", {
      p_session_id: sess,
      p_generation_id: null,
    });

    if (error) {
      throw new Error(error.message || "Failed to load generation");
    }

    return normalizeResultRow(data);
  }

  async function fetchGeneration(
    genId?: string | null,
    sess?: string | null
  ): Promise<ResultRow | null> {
    const safeGenId = String(genId || "").trim();
    const safeSess = String(sess || "").trim();

    if (safeGenId) return fetchGenerationById(safeGenId);
    if (safeSess) return fetchGenerationBySession(safeSess);

    return null;
  }

  async function applyRow(nextRow: ResultRow | null) {
    if (!nextRow?.id) return false;

    setRow(nextRow);

    if (isTerminalFailure(nextRow.status)) {
      setImageUrl(null);
      setErrorMessage(nextRow.error || "Generation failed.");
      return true;
    }

    const resolvedUrl = await resolveImageUrl(nextRow);

    if (resolvedUrl && isHttpUrl(resolvedUrl)) {
      setImageUrl(resolvedUrl);
      setErrorMessage("");
      return true;
    }

    setImageUrl(null);
    return false;
  }

  async function fetchSignedResult(ids: {
    genId?: string | null;
    sess?: string | null;
    order?: string | null;
  }) {
    const { url: supabaseUrl, anon } = getPublicSupabaseConfig();
    const headers = await getEdgeFunctionHeaders(anon);
    const res = await fetch(`${supabaseUrl}/functions/v1/get-signed-result`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        generation_id: ids.genId || null,
        session_id: ids.sess || null,
        order_id: ids.order || null,
      }),
    });
    const data = (await safeReadJson(res)) as EdgeJson & {
      order_id?: string;
      generation_id?: string;
      order_status?: string;
      generation_status?: string;
      image_url?: string | null;
      regenerations_used?: number;
      regenerations_allowed?: number;
    };
    if (!res.ok) {
      throw new Error(String(data.error || data.message || "Could not load result"));
    }
    return data;
  }

  async function callGenerateNanoBanana(_generationIdToStart: string) {
    throw new Error(
      "Generation is started by the payment webhook, not by this page.",
    );
  }

  async function startGenerationIfNeeded(_generationIdToStart: string) {
    return;
  }

  useEffect(() => {
    let cancelled = false;

    async function sleep(ms: number) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function loadDirectGeneration() {
      if (!generationId && !orderId && !sessionId) return false;

      const start = Date.now();
      const maxMs = 180000;
      const intervalMs = 1500;

      while (!cancelled && Date.now() - start < maxMs) {
        try {
          const signed = await fetchSignedResult({
            genId: generationId,
            sess: sessionId,
            order: orderId,
          });
          if (cancelled) return true;
          if (signed.order_id) setResolvedOrderId(String(signed.order_id));
          if (typeof signed.regenerations_used === "number") {
            setRegenUsed(signed.regenerations_used);
          }
          if (typeof signed.regenerations_allowed === "number") {
            setRegenAllowed(signed.regenerations_allowed);
          }
          if (signed.image_url && isHttpUrl(signed.image_url)) {
            setImageUrl(signed.image_url);
            setErrorMessage("");
            setLoading(false);
            if (signed.generation_id) {
              const nextRow = await fetchGeneration(String(signed.generation_id), null);
              if (nextRow) setRow(nextRow);
            }
            return true;
          }
          if (isTerminalFailure(signed.generation_status || null)) {
            setErrorMessage(String(signed.error || "Generation failed."));
            setLoading(false);
            return true;
          }
        } catch {
          // Fall through to table polling if the signed-result function is not deployed yet.
        }

        await sleep(intervalMs);
      }

      const fallbackStart = Date.now();
      while (!cancelled && Date.now() - fallbackStart < maxMs) {
        const nextRow = await fetchGeneration(generationId, sessionId || null);
        if (cancelled) return true;

        if (nextRow?.id) {
          const ok = await applyRow(nextRow);

          if (isTerminalFailure(nextRow.status)) {
            setLoading(false);
            return true;
          }

          if (ok && (await resolveImageUrl(nextRow))) {
            setLoading(false);
            return true;
          }

          setRow(nextRow);
        }

        await sleep(intervalMs);
      }

      if (!cancelled) {
        setLoading(false);
        setErrorMessage("Generation found, but no valid public image URL is available yet.");
      }

      return true;
    }

    async function loadBySessionPolling() {
      if (!sessionId) return false;

      const start = Date.now();
      const maxMs = 180000;
      const intervalMs = 1500;

      while (!cancelled && Date.now() - start < maxMs) {
        const nextRow = await fetchGeneration(null, sessionId);
        if (cancelled) return true;

        if (nextRow?.id) {
          const ok = await applyRow(nextRow);

          if (isTerminalFailure(nextRow.status)) {
            setLoading(false);
            return true;
          }

          if (ok && (await resolveImageUrl(nextRow))) {
            setLoading(false);
            return true;
          }

          setRow(nextRow);

          const status = normalizeStatus(nextRow.status);

          if (isTerminalFailure(nextRow.status) || isTerminalSuccess(status)) {
            // Webhook fulfillment owns generation. This page only polls.
          }
        }

        await sleep(intervalMs);
      }

      if (!cancelled) {
        setLoading(false);
        setErrorMessage("No generation found for this payment session.");
      }

      return true;
    }

    async function loadUpgradePolling() {
      if (!checkoutSessionId) return false;

      const start = Date.now();
      const maxMs = 180000;
      const intervalMs = 1500;

      while (!cancelled && Date.now() - start < maxMs) {
        const { data, error } = await supabase.rpc(
          "get_upgrade_result_by_checkout_session",
          { p_checkout_session_id: checkoutSessionId }
        );

        if (error) {
          if (!cancelled) {
            setErrorMessage(error.message || "Failed to load upgrade result");
            setLoading(false);
          }

          return true;
        }

        const upgrade = normalizeUpgradeRpcRow(data);

        if (!upgrade) {
          if (!cancelled) setUpgradeStatus("Waiting for upgrade fulfillment…");
          await sleep(intervalMs);
          continue;
        }

        const fulfillmentStatus = String(upgrade.fulfillment_status || "").toLowerCase();
        const actionType = String(upgrade.action_type || "");
        const outputGenerationId = String(upgrade.output_generation_id || "").trim();

        if (!cancelled) {
          setUpgradeStatus(
            fulfillmentStatus === "queued" || fulfillmentStatus === "processing"
              ? `Processing upgrade: ${actionType || "upgrade"}…`
              : fulfillmentStatus === "fulfilled"
                ? `Upgrade ready: ${actionType || "upgrade"}`
                : fulfillmentStatus === "failed"
                  ? `Upgrade failed: ${actionType || "upgrade"}`
                  : `Upgrade status: ${fulfillmentStatus || "unknown"}`
          );
        }

        if (fulfillmentStatus === "failed") {
          if (!cancelled) {
            setErrorMessage("Upgrade processing failed.");
            setLoading(false);
          }

          return true;
        }

        if (actionType === "full_hd" && upgrade.generation_id) {
          const nextRow = await fetchGeneration(String(upgrade.generation_id), null);
          if (cancelled) return true;

          const ok = await applyRow(nextRow);
          if (ok && nextRow && (await resolveImageUrl(nextRow))) {
            setLoading(false);
            return true;
          }
        }

        if (outputGenerationId) {
          const nextRow = await fetchGeneration(outputGenerationId, null);
          if (cancelled) return true;

          const ok = await applyRow(nextRow);
          if (ok && nextRow && (await resolveImageUrl(nextRow))) {
            setLoading(false);
            return true;
          }
        }

        await sleep(intervalMs);
      }

      if (!cancelled) {
        setLoading(false);
        setErrorMessage("Timed out waiting for upgrade result.");
      }

      return true;
    }

    async function load() {
      try {
        setLoading(true);
        setRow(null);
        setImageUrl(null);
        setErrorMessage("");
        setUpgradeStatus("");

        if (!sessionId && !generationId && !checkoutSessionId && !orderId) {
          setLoading(false);
          setErrorMessage("Missing payment session or generation id.");
          return;
        }

        if (checkoutSessionId) {
          const handled = await loadUpgradePolling();
          if (handled) return;
        }

        if (generationId || orderId || sessionId) {
          const handled = await loadDirectGeneration();
          if (handled) return;
        }

        if (sessionId) {
          await loadBySessionPolling();
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unexpected error";
          setLoading(false);
          setErrorMessage(message);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sessionId, generationId, checkoutSessionId, orderId]);

  async function handleIncludedRegeneration() {
    const id = resolvedOrderId || orderId;
    if (!id && !sessionId) {
      toast.error("Missing order. Refresh this page from your payment email.");
      return;
    }
    if (regenUsed >= regenAllowed) {
      toast.error("The included regeneration has already been used.");
      return;
    }

    setIncludedRegenLoading(true);
    try {
      const { url: supabaseUrl, anon } = getPublicSupabaseConfig();
      const headers = await getEdgeFunctionHeaders(anon);
      const res = await fetch(`${supabaseUrl}/functions/v1/request-included-regeneration`, {
        method: "POST",
        headers,
        body: JSON.stringify({ order_id: id || null, session_id: sessionId || null }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) {
        throw new Error(String(data.error || data.message || "Regeneration failed"));
      }
      toast.success("Creating a new image. This page will update when it is ready.");
      window.location.reload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Regeneration failed");
    } finally {
      setIncludedRegenLoading(false);
    }
  }

  async function handleCheckout(actionType: ActionType) {
    if (actionType === "regenerate") {
      await handleIncludedRegeneration();
      return;
    }
    toast.error("Add-ons are not part of the launch product.");
  }

  function downloadCurrent() {
    if (!imageUrl) return;

    const a = document.createElement("a");
    a.href = imageUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function HeaderActions() {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="hidden text-zinc-700 hover:text-zinc-900 sm:inline-flex"
          onClick={() => navigate(HOME_ROUTE)}
        >
          <Home className="mr-2 h-4 w-4" />
          Home
        </Button>

        <Button
          variant="ghost"
          className="hidden text-zinc-700 hover:text-zinc-900 sm:inline-flex"
          onClick={() => navigate(DASHBOARD_ROUTE)}
        >
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Dashboard
        </Button>

        <div className="text-sm text-zinc-600">{stepLabel}</div>
      </div>
    );
  }

  if (!sessionId && !generationId && !checkoutSessionId && !orderId) {
    return (
      <div className="min-h-screen" style={pageBg}>
        <header className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-zinc-700 hover:text-zinc-900"
              onClick={() => navigate(HOME_ROUTE)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="select-none text-lg font-semibold tracking-wide text-[#0b3b2e] sm:text-xl">
              TheDigitalGifter
            </div>

            <HeaderActions />
          </div>

          <div className="mt-4">
            <Separator className="bg-zinc-200" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
          <Card className="border-zinc-200 bg-white/80 shadow-sm">
            <CardContent className="p-8 text-center">
              <h1 className="text-3xl font-semibold text-[#0b3b2e] sm:text-4xl">
                We couldn’t open your result
              </h1>

              <p className="mt-3 text-zinc-700">
                The payment session or generation id is missing. Please return and try again.
              </p>

              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={() => navigate(NEW_GIFT_ROUTE)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start again
                </Button>

                <Button variant="outline" onClick={() => navigate(DASHBOARD_ROUTE)}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>

                <Button variant="outline" onClick={() => navigate(HOME_ROUTE)}>
                  <Home className="mr-2 h-4 w-4" />
                  Go home
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={pageBg}>
      <header className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="text-zinc-700 hover:text-zinc-900"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="select-none text-lg font-semibold tracking-wide text-[#0b3b2e] sm:text-xl">
            TheDigitalGifter
          </div>

          <HeaderActions />
        </div>

        <div className="mt-4">
          <Separator className="bg-zinc-200" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="text-center">
          <Badge
            variant="outline"
            className="border-[#0b3b2e]/15 bg-white/70 px-3 py-1 text-[#0b3b2e]"
          >
            {productTruth.copy.aiGeneratedDisclosure}
          </Badge>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#0b3b2e] sm:text-4xl md:text-5xl">
            {imageUrl
              ? "Your gift is ready"
              : loading
                ? "Finishing your gift…"
                : normalizedStatus === "failed"
                  ? "Generation failed"
                  : "Almost there…"}
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-700 sm:text-base md:text-lg">
            {imageUrl
              ? "Download your gift, create another one, or open your dashboard anytime."
              : "This page will update if a result becomes available."}
          </p>

          {imageUrl ? (
            <div className="mx-auto mt-6 flex max-w-2xl flex-col justify-center gap-3 sm:flex-row">
              <Button
                className="bg-[#0b3b2e] text-white hover:bg-[#082c22]"
                onClick={downloadCurrent}
                disabled={!imageUrl || anyCheckoutLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                Download image
              </Button>

              <Button
                variant="outline"
                className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                onClick={() => navigate(NEW_GIFT_ROUTE)}
                disabled={anyCheckoutLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create another gift
              </Button>

              <Button
                variant="outline"
                className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                onClick={() => navigate(DASHBOARD_ROUTE)}
                disabled={anyCheckoutLoading}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </div>
          ) : null}

          {upgradeStatus ? (
            <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              {upgradeStatus}
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="overflow-hidden border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(17,24,39,0.08)]">
            <CardContent className="p-4 sm:p-5">
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt="Final result"
                      className="block h-auto w-full object-contain"
                    />

                    {imageUrl ? (
                      <button
                        type="button"
                        onClick={() => void handleIncludedRegeneration()}
                        disabled={includedRegenLoading || regenUsed >= regenAllowed}
                        className="absolute right-3 top-3 inline-flex items-center rounded-full bg-[#0b3b2e] px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-[#082c22] disabled:cursor-not-allowed disabled:opacity-60 sm:right-4 sm:top-4"
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        {includedRegenLoading
                          ? "Loading..."
                          : regenUsed >= regenAllowed
                            ? "Regeneration used"
                            : "Included regeneration"}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="flex min-h-[340px] items-center justify-center bg-gradient-to-b from-white to-[#f7f3ee] px-6 py-12 text-center sm:min-h-[420px]">
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white">
                        <RefreshCw
                          className={`h-5 w-5 text-[#0b3b2e] ${loading ? "animate-spin" : ""}`}
                        />
                      </div>

                      <div className="mt-4 text-base font-medium text-zinc-900">
                        {loading ? "Generating your final image…" : "Result not ready yet"}
                      </div>

                      <div className="mt-2 text-sm text-zinc-600">
                        {loading
                          ? "Keep this tab open — we’ll show it as soon as it’s ready."
                          : "Click Refresh to check again."}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  className="bg-[#0b3b2e] text-white hover:bg-[#082c22]"
                  onClick={() => navigate(DASHBOARD_ROUTE)}
                  disabled={anyCheckoutLoading}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>

                <Button
                  variant="outline"
                  className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={() => navigate(NEW_GIFT_ROUTE)}
                  disabled={anyCheckoutLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create another gift
                </Button>

                <Button
                  variant="outline"
                  className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={downloadCurrent}
                  disabled={!imageUrl || anyCheckoutLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download image
                </Button>

                <Button
                  variant="outline"
                  className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={() => window.location.reload()}
                  disabled={anyCheckoutLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              <div className="mt-5 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                You can return to your dashboard anytime.
              </div>

              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(17,24,39,0.08)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl text-[#0b3b2e]">Your purchase</CardTitle>
              <CardDescription className="text-zinc-600">
                {productModel.displayPrice} still image · personal use · one included
                regeneration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700">
                This image is {productTruth.copy.aiGeneratedDisclosure.toLowerCase()}.{" "}
                {productTruth.copy.licenseSentence} Uploads are kept 24 hours and
                results 30 days.
              </div>
              <Button
                className="w-full bg-[#0b3b2e] text-white hover:bg-[#082c22]"
                onClick={() => void handleIncludedRegeneration()}
                disabled={includedRegenLoading || regenUsed >= regenAllowed || !imageUrl}
              >
                {includedRegenLoading
                  ? "Starting…"
                  : regenUsed >= regenAllowed
                    ? "Included regeneration used"
                    : "Use included regeneration"}
              </Button>
              <p className="text-xs leading-5 text-zinc-500">
                Generation starts only after Stripe confirms payment. Refreshing this
                page does not charge you again and does not start a second generation.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <div className="h-10" />
    </div>
  );
}
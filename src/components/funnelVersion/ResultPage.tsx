import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw,
  Sparkles,
  Crown,
  Puzzle,
  Image as ImageIcon,
  ShieldCheck,
  Download,
  ArrowLeft,
} from "lucide-react";

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
  final_bucket: string | null;
  final_storage_path: string | null;
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
  final_bucket: string | null;
  final_storage_path: string | null;
  generation_status: string | null;
  generation_created_at: string | null;
  generation_updated_at: string | null;
};

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test((s || "").trim());
}

function firstNonEmpty(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

async function resolveImageUrl(row: ResultRow): Promise<string | null> {
  const direct = firstNonEmpty(
    row.final_image_url,
    row.result_image_url,
    row.preview_image_url
  );

  if (direct && isHttpUrl(direct)) return direct;

  const bucket = (row.final_bucket || "").trim();
  const path = (row.final_storage_path || "").trim();

  if (!bucket || !path) return direct || null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error) return direct || null;
  return (data?.signedUrl ?? direct) || null;
}

function normalizeResultRow(x: any): ResultRow | null {
  if (!x) return null;
  const r = Array.isArray(x) ? x[0] : x;
  if (!r) return null;

  return {
    id: String(r.id ?? ""),
    status: r.status ?? null,
    final_image_url: r.final_image_url ?? null,
    result_image_url: r.result_image_url ?? null,
    preview_image_url: r.preview_image_url ?? null,
    final_bucket: r.final_bucket ?? null,
    final_storage_path: r.final_storage_path ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

function normalizeUpgradeRpcRow(x: any): UpgradeRpcRow | null {
  if (!x) return null;
  const r = Array.isArray(x) ? x[0] : x;
  if (!r) return null;

  return {
    fulfillment_id: r.fulfillment_id ?? null,
    generation_id: r.generation_id ?? null,
    action_type: r.action_type ?? null,
    fulfillment_status: r.fulfillment_status ?? null,
    output_generation_id: r.output_generation_id ?? null,
    output_image_url: r.output_image_url ?? null,
    final_image_url: r.final_image_url ?? null,
    final_bucket: r.final_bucket ?? null,
    final_storage_path: r.final_storage_path ?? null,
    generation_status: r.generation_status ?? null,
    generation_created_at: r.generation_created_at ?? null,
    generation_updated_at: r.generation_updated_at ?? null,
  };
}

const OFFER_CONFIG: Array<{
  actionType: ActionType;
  title: string;
  priceLabel: string;
  description: string;
  cta: string;
  icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
}> = [
  {
    actionType: "full_hd",
    title: "Unlock Full HD",
    priceLabel: "€0.99",
    description: "High-resolution, clean, sharp, and ready to download.",
    cta: "Unlock Full HD",
    icon: ImageIcon,
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
  },
  {
    actionType: "puzzle",
    title: "Turn into Puzzle",
    priceLabel: "€14.99",
    description:
      "Your image is reprocessed with a premium puzzle-style prompt for a printable puzzle gift look.",
    cta: "Turn into Puzzle",
    icon: Puzzle,
  },
];

function formatStatus(status: string | null) {
  const s = String(status || "").toLowerCase();
  if (!s) return "waiting";
  if (["succeeded", "done", "completed", "fulfilled", "ready"].includes(s)) return "ready";
  return s;
}

export default function ResultPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const sessionId = (q.get("session_id") || "").trim();
  const generationIdFromUrl = (q.get("generation_id") || "").trim();
  const checkoutSessionId = (q.get("checkout_session_id") || "").trim();
  const upgradeSuccess = (q.get("upgrade_success") || "").trim() === "1";
  const upgradeCanceled = (q.get("upgrade_canceled") || "").trim() === "1";

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ResultRow | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [debug, setDebug] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [upgradeStatus, setUpgradeStatus] = useState<string>("");
  const [checkoutLoading, setCheckoutLoading] = useState<CheckoutLoadingState>({
    full_hd: false,
    regenerate: false,
    golden_frame: false,
    puzzle: false,
  });

  const stepLabel = useMemo(() => "3 of 3", []);
  const pageBg = useMemo(() => ({ background: "#f6f1ea" as const }), []);
  const normalizedStatus = useMemo(() => formatStatus(row?.status ?? null), [row?.status]);

  useEffect(() => {
    if (upgradeSuccess) toast.success("Payment successful.");
    if (upgradeCanceled) toast.error("Checkout canceled.");
  }, [upgradeSuccess, upgradeCanceled]);

  async function fetchGeneration(generationId?: string | null, session?: string | null) {
    const genId = (generationId || "").trim();
    const sess = (session || "").trim();

    const { data, error } = await supabase.rpc("get_result_page_generation", {
      p_session_id: sess || null,
      p_generation_id: genId || null,
    });

    if (error) {
      throw new Error(error.message || "Failed to load generation");
    }

    return normalizeResultRow(data);
  }

  async function applyRow(r: ResultRow | null, modeLabel: string) {
    if (!r?.id) return false;

    setRow(r);

    const url = await resolveImageUrl(r);

    setDebug(
      [
        `mode=${modeLabel}`,
        `id=${r.id}`,
        `status=${r.status || "—"}`,
        `final=${r.final_image_url ? "yes" : "no"}`,
        `result=${r.result_image_url ? "yes" : "no"}`,
        `preview=${r.preview_image_url ? "yes" : "no"}`,
        `bucket=${r.final_bucket || "—"}`,
        `path=${r.final_storage_path || "—"}`,
        `resolved=${url ? "yes" : "no"}`,
      ].join(" · ")
    );

    if (url) {
      setImageUrl(url);
      setErrorMessage("");
      return true;
    }

    return false;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDirectGeneration() {
      if (!generationIdFromUrl) return false;

      const r = await fetchGeneration(generationIdFromUrl, null);
      if (cancelled) return true;

      const ok = await applyRow(r, "generation_id");
      setLoading(false);

      if (!ok && r?.id) {
        setErrorMessage("Generation found, but no image URL is available yet.");
      }

      return true;
    }

    async function loadBySessionPolling() {
      if (!sessionId) return false;

      const start = Date.now();
      const maxMs = 180000;
      const intervalMs = 1500;

      while (!cancelled && Date.now() - start < maxMs) {
        const r = await fetchGeneration(null, sessionId);
        if (cancelled) return true;

        if (r?.id) {
          const ok = await applyRow(r, "session_id");
          if (ok) {
            setLoading(false);
            return true;
          }

          setRow(r);
        } else {
          setDebug(`mode=session_id · session_id=${sessionId} · no generation yet`);
        }

        await new Promise((res) => setTimeout(res, intervalMs));
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
        const { data, error } = await supabase.rpc("get_upgrade_result_by_checkout_session", {
          p_checkout_session_id: checkoutSessionId,
        });

        if (error) {
          if (!cancelled) {
            setErrorMessage(error.message || "Failed to load upgrade result");
            setLoading(false);
          }
          return true;
        }

        const upgrade = normalizeUpgradeRpcRow(data);

        if (!upgrade) {
          if (!cancelled) {
            setUpgradeStatus("Waiting for upgrade fulfillment…");
            setDebug(`mode=checkout_session_id · checkout_session_id=${checkoutSessionId} · no fulfillment yet`);
          }
          await new Promise((res) => setTimeout(res, intervalMs));
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
          const r = await fetchGeneration(String(upgrade.generation_id), null);
          if (cancelled) return true;

          const ok = await applyRow(r, "checkout_session_id/full_hd");
          if (ok) {
            setLoading(false);
            return true;
          }
        }

        if (outputGenerationId) {
          const r = await fetchGeneration(outputGenerationId, null);
          if (cancelled) return true;

          const ok = await applyRow(r, "checkout_session_id/output_generation");
          if (ok) {
            setLoading(false);
            return true;
          }
        }

        await new Promise((res) => setTimeout(res, intervalMs));
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
        setDebug("");
        setErrorMessage("");
        setUpgradeStatus("");

        if (!sessionId && !generationIdFromUrl && !checkoutSessionId) {
          setLoading(false);
          setErrorMessage("Missing payment session.");
          setDebug("Missing session_id, generation_id and checkout_session_id in URL.");
          return;
        }

        if (checkoutSessionId) {
          const handled = await loadUpgradePolling();
          if (handled) return;
        }

        if (generationIdFromUrl) {
          const handled = await loadDirectGeneration();
          if (handled) return;
        }

        if (sessionId) {
          await loadBySessionPolling();
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoading(false);
          setErrorMessage(String(e?.message || e || "Unexpected error"));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sessionId, generationIdFromUrl, checkoutSessionId]);

  async function handleCheckout(actionType: ActionType) {
    if (!row?.id) {
      toast.error("Generation not found yet.");
      return;
    }

    setCheckoutLoading((prev) => ({ ...prev, [actionType]: true }));

    try {
      const successUrl = `${window.location.origin}/funnel/result?generation_id=${row.id}`;
      const cancelUrl = `${window.location.origin}/funnel/result?generation_id=${row.id}`;

      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          generation_id: row.id,
          action_type: actionType,
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      });

      if (error) throw error;

      const checkoutUrl = data?.url || data?.checkout_url || null;
      if (!checkoutUrl) throw new Error("Missing checkout URL");

      window.location.href = checkoutUrl;
    } catch (e: any) {
      toast.error(e?.message || "Failed to start checkout");
    } finally {
      setCheckoutLoading((prev) => ({ ...prev, [actionType]: false }));
    }
  }

  function downloadCurrent() {
    if (!imageUrl) return;
    window.open(imageUrl, "_blank", "noopener,noreferrer");
  }

  const anyCheckoutLoading = Object.values(checkoutLoading).some(Boolean);
  const canBuy = Boolean(imageUrl) && Boolean(row?.id) && !loading;

  if (!sessionId && !generationIdFromUrl && !checkoutSessionId) {
    return (
      <div className="min-h-screen" style={pageBg}>
        <header className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              className="text-zinc-700 hover:text-zinc-900"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="select-none text-lg font-semibold tracking-wide text-[#0b3b2e] sm:text-xl">
              TheDigitalGifter
            </div>

            <div className="text-sm text-zinc-600">{stepLabel}</div>
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
                The payment session is missing. Please return and try again.
              </p>

              <div className="mt-6 flex justify-center gap-3">
                <Button onClick={() => navigate("/funnel/uploadPhoto")}>Start again</Button>
                <Button variant="outline" onClick={() => navigate("/")}>
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
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            className="text-zinc-700 hover:text-zinc-900"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="select-none text-lg font-semibold tracking-wide text-[#0b3b2e] sm:text-xl">
            TheDigitalGifter
          </div>

          <div className="text-sm text-zinc-600">{stepLabel}</div>
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
            Premium Result
          </Badge>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#0b3b2e] sm:text-4xl md:text-5xl">
            {imageUrl
              ? "Your gift is ready"
              : loading
                ? "Finishing your gift…"
                : normalizedStatus === "ready"
                  ? "Syncing your final image…"
                  : "Almost there…"}
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-700 sm:text-base md:text-lg">
            {imageUrl
              ? "Unlock premium upgrades, regenerate new variations, or download a sharper final version."
              : checkoutSessionId
                ? "We’re processing your upgrade and will show the new result automatically."
                : "We’re keeping this page updated while your final result is prepared."}
          </p>

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
                      onError={() => setDebug((d) => `${d}\nIMG error loading resolved image url`)}
                    />

                    <button
                      type="button"
                      onClick={() => void handleCheckout("regenerate")}
                      disabled={!canBuy || checkoutLoading.regenerate}
                      className="absolute right-3 top-3 inline-flex items-center rounded-full bg-[#0b3b2e] px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-[#082c22] disabled:cursor-not-allowed disabled:opacity-60 sm:right-4 sm:top-4"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {checkoutLoading.regenerate ? "Loading..." : "Regenerate – €0.70"}
                    </button>
                  </>
                ) : (
                  <div className="flex min-h-[340px] items-center justify-center bg-gradient-to-b from-white to-[#f7f3ee] px-6 py-12 text-center sm:min-h-[420px]">
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white">
                        <RefreshCw className={`h-5 w-5 text-[#0b3b2e] ${loading ? "animate-spin" : ""}`} />
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
                  variant="outline"
                  className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={() => window.location.reload()}
                  disabled={anyCheckoutLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                <Button
                  variant="outline"
                  className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={downloadCurrent}
                  disabled={!imageUrl || anyCheckoutLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Open full image
                </Button>

                <Button
                  variant="outline"
                  className="border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                  onClick={() => navigate("/funnel/uploadPhoto")}
                  disabled={anyCheckoutLoading}
                >
                  Start new gift
                </Button>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Your image is safely stored and ready for premium upgrades.</span>
                </div>
              </div>

              {debug ? (
                <div className="mt-4 break-all rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-xs text-zinc-500">
                  {debug}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(17,24,39,0.08)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl text-[#0b3b2e]">More ways to enjoy your gift</CardTitle>
              <CardDescription className="text-zinc-600">
                Premium upgrades designed to increase quality, presentation, and gifting value.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {OFFER_CONFIG.map((offer) => {
                const Icon = offer.icon;
                const isLoading = checkoutLoading[offer.actionType];

                return (
                  <div
                    key={offer.actionType}
                    className={`rounded-2xl border p-4 transition ${
                      offer.featured
                        ? "border-amber-200 bg-amber-50/60"
                        : "border-zinc-200 bg-white"
                    } ${!canBuy ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white">
                          <Icon className="h-5 w-5 text-[#0b3b2e]" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-zinc-900">{offer.title}</h3>
                            {offer.featured ? (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                                Best Value
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-zinc-600">{offer.description}</p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-lg font-bold text-[#0b3b2e]">{offer.priceLabel}</div>
                      </div>
                    </div>

                    <Button
                      className="mt-4 w-full bg-[#0b3b2e] text-white hover:bg-[#082c22]"
                      onClick={() => void handleCheckout(offer.actionType)}
                      disabled={!canBuy || isLoading}
                    >
                      {isLoading ? "Loading..." : offer.cta}
                    </Button>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-zinc-200 bg-[#f8f5ef] p-4">
                <div className="text-sm font-semibold text-[#0b3b2e]">Why upgrade?</div>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                  <li>• Sharper quality</li>
                  <li>• Premium gift presentation</li>
                  <li>• More shareable result</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <div className="h-10" />
    </div>
  );
}
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw, Search, PawPrint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsd, formatUsd3, GROSS_AFTER_AI_DISCLAIMER, recognizedRevenueCents, type OrderCostDetails } from "@/features/pet/aiCost";
import { WAITING_FOR_PROVIDER_RATE_LIMIT, adminPortraitStatusLabel } from "@/features/pet/replicateRateLimit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PetOrderListItem = {
  id: string;
  email: string;
  pet_name: string;
  status: string;
  amount_cents: number;
  stripe_checkout_session_id: string | null;
  paid_at: string | null;
  created_at: string;
  qc_status: string | null;
  last_error: string | null;
  model_name: string | null;
  ai_cost_usd?: number;
  revenue_usd?: number;
  gross_after_ai_usd?: number;
  cost_badge?: "exact" | "estimated" | null;
  image_progress?: { total: number; succeeded: number };
  video_progress?: { total: number; succeeded: number };
  image_ai_cost_usd?: number;
  video_ai_cost_usd?: number;
};

type PetScene = {
  id: string;
  scene_key: string;
  title: string;
  status: string;
  attempts: number;
  replicate_prediction_id: string | null;
  model_name: string | null;
  model_version: string | null;
  last_error: string | null;
  previewUrl: string | null;
};

type PetClip = {
  id: string;
  slot: number;
  source_scene_id: string;
  status: string;
  attempt_number: number;
  replicate_prediction_id: string | null;
  model_name: string | null;
  provider_error: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  qc_status: string | null;
  requested_duration_seconds?: number;
  requested_resolution?: string;
};

type PetEvent = {
  id: string;
  action: string;
  actor_type: string;
  actor_email: string | null;
  scene_key: string | null;
  created_at: string;
};

function CostBadge({ state }: { state?: string | null }) {
  if (!state) return <span className="text-xs text-slate-500">—</span>;
  const estimated = state === "estimated" || state === "pending";
  return (
    <Badge
      variant="outline"
      className={estimated ? "border-amber-400/40 text-amber-200" : "border-emerald-400/40 text-emerald-200"}
    >
      {estimated ? "estimated" : "exact"}
    </Badge>
  );
}

function recognizedOrderRevenue(
  order: Record<string, unknown>,
  costs?: OrderCostDetails,
) {
  const revenueUsd =
    recognizedRevenueCents({
      amount_cents: order.amount_cents,
      charged_amount_cents: order.charged_amount_cents,
      discount_percent: order.discount_percent ?? costs?.discountPercent,
      promo_code: order.promo_code ?? costs?.promoCode,
      stripe_checkout_session_id: order.stripe_checkout_session_id,
    }) / 100;
  const promoCode = String(order.promo_code || costs?.promoCode || "").trim() || null;
  const discountPercent = Number(order.discount_percent ?? costs?.discountPercent ?? 0);
  const listCents = Number(order.amount_cents);
  const listPriceUsd = Number.isFinite(listCents)
    ? listCents / 100
    : Number(costs?.listPriceUsd || 0);
  return {
    revenueUsd,
    listPriceUsd: Number.isFinite(listPriceUsd) ? listPriceUsd : 0,
    promoCode,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : 0,
    grossAfterAiUsd: revenueUsd - (costs?.replicateUsd ?? 0),
  };
}

function OrderCostPanel({
  order,
  costs,
}: {
  order: Record<string, unknown>;
  costs: OrderCostDetails;
}) {
  const revenue = recognizedOrderRevenue(order, costs);
  return (
    <div className="rounded-xl border border-cyan-400/20 bg-slate-950/70 p-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Tracked pet-funnel Replicate usage
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span>Revenue</span>
        <span>{formatUsd(revenue.revenueUsd)}</span>
      </div>
      {revenue.discountPercent > 0 || revenue.promoCode ? (
        <p className="mt-1 text-[11px] leading-4 text-amber-200/80">
          Promo{revenue.promoCode ? ` ${revenue.promoCode}` : ""}
          {revenue.discountPercent > 0 ? ` · ${revenue.discountPercent}% off` : ""}
          {revenue.listPriceUsd > 0 ? ` · list ${formatUsd(revenue.listPriceUsd)}` : ""} — not counted as
          revenue
        </p>
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-2">
        <span>Image AI</span>
        <span>{formatUsd(costs.imageAiUsd ?? 0)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span>Video AI</span>
        <span>{formatUsd3(costs.videoAiUsd ?? 0)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span>Replicate</span>
        <span className="font-medium text-cyan-100">{formatUsd(costs.replicateUsd)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span>Gross after AI</span>
        <span className="font-medium text-emerald-100">{formatUsd(revenue.grossAfterAiUsd)}</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">{GROSS_AFTER_AI_DISCLAIMER}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">
        This is not the entire Replicate account invoice.
      </p>
      <div className="mt-3 space-y-2">
        {costs.byScene.map((scene) => (
          <div key={scene.sceneKey} className="rounded-lg border border-slate-800 p-2">
            <div className="flex items-center justify-between text-xs">
              <span>{scene.sceneKey}</span>
              <span>{formatUsd(scene.totalUsd)}</span>
            </div>
            {scene.attempts.map((attempt) => (
              <div
                key={attempt.predictionId}
                className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400"
              >
                <span>
                  Attempt {attempt.attemptNumber}
                  {attempt.isRetry ? " · retry" : ""}
                  {attempt.isMock ? " · mock" : ""} · {attempt.providerStatus} · {attempt.modelName} ·{" "}
                  {attempt.pricingMethod} @ {formatUsd(attempt.tariffUnitCostUsd)}
                </span>
                <span className="inline-flex items-center gap-1">
                  {formatUsd(attempt.costUsd)}
                  <CostBadge state={attempt.costState} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

async function petAdmin<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("pet-admin", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error?: string }).error));
  }
  return data as T;
}

export default function PetOrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<PetOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
        order: Record<string, unknown>;
        scenes: PetScene[];
        clips?: PetClip[];
        events: PetEvent[];
        sourcePreviewUrl: string | null;
        costs?: OrderCostDetails;
      } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await petAdmin<{ items: PetOrderListItem[]; total: number }>("list", {
        q,
        status,
        page,
        pageSize: 20,
      });
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load pet orders");
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setSelectedId(id);
    try {
      const result = await petAdmin<{
        order: Record<string, unknown>;
        scenes: PetScene[];
        clips?: PetClip[];
        events: PetEvent[];
        sourcePreviewUrl: string | null;
        costs?: OrderCostDetails;
      }>("get", { orderId: id });
      setDetail(result);
      setSelectedSceneIds((result.clips || []).map((clip) => clip.source_scene_id).filter(Boolean));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load order");
    }
  }

  async function mutate(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedId) return;
    setBusy(true);
    try {
      const result = await petAdmin<{ status?: string; message?: string }>(action, {
        orderId: selectedId,
        notes,
        ...extra,
      });
      if (result?.status === "held") {
        toast.message(result.message || "Video generation is disabled.");
      } else {
        toast.success("Updated");
      }
      await openDetail(selectedId);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Admin</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              <PawPrint className="h-6 w-6 text-amber-300" />
              Pet Orders
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              My Pet’s Secret Life — one-time payment, 12 portraits + 2 clips, human QC before delivery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </button>
        </header>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              placeholder="Search email, pet name, Stripe session, status"
              className="border-slate-800 bg-slate-900 pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {[
              "awaiting_upload",
              "awaiting_payment",
              "paid",
              "generating",
              "awaiting_qc",
              "selecting_video_scenes",
              "generating_videos",
              "awaiting_video_qc",
              "complete",
              "partial_failure",
              "failed",
              "refunded",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead>Pet</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>AI cost</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer border-slate-800 hover:bg-slate-900"
                    onClick={() => void openDetail(item.id)}
                  >
                    <TableCell className="font-medium">{item.pet_name}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.status}</Badge>
                      <p className="mt-1 text-[10px] text-slate-500">
                        img {item.image_progress?.succeeded ?? 0}/{item.image_progress?.total ?? 12} · vid{" "}
                        {item.video_progress?.succeeded ?? 0}/{item.video_progress?.total ?? 2}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-cyan-100">
                      <div className="flex items-center gap-2">
                        <span>{formatUsd(item.ai_cost_usd || 0)}</span>
                        <CostBadge state={item.cost_badge} />
                      </div>
                    </TableCell>
                    <TableCell>{item.paid_at ? "Yes" : "No"}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs text-slate-400">
                      {item.stripe_checkout_session_id || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-400">
              <span>
                {total} orders · page {page}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Prev
                </Button>
                <Button
                  variant="outline"
                  disabled={page * 20 >= total}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            {!detail ? (
              <p className="text-sm text-slate-400">Select an order to inspect photos, scenes, and QC.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{String(detail.order.pet_name)}</h2>
                  <p className="text-sm text-slate-400">{String(detail.order.email)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {String(detail.order.status)} · {String(detail.order.model_name || "model unset")}
                    {detail.order.model_version ? ` @ ${String(detail.order.model_version)}` : ""}
                  </p>
                </div>
                {detail.costs ? <OrderCostPanel order={detail.order} costs={detail.costs} /> : null}
                {detail.sourcePreviewUrl ? (
                  <img
                    src={detail.sourcePreviewUrl}
                    alt="Source pet photo"
                    className="h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <p className="text-sm text-slate-500">No source photo yet.</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {detail.scenes.map((scene) => (
                    <div key={scene.id} className="overflow-hidden rounded-xl border border-slate-800">
                      {scene.previewUrl ? (
                        <img src={scene.previewUrl} alt={scene.title} className="h-20 w-full object-cover" />
                      ) : (
                        <div className="grid h-20 place-items-center bg-slate-950 px-1 text-center text-[10px] text-slate-500">
                          {adminPortraitStatusLabel({
                            status: scene.status,
                            lastError: scene.last_error,
                            replicatePredictionId: scene.replicate_prediction_id,
                          })}
                        </div>
                      )}
                      <label className="flex items-center gap-1 px-1 py-1 text-[10px]">
                        <input
                          type="checkbox"
                          checked={selectedSceneIds.includes(scene.id)}
                          disabled={!["succeeded", "ready"].includes(scene.status)}
                          onChange={() => {
                            setSelectedSceneIds((current) => {
                              if (current.includes(scene.id)) return current.filter((id) => id !== scene.id);
                              if (current.length >= 2) return [current[1], scene.id];
                              return [...current, scene.id];
                            });
                          }}
                        />
                        <span className="truncate">{scene.title}</span>
                      </label>
                      <p className="px-1 pb-1 text-[10px] text-slate-500">
                        {scene.attempts} tries · {scene.replicate_prediction_id || "no prediction"}
                      </p>
                      {adminPortraitStatusLabel({
                        status: scene.status,
                        lastError: scene.last_error,
                        replicatePredictionId: scene.replicate_prediction_id,
                      }) === WAITING_FOR_PROVIDER_RATE_LIMIT ? (
                        <p className="px-1 pb-1 text-[10px] text-amber-200">{WAITING_FOR_PROVIDER_RATE_LIMIT}</p>
                      ) : scene.last_error ? (
                        <p className="px-1 pb-1 text-[10px] text-red-300">{scene.last_error}</p>
                      ) : null}
                      {detail.costs?.byScene
                        .filter((item) => item.sceneKey === scene.scene_key)
                        .map((item) => (
                          <div key={`${scene.id}-cost`} className="px-1 pb-1 text-[10px] text-cyan-100">
                            <p>Scene AI: {formatUsd(item.totalUsd)}</p>
                            {item.attempts.map((attempt) => (
                              <p key={attempt.predictionId} className="text-slate-400">
                                #{attempt.attemptNumber}
                                {attempt.isRetry ? " retry" : ""}
                                {attempt.isMock ? " mock" : ""} · {formatUsd(attempt.costUsd)} ·{" "}
                                {attempt.modelName} · {attempt.pricingMethod} @{" "}
                                {formatUsd(attempt.tariffUnitCostUsd)}
                                <Badge
                                  variant="outline"
                                  className="ml-1 px-1 py-0 text-[9px]"
                                >
                                  {attempt.costState}
                                </Badge>
                              </p>
                            ))}
                          </div>
                        ))}
                      {scene.last_error ? (
                        <p className="px-1 pb-1 text-[10px] text-red-300">{scene.last_error}</p>
                      ) : null}
                      <button
                        type="button"
                        className="w-full pb-1 text-[10px] text-amber-300"
                        onClick={() => void mutate("regenerateScene", { sceneKey: scene.scene_key })}
                      >
                        Retry/regenerate
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    disabled={busy || selectedSceneIds.length !== 2}
                    variant="outline"
                    onClick={() => void mutate("selectVideoSources", { sceneIds: selectedSceneIds })}
                  >
                    Save 2 source scenes
                  </Button>
                  <Button disabled={busy} onClick={() => void mutate("generateVideoClips")}>
                    Generate 2 clips
                  </Button>
                  <Button disabled={busy} variant="outline" onClick={() => void mutate("qcApprovePortraits")}>
                    Approve 12 portraits
                  </Button>
                </div>
                <div className="space-y-2">
                  {(detail.clips || []).map((clip) => (
                    <div key={clip.id} className="rounded-xl border border-slate-800 p-2">
                      <p className="text-xs font-medium">
                        Clip {clip.slot} · {clip.status}
                        {clip.qc_status ? ` · QC ${clip.qc_status}` : ""}
                      </p>
                      {clip.previewUrl ? (
                        <video src={clip.previewUrl} muted controls className="mt-2 h-28 w-full rounded-lg bg-black" />
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-500">No MP4 yet</p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        {clip.requested_duration_seconds || 5}s · {clip.requested_resolution || "720p"} · attempt{" "}
                        {clip.attempt_number} · {clip.replicate_prediction_id || "no prediction"}
                      </p>
                      {detail.costs?.byClip
                        ?.filter((item) => item.sceneId === clip.id || item.sceneKey === clip.id)
                        .map((item) => (
                          <p key={item.sceneKey} className="text-[10px] text-cyan-100">
                            Clip AI {formatUsd3(item.totalUsd)}
                            {item.attempts.map((attempt) => (
                              <span key={attempt.predictionId}>
                                {" "}
                                · #{attempt.attemptNumber} {formatUsd3(attempt.costUsd)} {attempt.costState}
                              </span>
                            ))}
                          </p>
                        ))}
                      {clip.provider_error ? (
                        <p className="text-[10px] text-red-300">{clip.provider_error}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="text-[10px] text-amber-300"
                          onClick={() => void mutate("retryVideoClip", { clipId: clip.id })}
                        >
                          Retry failed clip
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-emerald-300"
                          onClick={() => void mutate("qcApproveClip", { clipId: clip.id })}
                        >
                          Approve clip
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-red-300"
                          onClick={() => void mutate("qcRejectClip", { clipId: clip.id })}
                        >
                          Reject clip
                        </button>
                        {clip.downloadUrl ? (
                          <a href={clip.downloadUrl} className="text-[10px] text-cyan-300" target="_blank" rel="noreferrer">
                            Signed download
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="QC notes"
                  className="h-20 w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={busy} onClick={() => void mutate("retryFailed")}>
                    Retry failed
                  </Button>
                  <Button disabled={busy} onClick={() => void mutate("qcApprove")}>
                    QC approve & release
                  </Button>
                  <Button disabled={busy} variant="outline" onClick={() => void mutate("qcReject")}>
                    QC reject
                  </Button>
                  <Button disabled={busy} variant="outline" onClick={() => void mutate("resendEmail")}>
                    Resend email
                  </Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto text-xs text-slate-400">
                  {detail.events.map((event) => (
                    <p key={event.id}>
                      {new Date(event.created_at).toLocaleString()} · {event.actor_type} · {event.action}
                      {event.scene_key ? ` · ${event.scene_key}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

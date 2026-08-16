import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RefreshCw, Search, PawPrint } from "lucide-react";
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

type PetEvent = {
  id: string;
  action: string;
  actor_type: string;
  actor_email: string | null;
  scene_key: string | null;
  created_at: string;
};

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
    events: PetEvent[];
    sourcePreviewUrl: string | null;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

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
        events: PetEvent[];
        sourcePreviewUrl: string | null;
      }>("get", { orderId: id });
      setDetail(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load order");
    }
  }

  async function mutate(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await petAdmin(action, { orderId: selectedId, notes, ...extra });
      toast.success("Updated");
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
              My Pet’s Secret Life — $59 one-time, human QC before delivery.
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
                        <div className="grid h-20 place-items-center bg-slate-950 text-[10px] text-slate-500">
                          {scene.status}
                        </div>
                      )}
                      <p className="truncate px-1 py-1 text-[10px]">{scene.title}</p>
                      <p className="px-1 pb-1 text-[10px] text-slate-500">
                        {scene.attempts} tries · {scene.replicate_prediction_id || "no prediction"}
                      </p>
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

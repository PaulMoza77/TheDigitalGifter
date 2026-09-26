import React from "react";
import { Loader2, PauseCircle, PlayCircle, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Snapshot = {
  settings: {
    enabled: boolean;
    generationPaused: boolean;
    researchCandidatesPerDay: number;
    productionConceptsPerDay: number;
    clipsPerReel: number;
    maxDailySpendUsd: number;
  };
  usage: Record<string, unknown>;
  counts: Record<string, number>;
  concepts: Array<Record<string, unknown>>;
};

async function api(action: string, body?: Record<string, unknown>) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const response = await fetch(`/api/content-autopilot?action=${encodeURIComponent(action)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(json.error || json.message || response.status));
  return json;
}

export default function AdminContentAutopilotPage() {
  const [loading, setLoading] = React.useState(true);
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot((await api("dashboard")) as Snapshot);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load content autopilot");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const settings = snapshot?.settings;
  const counts = snapshot?.counts || {};

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Content Autopilot</h1>
          <p className="text-sm text-slate-400">Daily research → generation → existing reel finish → publisher pool</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {settings ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
            <div className="mt-2 text-lg text-white">{settings.enabled ? "ON" : "OFF"}</div>
            <div className="mt-1 text-sm text-slate-400">{settings.generationPaused ? "Generation paused" : "Generation active"}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Research / Production</div>
            <div className="mt-2 text-lg text-white">
              {settings.researchCandidatesPerDay} / {settings.productionConceptsPerDay} per day
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Clips / Reel</div>
            <div className="mt-2 text-lg text-white">{settings.clipsPerReel}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Daily spend cap</div>
            <div className="mt-2 text-lg text-white">${settings.maxDailySpendUsd.toFixed(2)}</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="mb-3 text-sm font-medium text-slate-200">Today&apos;s pipeline</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["RESEARCHED", counts.researched],
            ["SELECTED", counts.selected],
            ["QC PASS", counts.qcPass],
            ["VIDEOS", counts.videos],
            ["REELS", counts.reels],
            ["READY", counts.ready],
            ["PUBLISHED", counts.published],
          ].map(([label, value]) => (
            <span key={String(label)} className="rounded-full border border-slate-700 px-3 py-1 text-slate-200">
              {label}: {value ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          onClick={() =>
            void api("update_settings", { enabled: !settings?.enabled }).then(refresh).then(() => toast.success("Updated status"))
          }
        >
          {settings?.enabled ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          {settings?.enabled ? "Turn OFF" : "Turn ON"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200"
          onClick={() => void api("run_research").then(refresh).then(() => toast.success("Research triggered"))}
        >
          <Sparkles className="h-4 w-4" />
          Run research now
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200"
          onClick={() =>
            void api("update_settings", { generation_paused: !settings?.generationPaused })
              .then(refresh)
              .then(() => toast.success("Pause setting updated"))
          }
        >
          {settings?.generationPaused ? "Resume generation" : "Pause generation"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200"
          onClick={() => void api("tick_admin").then(refresh).then(() => toast.success("Worker ticked"))}
        >
          Run worker tick
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Concept</th>
              <th className="px-3 py-2">Family</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Platforms</th>
              <th className="px-3 py-2">Pipeline</th>
              <th className="px-3 py-2">Failure</th>
            </tr>
          </thead>
          <tbody>
            {(snapshot?.concepts || []).map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-800 text-slate-200">
                <td className="px-3 py-2">{String(row.concept || "")}</td>
                <td className="px-3 py-2">{String(row.concept_family || "")}</td>
                <td className="px-3 py-2 uppercase">{String(row.classification || "")}</td>
                <td className="px-3 py-2">{Array.isArray(row.target_platforms) ? row.target_platforms.join(", ") : ""}</td>
                <td className="px-3 py-2">{String(row.pipeline_status || "")}</td>
                <td className="px-3 py-2 text-rose-300">{String(row.failure_reason || "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from "react";
import { toast } from "sonner";

import { libraryPhotos } from "./libraryMerge";
import { HIGGSFIELD_MODELS, type HiggsfieldModelKey } from "./higgsfieldModels";
import {
  composeLibraryReel,
  estimateLibraryClip,
  retryLibraryImport,
  submitLibraryClip,
  syncLibraryJob,
  type PublicJob,
} from "./adminLibraryApi";
import { LIBRARY_VIDEOS } from "./catalog";

export default function HiggsfieldStudio({ onImported }: { onImported: () => void }) {
  const photos = React.useMemo(() => libraryPhotos(), []);
  const shorts = React.useMemo(
    () => LIBRARY_VIDEOS.filter((item) => item.category === "christmas_reels" && item.kind === "short"),
    [],
  );
  const [photoId, setPhotoId] = React.useState(photos[0]?.id || "");
  const [modelKey, setModelKey] = React.useState<HiggsfieldModelKey>("kling-3.0-pro");
  const [prompt, setPrompt] = React.useState("");
  const [budget, setBudget] = React.useState("1.50");
  const [job, setJob] = React.useState<PublicJob | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);
  const [estimate, setEstimate] = React.useState<{ usd: number; credits: string | null } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!job?.id) return;
    if (["imported", "failed", "nsfw", "canceled"].includes(job.status)) return;
    const timer = window.setInterval(() => {
      void syncLibraryJob(job.id)
        .then((result) => {
          setJob(result.job);
          if (result.imported) onImported();
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, onImported]);

  async function onEstimate() {
    setBusy(true);
    try {
      const result = await estimateLibraryClip({ photoId, prompt, modelKey });
      setJob(result.job);
      setEstimate(result.estimate);
      setNotes(result.notes);
      if (!result.estimate) toast.message("No verifiable Higgsfield estimate. Paid generate stays blocked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Estimate failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    if (!job?.id) {
      toast.error("Estimate first so the budget can be compared to a real tariff.");
      return;
    }
    const budgetUsd = Number(budget);
    setBusy(true);
    try {
      const result = await submitLibraryClip({ jobId: job.id, budgetUsd });
      setJob(result.job);
      setNotes(result.notes);
      toast.message(result.submitted ? "Generation submitted" : "Resumed existing Higgsfield job (no duplicate charge)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRetryImport() {
    if (!job?.id) return;
    setBusy(true);
    try {
      const result = await retryLibraryImport(job.id);
      setJob(result.job);
      if (result.job.status === "imported") onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import retry failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCompose() {
    setBusy(true);
    try {
      const result = await composeLibraryReel(selected);
      toast.success(`Saved ${result.reel.catalogId} to TDG Library`);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Compose failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-lg font-semibold text-slate-50">Image → video (Higgsfield)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Admin-only. 5s, 9:16, 1080p, no audio when the model documents those fields. Jobs keep the provider ID if you
        close the tablet. MP4s are stored in TDG Library, not as Higgsfield CDN links.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="text-sm text-slate-300">
          Photo from TDG Library
          <select
            value={photoId}
            onChange={(event) => setPhotoId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {photos.map((photo) => (
              <option key={photo.id} value={photo.id}>
                {photo.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Model
          <select
            value={modelKey}
            onChange={(event) => setModelKey(event.target.value as HiggsfieldModelKey)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {Object.values(HIGGSFIELD_MODELS).map((model) => (
              <option key={model.key} value={model.key}>
                {model.label} ({model.modelId})
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm text-slate-300">
        Prompt
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          placeholder="Keep identity, add gentle snowfall, slow camera…"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">
          Budget USD
          <input
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            className="mt-1 w-32 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={() => void onEstimate()}
          className="rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
        >
          Estimate
        </button>
        <button
          type="button"
          disabled={busy || !job}
          onClick={() => void onGenerate()}
          className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Generate
        </button>
        {job?.status === "import_failed" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRetryImport()}
            className="rounded-xl border border-amber-400/40 px-3 py-2 text-sm text-amber-100"
          >
            Retry import
          </button>
        ) : null}
      </div>
      {estimate ? (
        <p className="mt-3 text-sm text-emerald-200">
          Verified estimate: ${estimate.usd.toFixed(4)}
          {estimate.credits ? ` (${estimate.credits} credits)` : ""}. Confirmed invoice stays empty until Higgsfield
          reports it.
        </p>
      ) : null}
      {job ? (
        <p className="mt-2 text-xs text-slate-400">
          Job {job.id} · {job.status}
          {job.provider_request_id ? ` · provider ${job.provider_request_id}` : ""}
          {job.estimated_cost_usd != null ? ` · est $${Number(job.estimated_cost_usd).toFixed(4)}` : ""}
          {job.confirmed_cost_usd != null ? ` · confirmed $${Number(job.confirmed_cost_usd).toFixed(4)}` : " · confirmed n/a"}
          {job.effective_width && job.effective_height ? ` · ${job.effective_width}×${job.effective_height}` : ""}
        </p>
      ) : null}
      {notes.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold text-slate-200">Assemble Reel from selected shorts</h3>
      <p className="mt-1 text-xs text-slate-500">
        Uses the existing ffmpeg hard-cut montage. Requires ffmpeg on the origin (VPS). Not billed to Higgsfield.
      </p>
      <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
        {shorts.slice(0, 20).map((clip) => (
          <label key={clip.id} className="flex items-center gap-1 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={selected.includes(clip.id)}
              onChange={(event) => {
                setSelected((prev) =>
                  event.target.checked ? [...prev, clip.id] : prev.filter((id) => id !== clip.id),
                );
              }}
            />
            {clip.title}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={busy || selected.length < 2}
        onClick={() => void onCompose()}
        className="mt-3 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
      >
        Save assembled Reel to Library
      </button>
    </section>
  );
}

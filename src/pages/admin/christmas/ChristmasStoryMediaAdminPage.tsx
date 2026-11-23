import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Private Christmas Story media ops queue.
 * Requires CHRISTMAS_STORY_ADMIN_TOKEN via header — never stores service role in the browser.
 */
export default function ChristmasStoryMediaAdminPage() {
  const [adminToken, setAdminToken] = useState("");
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadQueue() {
    setBusy(true);
    setNote(null);
    try {
      const { data, error } = await supabase.functions.invoke("christmas-story", {
        body: { action: "adminListSongQueue" },
        headers: { "x-christmas-story-admin-token": adminToken },
      });
      if (error) {
        setNote(error.message);
        setJobs([]);
        return;
      }
      if (data?.ok === false) {
        setNote(String(data.code || "unauthorized"));
        setJobs([]);
        return;
      }
      setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
      setNote(`Loaded ${Array.isArray(data?.jobs) ? data.jobs.length : 0} song jobs.`);
    } finally {
      setBusy(false);
    }
  }

  async function advance(jobId: string, productionState: string) {
    setBusy(true);
    setNote(null);
    try {
      const { data, error } = await supabase.functions.invoke("christmas-story", {
        body: { action: "adminAdvanceSongState", job_id: jobId, production_state: productionState },
        headers: { "x-christmas-story-admin-token": adminToken },
      });
      if (error || data?.ok === false) {
        setNote(error?.message || String(data?.code || "advance_failed"));
        return;
      }
      setNote(`Advanced ${jobId} → ${productionState}`);
      await loadQueue();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="text-xl font-semibold text-white">Story media production</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">
        Manual licensed-song queue. Upload masters and record commercial license evidence on the
        worker/ops host. Free/trial downloads are rejected. FFmpeg film jobs run on the isolated
        worker — not inside Edge Functions.
      </p>
      <label className="mt-4 block max-w-xl text-sm text-slate-300">
        Admin token
        <input
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        className="mt-3 rounded bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
        disabled={busy || adminToken.length < 24}
        onClick={() => void loadQueue()}
      >
        {busy ? "Loading…" : "Load song queue"}
      </button>
      {note ? <p className="mt-3 text-sm text-amber-200">{note}</p> : null}
      <ul className="mt-6 space-y-4">
        {jobs.map((job) => {
          const brief = ((job.metadata as Record<string, unknown> | undefined)?.brief ||
            {}) as Record<string, unknown>;
          return (
            <li key={String(job.id)} className="rounded border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-200">
                {String(job.id)} · order {String(job.order_id)} · {String(job.production_state || job.status)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                For {String(brief.recipientFirstName || "recipient")} · {String(brief.songGenre || "style n/a")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "in_production",
                  "rights_verification_pending",
                  "ready_for_buyer_review",
                  "failed",
                ].map((state) => (
                  <button
                    key={state}
                    type="button"
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                    disabled={busy}
                    onClick={() => void advance(String(job.id), state)}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-xs text-slate-500">
        Local film worker:{" "}
        <code>node --experimental-strip-types scripts/christmas-story-02d/film-worker.mjs --once</code>
      </p>
    </div>
  );
}

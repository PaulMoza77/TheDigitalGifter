import React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import type { AutopilotMusicTrack } from "../../../api/_lib/christmas-reel-pipeline/types";

async function api(action: string, body?: Record<string, unknown>) {
  const token = localStorage.getItem("sb-access-token") || "";
  const response = await fetch(`/api/christmas-reel-pipeline?action=${encodeURIComponent(action)}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(json.message || json.error || response.status));
  return json;
}

function verified(track: AutopilotMusicTrack): boolean {
  return track.approvedForAutopilot && track.commercialUseAllowed === true;
}

export default function AdminMusicLibraryPage() {
  const [tracks, setTracks] = React.useState<AutopilotMusicTrack[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api("list_music")) as { tracks: AutopilotMusicTrack[] };
      setTracks(data.tracks || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load music library.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Admin</p>
          <h1 className="text-2xl font-semibold">Christmas Music Library</h1>
          <p className="text-sm text-slate-400">Only verified CC0 tracks with approved_for_autopilot enter automatic publishing.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/library" className="rounded-full border border-white/15 px-4 py-2 text-sm">
            Library
          </Link>
          <button
            type="button"
            className="rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-2 text-sm text-amber-50"
            disabled={importing}
            onClick={() => {
              setImporting(true);
              void api("import_cc0")
                .then((result) => {
                  toast.success(`Import finished · ${String(result.imported)} imported`);
                  return load();
                })
                .catch((error) => toast.error(error instanceof Error ? error.message : "Import failed"))
                .finally(() => setImporting(false));
            }}
          >
            {importing ? "Importing…" : "Import verified CC0 Christmas tracks"}
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-400">Loading tracks…</p> : null}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Track</th>
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">Mood</th>
              <th className="px-4 py-3">License</th>
              <th className="px-4 py-3">Commercial</th>
              <th className="px-4 py-3">IG / FB / YT</th>
              <th className="px-4 py-3">Approved</th>
              <th className="px-4 py-3">Last used</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => {
              const safe = verified(track);
              return (
                <tr key={track.id} className="border-t border-white/10 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-amber-50">{track.title}</div>
                    {track.publicSrc ? (
                      <button
                        type="button"
                        className="mt-1 text-xs text-sky-300"
                        onClick={() => setPreviewId((id) => (id === track.id ? null : track.id))}
                      >
                        {previewId === track.id ? "Hide preview" : "Preview audio"}
                      </button>
                    ) : null}
                    {previewId === track.id && track.publicSrc ? (
                      <audio className="mt-2 w-full max-w-xs" src={track.publicSrc} controls autoPlay />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{track.artistSource || "—"}</td>
                  <td className="px-4 py-3">{track.mood}</td>
                  <td className="px-4 py-3">
                    {track.licenseUrl ? (
                      <a href={track.licenseUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline">
                        {track.licenseType || "License"}
                      </a>
                    ) : (
                      track.licenseType || "—"
                    )}
                    {track.sourceUrl ? (
                      <div>
                        <a href={track.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-400 underline">
                          Source
                        </a>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{track.commercialUseAllowed ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    {track.instagramAllowed ? "IG" : "—"} / {track.facebookAllowed ? "FB" : "—"} / {track.youtubeAllowed ? "YT" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={safe ? "text-emerald-300" : "text-rose-300"}>{safe ? "SAFE ✓" : "NOT VERIFIED"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{track.lastUsedAt ? new Date(track.lastUsedAt).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

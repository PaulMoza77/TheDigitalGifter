import React from "react";
import { toast } from "sonner";

import type { LibraryVideo } from "@/features/admin-library/catalog";
import { LIVE_DURATION_PRESETS_HOURS, LIVE_DEFAULT_HOURS, type LiveDurationHours, type YoutubeLivePrivacy } from "./policy";
import { youtubeLiveApi } from "./api";

type Props = {
  video: LibraryVideo;
  onClose: () => void;
  onStarted: () => void;
};

export default function StartLiveModal({ video, onClose, onStarted }: Props) {
  const [title, setTitle] = React.useState(video.title || "TDG Live");
  const [description, setDescription] = React.useState(video.description || "");
  const [privacy, setPrivacy] = React.useState<YoutubeLivePrivacy>("private");
  const [hours, setHours] = React.useState<LiveDurationHours>(LIVE_DEFAULT_HOURS);
  const [publicConfirm, setPublicConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function start() {
    if (privacy === "public" && !publicConfirm) {
      toast.error("Confirm that this live should be Public on YouTube.");
      return;
    }
    setBusy(true);
    try {
      await youtubeLiveApi.start({
        library_asset_id: video.id,
        production_id: video.productionId,
        title,
        description,
        privacy_status: privacy,
        made_for_kids: false,
        duration_hours: hours,
      });
      toast.success("YouTube Live is starting. The stream key stayed on the server.");
      onStarted();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start YouTube Live.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white">
        <h2 className="text-lg font-semibold">Start YouTube Live</h2>
        <p className="mt-1 text-xs text-slate-400">
          Loops this long-form file on the VPS. No stream key is sent to the browser.
        </p>
        <label className="mt-4 block text-xs text-slate-400">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="mt-3 block text-xs text-slate-400">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="mt-3">
          <p className="text-xs text-slate-400">Privacy</p>
          <div className="mt-1 flex gap-2">
            {(["private", "unlisted", "public"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPrivacy(item)}
                className={[
                  "rounded-full px-3 py-1 text-xs capitalize",
                  privacy === item ? "bg-indigo-500 text-white" : "border border-slate-700 text-slate-300",
                ].join(" ")}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs text-slate-400">Duration</p>
          <div className="mt-1 flex gap-2">
            {LIVE_DURATION_PRESETS_HOURS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setHours(item)}
                className={[
                  "rounded-full px-3 py-1 text-xs",
                  hours === item ? "bg-indigo-500 text-white" : "border border-slate-700 text-slate-300",
                ].join(" ")}
              >
                {item}h
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Made for kids: false</p>
        {privacy === "public" ? (
          <label className="mt-3 flex items-start gap-2 text-xs text-amber-100">
            <input type="checkbox" checked={publicConfirm} onChange={(event) => setPublicConfirm(event.target.checked)} />
            I understand this live will be Public on YouTube.
          </label>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="rounded-xl bg-red-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Starting…" : "START LIVE"}
          </button>
        </div>
      </div>
    </div>
  );
}

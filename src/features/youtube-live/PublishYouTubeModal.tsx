import React from "react";
import { toast } from "sonner";

import type { LibraryVideo } from "@/features/admin-library/catalog";
import type { YoutubeLivePrivacy } from "./policy";
import { youtubeLiveApi } from "./api";

type Props = {
  video: LibraryVideo;
  onClose: () => void;
};

export default function PublishYouTubeModal({ video, onClose }: Props) {
  const [title, setTitle] = React.useState(video.title || "TDG long-form");
  const [description, setDescription] = React.useState(video.description || "");
  const [privacy, setPrivacy] = React.useState<YoutubeLivePrivacy>("private");
  const [busy, setBusy] = React.useState(false);

  async function publish() {
    setBusy(true);
    try {
      const result = await youtubeLiveApi.publishVideo({
        library_asset_id: video.id,
        production_id: video.productionId,
        title,
        description,
        privacy_status: privacy,
        made_for_kids: false,
      });
      toast.success(`Uploaded as a YouTube video: ${result.url}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "YouTube upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white">
        <h2 className="text-lg font-semibold">Publish to YouTube</h2>
        <p className="mt-1 text-xs text-slate-400">
          Uploads the local VPS file as a normal YouTube video (not a Short). The file is not fetched through the browser.
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
        <div className="mt-3 flex gap-2">
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
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Publish video"}
          </button>
        </div>
      </div>
    </div>
  );
}

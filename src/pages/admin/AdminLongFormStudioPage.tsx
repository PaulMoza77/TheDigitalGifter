import React from "react";
import { Film, Library, Loader2, Music2, Pause, Play, Shuffle, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { longFormApi } from "@/features/long-form-studio/api";
import { trackBadges } from "@/features/long-form-studio/musicRights";
import { formatClock, moodForStyle } from "@/features/long-form-studio/playlist";
import {
  DURATION_BUTTONS,
  MOOD_LABELS,
  MUSIC_MOODS,
  STAGE_LABELS,
  STYLE_LABELS,
  STYLE_PRESETS,
  STUDIO_STAGES,
  type MusicMood,
  type MusicTrack,
  type StylePreset,
} from "@/features/long-form-studio/types";

type Scene = {
  id: string;
  title: string;
  description?: string;
  src: string;
  poster?: string;
  kind: string;
  filename: string;
  photo?: boolean;
};

const STAGE_LIST = STUDIO_STAGES.map((id) => ({ id, label: STAGE_LABELS[id] }));

function Chip({
  active,
  label,
  onClick,
  large,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border text-left transition",
        large ? "min-w-[7.5rem] px-5 py-4 text-sm font-semibold tracking-[0.14em]" : "px-3 py-2 text-sm",
        active
          ? "border-amber-300/70 bg-amber-200/15 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.12)]"
          : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function RightsPills({ track }: { track: MusicTrack }) {
  const badge = trackBadges(track);
  if (badge.kind === "review") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
        <TriangleAlert className="h-3 w-3" />
        Rights need review
      </span>
    );
  }
  const tone = badge.kind === "demo" ? "border-slate-400/30 bg-slate-500/10 text-slate-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  return (
    <span className="flex flex-wrap gap-1">
      {badge.labels.map((label) => (
        <span key={label} className={`rounded-full border px-2 py-0.5 text-[11px] ${tone}`}>
          {badge.kind === "demo" ? label : `✓ ${label}`}
        </span>
      ))}
    </span>
  );
}

export default function AdminLongFormStudioPage() {
  const [scenes, setScenes] = React.useState<Scene[]>([]);
  const [music, setMusic] = React.useState<MusicTrack[]>([]);
  const [query, setQuery] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [musicOpen, setMusicOpen] = React.useState(false);
  const [scene, setScene] = React.useState<Scene | null>(null);
  const [style, setStyle] = React.useState<StylePreset>("cozy");
  const [mood, setMood] = React.useState<MusicMood>("cozy_instrumental");
  const [duration, setDuration] = React.useState(3600);
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const [shuffle, setShuffle] = React.useState(true);
  const [selectedCount, setSelectedCount] = React.useState(0);
  const [musicDuration, setMusicDuration] = React.useState(0);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [production, setProduction] = React.useState<Record<string, unknown> | null>(null);
  const [yalOpen, setYalOpen] = React.useState(false);

  React.useEffect(() => {
    void longFormApi
      .bootstrap()
      .then((data) => {
        setMusic(data.music || []);
        setScenes((data.scenes || []) as Scene[]);
      })
      .catch((error: Error) => toast.error(error.message));
  }, []);

  React.useEffect(() => {
    setMood(moodForStyle(style));
  }, [style]);

  React.useEffect(() => {
    void longFormApi
      .previewPlaylist(mood, duration, shuffle, 7)
      .then((data) => {
        setSelectedCount(data.selected.length);
        setMusicDuration(data.musicDuration);
      })
      .catch(() => {
        setSelectedCount(0);
        setMusicDuration(0);
      });
  }, [mood, duration, shuffle, music.length]);

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scenes.filter((item) => !needle || `${item.title} ${item.description || ""}`.toLowerCase().includes(needle));
  }, [scenes, query]);

  const photo = scene ? scene.photo || scene.kind === "photo" : false;
  const stage = String(production?.stage || "");
  const progress = Number(production?.progress || 0);
  const similar = production?.similarity as { tooSimilar?: boolean; closestTitle?: string } | undefined;
  const rights = production?.rights_manifest as { publicationStatus?: string; blockers?: string[] } | undefined;
  const status = String(production?.status || "");
  const done = ["saved", "demo", "ready_to_publish", "rights_review_required", "similarity_review_required", "persist_failed", "failed"].includes(status);
  const playback = String(production?.playback_url || production?.src || "");
  const libraryId = String(production?.library_asset_id || "");
  const usedDemo = String(production?.soundtrack_kind || "") === "demo";

  async function onCreate() {
    if (!scene) {
      toast.error("Choose a scene first.");
      return;
    }
    setCreating(true);
    try {
      const result = (await longFormApi.createVideo({
        scene_ids: [scene.id],
        mood,
        style,
        duration_seconds: duration,
        shuffle,
      })) as { production?: Record<string, unknown>; id?: string; progress?: number };
      const next = (result.production || result) as Record<string, unknown>;
      setProduction(next);
      const id = String(next.id || "");
      if (id && Number(next.progress || 0) < 100) {
        const timer = window.setInterval(() => {
          void longFormApi.getProduction(id).then((row) => {
            setProduction(row.production);
            const done = [
              "saved",
              "demo",
              "ready_to_publish",
              "rights_review_required",
              "similarity_review_required",
              "persist_failed",
              "failed",
            ].includes(String(row.production.status));
            if (done) window.clearInterval(timer);
          });
        }, 2500);
      }
      toast.success("Creating your video.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create video");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#07080c] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200/70">Long-Form Studio</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-amber-50 sm:text-5xl">Create the atmosphere</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            One carefully made Christmas ambience video. Start with 1 hour. Music must be documented before this is more than a demo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMusicOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <Music2 className="h-4 w-4" />
            Music Library
          </button>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <section>
            <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-slate-500">Step 1 — Choose scene</p>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <div className="relative aspect-video bg-zinc-950">
                {scene ? (
                  photo ? (
                    <img src={scene.src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video
                      key={scene.id}
                      src={scene.src}
                      poster={scene.poster}
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Choose a scene from the Library</div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                  <p className="font-medium text-amber-50">{scene?.title || "No scene selected"}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2.5 text-sm font-semibold text-zinc-900"
              >
                <Library className="h-4 w-4" />
                Choose from Library
              </button>
              {photo ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!scene) return;
                    void longFormApi.animateScene(scene.id).then((data) => toast.success(data.note)).catch((err: Error) => toast.error(err.message));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-100"
                >
                  <Sparkles className="h-4 w-4" />
                  Animate Scene
                </button>
              ) : null}
            </div>
          </section>

          <aside className="space-y-6">
            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-slate-500">Step 2 — Choose music</p>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap gap-2">
                  {MUSIC_MOODS.map((id) => (
                    <Chip key={id} active={mood === id} label={MOOD_LABELS[id]} onClick={() => setMood(id)} />
                  ))}
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-amber-50">{selectedCount} tracks</p>
                    <p className="text-sm text-slate-400">Music duration: {formatClock(musicDuration)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShuffle((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs ${shuffle ? "bg-amber-100 text-zinc-900" : "border border-white/15 text-slate-200"}`}
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    Shuffle
                  </button>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-slate-500">Step 3 — Duration</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_BUTTONS.map((item) => (
                  <Chip
                    key={item.seconds}
                    large
                    active={duration === item.seconds}
                    label={item.enabled ? item.label : `${item.label} (soon)`}
                    onClick={() => {
                      if (!item.enabled) return;
                      setDuration(item.seconds);
                    }}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Longer lengths stay off until storage and render time are validated.</p>
            </section>

            <section>
              <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-slate-500">Step 4 — Style</p>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((id) => (
                  <Chip key={id} active={style === id} label={STYLE_LABELS[id]} onClick={() => setStyle(id)} />
                ))}
              </div>
              <button type="button" onClick={() => setCustomizeOpen((v) => !v)} className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                Customize
              </button>
              {customizeOpen ? (
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Style quietly shapes music mood, motion, titles, and thumbnail ideas. Keep it simple — variation lives in the scene and soundtrack, not in extra prompts.
                </p>
              ) : null}
            </section>
          </aside>
        </div>

        <div className="mt-10 flex flex-col items-start gap-4">
          <button
            type="button"
            disabled={creating}
            onClick={() => void onCreate()}
            className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-100 to-orange-200 px-10 py-4 text-sm font-semibold tracking-[0.18em] text-zinc-900 shadow-[0_20px_40px_rgba(251,191,36,0.2)] disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            CREATE VIDEO
          </button>

          {production ? (
            <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-6">
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/80">In progress</p>
              <p className="mt-1 text-lg text-amber-50">{String(production.progress_label || "Preparing scene")}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-amber-200" style={{ width: `${Math.max(6, progress)}%` }} />
              </div>
              <ol className="mt-5 space-y-2">
                {STAGE_LIST.map((item) => {
                  const currentIndex = STAGE_LIST.findIndex((row) => row.id === stage);
                  const itemIndex = STAGE_LIST.findIndex((row) => row.id === item.id);
                  const done = itemIndex < currentIndex || progress >= 100;
                  const active = item.id === stage && progress < 100;
                  return (
                    <li key={item.id} className={done || active ? "text-amber-50" : "text-slate-500"}>
                      {done ? "●" : active ? "○" : "·"} {item.label}
                    </li>
                  );
                })}
              </ol>
              {similar?.tooSimilar ? (
                <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  ⚠ Too similar to an existing video{similar.closestTitle ? ` (${similar.closestTitle})` : ""}. Change the scene, music, or style before treating this as a new production.
                </p>
              ) : null}
              {usedDemo ? (
                <p className="mt-3 text-sm text-amber-100">
                  This run used demo test pads, not finished Christmas music. The file is a technical demo.
                </p>
              ) : null}
              {rights?.publicationStatus === "rights_review_required" ? (
                <p className="mt-3 text-sm text-amber-100">
                  Rights need review. Library scenes and demo pads are not a commercial YouTube clearance.
                </p>
              ) : null}
              {status === "persist_failed" || status === "failed" ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-rose-200">{String(production.error_message || "Creation failed.")}</p>
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-3 py-1 text-xs"
                    onClick={() => {
                      const id = String(production.id || "");
                      if (!id) return;
                      void longFormApi.retryProduction(id).then((row) => setProduction(row.production)).catch((err: Error) => toast.error(err.message));
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {done && playback ? (
                <div className="mt-4 space-y-3">
                  <video className="w-full rounded-2xl" src={playback} controls poster={production.poster ? String(production.poster) : undefined} />
                  <div className="flex flex-wrap gap-2">
                    <a href={playback} className="rounded-full bg-amber-100 px-4 py-2 text-sm text-zinc-900" target="_blank" rel="noreferrer">
                      Play
                    </a>
                    <a href={playback} download className="rounded-full border border-white/20 px-4 py-2 text-sm">
                      Download
                    </a>
                    {libraryId ? (
                      <a href="/admin/library" className="rounded-full border border-white/20 px-4 py-2 text-sm">
                        Open in Library
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0c0d12]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <p className="font-medium">Library scenes</p>
              <button type="button" className="text-sm text-slate-400" onClick={() => setPickerOpen(false)}>
                Close
              </button>
            </div>
            <div className="px-5 py-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cozy, cabin, New York…"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm"
              />
            </div>
            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto p-5 md:grid-cols-3">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setScene(item);
                    setPickerOpen(false);
                  }}
                  className="overflow-hidden rounded-2xl border border-white/10 text-left hover:border-amber-200/40"
                >
                  <div className="aspect-video bg-black">
                    {item.photo || item.kind === "photo" ? (
                      <img src={item.src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <img src={item.poster || item.src} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className="px-3 py-2 text-xs text-slate-200">{item.title}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {musicOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0c0d12]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="font-medium">TDG Music Library</p>
                <p className="text-xs text-slate-500">Demo pads are labeled. License stored only when a document was uploaded.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="text-sm text-amber-100" onClick={() => setYalOpen((v) => !v)}>
                  Import YouTube Audio Library
                </button>
                <button type="button" className="text-sm text-slate-400" onClick={() => setMusicOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            {yalOpen ? <YalImportForm onImported={(track) => setMusic((current) => [track, ...current])} /> : null}
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              {music.map((track) => (
                <div key={track.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-amber-50">{track.title}</p>
                      <p className="text-xs text-slate-400">
                        {track.artistSource} · {MOOD_LABELS[track.mood as MusicMood] || track.mood} · {formatClock(track.durationSeconds)}
                      </p>
                    </div>
                    {track.publicSrc ? (
                      <button
                        type="button"
                        onClick={() => setPreviewId((id) => (id === track.id ? null : track.id))}
                        className="rounded-full border border-white/15 p-2"
                      >
                        {previewId === track.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <RightsPills track={track} />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">{track.licenseType}</p>
                  {previewId === track.id && track.publicSrc ? <audio className="mt-3 w-full" src={track.publicSrc} controls autoPlay /> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function YalImportForm({ onImported }: { onImported: (track: MusicTrack) => void }) {
  const [title, setTitle] = React.useState("");
  const [artist, setArtist] = React.useState("");
  const [attr, setAttr] = React.useState(false);
  const [attrText, setAttrText] = React.useState("");
  const [youtube, setYoutube] = React.useState<"yes" | "no" | "unknown">("unknown");
  const [commercial, setCommercial] = React.useState(false);
  const [audio, setAudio] = React.useState<File | null>(null);
  const [proof, setProof] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <form
      className="space-y-2 border-b border-white/10 px-5 py-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!audio) {
          toast.error("Choose the MP3, WAV, or M4A file you downloaded from YouTube Audio Library.");
          return;
        }
        setBusy(true);
        void longFormApi
          .importYal(
            {
              title,
              artist_source: artist,
              attribution_required: attr,
              attribution_text: attrText,
              youtube_monetization_allowed: youtube,
              commercial_use_allowed: commercial,
              mood: "cozy_instrumental",
            },
            { audio, proof },
          )
          .then((data) => {
            onImported(data.track);
            toast.success(data.duplicate ? "This file was already in the library." : "Track stored. Rights stay on review until the license document is present.");
          })
          .catch((error: Error) => toast.error(error.message))
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-xs text-slate-400">
        Import a file you obtained from YouTube Audio Library. Do not paste random YouTube links. Attach the license page or export you saved.
      </p>
      <input className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2" placeholder="Artist / source" value={artist} onChange={(e) => setArtist(e.target.value)} />
      <label className="block text-slate-400">
        Audio file
        <input className="mt-1 block w-full text-xs" type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" onChange={(e) => setAudio(e.target.files?.[0] || null)} />
      </label>
      <label className="block text-slate-400">
        License document
        <input className="mt-1 block w-full text-xs" type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(e) => setProof(e.target.files?.[0] || null)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={attr} onChange={(e) => setAttr(e.target.checked)} />
        Attribution required
      </label>
      {attr ? (
        <input className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2" placeholder="Required attribution text" value={attrText} onChange={(e) => setAttrText(e.target.value)} />
      ) : null}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={commercial} onChange={(e) => setCommercial(e.target.checked)} />
        Commercial use allowed (from the Audio Library license, not the filename)
      </label>
      <label className="block text-slate-400">
        YouTube use
        <select className="ml-2 rounded-lg bg-black/40 px-2 py-1" value={youtube} onChange={(e) => setYoutube(e.target.value as "yes" | "no" | "unknown")}>
          <option value="unknown">Unknown</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <button type="submit" disabled={busy} className="rounded-full bg-amber-100 px-4 py-2 text-zinc-900 disabled:opacity-60">
        {busy ? "Saving…" : "Save track"}
      </button>
    </form>
  );
}

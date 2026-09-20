import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Check,
  Film,
  Library,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  clipFactoryApi,
  type ClipFactoryCandidateRow,
  type ClipFactoryJob,
} from "@/features/clip-factory/api";
import { sortCandidates } from "@/features/clip-factory/diversity";
import { classifyMediaUrl } from "@/features/clip-factory/safeUrl";
import {
  ANALYSIS_STAGE_ORDER,
  DEFAULT_CLIP_FACTORY_OPTIONS,
  STAGE_LABELS,
  type CaptionStyle,
  type ClipFactoryOptions,
} from "@/features/clip-factory/types";

const COUNT_CHIPS: Array<{ id: ClipFactoryOptions["clipCount"]; label: string }> = [
  { id: 5, label: "5" },
  { id: 10, label: "10" },
  { id: 20, label: "20" },
  { id: "auto", label: "Auto" },
];
const DURATION_CHIPS: Array<{ id: ClipFactoryOptions["duration"]; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "10-20", label: "10–20 sec" },
  { id: "20-30", label: "20–30 sec" },
  { id: "30-60", label: "30–60 sec" },
];
const PLATFORM_CHIPS: Array<{ id: ClipFactoryOptions["platform"]; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "instagram_reels", label: "Instagram Reels" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube_shorts", label: "YouTube Shorts" },
  { id: "facebook_reels", label: "Facebook Reels" },
];
const OBJECTIVE_CHIPS: Array<{ id: ClipFactoryOptions["objective"]; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "viral", label: "Viral" },
  { id: "funny", label: "Funny" },
  { id: "emotional", label: "Emotional" },
  { id: "educational", label: "Educational" },
  { id: "storytelling", label: "Storytelling" },
  { id: "inspirational", label: "Inspirational" },
  { id: "christmas", label: "Christmas / Seasonal" },
];
const CAPTION_CHIPS: Array<{ id: CaptionStyle; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "clean", label: "Clean" },
  { id: "bold_viral", label: "Bold Viral" },
  { id: "minimal", label: "Minimal" },
  { id: "karaoke", label: "Karaoke" },
];

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-indigo-400/70 bg-indigo-500/20 text-white"
          : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function formatClock(seconds: number): string {
  const t = Math.max(0, seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusTone(status: string): string {
  if (status === "completed") return "text-emerald-300";
  if (status === "failed") return "text-rose-300";
  if (status === "ready") return "text-indigo-200";
  if (status === "partial") return "text-amber-200";
  return "text-slate-300";
}

export default function AdminClipFactoryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobId = params.get("job");
  const [options, setOptions] = React.useState<ClipFactoryOptions>(DEFAULT_CLIP_FACTORY_OPTIONS);
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [libraryId, setLibraryId] = React.useState("");
  const [libraryItems, setLibraryItems] = React.useState<Array<{ id: string; title: string }>>([]);
  const [advanced, setAdvanced] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [job, setJob] = React.useState<ClipFactoryJob | null>(null);
  const [jobs, setJobs] = React.useState<ClipFactoryJob[]>([]);
  const [sort, setSort] = React.useState<"score" | "shortest" | "longest" | "funny" | "emotional" | "educational" | "visual">("score");
  const [preview, setPreview] = React.useState<ClipFactoryCandidateRow | null>(null);
  const [trim, setTrim] = React.useState({ start: 0, end: 0 });
  const submitLock = React.useRef(false);

  const loadJobs = React.useCallback(() => {
    void clipFactoryApi.listJobs().then((data) => setJobs(data.jobs)).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    void clipFactoryApi.libraryVideos().then((data) => setLibraryItems(data.videos)).catch(() => undefined);
    loadJobs();
  }, [loadJobs]);

  React.useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    const id = jobId;
    let cancelled = false;
    async function refresh() {
      try {
        const data = await clipFactoryApi.getJob(id);
        if (!cancelled) setJob(data.job);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load job.");
      }
    }
    void refresh();
    const active = !job || !["completed", "failed", "ready", "partial"].includes(job.status);
    const timer = window.setInterval(() => void refresh(), active ? 2500 : 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobId, job?.status]);

  function openJob(id: string) {
    navigate(`/admin/clip-factory?job=${id}`);
  }

  async function createJob() {
    if (submitLock.current || busy) return;
    submitLock.current = true;
    setBusy(true);
    try {
      const idempotency = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let payload: Record<string, unknown> = { options, idempotency_key: idempotency };
      if (file) {
        const signed = await clipFactoryApi.signedUpload(file.type || "video/mp4", file.size, file.name);
        await fetch(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: file });
        payload = { ...payload, source_kind: "upload", object_path: signed.objectPath, file_name: file.name };
      } else if (libraryId) {
        payload = { ...payload, source_kind: "library", library_asset_id: libraryId };
      } else if (url.trim()) {
        const decision = classifyMediaUrl(url.trim());
        if (!decision.ok) {
          toast.error(decision.message);
          return;
        }
        payload = { ...payload, source_kind: "direct_media_url", url: decision.url };
      } else {
        toast.error("Paste a video URL, upload a file, or choose one from the Library.");
        return;
      }
      const created = await clipFactoryApi.createJob(payload);
      openJob(created.job.id);
      loadJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start analysis.");
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  const urlDecision = url.trim() ? classifyMediaUrl(url.trim()) : null;
  const analyzing = Boolean(job && !["ready", "completed", "partial", "failed"].includes(job.status));
  const candidates = sortCandidates(
    (job?.candidates || [])
      .filter((c) => !c.rejected)
      .map((c) => ({
        startTime: c.start_time,
        endTime: c.end_time,
        duration: c.duration,
        title: c.title,
        hook: c.hook,
        summary: c.summary,
        reason: c.reason,
        category: c.category,
        suggestedPlatforms: c.suggested_platforms,
        suggestedCaption: c.suggested_caption,
        suggestedPostCaption: c.suggested_post_caption,
        hashtags: c.hashtags,
        confidence: c.confidence,
        scores: {
          hook: c.scores.hook || 0,
          retention: c.scores.retention || 0,
          emotion: c.scores.emotion || 0,
          humor: c.scores.humor || 0,
          visual: c.scores.visual || 0,
          standalone: c.scores.standalone || 0,
          shareability: c.scores.shareability || 0,
        },
        overallViralScore: c.overall_viral_score,
        whyItWorks: c.why_it_works,
      })),
    sort,
  );

  async function generate(ids: string[]) {
    if (!job) return;
    try {
      await clipFactoryApi.render(job.id, ids, { captionStyle: options.captionStyle, aiHook: options.aiHook });
      toast.success("Generating vertical clips…");
      const fresh = await clipFactoryApi.getJob(job.id);
      setJob(fresh.job);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start render.");
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">AI Clip Factory</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            <WandSparkles className="h-8 w-8 text-indigo-300" />
            Turn any video into scroll-stopping content
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">
            AI finds the strongest moments, edits them and creates ready-to-post Reels, Shorts and TikToks.
          </p>
          {jobId ? (
            <button type="button" onClick={() => navigate("/admin/clip-factory")} className="mt-4 text-sm text-indigo-300">
              New job
            </button>
          ) : null}
        </header>

        {!jobId ? (
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/50 p-5 sm:p-8">
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Paste video URL</span>
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setFile(null);
                    setLibraryId("");
                  }}
                  placeholder="https://cdn.example.com/talk.mp4"
                  aria-invalid={Boolean(urlDecision && !urlDecision.ok)}
                  className={[
                    "w-full rounded-2xl border bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600",
                    urlDecision && !urlDecision.ok
                      ? "border-amber-400/70 focus:border-amber-300"
                      : "border-slate-700 focus:border-indigo-400/60",
                  ].join(" ")}
                />
                {urlDecision && !urlDecision.ok ? (
                  <p className="mt-2 text-sm text-amber-200">{urlDecision.message}</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Direct file URLs only (.mp4, .mov, .webm). YouTube, TikTok, and Vimeo links are not imported — upload the file instead.
                  </p>
                )}
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
                  <Upload className="h-4 w-4" />
                  {file ? file.name : "Upload Video"}
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                    className="hidden"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setUrl("");
                      setLibraryId("");
                    }}
                  />
                </label>
                <select
                  value={libraryId}
                  onChange={(e) => {
                    setLibraryId(e.target.value);
                    setFile(null);
                    setUrl("");
                  }}
                  className="min-w-[220px] flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                >
                  <option value="">Choose from Library</option>
                  {libraryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 grid gap-6">
              <fieldset>
                <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Number of clips</legend>
                <div className="flex flex-wrap gap-2">
                  {COUNT_CHIPS.map((chip) => (
                    <Chip key={String(chip.id)} active={options.clipCount === chip.id} label={chip.label} onClick={() => setOptions({ ...options, clipCount: chip.id })} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Target duration</legend>
                <div className="flex flex-wrap gap-2">
                  {DURATION_CHIPS.map((chip) => (
                    <Chip key={chip.id} active={options.duration === chip.id} label={chip.label} onClick={() => setOptions({ ...options, duration: chip.id })} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Platform</legend>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_CHIPS.map((chip) => (
                    <Chip key={chip.id} active={options.platform === chip.id} label={chip.label} onClick={() => setOptions({ ...options, platform: chip.id })} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Content objective</legend>
                <div className="flex flex-wrap gap-2">
                  {OBJECTIVE_CHIPS.map((chip) => (
                    <Chip key={chip.id} active={options.objective === chip.id} label={chip.label} onClick={() => setOptions({ ...options, objective: chip.id, aiHook: chip.id === "viral" ? true : options.aiHook })} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Caption style</legend>
                <div className="flex flex-wrap gap-2">
                  {CAPTION_CHIPS.map((chip) => (
                    <Chip key={chip.id} active={options.captionStyle === chip.id} label={chip.label} onClick={() => setOptions({ ...options, captionStyle: chip.id })} />
                  ))}
                </div>
              </fieldset>
            </div>

            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              className="mt-6 text-sm text-slate-500"
            >
              {advanced ? "Hide advanced options" : "Advanced options"}
            </button>
            {advanced ? (
              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  Language
                  <select
                    value={options.language}
                    onChange={(e) => setOptions({ ...options, language: e.target.value })}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-1"
                  >
                    <option value="auto">Auto Detect</option>
                    <option value="en">English</option>
                    <option value="ro">Romanian</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.aiHook}
                    onChange={(e) => setOptions({ ...options, aiHook: e.target.checked })}
                  />
                  AI Hook
                </label>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-600">Language: Auto Detect</p>
            )}

            <button
              type="button"
              disabled={busy || Boolean(urlDecision && !urlDecision.ok)}
              onClick={() => void createJob()}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60 sm:w-auto"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Find Viral Moments
            </button>
          </section>
        ) : null}

        {job && analyzing ? (
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
            <p className="text-sm text-slate-400">{job.source_label}</p>
            <h2 className="mt-1 text-2xl font-semibold">Finding the strongest moments</h2>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${Math.max(6, job.progress)}%` }} />
            </div>
            <ol className="mt-6 grid gap-2">
              {ANALYSIS_STAGE_ORDER.map((stage) => {
                const currentIndex = ANALYSIS_STAGE_ORDER.indexOf(job.stage as (typeof ANALYSIS_STAGE_ORDER)[number]);
                const thisIndex = ANALYSIS_STAGE_ORDER.indexOf(stage);
                const done = currentIndex > thisIndex || job.status === "ready";
                const active = job.stage === stage || (stage === "ingesting" && job.stage === "queued");
                return (
                  <li key={stage} className="flex items-center gap-3 rounded-2xl border border-slate-800 px-4 py-3">
                    {done ? <Check className="h-4 w-4 text-emerald-300" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-indigo-300" /> : <span className="h-4 w-4 rounded-full border border-slate-700" />}
                    <span className={active ? "text-white" : "text-slate-400"}>{STAGE_LABELS[stage]}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-sm text-slate-500">You can leave this page. Progress is saved.</p>
          </section>
        ) : null}

        {job?.status === "failed" ? (
          <section className="mt-6 rounded-[28px] border border-rose-500/20 bg-rose-950/20 p-6">
            <h2 className="text-xl font-semibold">Analysis could not finish</h2>
            <p className="mt-2 text-sm leading-6 text-rose-100">{job.error_message || "The job failed."}</p>
            <button
              type="button"
              onClick={() => void clipFactoryApi.retry(job.id).then((data) => setJob(data.job))}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
            >
              <RotateCcw className="h-4 w-4" />
              Retry failed step
            </button>
          </section>
        ) : null}

        {job && ["ready", "completed", "partial", "rendering"].includes(job.status) ? (
          <section className="mt-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{job.moments_found} Viral Moments Found</h2>
                <p className="text-sm text-slate-400">{job.source_label}</p>
              </div>
              <button
                type="button"
                onClick={() => void generate((job.candidates || []).filter((c) => !c.rejected).slice(0, 10).map((c) => c.id))}
                className="rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold"
              >
                Generate Best 10
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["score", "shortest", "longest", "funny", "emotional", "educational", "visual"] as const).map((key) => (
                <Chip key={key} active={sort === key} label={key === "score" ? "Best score" : key[0].toUpperCase() + key.slice(1)} onClick={() => setSort(key)} />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(job.candidates || [])
                .filter((c) => !c.rejected)
                .sort((a, b) => {
                  const map = new Map(candidates.map((c, i) => [`${c.startTime}-${c.endTime}`, i]));
                  return (map.get(`${a.start_time}-${a.end_time}`) ?? 0) - (map.get(`${b.start_time}-${b.end_time}`) ?? 0);
                })
                .map((card) => {
                  const render = job.renders?.find((r) => r.candidate_id === card.id);
                  return (
                    <article key={card.id} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-3xl font-semibold tabular-nums">{card.overall_viral_score} <span className="text-sm font-normal text-slate-500">/ 100</span></p>
                        <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] uppercase tracking-wide text-amber-200">
                          {card.scores.hook >= 80 ? "Strong hook" : card.category}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-medium leading-6">“{card.hook || card.title}”</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {Math.round(card.duration)} sec · {formatClock(card.start_time)} → {formatClock(card.end_time)}
                      </p>
                      <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-slate-500">Why this works</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">
                        {(card.why_it_works.length ? card.why_it_works : [card.reason]).slice(0, 5).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="rounded-xl border border-slate-700 px-3 py-2 text-sm" onClick={() => { setPreview(card); setTrim({ start: card.start_time, end: card.end_time }); }}>Preview</button>
                        <button type="button" className="rounded-xl border border-slate-700 px-3 py-2 text-sm" onClick={() => { setPreview(card); setTrim({ start: card.start_time, end: card.end_time }); }}>Edit</button>
                        <button type="button" className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold" onClick={() => void generate([card.id])}>Generate</button>
                        <button type="button" className="rounded-xl px-3 py-2 text-sm text-slate-500" onClick={() => void clipFactoryApi.rejectCandidate(job.id, card.id, true).then(async () => setJob((await clipFactoryApi.getJob(job.id)).job))}>Reject</button>
                      </div>
                      {render ? (
                        <p className={`mt-3 text-xs ${statusTone(render.status)}`}>
                          {render.status === "completed" ? "Saved to Library" : render.status === "failed" ? render.error_message : "Rendering…"}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
            </div>
          </section>
        ) : null}

        {preview && job ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Preview</h3>
                <button type="button" onClick={() => setPreview(null)} className="text-slate-400">Close</button>
              </div>
              <div className="relative mx-auto mt-4 aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-3xl bg-black">
                {job.playback_url ? (
                  <video
                    className="h-full w-full object-cover"
                    src={`${job.playback_url}#t=${trim.start},${trim.end}`}
                    controls
                    playsInline
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Source preview is preparing…</div>
                )}
                <p className="pointer-events-none absolute inset-x-4 bottom-16 text-center text-lg font-semibold drop-shadow">{preview.hook || preview.title}</p>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <label>Start {formatClock(trim.start)}
                  <input type="range" min={Math.max(0, preview.start_time - 4)} max={preview.end_time - 1} step="0.1" value={trim.start} onChange={(e) => setTrim((t) => ({ ...t, start: Number(e.target.value) }))} className="w-full" />
                </label>
                <label>End {formatClock(trim.end)}
                  <input type="range" min={preview.start_time + 1} max={preview.end_time + 4} step="0.1" value={trim.end} onChange={(e) => setTrim((t) => ({ ...t, end: Number(e.target.value) }))} className="w-full" />
                </label>
                <label className="flex items-center gap-2">
                  Caption
                  <select value={options.captionStyle} onChange={(e) => setOptions({ ...options, captionStyle: e.target.value as CaptionStyle })} className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-1">
                    {CAPTION_CHIPS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="mt-5 w-full rounded-2xl bg-indigo-500 py-3 font-semibold"
                onClick={async () => {
                  await clipFactoryApi.updateCandidate(job.id, preview.id, { start_time: trim.start, end_time: trim.end });
                  await generate([preview.id]);
                  setPreview(null);
                }}
              >
                Generate this clip
              </button>
            </div>
          </div>
        ) : null}

        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Film className="h-5 w-5 text-slate-400" />
            Recent Jobs
          </h2>
          {jobs.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 px-4 py-8 text-center text-sm text-slate-500">No jobs yet.</p>
          ) : (
            <div className="grid gap-3">
              {jobs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openJob(item.id)}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    {item.source_thumbnail_url ? (
                      <img src={item.source_thumbnail_url} alt="" className="h-14 w-10 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-14 w-10 items-center justify-center rounded-lg bg-slate-800"><Library className="h-4 w-4" /></span>
                    )}
                    <div>
                      <p className="font-medium">{item.source_label}</p>
                      <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()} · {item.media?.duration_seconds ? `${Math.round(item.media.duration_seconds)}s` : "—"}</p>
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">
                    <span className={statusTone(item.status)}>{item.status.replace(/_/g, " ")}</span>
                    <span className="mx-2">·</span>
                    {item.moments_found} moments · {item.clips_generated} generated
                    {typeof item.cost?.estimated_usd === "number" ? ` · ~$${item.cost.estimated_usd}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

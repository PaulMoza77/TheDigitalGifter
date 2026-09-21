import { readFileSync } from "node:fs";
import type { ObjectiveOption, Transcript, TranscriptWord, ViralCandidate } from "../../../src/features/clip-factory/types";
import { normalizeDimensions, overallViralScore, durationFitPenalty, extraSignalBonus } from "../../../src/features/clip-factory/scoring";
import { snapClipBoundaries, desiredClipCount } from "../../../src/features/clip-factory/boundaries";
import { selectDiverseCandidates } from "../../../src/features/clip-factory/diversity";
import { candidateTextGrounded } from "../../../src/features/clip-factory/mediaQuality";

function openaiKey(): string {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

export function openaiConfigured(): boolean {
  return openaiKey().length > 0;
}

async function openaiJson(path: string, body: BodyInit, headers: Record<string, string> = {}) {
  const key = openaiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured on the origin. Transcription and moment analysis cannot run.");
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, ...headers },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.message || `openai_${path}_${res.status}`;
    throw new Error(message);
  }
  return json;
}

export async function transcribeWhisper(filePath: string, language: string): Promise<Transcript & { usage: { minutes: number } }> {
  const buf = readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  if (language && language !== "auto") form.append("language", language === "ro" ? "ro" : language);
  const json = await openaiJson("audio/transcriptions", form);
  const words: TranscriptWord[] = Array.isArray(json.words)
    ? json.words.map((w: { word?: string; start?: number; end?: number; probability?: number }) => ({
        word: String(w.word || ""),
        start: Number(w.start || 0),
        end: Number(w.end || 0),
        confidence: typeof w.probability === "number" ? w.probability : undefined,
      }))
    : [];
  const segments = Array.isArray(json.segments)
    ? json.segments.map((s: { id?: number; start?: number; end?: number; text?: string }) => ({
        id: s.id,
        start: Number(s.start || 0),
        end: Number(s.end || 0),
        text: String(s.text || "").trim(),
      }))
    : [];
  return {
    language: json.language || language || null,
    languageProbability: json.language_probability ?? null,
    fullText: String(json.text || "").trim(),
    words,
    segments,
    usage: { minutes: Number(json.duration || 0) / 60 },
  };
}

const CHUNK_SECONDS = 480;

export async function transcribeWhisperLong(input: {
  sourcePath: string;
  workDir: string;
  durationSeconds: number;
  language: string;
  extractAudio: (source: string, dest: string, start?: number, duration?: number) => Promise<void>;
}): Promise<Transcript & { usage: { minutes: number } }> {
  const duration = Math.max(0, Number(input.durationSeconds) || 0);
  if (duration <= CHUNK_SECONDS + 30) {
    const audioPath = `${input.workDir}/audio.mp3`;
    await input.extractAudio(input.sourcePath, audioPath);
    return transcribeWhisper(audioPath, input.language);
  }
  const words: TranscriptWord[] = [];
  const segments: Transcript["segments"] = [];
  const texts: string[] = [];
  let minutes = 0;
  let language: string | null = input.language === "auto" ? null : input.language;
  for (let start = 0, index = 0; start < duration; start += CHUNK_SECONDS, index += 1) {
    const span = Math.min(CHUNK_SECONDS + 12, duration - start);
    const audioPath = `${input.workDir}/audio-${index}.mp3`;
    await input.extractAudio(input.sourcePath, audioPath, start, span);
    const part = await transcribeWhisper(audioPath, input.language);
    minutes += part.usage.minutes;
    language = part.language || language;
    if (part.fullText) texts.push(part.fullText);
    for (const word of part.words) {
      words.push({ ...word, start: word.start + start, end: word.end + start });
    }
    for (const segment of part.segments) {
      segments.push({ ...segment, start: segment.start + start, end: segment.end + start });
    }
  }
  return {
    language,
    languageProbability: null,
    fullText: texts.join(" ").trim(),
    words,
    segments,
    usage: { minutes },
  };
}

export type VisualFrameNote = {
  t: number;
  note: string;
  subjectX: number;
  subjectY: number;
  hasFace: boolean;
  confidence: number;
  seasonal?: boolean;
};

export async function describeFrames(
  frames: Array<{ t: number; jpeg: Buffer }>,
): Promise<{ notes: VisualFrameNote[]; tokens: number }> {
  if (!frames.length) return { notes: [], tokens: 0 };
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `You analyze sampled frames from a source video for short-form clipping.
For each image in order, return JSON: {"frames":[{"t":number,"note":"one sentence","subjectX":0-1,"subjectY":0-1,"hasFace":boolean,"confidence":0-1,"seasonal":boolean}]}
subjectX/Y is the primary subject center in normalized coordinates. Be faithful. Do not invent people who are not visible.`,
    },
  ];
  for (const frame of frames) {
    content.push({
      type: "text",
      text: `Frame t=${frame.t.toFixed(2)}s`,
    });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${frame.jpeg.toString("base64")}`, detail: "low" },
    });
  }
  const json = await openaiJson("chat/completions", JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content }],
    max_tokens: 900,
  }), { "Content-Type": "application/json" });
  const text = json.choices?.[0]?.message?.content || "{}";
  let parsed: { frames?: VisualFrameNote[] } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }
  const notes = (parsed.frames || []).map((f, i) => ({
    t: Number(f.t ?? frames[i]?.t ?? 0),
    note: String(f.note || ""),
    subjectX: Math.min(1, Math.max(0, Number(f.subjectX ?? 0.5))),
    subjectY: Math.min(1, Math.max(0, Number(f.subjectY ?? 0.45))),
    hasFace: Boolean(f.hasFace),
    confidence: Math.min(1, Math.max(0, Number(f.confidence ?? 0.4))),
    seasonal: Boolean(f.seasonal),
  }));
  const tokens = Number(json.usage?.total_tokens || 0);
  return { notes, tokens };
}

export async function proposeMoments(input: {
  transcript: Transcript;
  visuals: VisualFrameNote[];
  duration: number;
  options: { clipCount: 5 | 10 | 20 | 30 | "auto"; duration: "auto" | "10-20" | "20-30" | "30-60"; objective: ObjectiveOption; platform: string };
}): Promise<{ candidates: ViralCandidate[]; tokens: number }> {
  const want = desiredClipCount(input.options.clipCount, input.duration);
  const windows = transcriptWindows(input.transcript, input.duration);
  let tokens = 0;
  const collected: ViralCandidate[] = [];
  for (const window of windows) {
    const part = await proposeMomentsWindow({ ...input, transcript: window.transcript, duration: window.end - window.start, offset: window.start, want: window.want });
    tokens += part.tokens;
    collected.push(...part.candidates);
  }
  const grounded = collected.filter((row) =>
    candidateTextGrounded({
      start: row.startTime,
      end: row.endTime,
      title: row.title,
      summary: row.summary,
      hook: row.hook,
      transcriptText: input.transcript.fullText,
      visualNotes: input.visuals,
    }),
  );
  const diverse = selectDiverseCandidates(grounded, want);
  return { candidates: diverse, tokens };
}

const WINDOW_SECONDS = 15 * 60;

function transcriptWindows(transcript: Transcript, duration: number): Array<{ start: number; end: number; want: number; transcript: Transcript }> {
  if (duration <= WINDOW_SECONDS + 30) {
    return [{ start: 0, end: duration, want: Math.min(24, Math.max(8, Math.round(duration / 40))), transcript }];
  }
  const out = [];
  for (let start = 0; start < duration; start += WINDOW_SECONDS) {
    const end = Math.min(duration, start + WINDOW_SECONDS + 20);
    const segments = transcript.segments.filter((s) => s.end > start && s.start < end).map((s) => ({ ...s, start: s.start, end: s.end }));
    const words = transcript.words.filter((w) => w.end > start && w.start < end);
    const fullText = segments.map((s) => s.text).join(" ") || transcript.fullText;
    out.push({
      start,
      end,
      want: 12,
      transcript: { ...transcript, segments, words, fullText },
    });
  }
  return out;
}

async function proposeMomentsWindow(input: {
  transcript: Transcript;
  visuals: VisualFrameNote[];
  duration: number;
  offset: number;
  want: number;
  options: { clipCount: 5 | 10 | 20 | 30 | "auto"; duration: "auto" | "10-20" | "20-30" | "30-60"; objective: ObjectiveOption; platform: string };
}): Promise<{ candidates: ViralCandidate[]; tokens: number }> {
  const transcriptSlice = input.transcript.fullText.slice(0, 12000);
  const wordHint = input.transcript.words.slice(0, 400).map((w) => `${w.start.toFixed(1)}:${w.word}`).join(" ");
  const visualHint = input.visuals.map((v) => `${v.t.toFixed(1)}s ${v.note}`).join(" | ");
  const json = await openaiJson("chat/completions", JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    max_tokens: 2200,
    messages: [
      {
        role: "system",
        content:
          "You select short-form clip candidates from an existing video. Be faithful to the source. No clickbait that misrepresents. Never invent people, animals, dialogue, or scenes that are not in the transcript or visual notes. If the transcript is empty and visuals are dark/empty, return {\"candidates\":[]}. Return JSON only.",
      },
      {
        role: "user",
        content: `Source duration: ${input.duration.toFixed(1)}s
Objective: ${input.options.objective}
Target duration: ${input.options.duration}
Platform: ${input.options.platform}
Need about ${input.want} diverse candidates in this window.
Timestamps are absolute seconds from the start of the original video (this window is ${input.offset.toFixed(1)}s–${(input.offset + input.duration).toFixed(1)}s).

Transcript:
${transcriptSlice || "(no speech)"}

Word timeline (partial):
${wordHint || "(none)"}

Visual notes:
${visualHint || "(none)"}

Return {"candidates":[{
  "start_time": number, "end_time": number, "title": string, "hook": string,
  "summary": string, "reason": string, "category": string,
  "suggested_platforms": string[], "suggested_caption": string, "suggested_post_caption": string,
  "hashtags": string[] (max 8, relevant only), "confidence": 0-1,
  "scores": {"hook":0-100,"retention":0-100,"emotion":0-100,"humor":0-100,"visual":0-100,"standalone":0-100,"shareability":0-100,"surprise":0-100,"curiosity":0-100,"controversy":0-100,"storytelling":0-100,"seasonal":0-100,"quotability":0-100,"payoff":0-100,"information":0-100,"objective_fit":0-100},
  "why_it_works": string[] (3-5 short bullets)
}]}
Do not output overall_viral_score. Prefer natural story units. Return the best NON-overlapping moments only. Slightly expand start/end so sentences are complete.
Score hook, curiosity, emotion, humor, surprise, storytelling, controversy/debate potential, standalone comprehensibility, retention, shareability, and seasonal relevance.`,
      },
    ],
  }), { "Content-Type": "application/json" });
  const text = json.choices?.[0]?.message?.content || "{}";
  let parsed: { candidates?: Array<Record<string, unknown>> } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }
  const raw = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const mapped: ViralCandidate[] = raw.map((row) => {
    const scores = normalizeDimensions(row.scores as Record<string, unknown>);
    let start = Number(row.start_time ?? row.startTime ?? 0);
    let end = Number(row.end_time ?? row.endTime ?? start + 12);
    const sourceDuration = input.offset + input.duration;
    const snapped = snapClipBoundaries(start, end, input.transcript, sourceDuration, input.options.duration);
    start = snapped.start;
    end = snapped.end;
    const duration = end - start;
    const extra = extraSignalBonus((row.scores || row) as Record<string, unknown>);
    const overall = Math.max(
      0,
      overallViralScore(scores, input.options.objective) - durationFitPenalty(duration, input.options.duration) + extra,
    );
    const hashtags = Array.isArray(row.hashtags) ? row.hashtags.map((h) => String(h)).slice(0, 8) : [];
    return {
      startTime: start,
      endTime: end,
      duration,
      title: String(row.title || "Untitled moment").slice(0, 90),
      hook: String(row.hook || "").slice(0, 140),
      summary: String(row.summary || "").slice(0, 400),
      reason: String(row.reason || "").slice(0, 400),
      category: String(row.category || input.options.objective || "auto"),
      suggestedPlatforms: Array.isArray(row.suggested_platforms)
        ? row.suggested_platforms.map((p) => String(p))
        : ["instagram_reels", "tiktok", "youtube_shorts"],
      suggestedCaption: String(row.suggested_caption || "").slice(0, 180),
      suggestedPostCaption: String(row.suggested_post_caption || row.suggested_caption || "").slice(0, 400),
      hashtags,
      confidence: Math.min(1, Math.max(0, Number(row.confidence ?? 0.6))),
      scores,
      overallViralScore: overall,
      whyItWorks: Array.isArray(row.why_it_works) ? row.why_it_works.map((w) => String(w)).slice(0, 6) : [],
    };
  });
  const grounded = mapped.filter((row) =>
    candidateTextGrounded({
      start: row.startTime,
      end: row.endTime,
      title: row.title,
      summary: row.summary,
      hook: row.hook,
      transcriptText: input.transcript.fullText,
      visualNotes: input.visuals,
    }),
  );
  const diverse = selectDiverseCandidates(grounded, input.want);
  return { candidates: diverse, tokens: Number(json.usage?.total_tokens || 0) };
}

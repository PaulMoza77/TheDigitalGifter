import type { Transcript, TranscriptSegment, TranscriptWord } from "./types";

const FILLERS = /^(um+|uh+|er+|ah+|like|so|yeah|you know|ok|okay)$/i;

export function overlapSeconds(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

export function intervalIoU(a0: number, a1: number, b0: number, b1: number): number {
  const inter = overlapSeconds(a0, a1, b0, b1);
  const union = Math.max(a1, b1) - Math.min(a0, b0);
  if (union <= 0) return 0;
  return inter / union;
}

function sentencesFromTranscript(transcript: Transcript): TranscriptSegment[] {
  if (transcript.segments.length) {
    return transcript.segments
      .map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }))
      .filter((s) => s.end > s.start && s.text);
  }
  const words = transcript.words;
  if (!words.length) return [];
  const out: TranscriptSegment[] = [];
  let buf: TranscriptWord[] = [];
  const flush = () => {
    if (!buf.length) return;
    out.push({
      start: buf[0].start,
      end: buf[buf.length - 1].end,
      text: buf.map((w) => w.word).join(" ").replace(/\s+/g, " ").trim(),
    });
    buf = [];
  };
  for (const word of words) {
    buf.push(word);
    if (/[.!?…]["”']?$/.test(word.word.trim())) flush();
  }
  flush();
  return out;
}

function nearestSentence(sentences: TranscriptSegment[], t: number, edge: "start" | "end"): TranscriptSegment | null {
  if (!sentences.length) return null;
  if (edge === "start") {
    const covering = sentences.find((s) => t >= s.start - 0.05 && t <= s.end + 0.05);
    if (covering) return covering;
    return sentences.reduce((best, s) => (Math.abs(s.start - t) < Math.abs(best.start - t) ? s : best));
  }
  const covering = [...sentences].reverse().find((s) => t >= s.start - 0.05 && t <= s.end + 0.15);
  if (covering) return covering;
  return sentences.reduce((best, s) => (Math.abs(s.end - t) < Math.abs(best.end - t) ? s : best));
}

function trimSilence(words: TranscriptWord[], start: number, end: number): { start: number; end: number } {
  const inside = words.filter((w) => w.end > start && w.start < end);
  if (!inside.length) return { start, end };
  let s = Math.max(start, inside[0].start);
  let e = Math.min(end, inside[inside.length - 1].end);
  while (inside.length && FILLERS.test(inside[0].word.replace(/[^\p{L}\p{N}]+/gu, ""))) {
    if (inside[1] && inside[1].start - inside[0].end < 1.1) {
      s = inside[1].start;
      inside.shift();
    } else break;
  }
  const pad = 0.12;
  return { start: Math.max(0, s - pad), end: e + pad };
}

/**
 * Snap AI timestamps onto natural speech boundaries so cuts do not start/end mid-sentence,
 * eat punchlines, or keep long dead air.
 */
export function snapClipBoundaries(
  start: number,
  end: number,
  transcript: Transcript,
  sourceDuration: number,
  target: "auto" | "10-20" | "20-30" | "30-60" = "auto",
): { start: number; end: number } {
  const duration = Math.max(0, sourceDuration);
  let s = Math.max(0, Math.min(start, duration));
  let e = Math.max(s + 3, Math.min(end, duration));
  const sentences = sentencesFromTranscript(transcript);
  const words = transcript.words || [];

  const startSent = nearestSentence(sentences, s, "start");
  if (startSent && s - startSent.start <= 1.8 && s > startSent.start) {
    s = startSent.start;
  } else if (startSent && startSent.start - s > 0 && startSent.start - s <= 0.7) {
    s = startSent.start;
  }

  const endSent = nearestSentence(sentences, e, "end");
  if (endSent && endSent.end - e <= 2.2 && endSent.end > e) {
    e = endSent.end;
  } else if (endSent && e < endSent.end && endSent.end - e < 0.45) {
    e = endSent.end;
  }

  const next = sentences.find((sent) => sent.start >= e - 0.05 && sent.start <= e + 1.15);
  if (next && /[!?]|punch|wait|because|so\b/i.test(next.text) && next.end - s <= 62) {
    e = next.end;
  }

  const trimmed = trimSilence(words, s, e);
  s = trimmed.start;
  e = trimmed.end;

  if (target !== "auto") {
    const [lo, hi] = target.split("-").map(Number);
    const len = e - s;
    if (len < lo) e = Math.min(duration, s + lo);
    if (e - s > hi) e = s + hi;
  } else if (e - s < 8) {
    e = Math.min(duration, s + 10);
  } else if (e - s > 60) {
    e = s + 45;
  }

  s = Math.max(0, Number(s.toFixed(3)));
  e = Math.min(duration, Number(e.toFixed(3)));
  if (e - s < 3 && duration >= 3) e = Math.min(duration, s + 5);
  return { start: s, end: Math.max(s + 1, e) };
}

export function desiredClipCount(option: 5 | 10 | 20 | 30 | "auto", sourceDuration: number): number {
  if (option === "auto") return Math.max(4, Math.min(30, Math.round(sourceDuration / 90) || 4));
  return option;
}

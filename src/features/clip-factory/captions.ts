import type { CaptionStyle, Transcript, TranscriptWord } from "./types";

export function escapeAss(text: string): string {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}

export function formatAssTime(seconds: number): string {
  const t = Math.max(0, seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function wrapLine(words: string[], maxChars: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function cueGroups(words: TranscriptWord[], start: number, end: number): TranscriptWord[][] {
  const inside = words.filter((w) => w.end > start && w.start < end);
  const groups: TranscriptWord[][] = [];
  let buf: TranscriptWord[] = [];
  const flush = () => {
    if (buf.length) groups.push(buf);
    buf = [];
  };
  for (const word of inside) {
    buf.push(word);
    const text = buf.map((w) => w.word).join(" ");
    const dur = word.end - buf[0].start;
    if (text.length > 42 || dur > 2.8 || /[.!?]$/.test(word.word)) flush();
  }
  flush();
  return groups;
}

const STYLES: Record<Exclude<CaptionStyle, "auto">, string> = {
  clean:
    "Style: Default,DejaVu Sans,68,&H00FFFFFF,&H000000FF,&H66101010,&H00000000,0,0,0,0,100,100,0,0,1,4,0,2,80,80,280,1",
  bold_viral:
    "Style: Default,DejaVu Sans,78,&H0000E5FF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,6,0,2,70,70,300,1",
  minimal:
    "Style: Default,DejaVu Sans,54,&H00F5F5F5,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,90,90,260,1",
  karaoke:
    "Style: Default,DejaVu Sans,70,&H00FFFFFF,&H000000FF,&H66000000,&H00000000,0,0,0,0,100,100,0,0,1,4,0,2,80,80,290,1",
};

function resolvedStyle(style: CaptionStyle): Exclude<CaptionStyle, "auto"> {
  return style === "auto" ? "clean" : style;
}

export function buildAssCaptions(input: {
  transcript: Transcript;
  start: number;
  end: number;
  style: CaptionStyle;
  hook?: string | null;
  hookEnabled?: boolean;
}): string {
  const style = resolvedStyle(input.style);
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${STYLES[style]}
Style: Hook,DejaVu Sans,56,&H00FFFFFF,&H000000FF,&HAA000000,&H00000000,0,0,0,0,100,100,0,0,1,3,0,8,70,70,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events: string[] = [];
  const rel = (t: number) => Math.max(0, t - input.start);
  if (input.hookEnabled && input.hook && input.hook.trim()) {
    const hookEnd = Math.min(2.6, input.end - input.start);
    events.push(
      `Dialogue: 0,${formatAssTime(0)},${formatAssTime(hookEnd)},Hook,,0,0,0,,${escapeAss(input.hook.trim())}`,
    );
  }

  const groups = cueGroups(input.transcript.words, input.start, input.end);
  if (!groups.length && input.transcript.fullText) {
    const lines = wrapLine(input.transcript.fullText.split(/\s+/).slice(0, 18), 28);
    events.push(`Dialogue: 0,${formatAssTime(0.2)},${formatAssTime(Math.min(6, input.end - input.start))},Default,,0,0,0,,${escapeAss(lines.join("\\N"))}`);
  }

  for (const group of groups) {
    const gStart = Math.max(0, rel(group[0].start));
    const gEnd = Math.max(gStart + 0.35, rel(Math.min(input.end, group[group.length - 1].end)));
    if (style === "karaoke") {
      const parts = group.map((word, i) => {
        const next = group[i + 1];
        const durCs = Math.max(8, Math.round(((next ? next.start : word.end) - word.start) * 100));
        return `{\\k${durCs}}${escapeAss(word.word)}`;
      });
      events.push(`Dialogue: 0,${formatAssTime(gStart)},${formatAssTime(gEnd)},Default,,0,0,0,,${parts.join(" ")}`);
    } else {
      const lines = wrapLine(
        group.map((w) => w.word.replace(/\s+/g, " ").trim()).filter(Boolean),
        style === "minimal" ? 34 : 28,
      );
      events.push(`Dialogue: 0,${formatAssTime(gStart)},${formatAssTime(gEnd)},Default,,0,0,0,,${escapeAss(lines.join("\n"))}`);
    }
  }

  return header + events.join("\n") + "\n";
}

export function resolveCaptionStyle(style: CaptionStyle, objective: string): Exclude<CaptionStyle, "auto"> {
  if (style !== "auto") return style;
  if (objective === "viral" || objective === "funny") return "bold_viral";
  if (objective === "educational") return "minimal";
  return "clean";
}

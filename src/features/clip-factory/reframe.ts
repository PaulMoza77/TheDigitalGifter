import type { ReframeKeyframe, ReframePlan } from "./types";

export function interpolateSubject(keyframes: ReframeKeyframe[], t: number): { x: number; y: number; hasFace: boolean; confidence: number } {
  if (!keyframes.length) return { x: 0.5, y: 0.45, hasFace: false, confidence: 0 };
  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (t <= sorted[0].t) return { x: sorted[0].subjectX, y: sorted[0].subjectY, hasFace: sorted[0].hasFace, confidence: sorted[0].confidence };
  const last = sorted[sorted.length - 1];
  if (t >= last.t) return { x: last.subjectX, y: last.subjectY, hasFace: last.hasFace, confidence: last.confidence };
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / Math.max(0.001, b.t - a.t);
      const smooth = u * u * (3 - 2 * u);
      return {
        x: a.subjectX + (b.subjectX - a.subjectX) * smooth,
        y: a.subjectY + (b.subjectY - a.subjectY) * smooth,
        hasFace: a.hasFace || b.hasFace,
        confidence: Math.min(a.confidence, b.confidence),
      };
    }
  }
  return { x: 0.5, y: 0.45, hasFace: false, confidence: 0 };
}

export function smoothKeyframes(frames: ReframeKeyframe[]): ReframeKeyframe[] {
  if (frames.length < 3) return frames;
  const out = frames.map((f) => ({ ...f }));
  for (let i = 1; i < out.length - 1; i += 1) {
    out[i].subjectX = out[i - 1].subjectX * 0.25 + out[i].subjectX * 0.5 + out[i + 1].subjectX * 0.25;
    out[i].subjectY = out[i - 1].subjectY * 0.25 + out[i].subjectY * 0.5 + out[i + 1].subjectY * 0.25;
  }
  return out;
}

export function planReframe(input: {
  width: number;
  height: number;
  keyframes: ReframeKeyframe[];
}): ReframePlan {
  const frames = smoothKeyframes(input.keyframes);
  const avgConf =
    frames.reduce((sum, f) => sum + (Number.isFinite(f.confidence) ? f.confidence : 0), 0) / Math.max(1, frames.length);
  const faceHits = frames.filter((f) => f.hasFace).length;
  if (!frames.length || (avgConf < 0.35 && faceHits === 0)) {
    const alreadyVertical = input.height / Math.max(1, input.width) >= 1.4;
    return { mode: alreadyVertical ? "center" : "blur_pad", keyframes: frames };
  }
  return { mode: "track", keyframes: frames };
}

export function cropOrigin(input: {
  sourceW: number;
  sourceH: number;
  subjectX: number;
  subjectY: number;
  outW?: number;
  outH?: number;
}): { x: number; y: number; w: number; h: number } {
  const outW = input.outW ?? 1080;
  const outH = input.outH ?? 1920;
  const targetRatio = outW / outH;
  const srcRatio = input.sourceW / Math.max(1, input.sourceH);
  let cropW: number;
  let cropH: number;
  if (srcRatio > targetRatio) {
    cropH = input.sourceH;
    cropW = cropH * targetRatio;
  } else {
    cropW = input.sourceW;
    cropH = cropW / targetRatio;
  }
  const cx = input.subjectX * input.sourceW;
  const cy = input.subjectY * input.sourceH;
  const x = Math.max(0, Math.min(input.sourceW - cropW, cx - cropW / 2));
  const y = Math.max(0, Math.min(input.sourceH - cropH, cy - cropH / 2));
  return { x, y, w: cropW, h: cropH };
}

export function ffmpegCropExpression(plan: ReframePlan, clipStart: number, sourceW: number, sourceH: number): string {
  const crop = cropOrigin({ sourceW, sourceH, subjectX: 0.5, subjectY: 0.45 });
  if (plan.mode !== "track" || plan.keyframes.length < 2) {
    const mid = interpolateSubject(plan.keyframes, clipStart + 0.4);
    const box = cropOrigin({ sourceW, sourceH, subjectX: mid.x, subjectY: mid.y });
    return `crop=${Math.floor(box.w)}:${Math.floor(box.h)}:${Math.floor(box.x)}:${Math.floor(box.y)}`;
  }
  const a = interpolateSubject(plan.keyframes, clipStart);
  const b = interpolateSubject(plan.keyframes, clipStart + Math.max(1, (plan.keyframes.at(-1)?.t || clipStart) - clipStart));
  const boxA = cropOrigin({ sourceW, sourceH, subjectX: a.x, subjectY: a.y });
  const boxB = cropOrigin({ sourceW, sourceH, subjectX: b.x, subjectY: b.y });
  const dur = Math.max(0.01, (plan.keyframes.at(-1)?.t || clipStart + 1) - clipStart);
  return `crop=${Math.floor(crop.w)}:${Math.floor(crop.h)}:x='${boxA.x.toFixed(1)}+(${(boxB.x - boxA.x).toFixed(1)})*min(1\\,t/${dur.toFixed(2)})':y='${boxA.y.toFixed(1)}+(${(boxB.y - boxA.y).toFixed(1)})*min(1\\,t/${dur.toFixed(2)})'`;
}

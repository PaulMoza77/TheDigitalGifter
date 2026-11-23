/**
 * Render title/dedication plates via Pillow (FFmpeg build may lack drawtext).
 * Output is a PNG under the job work directory — never shell-interpolated.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function renderTextPlate(input: {
  outPath: string;
  width: number;
  height: number;
  background: string;
  lines: Array<{ text: string; size: number; color: string; yRatio: number }>;
}): void {
  // Prefer a tiny Python helper for Pillow — keeps Node free of native canvas deps.
  const script = `
from PIL import Image, ImageDraw, ImageFont
import json, sys
cfg = json.loads(sys.argv[1])
img = Image.new("RGB", (cfg["width"], cfg["height"]), cfg["background"])
draw = ImageDraw.Draw(img)
font_paths = [
  "/System/Library/Fonts/Supplemental/Georgia.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
]
def font(size):
  for p in font_paths:
    try:
      return ImageFont.truetype(p, size=size)
    except Exception:
      pass
  return ImageFont.load_default()
for line in cfg["lines"]:
  f = font(int(line["size"]))
  text = str(line["text"])[:140]
  bbox = draw.textbbox((0,0), text, font=f)
  tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
  x = max(0, (cfg["width"] - tw)//2)
  y = int(cfg["height"] * float(line["yRatio"]) - th/2)
  # soft shadow
  draw.text((x+2, y+2), text, font=f, fill=(0,0,0))
  draw.text((x, y), text, font=f, fill=line["color"])
img.save(cfg["outPath"], "PNG")
`;
  const cfgPath = `${input.outPath}.cfg.json`;
  writeFileSync(
    cfgPath,
    JSON.stringify({
      outPath: input.outPath,
      width: input.width,
      height: input.height,
      background: input.background,
      lines: input.lines,
    }),
    "utf8",
  );
  const py = spawnSync("python3", ["-c", script, JSON.stringify({
    outPath: input.outPath,
    width: input.width,
    height: input.height,
    background: input.background,
    lines: input.lines,
  })], { encoding: "utf8" });
  if (py.status !== 0) {
    throw new Error(`text_plate_failed:${(py.stderr || py.stdout || "").slice(0, 400)}`);
  }
}

export function platePath(workDir: string, name: string) {
  return join(workDir, name);
}

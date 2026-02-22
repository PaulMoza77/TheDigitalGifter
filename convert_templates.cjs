// convert_templates.cjs
// Input:  templates.json  (poate fi JSON valid SAU output Convex copiat (JS-like))
// Output: templates_supabase.csv + templates_supabase.json
//
// Rulează: node convert_templates.cjs

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const IN_FILE = path.join(process.cwd(), "templates.json");
const OUT_CSV = path.join(process.cwd(), "templates_supabase.csv");
const OUT_JSON = path.join(process.cwd(), "templates_supabase.json");

function readAnyJsonLike(file) {
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];

  // 1) Try strict JSON first
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {}

  // 2) Try JS-like (Convex output) using VM
  // normalize a bit (undefined -> null)
  let src = raw.replace(/\bundefined\b/g, "null");

  // If it's not an array, but likely one object, wrap into array
  // If it's multiple objects separated by "}\n{", wrap with commas
  if (!src.startsWith("[")) {
    // if looks like multiple objects stuck together
    if (src.includes("}\n{") || src.includes("}\r\n{")) {
      src = src.replace(/}\s*[\r\n]+\s*{/g, "},{");
      src = `[${src}]`;
    } else {
      src = `[${src}]`;
    }
  }

  // Evaluate safely in isolated context
  // (Convex output is trusted data you just copied)
  const context = {};
  const script = new vm.Script(`(${src})`, { timeout: 1000 });
  const result = script.runInNewContext(context, { timeout: 1000 });

  return Array.isArray(result) ? result : [result];
}

function isNil(v) {
  return v === null || v === undefined;
}

function num(v) {
  if (isNil(v) || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  if (typeof v === "number") return v !== 0;
  return null;
}

function arrStr(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

function csvCell(v) {
  if (isNil(v)) return "";
  let s = String(v);
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

function toRow(t) {
  // Convex template fields (din ce ai în screenshot):
  // _creationTime, id, category, creditCost, defaultAspectRatio, defaultDuration,
  // defaultResolution, generateAudioDefault, isActive, occasion, orientation,
  // previewUrl, prompt, scene, subCategory, tags

  const tags = arrStr(t.tags);

  return {
    convex_id: t.id ? String(t.id) : null,
    created_at_ms: num(t._creationTime ?? t.creationTime),

    category: !isNil(t.category) ? String(t.category) : null,
    sub_category: !isNil(t.subCategory) ? String(t.subCategory) : null,
    occasion: !isNil(t.occasion) ? String(t.occasion) : null,

    credit_cost: num(t.creditCost),

    default_aspect_ratio: !isNil(t.defaultAspectRatio) ? String(t.defaultAspectRatio) : null,
    default_duration: num(t.defaultDuration),
    default_resolution: !isNil(t.defaultResolution) ? String(t.defaultResolution) : null,

    generate_audio_default: bool(t.generateAudioDefault),
    is_active: bool(t.isActive),

    orientation: !isNil(t.orientation) ? String(t.orientation) : null,
    preview_url: !isNil(t.previewUrl) ? String(t.previewUrl) : null,

    prompt: !isNil(t.prompt) ? String(t.prompt) : null,
    scene: !isNil(t.scene) ? String(t.scene) : null,

    // doua variante:
    tags_csv: tags.length ? tags.join(",") : null,
    tags_json: JSON.stringify(tags),
  };
}

function main() {
  const input = readAnyJsonLike(IN_FILE);
  const rows = input.map(toRow);

  fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2), "utf8");

  const headers = Object.keys(rows[0] || {});
  const csvLines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ];
  fs.writeFileSync(OUT_CSV, csvLines.join("\n"), "utf8");

  console.log("✅ Done");
  console.log("Rows:", rows.length);
  console.log("Wrote:", path.basename(OUT_JSON));
  console.log("Wrote:", path.basename(OUT_CSV));
}

main();
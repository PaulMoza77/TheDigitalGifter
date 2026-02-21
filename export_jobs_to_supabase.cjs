const fs = require("fs");

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ");
  return `"${s.replace(/"/g, '""')}"`;
}

const jobs = JSON.parse(fs.readFileSync("jobs.json", "utf8"));

const headers = [
  "id",
  "user_convex_id",
  "status",
  "type",
  "template_id",
  "created_at_ms",
];

const lines = [headers.join(",")];

for (const j of jobs) {
  const createdAtMs = j._creationTime
    ? Math.floor(Number(j._creationTime))
    : 0;

  lines.push(
    [
      j._id ?? "",
      j.userId ?? "",
      j.status ?? "",
      j.type ?? "",
      j.templateId ?? "",
      createdAtMs,
    ].map(csvEscape).join(",")
  );
}

fs.writeFileSync("jobs_supabase.csv", lines.join("\n"), "utf8");
console.log("✅ jobs_supabase.csv ready rows:", jobs.length);
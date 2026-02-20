// convert_orders.js
const fs = require("fs");

const raw = fs.readFileSync("orders_raw.txt", "utf8");

// Transformă output-ul Convex (object literals) în JSON valid
let s = raw.trim();

// dacă nu e deja listă, o împachetăm în []
if (!s.startsWith("[")) s = "[" + s + "]";
if (!s.endsWith("]")) s = s + "]";

// quote la chei (ex: _creationTime: -> "_creationTime":)
s = s.replace(/([{\s,])([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');

// scoate trailing commas înainte de } sau ]
s = s.replace(/,\s*([}\]])/g, "$1");

// parse JSON
let arr;
try {
  arr = JSON.parse(s);
} catch (e) {
  console.error("❌ JSON parse failed:", e.message);
  // salvează varianta intermediară ca să vedem unde crapă
  fs.writeFileSync("orders_sanitized.json", s, "utf8");
  console.log("Am scris orders_sanitized.json (pentru debug).");
  process.exit(1);
}

// salvează orders.json
fs.writeFileSync("orders.json", JSON.stringify(arr, null, 2), "utf8");

// CSV pentru Supabase
const esc = (v) => String(v ?? "").replace(/"/g, '""');

let out =
  "convex_id,user_convex_id,amount,pack,status,stripe_session_id,created_at_ms,creation_time_ms\n";

for (const o of arr) {
  out +=
    `"${esc(o._id)}",` +
    `"${esc(o.userId)}",` +
    `"${esc(o.amount)}",` +
    `"${esc(o.pack)}",` +
    `"${esc(o.status)}",` +
    `"${esc(o.stripeSessionId)}",` +
    `"${esc(o.createdAt)}",` +
    `"${esc(o._creationTime)}"\n`;
}

fs.writeFileSync("orders.csv", out, "utf8");
console.log("✅ orders.json + orders.csv ready");

const fs = require("fs");

function toIso(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n).toISOString();
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ");
  return `"${s.replace(/"/g, '""')}"`;
}

const orders = JSON.parse(fs.readFileSync("orders.json", "utf8"));

const headers = [
  "user_id",
  "source",
  "reference_id",
  "pack",
  "amount",
  "status",
  "stripe_session_id",
  "created_at",
];

const lines = [headers.join(",")];

for (const o of orders) {
  const row = {
    user_id: o.userId ?? "",
    source: "order",
    reference_id: o._id ?? "",
    pack: o.pack ?? "",
    amount: o.amount ?? 0,
    status: o.status ?? "",
    stripe_session_id: o.stripeSessionId ?? "",
    created_at: toIso(o.createdAt ?? o._creationTime),
  };

  lines.push(headers.map((h) => csvEscape(row[h])).join(","));
}

fs.writeFileSync("credit_transactions_orders.csv", lines.join("\n"), "utf8");
console.log("✅ credit_transactions_orders.csv ready rows:", orders.length);
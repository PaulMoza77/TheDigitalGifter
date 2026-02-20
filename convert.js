import fs from "fs";

let raw = fs.readFileSync("users_raw.txt", "utf8").trim();

// 1) Scoate eventualele linii goale la capete
raw = raw.replace(/^\s+|\s+$/g, "");

// 2) Învelește totul într-un array JSON valid.
// Convex output e de obicei: {..}, {..}, {..}
// Noi îl facem: [ {..}, {..}, {..} ]
if (!raw.startsWith("[")) raw = "[\n" + raw;
if (!raw.endsWith("]")) raw = raw + "\n]";

// 3) IMPORTANT: pune ghilimele la chei DOAR când sunt chei reale (la început de linie / după { sau ,)
// Asta evită să lovească "https:" din interiorul stringurilor.
raw = raw.replace(/(^|[{,\s])([A-Za-z_]\w*)\s*:/gm, '$1"$2":');

// 4) Curăță virgule în plus înainte de } sau ]
raw = raw.replace(/,(\s*[}\]])/g, "$1");

// 5) Validate + pretty print
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("JSON parse failed:", e.message);
  // arată un pic din zona unde crapă, ca să vedem exact
  const m = String(e.message).match(/position (\d+)/);
  if (m) {
    const pos = Number(m[1]);
    console.error("\n--- context ---\n");
    console.error(raw.slice(Math.max(0, pos - 200), pos + 200));
    console.error("\n--- /context ---\n");
  }
  process.exit(1);
}

fs.writeFileSync("users.json", JSON.stringify(data, null, 2), "utf8");
console.log("✅ users.json creat și valid");

const fs = require("fs");

async function main() {
  // importa array-ul din jobs_convex.js
  const mod = await import(process.cwd() + "/orders_convex.js");
  const jobs = mod.default || [];

  fs.writeFileSync("jobs.json", JSON.stringify(jobs, null, 2), "utf8");
  console.log("✅ jobs.json ready:", jobs.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
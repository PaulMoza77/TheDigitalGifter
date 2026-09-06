import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const tscBin = resolve("node_modules/typescript/bin/tsc");
const viteBin = resolve("node_modules/vite/bin/vite.js");

if (!existsSync(tscBin) || !existsSync(viteBin)) {
  run("npm", ["install", "--no-audit", "--no-fund", "--include=dev"]);
}

if (!existsSync(tscBin)) {
  console.error("lint: typescript is still missing after npm install");
  process.exit(127);
}

run(process.execPath, [tscBin, "-p", ".", "--noEmit", "--pretty", "false"]);
run(process.execPath, [viteBin, "build"]);

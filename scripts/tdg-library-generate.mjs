/**
 * HTTP wrapper for hosts that already run the TDG origin.
 * Prefer: npx tsx scripts/tdg-library-generate.ts
 */
import { spawn } from "node:child_process";

const child = spawn("npx", ["tsx", "scripts/tdg-library-generate.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));

#!/usr/bin/env node
/**
 * Supervise song + film workers in one process (systemd friendly).
 */
import { spawn } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const node = process.execPath;
const env = { ...process.env, NODE_OPTIONS: "--experimental-strip-types" };

function start(script) {
  const child = spawn(node, [join(root, script)], { cwd: root, env, stdio: "inherit" });
  child.on("exit", (code) => {
    console.error(JSON.stringify({ event: "child_exit", script, code }));
    process.exit(code ?? 1);
  });
  return child;
}

console.log(JSON.stringify({ event: "supervisor_started", root }));
start("scripts/christmas-story-prod/prod-song-worker.mjs");
start("scripts/christmas-story-prod/prod-film-worker.mjs");
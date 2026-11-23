import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

/** Secure spawn: argv array only, no shell. */
export function runCommand(
  bin: string,
  args: string[],
  timeoutMs = 180_000,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH,
        LANG: process.env.LANG || "en_US.UTF-8",
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin}_timeout`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 1_500_000) stdout = stdout.slice(-750_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 80_000) stderr = stderr.slice(-40_000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr, code: 0 });
      else reject(new Error(`${bin}_exit_${code}:${stderr.slice(-600)}`));
    });
  });
}

export async function ffprobeJson(path: string): Promise<Record<string, unknown>> {
  const { stdout } = await runCommand(
    "ffprobe",
    ["-v", "error", "-show_format", "-show_streams", "-print_format", "json", path],
    60_000,
  );
  return JSON.parse(stdout) as Record<string, unknown>;
}

export function findDrawtextFont(): string {
  const candidates = [
    process.env.CHRISTMAS_STORY_FILM_FONT,
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p)) || "/System/Library/Fonts/Supplemental/Georgia.ttf";
}

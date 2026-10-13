import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const guardPy = resolve("deploy/lib/tdg_supabase_url_guard.py");
const mergeSh = resolve("deploy/scripts/merge-tdg-app-env.sh");
const ALLOWED = "https://supabase.thedigitalgifter.com";
const CLOUD = "https://kjlsocejpmnzhhduyumy.supabase.co";

function runGuard(args: string[], env: NodeJS.ProcessEnv = {}): { status: number; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync("python3", [guardPy, ...args], {
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, stdout: err.stdout || "", stderr: err.stderr || "" };
  }
}

function runMerge(dir: string, env: NodeJS.ProcessEnv): { status: number; stderr: string } {
  try {
    execFileSync("bash", [mergeSh], {
      env: { ...process.env, TDG_APP_ENV: join(dir, "app.env"), HOME: dir, ...env },
      encoding: "utf8",
    });
    return { status: 0, stderr: "" };
  } catch (error) {
    const err = error as { status?: number; stderr?: string };
    return { status: err.status ?? 1, stderr: err.stderr || "" };
  }
}

describe("tdg_supabase_url_guard", () => {
  it("allows matching self-hosted URLs in production mode", () => {
    const result = runGuard(["--app-env", "/tmp/unused.env", "--vite", ALLOWED, "--server", ALLOWED], {
      TDG_SUPABASE_URL_GUARD: "self-hosted-prod",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tdg_supabase_url_guard=ok");
  });

  it("rejects legacy Cloud SUPABASE_URL in production mode", () => {
    const result = runGuard(["--vite", ALLOWED, "--server", CLOUD], {
      TDG_SUPABASE_URL_GUARD: "self-hosted-prod",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("legacy-cloud:SUPABASE_URL");
    expect(result.stderr).not.toContain("kjlsocejpmnzhhduyumy");
  });

  it("rejects VITE/server mismatch in production mode", () => {
    const result = runGuard(
      ["--vite", ALLOWED, "--server", `${ALLOWED}/auth`],
      { TDG_SUPABASE_URL_GUARD: "self-hosted-prod" },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("vite-server-mismatch");
  });

  it("does not block local Kong URLs when guard is off", () => {
    const result = runGuard(
      ["--app-env", "/tmp/local-tdg.env", "--vite", "http://127.0.0.1:54321", "--server", "http://127.0.0.1:54321"],
      { TDG_SUPABASE_URL_GUARD: "off" },
    );
    expect(result.status).toBe(0);
  });
});

describe("merge-tdg-app-env.sh Cloud rewrite", () => {
  it("refuses to write Cloud URL when TDG_SUPABASE_URL_GUARD=self-hosted-prod", () => {
    const dir = mkdtempSync(join(tmpdir(), "tdg-env-"));
    try {
      writeFileSync(join(dir, "app.env"), `VITE_SUPABASE_URL=${ALLOWED}\nSUPABASE_URL=${ALLOWED}\nVITE_SUPABASE_ANON_KEY=x\nSUPABASE_SERVICE_ROLE_KEY=y\n`);
      chmodSync(join(dir, "app.env"), 0o640);
      const blocked = runMerge(dir, {
        TDG_SUPABASE_URL_GUARD: "self-hosted-prod",
        VITE_SUPABASE_URL: ALLOWED,
        SUPABASE_URL: CLOUD,
        VITE_SUPABASE_ANON_KEY: "x",
        SUPABASE_SERVICE_ROLE_KEY: "y",
      });
      expect(blocked.status).toBe(2);
      const body = readFileSync(join(dir, "app.env"), "utf8");
      expect(body).toContain(`SUPABASE_URL=${ALLOWED}`);
      expect(body).not.toContain("kjlsocejpmnzhhduyumy");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges local URLs without the production guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "tdg-env-local-"));
    try {
      writeFileSync(join(dir, "app.env"), "VITE_SUPABASE_ANON_KEY=x\nSUPABASE_SERVICE_ROLE_KEY=y\n");
      const ok = runMerge(dir, {
        TDG_SUPABASE_URL_GUARD: "off",
        VITE_SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_URL: "http://127.0.0.1:54321",
        VITE_SUPABASE_ANON_KEY: "x",
        SUPABASE_SERVICE_ROLE_KEY: "y",
      });
      expect(ok.status).toBe(0);
      const body = readFileSync(join(dir, "app.env"), "utf8");
      expect(body).toContain("http://127.0.0.1:54321");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

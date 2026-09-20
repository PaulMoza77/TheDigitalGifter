import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const deployProduction = readFileSync(resolve("scripts/deploy-production.sh"), "utf8");
const deployVps = readFileSync(resolve("scripts/deploy-vps.sh"), "utf8");
const applyHttp = readFileSync(resolve("deploy/scripts/apply-tdg-caddy.sh"), "utf8");
const ensure = readFileSync(resolve("deploy/scripts/mozas-ensure-tdg-caddy.sh"), "utf8");
const deployRemote = readFileSync(resolve("deploy/scripts/mozas-deploy-thedigitalgifter.sh"), "utf8");
const rollback = readFileSync(resolve("deploy/scripts/mozas-rollback-thedigitalgifter.sh"), "utf8");
const workflowVps = readFileSync(resolve(".github/workflows/deploy-vps-static.yml"), "utf8");
const workflowVercel = readFileSync(resolve(".github/workflows/deploy-vercel-production.yml"), "utf8");
const workflowPages = readFileSync(resolve(".github/workflows/deploy-static-github-pages.yml"), "utf8");
const agents = readFileSync(resolve("AGENTS.md"), "utf8");
const vercelUnpause = readFileSync(resolve("scripts/vercel-unpause-and-deploy.sh"), "utf8");

describe("TDG deploy wiring (HTTPS persist + rollback + Cloud Agent canonical path)", () => {
  it("deploy-production.sh is the canonical Cloud Agent → SSH entrypoint", () => {
    expect(deployProduction).toMatch(/Canonical TDG production deployment/);
    expect(deployProduction).toMatch(/MOZAS_SSH_HOST/);
    expect(deployProduction).toMatch(/MOZAS_SSH_PRIVATE_KEY/);
    expect(deployProduction).toMatch(/scripts\/deploy-vps\.sh/);
    expect(deployProduction).toMatch(/thedigitalgifter\.com\/christmas/);
    expect(deployProduction).toMatch(/\/healthz/);
    expect(deployProduction).toMatch(/GITHUB_ACTIONS/);
    expect(deployProduction).toMatch(/Vercel used: NO/);
    expect(deployProduction).toMatch(/GitHub Actions used: NO/);
  });

  it("AGENTS.md forbids Vercel and GitHub Actions deploy paths", () => {
    expect(agents).toMatch(/scripts\/deploy-production\.sh/);
    expect(agents).toMatch(/Vercel and GitHub Actions are forbidden/);
    expect(agents).toMatch(/Do not switch deployment providers/);
  });

  it("deploy-vps.sh applies Caddy via ensure, not unconditional HTTP apply", () => {
    expect(deployVps).toMatch(/\/opt\/mozas\/bin\/mozas-ensure-tdg-caddy/);
    expect(deployVps).toMatch(
      /install -m 0755 .*mozas-ensure-tdg-caddy\.sh \/opt\/mozas\/bin\/mozas-ensure-tdg-caddy/,
    );
    const applyLines = deployVps
      .split("\n")
      .filter((line) => /mozas-apply-tdg-caddy/.test(line));
    expect(applyLines.length).toBeGreaterThan(0);
    expect(applyLines.every((line) => /install -m 0755/.test(line))).toBe(true);
    const ensureInvoke = deployVps
      .split("\n")
      .filter((line) => /mozas-ensure-tdg-caddy/.test(line) && !/install -m 0755/.test(line));
    expect(ensureInvoke.some((line) => /mozas_ssh/.test(line))).toBe(true);
  });

  it("HTTP apply refuses to overwrite an active HTTPS site without FORCE", () => {
    expect(applyHttp).toMatch(/FORCE_TDG_CADDY_HTTP/);
    expect(applyHttp).toMatch(/refusing to overwrite HTTPS Caddy/);
    expect(applyHttp).toMatch(/refusing to overwrite active named HTTPS TDG site/);
    expect(applyHttp).toMatch(/exit 3/);
  });

  it("ensure re-selects HTTPS source when mode marker or named site is https", () => {
    expect(ensure).toMatch(/Caddyfile\.https\.ready/);
    expect(ensure).toMatch(/mozas-apply-tdg-caddy-https/);
    expect(ensure).toMatch(/tdg-caddy\.mode/);
  });

  it("failed deploy rolls back and does not advance verified pins", () => {
    const failBlock = deployRemote.slice(
      deployRemote.indexOf("up -d --remove-orphans --force-recreate --wait"),
    );
    expect(failBlock).toMatch(/mozas-rollback-thedigitalgifter/);
    expect(failBlock).toMatch(/previous verified release retained/);
    const verifiedAdvance = deployRemote.indexOf('printf \'%s\\n\' "${RELEASE}" >"${TDG_RELEASES}/verified.tag"');
    const healthWait = deployRemote.indexOf("up -d --remove-orphans --wait");
    expect(verifiedAdvance).toBeGreaterThan(healthWait);
  });

  it("rollback restores image tag plus current/verified metadata and TDG_RELEASE", () => {
    expect(rollback).toMatch(/verified\.tag/);
    expect(rollback).toMatch(/current\.tag/);
    expect(rollback).toMatch(/TDG_RELEASE=/);
    expect(rollback).toMatch(/mozas\/thedigitalgifter:previous/);
    expect(rollback).toMatch(/verified\.sha/);
    expect(rollback).toMatch(/current\.sha/);
  });

  it("GitHub Actions and Vercel production workflows are disabled stubs", () => {
    expect(workflowVps).toMatch(/forbidden/);
    expect(workflowVps).not.toMatch(/bash scripts\/deploy-vps\.sh/);
    expect(workflowVps).not.toMatch(/on:\s*\n\s*push:/);
    expect(workflowVercel).toMatch(/forbidden/);
    expect(workflowPages).toMatch(/forbidden/);
    expect(vercelUnpause).toMatch(/BLOCKED/);
    expect(vercelUnpause).toMatch(/exit 2/);
    expect(vercelUnpause).not.toMatch(/npx --yes vercel/);
  });
});

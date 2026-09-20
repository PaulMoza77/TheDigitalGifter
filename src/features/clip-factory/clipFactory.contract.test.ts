import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function read(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("clip factory production wiring", () => {
  it("registers admin route, origin API, and additive migration", () => {
    expect(read("src/App.tsx")).toContain("path=\"clip-factory\"");
    expect(read("src/layouts/AdminLayout.tsx")).toContain("/admin/clip-factory");
    expect(read("src/layouts/AdminLayout.tsx")).toContain("AI Clip Factory");
    expect(read("src/pages/admin/AdminClipFactoryPage.tsx")).toContain("classifyMediaUrl");
    expect(read("src/pages/admin/AdminClipFactoryPage.tsx")).toContain("YouTube, TikTok, and Vimeo");
    expect(read("server/routes.mjs")).toContain('"/api/clip-factory": "clip-factory.ts"');
    expect(read("api/clip-factory.ts")).toContain("requireClipFactoryAdmin");
    expect(read("api/clip-factory.ts")).toContain("create_job");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("clip_factory_analysis_started");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("library_assets");
    expect(read("api/_lib/clip-factory/openai.ts")).toContain("whisper-1");
    expect(read("src/features/clip-factory/scoring.ts")).toContain("SCORE_WEIGHTS");
    const sql = read("supabase/migrations/20260919210000_clip_factory.sql");
    expect(sql).toContain("create table if not exists public.clip_factory_jobs");
    expect(sql).toContain("for update of j skip locked");
    expect(sql).toContain("revoke all on public.clip_factory_jobs from anon, authenticated");
    expect(sql).not.toMatch(/drop table/i);
    expect(read("Dockerfile")).toContain("font-dejavu");
    expect(read("supabase/functions/social-publisher/index.ts")).toContain("/api/clip-factory");
  });
});

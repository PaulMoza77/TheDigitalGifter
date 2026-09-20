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
    expect(read("server/routes.mjs")).toContain('"/api/clip-factory": "clip-factory.ts"');
    expect(read("api/clip-factory.ts")).toContain("requireClipFactoryAdmin");
    expect(read("api/clip-factory.ts")).toContain("create_job");
    expect(read("api/clip-factory.ts")).toContain("attach_media");
    expect(read("api/clip-factory.ts")).toContain("waiting_for_media");
    expect(read("src/pages/admin/AdminClipFactoryPage.tsx")).toContain("YouTube source detected. Provide the original media to continue.");
    expect(read("src/pages/admin/AdminClipFactoryPage.tsx")).toContain("Automatic media import is not available for this source");
    expect(read("api/_lib/clip-factory/acquire.ts")).toContain("YouTube Data API v3");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("assertUsableSourceMedia");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("assertUsableRenderedClip");
    expect(read("src/features/clip-factory/mediaQuality.ts")).toContain("KNOWN_INVALID_MEDIA_HASHES");
    expect(read("api/clip-factory.ts")).toContain("rights_confirmed");
    expect(read("src/features/clip-factory/ingest/types.ts")).toContain("VideoSourceAdapter");
    expect(read("src/features/clip-factory/ingest/types.ts")).toContain("ingestionCapability");
    expect(read("src/features/clip-factory/ingest/capability.ts")).toContain("FULL_IMPORT");
    expect(read("src/pages/admin/AdminClipFactoryPage.tsx")).toContain("Find Viral Moments");
    expect(read("src/pages/admin/AdminClipFactoryPage.tsx")).toContain("ingest this URL automatically");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("Importing source...");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("clip_factory_analysis_started");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("acquireSourceMedia");
    expect(read("api/_lib/clip-factory/acquire.ts")).toContain("NormalizedIngest");
    expect(read("api/_lib/clip-factory/acquire.ts")).toContain("YouTube Data API v3");
    expect(read("api/_lib/clip-factory/worker.ts")).toContain("library_assets");
    expect(read("api/_lib/clip-factory/openai.ts")).toContain("whisper-1");
    expect(read("src/features/clip-factory/scoring.ts")).toContain("SCORE_WEIGHTS");
    const sql = read("supabase/migrations/20260919210000_clip_factory.sql");
    const ingestSql = read("supabase/migrations/20260920071600_clip_factory_url_ingest.sql");
    expect(sql).toContain("create table if not exists public.clip_factory_jobs");
    expect(ingestSql).toContain("rights_confirmed");
    expect(ingestSql).toContain("importing");
    expect(sql).toContain("for update of j skip locked");
    expect(sql).toContain("revoke all on public.clip_factory_jobs from anon, authenticated");
    expect(sql).not.toMatch(/drop table/i);
    expect(read("Dockerfile")).toContain("font-dejavu");
    expect(read("Dockerfile")).toContain("yt-dlp");
    expect(read("api/_lib/clip-factory/worker.ts")).not.toContain("color=c=");
    expect(read("api/_lib/clip-factory/worker.ts")).not.toContain("The family walked into the room");
    expect(read("api/_lib/clip-factory/acquire.ts")).not.toContain("color=c=");
    expect(read("supabase/migrations/20260920213000_clip_factory_invalidate_placeholder.sql")).toContain("1035c4690f0871aab131142f8b39fb055b82eaea8fe38706519dcc377d0b2c33");
    expect(read("server/origin.mjs")).toContain("tickClipFactory");
    expect(read("supabase/functions/social-publisher/index.ts")).toContain("/api/clip-factory");
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function read(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("long-form studio wiring", () => {
  it("registers a creative admin studio without codec controls", () => {
    expect(read("src/App.tsx")).toContain("path=\"long-form-studio\"");
    expect(read("src/layouts/AdminLayout.tsx")).toContain("Long-Form Studio");
    expect(read("src/layouts/AdminLayout.tsx")).toContain("/admin/long-form-studio");
    expect(read("server/routes.mjs")).toContain('"/api/long-form-studio": "long-form-studio.ts"');
    expect(read("api/long-form-studio.ts")).toContain("requireClipFactoryAdmin");
    expect(read("api/long-form-studio.ts")).toContain("create_video");
    expect(read("api/long-form-studio.ts")).toContain("import_youtube_audio_library");
    expect(read("api/long-form-studio.ts")).not.toContain("waitUntil");
    expect(read("api/long-form-studio.ts")).not.toMatch(/action === "file"/);
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).toContain("CREATE VIDEO");
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).toContain("Choose from Library");
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).toContain("TDG Music Library");
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).not.toContain("FFmpeg");
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).not.toContain("codec");
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).not.toContain("Higgsfield");
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).not.toContain("Kling");
    expect(read("src/pages/admin/AdminLongFormStudioPage.tsx")).toContain("Preparing scene");
    expect(read("src/features/long-form-studio/youtubePublisher.ts")).toContain("prepareYouTubeDraft");
    expect(read("src/features/long-form-studio/rightsManifest.ts")).toContain("validateProductionRights");
    expect(read("api/_lib/long-form-studio/worker.ts")).toContain("library_assets");
    expect(read("api/_lib/long-form-studio/worker.ts")).toContain('kind: "long_form"');
    const sql = read("supabase/migrations/20260921180000_long_form_studio.sql");
    expect(sql).toContain("create table if not exists public.music_tracks");
    expect(sql).toContain("create table if not exists public.long_form_productions");
    expect(sql).not.toMatch(/drop table/i);
    expect(read("deploy/docker-compose.yml")).toContain("/opt/mozas/projects/thedigitalgifter/media:/var/lib/tdg/clip-factory");
    expect(read("deploy/docker-compose.yml")).toContain("/opt/mozas/projects/thedigitalgifter/data/long-form:/data/long-form");
    expect(read("deploy/docker-compose.yml")).toContain("LONG_FORM_DATA_DIR: /data/long-form");
    expect(read("api/_lib/long-form-studio/storage.ts")).toContain("LONG_FORM_VPS_BUCKET");
    expect(read("api/_lib/long-form-studio/worker.ts")).toContain("reuse_existing_render");
    expect(read("api/long-form-studio.ts")).toContain("Accept-Ranges");
    expect(read("src/features/admin-library/catalog.ts")).toContain("long_form");
  });
});

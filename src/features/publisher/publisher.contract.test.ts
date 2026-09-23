import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function read(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("publisher v1 wiring", () => {
  it("uses dedicated publisher tables, SKIP LOCKED claims, and dry-run only", () => {
    const sql = read("supabase/migrations/20260923120000_publisher_v1.sql");
    expect(sql).toContain("publisher_schedule_rules");
    expect(sql).toContain("publisher_slots");
    expect(sql).toContain("publisher_publications");
    expect(sql).toContain("publisher_destination_jobs");
    expect(sql).toContain("publisher_attempts");
    expect(sql).toContain("unique (rule_id, scheduled_at)");
    expect(sql).toContain("unique (publication_id, destination)");
    expect(sql).toContain("for update of j skip locked");
    expect(sql).toContain("live_posts_enabled boolean not null default false");
    expect(sql).toContain("Europe/Bucharest");
    expect(sql).toContain("publisher_excluded");

    const service = read("api/_lib/publisher/service.ts");
    expect(service).toContain("DryRunPublisherAdapter");
    expect(service).not.toMatch(/graph\.facebook\.com|tiktokapis|googleapis\.com\/upload/);
    expect(service).toContain("Unapproved publication blocked from adapter");

    expect(read("server/routes.mjs")).toContain("/api/publisher");
    expect(read("server/routes.mjs")).toContain("/api/publisher-cron");
    expect(read("server/origin.mjs")).toContain("tickPublisherWorker");
    expect(read("src/layouts/AdminLayout.tsx")).toContain("/admin/publisher");
    expect(read("src/App.tsx")).toContain('path="publisher"');
  });
});

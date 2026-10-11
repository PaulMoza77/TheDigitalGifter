import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relative: string) {
  return readFileSync(resolve(relative), "utf8");
}

describe("admin role escalation hotfix contracts", () => {
  const migrationPath =
    "supabase/migrations/20261012130000_hotfix_admin_role_escalation.sql";

  it("ships standalone migration locking is_admin to admin_users only", () => {
    const migration = read(migrationPath);
    expect(migration).toContain("from public.admin_users au");
    expect(migration).toContain("profiles.role is intentionally ignored");
    expect(migration).toContain("profiles_prevent_role_escalation");
    expect(migration).not.toMatch(/p\.role = 'admin'/);
    expect(migration).not.toContain("christmas_v2_");
    expect(migration).toContain("revoke update on table public.profiles");
    expect(migration).toContain("grant update (%s) on table public.profiles to authenticated");
    expect(migration).toContain("'role', 'is_volocar_admin'");
  });

  it("useAdminAuth ignores profiles.role and checks admin_users only", () => {
    const hook = read("src/hooks/useAdminAuth.ts");
    expect(hook).toContain('from("admin_users")');
    expect(hook).not.toContain('from("profiles")');
    expect(hook).toContain("intentionally ignored");
  });

  it("AdminRoute already trusts admin_users only (no profiles.role)", () => {
    const route = read("src/components/AdminRoute.tsx");
    expect(route).toContain('from("admin_users")');
    expect(route).not.toMatch(/from\("profiles"\)[\s\S]*role/);
  });

  it("backend clip-factory admin check uses admin_users", () => {
    const admin = read("api/_lib/clip-factory/admin.ts");
    expect(admin).toContain('from("admin_users")');
    expect(admin).not.toContain("profiles.role");
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { fulfillmentSqlForUnitTests, repoRoot } from "./pgTestSql.ts";

describe("generations RLS", () => {
  it("keeps explicit anon deny, owner isolation, and admin/service access in the migration", () => {
    const sql = readFileSync(join(repoRoot, "supabase/migrations/20260818_review_blockers.sql"), "utf8");
    assert.equal(sql.includes("alter table public.generations enable row level security"), true);
    assert.equal(sql.includes("generations_anon_no_access"), true);
    assert.equal(sql.includes("to anon"), true);
    assert.equal(sql.includes("user_id = auth.uid()"), true);
    assert.equal(sql.includes("is_generation_admin()"), true);
    assert.equal(sql.includes("grant select, insert on table public.generations to authenticated"), true);
    assert.equal(sql.includes("revoke all on table public.generations from public, anon"), true);
  });

  it("enforces generations RLS for anon, owner, admin, and service_role", async () => {
    const ownerId = "11111111-1111-4111-8111-111111111111";
    const otherId = "22222222-2222-4222-8222-222222222222";
    const adminId = "33333333-3333-4333-8333-333333333333";
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;
        create schema if not exists auth;
        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        create table if not exists public.profiles (
          id uuid primary key,
          role text
        );
      `);
      await db.exec(fulfillmentSqlForUnitTests());
      await db.exec(readFileSync(join(repoRoot, "supabase/migrations/20260818_review_blockers.sql"), "utf8"));
      await db.exec(`
        grant usage on schema public to anon, authenticated, service_role;
        grant all on table public.generations to service_role;
        grant select on table public.generations to anon;
      `);
      await db.query(
        `insert into public.profiles (id, role) values ($1, 'admin')`,
        [adminId],
      );
      await db.query(
        `insert into public.generations (id, status, user_id)
         values
           ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pending', $1),
           ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pending', $2)`,
        [ownerId, otherId],
      );

      const asRole = async (role: string, sub: string, sql: string) => {
        await db.exec("begin");
        try {
          await db.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
          await db.exec(`set local role ${role}`);
          return await db.query(sql);
        } finally {
          await db.exec("rollback");
        }
      };

      const anonRows = await asRole("anon", ownerId, "select id from public.generations");
      assert.equal(anonRows.rows.length, 0);

      const own = await asRole("authenticated", ownerId, "select id from public.generations order by id");
      assert.equal(own.rows.length, 1);
      assert.equal(own.rows[0].id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

      const other = await asRole("authenticated", otherId, "select id from public.generations order by id");
      assert.equal(other.rows.length, 1);
      assert.equal(other.rows[0].id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

      const admin = await asRole("authenticated", adminId, "select id from public.generations order by id");
      assert.equal(admin.rows.length, 2);

      await db.exec("begin");
      await db.exec("set local role service_role");
      const service = await db.query("select id from public.generations order by id");
      await db.exec("rollback");
      assert.equal(service.rows.length, 2);
    } finally {
      await db.close();
    }
  });
});

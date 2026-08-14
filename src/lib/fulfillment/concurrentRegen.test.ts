import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fulfillmentSqlForUnitTests } from "./pgTestSql.ts";

const { Client } = createRequire(import.meta.url)("pg") as typeof import("pg");

function binExists(file: string) {
  const which = spawnSync("bash", ["-lc", `command -v ${file}`], { encoding: "utf8" });
  return which.status === 0 ? String(which.stdout).trim() : "";
}

function startEphemeralPostgres(): { url: string; stop: () => void } | null {
  const initdb = binExists("initdb") || "/usr/lib/postgresql/16/bin/initdb";
  const pgCtl = binExists("pg_ctl") || "/usr/lib/postgresql/16/bin/pg_ctl";
  const postgres = binExists("postgres") || "/usr/lib/postgresql/16/bin/postgres";
  const version = spawnSync(initdb, ["--version"], { encoding: "utf8" });
  if (version.status !== 0) return null;

  const dataDir = mkdtempSync(join(tmpdir(), "tdg-pg-"));
  const port = String(55432 + Math.floor(Math.random() * 20));
  const init = spawnSync(initdb, ["-D", dataDir, "--auth=trust", "--username=postgres", "--no-instructions"], {
    encoding: "utf8",
  });
  if (init.status !== 0) {
    rmSync(dataDir, { recursive: true, force: true });
    return null;
  }
  writeFileSync(join(dataDir, "pg.log"), "");
  const start = spawnSync(
    pgCtl,
    ["-D", dataDir, "-l", join(dataDir, "pg.log"), "-o", `-p ${port} -k ${dataDir} -c listen_addresses=127.0.0.1`, "start"],
    { encoding: "utf8" },
  );
  if (start.status !== 0) {
    rmSync(dataDir, { recursive: true, force: true });
    return null;
  }
  void postgres;
  return {
    url: `postgres://postgres@127.0.0.1:${port}/postgres`,
    stop: () => {
      spawnSync(pgCtl, ["-D", dataDir, "stop", "-m", "immediate"], { encoding: "utf8" });
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

describe("concurrent included regenerations", () => {
  it("lets only one of two DB connections claim the included regeneration", async () => {
    const envUrl = String(process.env.PG_CONCURRENT_TEST_URL || "").trim();
    const ephemeral = envUrl ? null : startEphemeralPostgres();
    const url = envUrl || ephemeral?.url || "";
    if (!url) {
      if (process.env.CI === "true") {
        throw new Error("PG_CONCURRENT_TEST_URL or local PostgreSQL 16 is required in CI");
      }
      return;
    }

    const setup = new Client({ connectionString: url });
    const first = new Client({ connectionString: url });
    const second = new Client({ connectionString: url });
    try {
      await setup.connect();
      await setup.query(fulfillmentSqlForUnitTests());
      const order = await setup.query<{ id: string }>(
        `insert into public.mvp_orders (email, status, included_regenerations_allowed, included_regenerations_used)
         values ('concurrent@example.com', 'completed', 1, 0)
         returning id`,
      );
      const gen1 = await setup.query<{ id: string }>(`insert into public.generations (status) values ('pending') returning id`);
      const gen2 = await setup.query<{ id: string }>(`insert into public.generations (status) values ('pending') returning id`);
      await first.connect();
      await second.connect();
      const [a, b] = await Promise.all([
        first.query<{ consume: { ok: boolean } }>(
          `select public.claim_included_regeneration($1::uuid, $2::uuid) as consume`,
          [order.rows[0].id, gen1.rows[0].id],
        ),
        second.query<{ consume: { ok: boolean } }>(
          `select public.claim_included_regeneration($1::uuid, $2::uuid) as consume`,
          [order.rows[0].id, gen2.rows[0].id],
        ),
      ]);
      const wins = [a.rows[0].consume.ok, b.rows[0].consume.ok].filter(Boolean).length;
      assert.equal(wins, 1);
    } finally {
      await first.end().catch(() => undefined);
      await second.end().catch(() => undefined);
      await setup.end().catch(() => undefined);
      ephemeral?.stop();
    }
  });
});

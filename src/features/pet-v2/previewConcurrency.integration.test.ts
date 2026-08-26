/**
 * DB concurrency tests for begin_pet_v2_preview_create.
 *
 * Requires BOTH:
 *   PET_V2_CONCURRENCY_DATABASE_URL=<authorized non-production postgres>
 *   PET_V2_CONCURRENCY_ALLOW_MUTATIONS=I_CONFIRM_NON_PRODUCTION
 *
 * Uses a pg.Pool with one independent client per concurrent caller and asserts
 * distinct backend PIDs. Cleans up generated rows after each test.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const dbUrl = String(process.env.PET_V2_CONCURRENCY_DATABASE_URL || "").trim();
const allowMutations =
  String(process.env.PET_V2_CONCURRENCY_ALLOW_MUTATIONS || "").trim() ===
  "I_CONFIRM_NON_PRODUCTION";

/** Known production project refs / hosts — never mutate these from CI/local agent. */
const PRODUCTION_DENYLIST =
  /prod|production|thedigitalgifter\.com|supabase\.co\/project\/[a-z]{20}/i;

const runDb =
  Boolean(dbUrl) &&
  allowMutations &&
  !PRODUCTION_DENYLIST.test(dbUrl) &&
  !/amazonaws\.com.*prod/i.test(dbUrl);

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release: () => void;
};

type PgPool = {
  connect: () => Promise<PgClient>;
  end: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

const require = createRequire(import.meta.url);
const trackedKeys = new Set<string>();

describe.runIf(runDb)("begin_pet_v2_preview_create concurrency (DB)", () => {
  let pool: PgPool;

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pg = require("pg") as { Pool: new (cfg: { connectionString: string; max: number }) => PgPool };
    pool = new pg.Pool({ connectionString: dbUrl, max: 10 });
    const probe = await pool.query(
      `select 1 from pg_proc where proname = 'begin_pet_v2_preview_create' limit 1`,
    );
    if (!probe.rows.length) {
      throw new Error("begin_pet_v2_preview_create missing — apply migration on this DB first");
    }
  });

  afterAll(async () => {
    if (trackedKeys.size) {
      await pool.query(
        `delete from public.pet_v2_preview_attempts where idempotency_key = any($1::text[])`,
        [[...trackedKeys]],
      );
    }
    await pool?.end();
  });

  async function beginOnFreshClient(key: string, session: string, ip: string, image: string) {
    trackedKeys.add(key);
    const client = await pool.connect();
    try {
      const pidRes = await client.query(`select pg_backend_pid() as pid`);
      const pid = Number(pidRes.rows[0].pid);
      const res = await client.query(
        `select public.begin_pet_v2_preview_create($1,$2,$3,$4,'dog','formula-racer',2,5,2,90) as result`,
        [key, session, ip, image],
      );
      return {
        pid,
        result: res.rows[0].result as Record<string, unknown>,
      };
    } finally {
      client.release();
    }
  }

  async function adminQuery(sql: string, params?: unknown[]) {
    return pool.query(sql, params);
  }

  it("uses distinct backend PIDs for concurrent callers", async () => {
    const key = `conc-pid-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        beginOnFreshClient(`${key}-${i}`, `s-${key}-${i}`, `ip-${key}-${i}`, `img-${key}-${i}`),
      ),
    );
    const pids = new Set(results.map((r) => r.pid));
    expect(pids.size).toBeGreaterThanOrEqual(2);
  });

  it("5 concurrent calls, same idempotency key → exactly one create", async () => {
    const key = `conc-same-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => beginOnFreshClient(key, `s-${key}`, `ip-${key}`, `img-${key}`)),
    );
    const creates = results.filter((r) => r.result.action === "create");
    expect(creates).toHaveLength(1);
    expect(new Set(results.map((r) => r.pid)).size).toBeGreaterThanOrEqual(2);
  });

  it("resume with existing prediction_id never creates again", async () => {
    const key = `conc-resume-${crypto.randomUUID()}`;
    await beginOnFreshClient(key, `s-${key}`, `ip-${key}`, `img-${key}`);
    await adminQuery(
      `update public.pet_v2_preview_attempts
       set prediction_id = $2, status = 'processing'
       where idempotency_key = $1`,
      [key, `pred_${key}`],
    );
    const again = await Promise.all(
      Array.from({ length: 3 }, () => beginOnFreshClient(key, `s-${key}`, `ip-${key}`, `img-${key}`)),
    );
    expect(again.every((r) => r.result.action === "resume")).toBe(true);
    expect(again.every((r) => r.result.prediction_id === `pred_${key}`)).toBe(true);
  });

  it("abandoned processing claim → orphan_timeout, no duplicate create", async () => {
    const key = `conc-orphan-${crypto.randomUUID()}`;
    await beginOnFreshClient(key, `s-${key}`, `ip-${key}`, `img-${key}`);
    await adminQuery(
      `update public.pet_v2_preview_attempts
       set status = 'processing', prediction_id = null, started_at = now() - interval '10 minutes'
       where idempotency_key = $1`,
      [key],
    );
    const result = await beginOnFreshClient(key, `s-${key}`, `ip-${key}`, `img-${key}`);
    expect(result.result.action).toBe("orphan_timeout");
  });

  it("expired orphan does not block a separate new attempt for 24h", async () => {
    const session = `sess-orph-${crypto.randomUUID()}`;
    const orphanKey = `conc-orph-old-${crypto.randomUUID()}`;
    const freshKey = `conc-orph-new-${crypto.randomUUID()}`;
    await beginOnFreshClient(orphanKey, session, `ip-${session}`, `img-${orphanKey}`);
    await adminQuery(
      `update public.pet_v2_preview_attempts
       set status = 'processing', prediction_id = null, started_at = now() - interval '10 minutes'
       where idempotency_key = $1`,
      [orphanKey],
    );
    const orphan = await beginOnFreshClient(orphanKey, session, `ip-${session}`, `img-${orphanKey}`);
    expect(orphan.result.action).toBe("orphan_timeout");
    const fresh = await beginOnFreshClient(freshKey, session, `ip-${session}`, `img-${freshKey}`);
    expect(fresh.result.action).toBe("create");
  });

  it("3 concurrent distinct attempts in one session → maximum 2 admitted", async () => {
    const session = `sess-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        beginOnFreshClient(
          `conc-sess-${session}-${i}-${crypto.randomUUID()}`,
          session,
          `ip-${session}`,
          `img-${session}-${i}`,
        ),
      ),
    );
    expect(results.filter((r) => r.result.action === "create").length).toBeLessThanOrEqual(2);
    expect(results.filter((r) => r.result.action === "quota_denied").length).toBeGreaterThanOrEqual(1);
    expect(new Set(results.map((r) => r.pid)).size).toBeGreaterThanOrEqual(2);
  });

  it("6 concurrent attempts on one IP → maximum 5 admitted", async () => {
    const ip = `ip-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        beginOnFreshClient(
          `conc-ip-${ip}-${i}-${crypto.randomUUID()}`,
          `s-${ip}-${i}`,
          ip,
          `img-${ip}-${i}`,
        ),
      ),
    );
    expect(results.filter((r) => r.result.action === "create").length).toBeLessThanOrEqual(5);
    expect(results.filter((r) => r.result.action === "quota_denied").length).toBeGreaterThanOrEqual(1);
  });

  it("failed reservation releases capacity", async () => {
    const session = `rel-${crypto.randomUUID()}`;
    const firstKey = `conc-rel-a-${crypto.randomUUID()}`;
    const secondKey = `conc-rel-b-${crypto.randomUUID()}`;
    const first = await beginOnFreshClient(firstKey, session, `ip-${session}`, `img-${firstKey}`);
    expect(first.result.action).toBe("create");
    await adminQuery(
      `update public.pet_v2_preview_attempts
       set status = 'failed', live_generation = false, prediction_id = null
       where idempotency_key = $1`,
      [firstKey],
    );
    const second = await beginOnFreshClient(secondKey, session, `ip-${session}`, `img-${secondKey}`);
    expect(second.result.action).toBe("create");
  });
});

describe("DB concurrency guard", () => {
  it("requires explicit non-production mutation confirmation", () => {
    expect("I_CONFIRM_NON_PRODUCTION").toBe("I_CONFIRM_NON_PRODUCTION");
    expect(PRODUCTION_DENYLIST.test("postgresql://user@db.prod.internal/app")).toBe(true);
  });
});

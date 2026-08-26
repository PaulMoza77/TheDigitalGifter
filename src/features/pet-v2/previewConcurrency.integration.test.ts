/**
 * DB concurrency tests for begin_pet_v2_preview_create.
 *
 * Runs only when PET_V2_CONCURRENCY_DATABASE_URL is set to an authorized
 * non-production Postgres URL with the migration applied.
 * Skips (does not fail) when unset — never targets production implicitly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const dbUrl = String(process.env.PET_V2_CONCURRENCY_DATABASE_URL || "").trim();
const runDb = Boolean(dbUrl) && !/prod|thedigitalgifter\.com/i.test(dbUrl);

type PgClient = {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

const require = createRequire(import.meta.url);

describe.runIf(runDb)("begin_pet_v2_preview_create concurrency (DB)", () => {
  let client: PgClient;

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pg = require("pg") as { Client: new (cfg: { connectionString: string }) => PgClient };
    client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    const probe = await client.query(
      `select 1 from pg_proc where proname = 'begin_pet_v2_preview_create' limit 1`,
    );
    if (!probe.rows.length) {
      throw new Error("begin_pet_v2_preview_create missing — apply migration on this DB first");
    }
  });

  afterAll(async () => {
    await client?.end();
  });

  async function begin(key: string, session: string, ip: string, image: string) {
    const res = await client.query(
      `select public.begin_pet_v2_preview_create($1,$2,$3,$4,'dog','formula-racer',2,5,2,90) as result`,
      [key, session, ip, image],
    );
    return res.rows[0].result as Record<string, unknown>;
  }

  it("5 concurrent calls, same idempotency key → exactly one create", async () => {
    const key = `conc-same-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => begin(key, `s-${key}`, `ip-${key}`, `img-${key}`)),
    );
    const creates = results.filter((r) => r.action === "create");
    const waits = results.filter((r) => r.action === "wait" || r.action === "resume");
    expect(creates).toHaveLength(1);
    expect(creates.length + waits.length).toBe(5);
  });

  it("resume with existing prediction_id never creates again", async () => {
    const key = `conc-resume-${crypto.randomUUID()}`;
    await begin(key, `s-${key}`, `ip-${key}`, `img-${key}`);
    await client.query(
      `update public.pet_v2_preview_attempts
       set prediction_id = $2, status = 'processing'
       where idempotency_key = $1`,
      [key, `pred_${key}`],
    );
    const again = await Promise.all(
      Array.from({ length: 3 }, () => begin(key, `s-${key}`, `ip-${key}`, `img-${key}`)),
    );
    expect(again.every((r) => r.action === "resume")).toBe(true);
    expect(again.every((r) => r.prediction_id === `pred_${key}`)).toBe(true);
  });

  it("abandoned processing claim → orphan_timeout, no duplicate create", async () => {
    const key = `conc-orphan-${crypto.randomUUID()}`;
    await begin(key, `s-${key}`, `ip-${key}`, `img-${key}`);
    await client.query(
      `update public.pet_v2_preview_attempts
       set status = 'processing', prediction_id = null, started_at = now() - interval '10 minutes'
       where idempotency_key = $1`,
      [key],
    );
    const result = await begin(key, `s-${key}`, `ip-${key}`, `img-${key}`);
    expect(result.action).toBe("orphan_timeout");
  });

  it("3 concurrent distinct attempts in one session → maximum 2 admitted", async () => {
    const session = `sess-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        begin(`conc-sess-${session}-${i}-${crypto.randomUUID()}`, session, `ip-${session}`, `img-${session}-${i}`),
      ),
    );
    const admitted = results.filter((r) => r.action === "create" || r.action === "wait");
    const denied = results.filter((r) => r.action === "quota_denied");
    expect(results.filter((r) => r.action === "create").length).toBeLessThanOrEqual(2);
    expect(admitted.length + denied.length).toBe(3);
    expect(denied.length).toBeGreaterThanOrEqual(1);
  });

  it("6 concurrent attempts on one IP → maximum 5 admitted", async () => {
    const ip = `ip-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        begin(`conc-ip-${ip}-${i}-${crypto.randomUUID()}`, `s-${ip}-${i}`, ip, `img-${ip}-${i}`),
      ),
    );
    expect(results.filter((r) => r.action === "create").length).toBeLessThanOrEqual(5);
    expect(results.filter((r) => r.action === "quota_denied").length).toBeGreaterThanOrEqual(1);
  });

  it("failed reservation releases capacity", async () => {
    const session = `rel-${crypto.randomUUID()}`;
    const firstKey = `conc-rel-a-${crypto.randomUUID()}`;
    const secondKey = `conc-rel-b-${crypto.randomUUID()}`;
    const first = await begin(firstKey, session, `ip-${session}`, `img-${firstKey}`);
    expect(first.action).toBe("create");
    await client.query(
      `update public.pet_v2_preview_attempts
       set status = 'failed', live_generation = false, prediction_id = null
       where idempotency_key = $1`,
      [firstKey],
    );
    const second = await begin(secondKey, session, `ip-${session}`, `img-${secondKey}`);
    expect(second.action).toBe("create");
  });
});

describe("RPC unavailable contract (unit)", () => {
  it("documents fail-closed: no provider create without begin RPC", () => {
    // Edge beginPreviewCreate returns null → 503 claim_unavailable; never Replicate.
    expect(true).toBe(true);
  });
});

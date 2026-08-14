import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { fulfillmentSqlForUnitTests } from "./pgTestSql.ts";

async function openDb() {
  const db = new PGlite();
  await db.exec(fulfillmentSqlForUnitTests());
  return db;
}

describe("postgres fulfillment functions", () => {
  it("does not load pg_cron; PGlite covers claim/backoff/redeem SQL only", () => {
    const sql = fulfillmentSqlForUnitTests();
    assert.equal(sql.includes("cron.schedule"), false);
    assert.equal(sql.includes("create extension if not exists pg_cron"), false);
    assert.equal(sql.includes("consume_access_redeem_code"), true);
  });  it("ignores a duplicated webhook and does not enqueue a second job", async () => {
    const db = await openDb();
    const order = await db.query<{ id: string; generation_id: string }>(
      `insert into public.mvp_orders (email, status, generation_id)
       values ('a@example.com', 'pending', public.gen_random_uuid())
       returning id, generation_id`,
    );
    const orderId = order.rows[0].id;
    const first = await db.query<{ claim_mvp_order_paid: { kind: string; enqueue_job: boolean } }>(
      `select public.claim_mvp_order_paid($1, 'evt_1', 'checkout.session.completed', 'cs_1', 'pi_1') as claim_mvp_order_paid`,
      [orderId],
    );
    const second = await db.query<{ claim_mvp_order_paid: { kind: string; enqueue_job: boolean } }>(
      `select public.claim_mvp_order_paid($1, 'evt_1', 'checkout.session.completed', 'cs_1', 'pi_1') as claim_mvp_order_paid`,
      [orderId],
    );
    assert.equal(first.rows[0].claim_mvp_order_paid.kind, "claimed");
    assert.equal(first.rows[0].claim_mvp_order_paid.enqueue_job, true);
    assert.equal(second.rows[0].claim_mvp_order_paid.kind, "duplicate_event");
    assert.equal(second.rows[0].claim_mvp_order_paid.enqueue_job, false);
    const jobs = await db.query<{ n: number }>(`select count(*)::int as n from public.fulfillment_jobs`);
    assert.equal(jobs.rows[0].n, 1);
    await db.close();
  });

  it("requeues a failed job with backoff so cron can retry without a new webhook", async () => {
    const db = await openDb();
    const order = await db.query<{ id: string; generation_id: string }>(
      `insert into public.mvp_orders (email, status, generation_id)
       values ('b@example.com', 'paid', public.gen_random_uuid())
       returning id, generation_id`,
    );
    const job = await db.query<{ id: string }>(
      `insert into public.fulfillment_jobs (order_id, generation_id, status, attempts, max_attempts, run_after)
       values ($1, $2, 'queued', 0, 3, now())
       returning id`,
      [order.rows[0].id, order.rows[0].generation_id],
    );
    const claimed = await db.query<{ claim_next_fulfillment_job: { kind: string; job: { id: string } } }>(
      `select public.claim_next_fulfillment_job() as claim_next_fulfillment_job`,
    );
    assert.equal(claimed.rows[0].claim_next_fulfillment_job.kind, "claimed");
    const finished = await db.query<{ finish_fulfillment_job: { kind: string } }>(
      `select public.finish_fulfillment_job($1, false, 'replicate_failed') as finish_fulfillment_job`,
      [job.rows[0].id],
    );
    assert.equal(finished.rows[0].finish_fulfillment_job.kind, "requeued");
    await db.query(
      `update public.fulfillment_jobs set run_after = now() - interval '1 second' where id = $1`,
      [job.rows[0].id],
    );
    const again = await db.query<{ claim_next_fulfillment_job: { kind: string } }>(
      `select public.claim_next_fulfillment_job() as claim_next_fulfillment_job`,
    );
    assert.equal(again.rows[0].claim_next_fulfillment_job.kind, "claimed");
    await db.close();
  });

  it("reclaims a stale running job without a new webhook", async () => {
    const db = await openDb();
    const order = await db.query<{ id: string; generation_id: string }>(
      `insert into public.mvp_orders (email, status, generation_id)
       values ('c@example.com', 'fulfilling', public.gen_random_uuid())
       returning id, generation_id`,
    );
    await db.query(
      `insert into public.fulfillment_jobs (order_id, generation_id, status, attempts, locked_at, run_after)
       values ($1, $2, 'running', 1, now() - interval '20 minutes', now() - interval '20 minutes')`,
      [order.rows[0].id, order.rows[0].generation_id],
    );
    const claimed = await db.query<{ claim_next_fulfillment_job: { kind: string } }>(
      `select public.claim_next_fulfillment_job(interval '10 minutes') as claim_next_fulfillment_job`,
    );
    assert.equal(claimed.rows[0].claim_next_fulfillment_job.kind, "claimed");
    await db.close();
  });

  it("lets only one of two sequential included regenerations succeed (SQL unit; concurrent coverage is concurrentRegen.test.ts)", async () => {
    const db = await openDb();
    const order = await db.query<{ id: string }>(
      `insert into public.mvp_orders (email, status, included_regenerations_allowed, included_regenerations_used)
       values ('d@example.com', 'completed', 1, 0)
       returning id`,
    );
    const gen1 = await db.query<{ id: string }>(`insert into public.generations (status) values ('pending') returning id`);
    const gen2 = await db.query<{ id: string }>(`insert into public.generations (status) values ('pending') returning id`);
    const first = await db.query<{ claim_included_regeneration: { ok: boolean; kind: string } }>(
      `select public.claim_included_regeneration($1, $2) as claim_included_regeneration`,
      [order.rows[0].id, gen1.rows[0].id],
    );
    const second = await db.query<{ claim_included_regeneration: { ok: boolean; kind: string } }>(
      `select public.claim_included_regeneration($1, $2) as claim_included_regeneration`,
      [order.rows[0].id, gen2.rows[0].id],
    );
    assert.equal(first.rows[0].claim_included_regeneration.ok, true);
    assert.equal(second.rows[0].claim_included_regeneration.ok, false);
    await db.close();
  });

  it("releases a processing generation so retry can reclaim it", async () => {
    const db = await openDb();
    const gen = await db.query<{ id: string }>(
      `insert into public.generations (status, attempt_count) values ('pending', 0) returning id`,
    );
    const claimed = await db.query<{ claim_mvp_generation_start: { kind: string; run_generation: boolean } }>(
      `select public.claim_mvp_generation_start($1, 3) as claim_mvp_generation_start`,
      [gen.rows[0].id],
    );
    assert.equal(claimed.rows[0].claim_mvp_generation_start.run_generation, true);
    const released = await db.query<{ release_mvp_generation_claim: { kind: string } }>(
      `select public.release_mvp_generation_claim($1, 'worker_error') as release_mvp_generation_claim`,
      [gen.rows[0].id],
    );
    assert.equal(released.rows[0].release_mvp_generation_claim.kind, "released");
    const retry = await db.query<{ claim_mvp_generation_start: { run_generation: boolean } }>(
      `select public.claim_mvp_generation_start($1, 3) as claim_mvp_generation_start`,
      [gen.rows[0].id],
    );
    assert.equal(retry.rows[0].claim_mvp_generation_start.run_generation, true);
    await db.close();
  });

  it("redeems the same unused-or-used code twice for one order after a lost response", async () => {
    const db = await openDb();
    const order = await db.query<{ id: string }>(
      `insert into public.mvp_orders (email, status) values ('redeem@example.com', 'completed') returning id`,
    );
    const other = await db.query<{ id: string }>(
      `insert into public.mvp_orders (email, status) values ('other@example.com', 'completed') returning id`,
    );
    await db.query(
      `insert into public.access_redeem_codes (code_hash, order_id, expires_at)
       values ('hash-1', $1, now() + interval '1 day')`,
      [order.rows[0].id],
    );
    const first = await db.query<{ consume_access_redeem_code: { ok: boolean; kind: string } }>(
      `select public.consume_access_redeem_code('hash-1', $1) as consume_access_redeem_code`,
      [order.rows[0].id],
    );
    const retry = await db.query<{ consume_access_redeem_code: { ok: boolean; kind: string } }>(
      `select public.consume_access_redeem_code('hash-1', $1) as consume_access_redeem_code`,
      [order.rows[0].id],
    );
    const mismatch = await db.query<{ consume_access_redeem_code: { ok: boolean } }>(
      `select public.consume_access_redeem_code('hash-1', $1) as consume_access_redeem_code`,
      [other.rows[0].id],
    );
    assert.equal(first.rows[0].consume_access_redeem_code.ok, true);
    assert.equal(retry.rows[0].consume_access_redeem_code.ok, true);
    assert.equal(mismatch.rows[0].consume_access_redeem_code.ok, false);
    await db.close();
  });
});

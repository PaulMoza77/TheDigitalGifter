import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {CHRISTMAS_PACKS} from "./config";
const read=(path:string)=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
describe('deployed Christmas pack reconciliation',()=>{
 it('preserves production EUR amounts and entitlements',()=>{
  expect(Object.values(CHRISTMAS_PACKS).map(p=>[p.priceCents,p.imageCount,p.videoCount])).toEqual([[700,3,0],[1700,5,1],[2700,10,3]]);
 });
 it('keeps the active pinned checkout bundle and its verified response metadata',()=>{
  expect(read('supabase/functions/christmas-funnel/index.ts')).toContain('_christmas_v2_6d533ec7a8cac492/christmas-funnel/index.ts');
  const api=read('supabase/functions/_christmas_v2_6d533ec7a8cac492/christmas-funnel/index.ts');
  expect(api).toContain('paidAt: asString(order.paid_at)');expect(api).toContain('currency: asString(session.currency)');
 });
 it('finalizes V2 generated scenes using the V2 RPC rather than commerce tables',()=>{
  expect(read('supabase/functions/christmas-generate/index.ts')).toContain('service.rpc("christmas_v2_finalize_generation_if_done"');
 });
 it('retains the already-deployed payment amount, currency and paid-state guards',()=>{
  const sql=read('supabase/migrations/20261023130000_reconcile_live_christmas_payment_guard.sql');
  expect(sql).toContain("p_payment_status is distinct from 'paid'");
  expect(sql).toContain('p_amount_cents is distinct from order_row.amount_cents');
  expect(sql).toContain('lower(p_currency) is distinct from lower(order_row.currency)');
 });
});

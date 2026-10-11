-- Christmas V2 Meta Purchase + AI cost ledger SQL assertions (disposable DB).
-- Prerequisites:
--   psql … -f scripts/christmas-v2-iso-meta-cost-stubs.sql
--   psql … -f supabase/migrations/20261011180000_christmas_v2_meta_purchase_and_cost_ledger.sql
-- Run: PGPASSWORD=tdg_test_local psql -h 127.0.0.1 -U tdg_test -d christmas_v2_iso -v ON_ERROR_STOP=1 -f scripts/christmas-v2-iso-meta-cost-assertions.sql

\set ON_ERROR_STOP on
begin;

create temporary table assertion_results (
  name text primary key,
  status text not null check (status in ('PASS', 'FAIL')),
  detail text
);

create or replace function pg_temp.record_assert(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  insert into assertion_results(name, status, detail)
  values (p_name, case when p_ok then 'PASS' else 'FAIL' end, coalesce(p_detail, ''))
  on conflict (name) do update set status = excluded.status, detail = excluded.detail;
end;
$$;

do $$
declare
  oid uuid := gen_random_uuid();
  upsell_id uuid := gen_random_uuid();
  claim1 jsonb;
  claim2 jsonb;
  fin jsonb;
  cost1 jsonb;
  cost2 jsonb;
  ledger_count int;
  unpaid_id uuid := gen_random_uuid();
  scene_id uuid := gen_random_uuid();
  del_status text;
  sent_at timestamptz;
  econ_row record;
begin
  -- Unpaid order must not claim Meta Purchase
  insert into public.christmas_v2_orders (
    id, public_token_hash, public_token_ciphertext, email, email_normalized,
    sku, pack_key, amount_cents, charged_amount_cents, currency, status,
    image_count, video_count, meta_event_id, scene_keys, video_source_scene_keys,
    offer_catalog_version, offer_snapshot
  ) values (
    unpaid_id, encode(digest(unpaid_id::text, 'sha256'), 'hex'),
    encode(convert_to('tok_unpaid', 'utf8'), 'base64'),
    'meta+unpaid@example.test', 'meta+unpaid@example.test',
    'christmas-starter-eur7', 'starter', 700, 700, 'eur', 'awaiting_payment',
    3, 0, 'christmas_purchase_' || unpaid_id::text, '[]'::jsonb, '[]'::jsonb,
    'v2_eur_2026_10', '{"sku":"christmas-starter-eur7"}'::jsonb
  );

  claim1 := public.christmas_v2_claim_meta_purchase_delivery(
    unpaid_id, 'christmas_purchase_' || unpaid_id::text, 700, 'eur', 'christmas-starter-eur7'
  );
  perform pg_temp.record_assert(
    'meta_claim_rejects_unpaid',
    claim1->>'claim' = 'false' and claim1->>'reason' = 'not_paid',
    claim1::text
  );

  -- Paid starter EUR
  insert into public.christmas_v2_orders (
    id, public_token_hash, public_token_ciphertext, email, email_normalized,
    sku, pack_key, amount_cents, charged_amount_cents, currency, status,
    image_count, video_count, meta_event_id, scene_keys, video_source_scene_keys,
    offer_catalog_version, offer_snapshot, paid_at, meta_fbc, meta_fbp
  ) values (
    oid, encode(digest(oid::text, 'sha256'), 'hex'),
    encode(convert_to('tok_meta', 'utf8'), 'base64'),
    'meta+starter@example.test', 'meta+starter@example.test',
    'christmas-starter-eur7', 'starter', 700, 700, 'eur', 'paid',
    3, 0, 'christmas_purchase_' || oid::text, '[]'::jsonb, '[]'::jsonb,
    'v2_eur_2026_10', '{"sku":"christmas-starter-eur7","amountCents":700,"currency":"eur"}'::jsonb,
    now(), 'fb.1.1700000000.ClickToken', 'fb.1.1700000000.BrowserToken'
  );

  claim1 := public.christmas_v2_claim_meta_purchase_delivery(
    oid, 'christmas_purchase_' || oid::text, 700, 'eur', 'christmas-starter-eur7'
  );
  perform pg_temp.record_assert(
    'meta_claim_allows_first_paid',
    (claim1->>'claim')::boolean is true
      and claim1->>'event_id' = 'christmas_purchase_' || oid::text
      and (claim1->>'amount_cents')::int = 700
      and claim1->>'currency' = 'eur',
    claim1::text
  );

  -- Concurrent / race second claim while sending
  claim2 := public.christmas_v2_claim_meta_purchase_delivery(
    oid, 'christmas_purchase_' || oid::text, 700, 'eur', 'christmas-starter-eur7'
  );
  perform pg_temp.record_assert(
    'meta_claim_blocks_in_flight_race',
    claim2->>'claim' = 'false' and claim2->>'reason' = 'in_flight',
    claim2::text
  );

  fin := public.christmas_v2_finalize_meta_purchase_delivery(oid, 'sent', 200, 1, null);
  perform pg_temp.record_assert('meta_finalize_sent', fin->>'ok' = 'true', fin::text);

  select meta_purchase_sent_at into sent_at from public.christmas_v2_orders where id = oid;
  perform pg_temp.record_assert('meta_order_sent_at_set', sent_at is not null, coalesce(sent_at::text, 'null'));

  -- Replay after sent → deduplicated
  claim2 := public.christmas_v2_claim_meta_purchase_delivery(
    oid, 'christmas_purchase_' || oid::text, 700, 'eur', 'christmas-starter-eur7'
  );
  perform pg_temp.record_assert(
    'meta_claim_dedupes_after_sent',
    claim2->>'claim' = 'false' and claim2->>'reason' = 'already_sent',
    claim2::text
  );

  select status into del_status from public.christmas_v2_meta_deliveries where order_id = oid;
  perform pg_temp.record_assert(
    'meta_delivery_status_sent',
    del_status = 'sent',
    coalesce(del_status, 'null')
  );

  -- Exactly one delivery row per order/kind
  select count(*) into ledger_count from public.christmas_v2_meta_deliveries where order_id = oid;
  perform pg_temp.record_assert('meta_one_delivery_row', ledger_count = 1, ledger_count::text);

  -- Upsell is a separate order / event_id / delivery
  insert into public.christmas_v2_orders (
    id, public_token_hash, public_token_ciphertext, email, email_normalized,
    sku, pack_key, amount_cents, charged_amount_cents, currency, status,
    image_count, video_count, meta_event_id, scene_keys, video_source_scene_keys,
    parent_order_id, offer_catalog_version, offer_snapshot, paid_at
  ) values (
    upsell_id, encode(digest(upsell_id::text, 'sha256'), 'hex'),
    encode(convert_to('tok_upsell', 'utf8'), 'base64'),
    'meta+upsell@example.test', 'meta+upsell@example.test',
    'christmas-magic-eur17', 'magic', 1700, 1700, 'eur', 'paid',
    5, 1, 'christmas_purchase_' || upsell_id::text, '[]'::jsonb, '[]'::jsonb,
    oid, 'v2_eur_2026_10', '{"sku":"christmas-magic-eur17"}'::jsonb, now()
  );

  claim1 := public.christmas_v2_claim_meta_purchase_delivery(
    upsell_id, 'christmas_purchase_' || upsell_id::text, 1700, 'eur', 'christmas-magic-eur17'
  );
  perform pg_temp.record_assert(
    'meta_upsell_separate_claim',
    (claim1->>'claim')::boolean is true
      and claim1->>'event_id' = 'christmas_purchase_' || upsell_id::text
      and (claim1->>'amount_cents')::int = 1700,
    claim1::text
  );
  perform public.christmas_v2_finalize_meta_purchase_delivery(upsell_id, 'sent', 200, 1, null);

  -- Cost ledger: mock zero cost + failed attempt estimate + dedupe by prediction_id
  insert into public.christmas_v2_order_scenes (id, order_id, scene_key, scene_number, title, status)
  values (scene_id, oid, 'by-the-christmas-tree', 1, 'Tree', 'succeeded');

  cost1 := public.christmas_v2_ai_cost_ledger_record_attempt(
    'higgsfield',
    'mock_' || oid::text || '_tree',
    oid,
    scene_id,
    null,
    'by-the-christmas-tree',
    1,
    'christmas-starter-eur7',
    'higgsfield-ai/soul/v2/image-to-image',
    'image',
    'succeeded',
    true,
    false,
    null,
    null
  );
  perform pg_temp.record_assert(
    'cost_mock_zero_and_exact',
    cost1->>'ok' = 'true'
      and (cost1->>'estimated_cost_usd')::numeric = 0
      and cost1->>'actual_cost_usd' is null
      and (cost1->>'is_estimate')::boolean is false,
    cost1::text
  );

  cost2 := public.christmas_v2_ai_cost_ledger_record_attempt(
    'higgsfield',
    'pred_live_' || oid::text,
    oid,
    scene_id,
    null,
    'by-the-christmas-tree',
    1,
    'christmas-starter-eur7',
    'higgsfield-ai/soul/v2/image-to-image',
    'image',
    'succeeded',
    false,
    false,
    null,
    null
  );
  perform pg_temp.record_assert(
    'cost_live_estimate_not_actual',
    cost2->>'ok' = 'true'
      and (cost2->>'is_estimate')::boolean is true
      and cost2->>'actual_cost_usd' is null
      and (cost2->>'estimated_cost_usd')::numeric > 0,
    cost2::text
  );

  -- Idempotent upsert on same prediction_id
  cost1 := public.christmas_v2_ai_cost_ledger_record_attempt(
    'higgsfield',
    'pred_live_' || oid::text,
    oid,
    scene_id,
    null,
    'by-the-christmas-tree',
    1,
    'christmas-starter-eur7',
    'higgsfield-ai/soul/v2/image-to-image',
    'image',
    'succeeded',
    false,
    true,
    null,
    'webhook_replay'
  );
  select count(*) into ledger_count
  from public.ai_cost_ledger
  where provider = 'higgsfield' and prediction_id = 'pred_live_' || oid::text;
  perform pg_temp.record_assert('cost_prediction_dedupe', ledger_count = 1, ledger_count::text);

  -- Failed attempt still recorded (consumption) without inventing actual
  cost1 := public.christmas_v2_ai_cost_ledger_record_attempt(
    'higgsfield',
    'failed:christmas_v2:image:' || oid::text || ':' || scene_id::text || ':2',
    oid,
    scene_id,
    null,
    'by-the-christmas-tree',
    2,
    'christmas-starter-eur7',
    'higgsfield-ai/soul/v2/image-to-image',
    'image',
    'failed',
    false,
    true,
    null,
    'failed_attempt_estimated_consumption'
  );
  perform pg_temp.record_assert(
    'cost_failed_attempt_estimated',
    cost1->>'ok' = 'true'
      and (cost1->>'is_estimate')::boolean is true
      and cost1->>'actual_cost_usd' is null,
    cost1::text
  );

  select * into econ_row from public.christmas_v2_order_economics where order_id = oid;
  perform pg_temp.record_assert(
    'economics_revenue_and_roas_unavailable',
    econ_row.charged_amount_cents = 700
      and econ_row.revenue_currency = 'eur'
      and econ_row.attribution_finance_status = 'ad_spend_unavailable'
      and econ_row.roas is null
      and econ_row.cpa is null
      and econ_row.purchase_kind = 'original',
    coalesce(econ_row.order_id::text, 'missing')
  );

  select * into econ_row from public.christmas_v2_order_economics where order_id = upsell_id;
  perform pg_temp.record_assert(
    'economics_upsell_separate',
    econ_row.purchase_kind = 'upsell'
      and econ_row.parent_order_id = oid
      and econ_row.charged_amount_cents = 1700,
    coalesce(econ_row.purchase_kind, 'missing')
  );

  -- RLS: anon/authenticated cannot execute claim RPCs
  perform pg_temp.record_assert(
    'meta_rpc_service_role_only',
    not has_function_privilege('anon', 'public.christmas_v2_claim_meta_purchase_delivery(uuid,text,integer,text,text)', 'execute')
      and not has_function_privilege('authenticated', 'public.christmas_v2_claim_meta_purchase_delivery(uuid,text,integer,text,text)', 'execute'),
    'privilege check'
  );

  perform pg_temp.record_assert(
    'cost_rpc_service_role_only',
    not has_function_privilege('anon', 'public.christmas_v2_ai_cost_ledger_record_attempt(text,text,uuid,uuid,uuid,text,integer,text,text,text,text,boolean,boolean,numeric,text)', 'execute'),
    'privilege check'
  );

  perform pg_temp.record_assert(
    'meta_deliveries_table_exists',
    to_regclass('public.christmas_v2_meta_deliveries') is not null,
    'missing table'
  );

  perform pg_temp.record_assert(
    'package_economics_view_exists',
    to_regclass('public.christmas_v2_package_economics') is not null,
    'missing view'
  );
end;
$$;

select name, status, detail from assertion_results order by name;

do $$
declare
  fails int;
begin
  select count(*) into fails from assertion_results where status = 'FAIL';
  if fails > 0 then
    raise exception 'christmas_v2 meta/cost assertions failed: %', fails;
  end if;
end;
$$;

rollback;

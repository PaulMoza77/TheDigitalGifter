-- Christmas V2 isolated SQL assertions (disposable DB only).
-- Run: PGPASSWORD=tdg_test_local psql -h 127.0.0.1 -U tdg_test -d christmas_v2_iso -v ON_ERROR_STOP=1 -f scripts/christmas-v2-iso-sql-assertions.sql

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

-- ---------------------------------------------------------------------------
-- Helpers / synthetic fixtures
-- ---------------------------------------------------------------------------

create temporary table fixture_orders (
  pack text primary key,
  order_id uuid not null,
  amount int not null,
  currency text not null,
  images int not null,
  videos int not null,
  sku text not null
);

do $$
declare
  oid uuid;
  i int;
  scene_keys text[] := array[
    'by-the-christmas-tree','snowy-winter-portrait','cozy-fireplace',
    'festive-kitchen','midnight-window','ornament-closeup',
    'scarf-portrait','candlelight','family-mantel','gift-opening'
  ];
  packs record;
begin
  for packs in
    select * from (values
      ('starter', 700, 'eur', 3, 0, 'christmas-starter-eur7'),
      ('magic', 1700, 'eur', 5, 1, 'christmas-magic-eur17'),
      ('ultimate', 2700, 'eur', 10, 3, 'christmas-ultimate-eur27'),
      ('legacy_usd', 300, 'usd', 3, 0, 'christmas-starter-3')
    ) as t(pack, amount, currency, images, videos, sku)
  loop
    oid := gen_random_uuid();
    insert into public.christmas_v2_orders (
      id, public_token_hash, public_token_ciphertext, email, email_normalized,
      sku, pack_key, amount_cents, charged_amount_cents, currency, status,
      image_count, video_count, meta_event_id, scene_keys, video_source_scene_keys,
      offer_catalog_version, offer_snapshot, photo_path, photo_content_type
    ) values (
      oid,
      encode(digest(oid::text || packs.pack, 'sha256'), 'hex'),
      encode(convert_to('tok_' || packs.pack, 'utf8'), 'base64'),
      'iso+' || packs.pack || '@example.test',
      'iso+' || packs.pack || '@example.test',
      packs.sku,
      case when packs.pack = 'legacy_usd' then 'starter' else packs.pack end,
      packs.amount,
      packs.amount,
      packs.currency,
      'awaiting_payment',
      packs.images,
      packs.videos,
      'iso_meta_' || packs.pack || '_' || oid::text,
      to_jsonb(scene_keys[1:packs.images]),
      to_jsonb(scene_keys[1:greatest(packs.videos, 0)]),
      case when packs.currency = 'eur' then 'v2_eur_2026_10' else null end,
      jsonb_build_object(
        'sku', packs.sku, 'amountCents', packs.amount, 'currency', packs.currency,
        'imageCount', packs.images, 'videoCount', packs.videos
      ),
      oid::text || '/source/photo.jpg',
      'image/jpeg'
    );

    for i in 1..packs.images loop
      insert into public.christmas_v2_order_scenes (order_id, scene_key, scene_number, title, status)
      values (oid, scene_keys[i], i, scene_keys[i], 'queued');
    end loop;

    for i in 1..packs.videos loop
      insert into public.christmas_v2_order_videos (order_id, source_scene_key, status)
      values (oid, scene_keys[i], 'queued');
    end loop;

    insert into fixture_orders values (packs.pack, oid, packs.amount, packs.currency, packs.images, packs.videos, packs.sku);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Amount / currency mismatch rejection
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  ok_amount boolean := false;
  ok_currency boolean := false;
begin
  select order_id into oid from fixture_orders where pack = 'starter';
  begin
    perform public.fulfill_christmas_v2_order_payment(
      'evt_mismatch_amount', 'cs_mismatch_amount', 'checkout.session.completed',
      'paid', 'pi_x', 999, 'eur', oid
    );
  exception when check_violation then
    ok_amount := true;
  when others then
    ok_amount := (sqlerrm ilike '%amount mismatch%');
  end;

  begin
    perform public.fulfill_christmas_v2_order_payment(
      'evt_mismatch_currency', 'cs_mismatch_currency', 'checkout.session.completed',
      'paid', 'pi_y', 700, 'usd', oid
    );
  exception when check_violation then
    ok_currency := true;
  when others then
    ok_currency := (sqlerrm ilike '%currency mismatch%');
  end;

  perform pg_temp.record_assert('amount_mismatch_rejected', ok_amount, 'starter EUR 700 vs 999');
  perform pg_temp.record_assert('currency_mismatch_rejected', ok_currency, 'starter EUR vs usd');
end $$;

-- ---------------------------------------------------------------------------
-- 2) Valid paid fulfillment (EUR starter)
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  result jsonb;
  job_count int;
begin
  select order_id into oid from fixture_orders where pack = 'starter';
  result := public.fulfill_christmas_v2_order_payment(
    'evt_starter_paid', 'cs_starter_paid', 'checkout.session.completed',
    'paid', 'pi_starter', 700, 'eur', oid
  );
  select count(*) into job_count from public.christmas_v2_generation_jobs where order_id = oid;
  perform pg_temp.record_assert(
    'valid_eur_starter_fulfill',
    (result->>'status') = 'fulfilled'
      and (result->>'should_enqueue')::boolean = true
      and job_count = 1
      and exists (select 1 from public.christmas_v2_orders where id = oid and paid_at is not null and status = 'paid'),
    result::text
  );
end $$;

-- ---------------------------------------------------------------------------
-- 3) Replay / idempotent fulfill (same event + second event already paid)
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  first jsonb;
  replay jsonb;
  second jsonb;
  paid_count int;
begin
  select order_id into oid from fixture_orders where pack = 'starter';
  first := public.fulfill_christmas_v2_order_payment(
    'evt_starter_paid', 'cs_starter_paid', 'checkout.session.completed',
    'paid', 'pi_starter', 700, 'eur', oid
  );
  replay := public.fulfill_christmas_v2_order_payment(
    'evt_starter_paid_replay', 'cs_starter_paid', 'checkout.session.completed',
    'paid', 'pi_starter', 700, 'eur', oid
  );
  select count(*) into paid_count from public.christmas_v2_generation_jobs where order_id = oid;
  perform pg_temp.record_assert(
    'already_paid_idempotent',
    (replay->>'already_paid')::boolean = true
      and (replay->>'should_enqueue')::boolean = false
      and paid_count = 1,
    replay::text
  );
  -- original event row present once
  perform pg_temp.record_assert(
    'stripe_event_dedupe',
    (select count(*) from public.processed_stripe_events where event_id = 'evt_starter_paid') = 1,
    'processed_stripe_events'
  );
end $$;

-- ---------------------------------------------------------------------------
-- 4) Concurrent claim: only one claimed; completed -> already_completed
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  c1 jsonb;
  c2 jsonb;
  c3 jsonb;
begin
  select order_id into oid from fixture_orders where pack = 'starter';
  c1 := public.claim_christmas_v2_generation_job(oid);
  c2 := public.claim_christmas_v2_generation_job(oid);
  perform pg_temp.record_assert(
    'duplicate_claim_blocked_while_running',
    (c1->>'claimed')::boolean = true and (c2->>'claimed')::boolean = false,
    c1::text || ' / ' || c2::text
  );

  -- Simulate finalize completed job
  update public.christmas_v2_generation_jobs
  set status = 'completed', finished_at = now(), updated_at = now()
  where order_id = oid;
  c3 := public.claim_christmas_v2_generation_job(oid);
  perform pg_temp.record_assert(
    'claim_completed_is_already_completed',
    (c3->>'claimed')::boolean = false and (c3->>'status') = 'already_completed',
    c3::text
  );
end $$;

-- ---------------------------------------------------------------------------
-- 5) Stale running lease reclaim (>3 minutes)
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  claim jsonb;
begin
  select order_id into oid from fixture_orders where pack = 'magic';
  perform public.fulfill_christmas_v2_order_payment(
    'evt_magic_paid', 'cs_magic_paid', 'checkout.session.completed',
    'paid', 'pi_magic', 1700, 'eur', oid
  );
  update public.christmas_v2_generation_jobs
  set status = 'running', claimed_at = now() - interval '4 minutes', updated_at = now()
  where order_id = oid;
  claim := public.claim_christmas_v2_generation_job(oid);
  perform pg_temp.record_assert(
    'stale_running_reclaim',
    (claim->>'claimed')::boolean = true,
    claim::text
  );
end $$;

-- ---------------------------------------------------------------------------
-- 6) Images done + videos pending => awaiting_videos (not complete)
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  fin jsonb;
  order_status text;
begin
  select order_id into oid from fixture_orders where pack = 'magic';
  update public.christmas_v2_order_scenes
  set status = 'succeeded', progress_percent = 100, result_path = 'x.jpg', completed_at = now()
  where order_id = oid;
  -- leave videos queued
  fin := public.christmas_v2_finalize_generation_if_done(oid);
  select status into order_status from public.christmas_v2_orders where id = oid;
  perform pg_temp.record_assert(
    'awaiting_videos_when_images_done',
    (fin->>'done')::boolean = false
      and (fin->>'awaiting_videos')::boolean = true
      and (fin->>'scenes_done')::boolean = true
      and order_status = 'generating',
    fin::text || ' status=' || order_status
  );
end $$;

-- ---------------------------------------------------------------------------
-- 7) All paid videos complete => complete; email ledger only after complete
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  fin jsonb;
  order_status text;
begin
  select order_id into oid from fixture_orders where pack = 'magic';
  update public.christmas_v2_order_videos
  set status = 'succeeded', result_path = 'v.mp4', completed_at = now()
  where order_id = oid;
  fin := public.christmas_v2_finalize_generation_if_done(oid);
  select status into order_status from public.christmas_v2_orders where id = oid;
  perform pg_temp.record_assert(
    'complete_after_videos',
    (fin->>'done')::boolean = true and order_status = 'complete',
    fin::text || ' status=' || order_status
  );

  insert into public.christmas_v2_email_deliveries (order_id, kind, status)
  values (oid, 'magic_ready', 'sent')
  on conflict (order_id, kind) do update set status = 'sent';
  perform pg_temp.record_assert(
    'email_ledger_after_complete',
    exists (
      select 1 from public.christmas_v2_email_deliveries d
      join public.christmas_v2_orders o on o.id = d.order_id
      where d.order_id = oid and d.status = 'sent' and o.status = 'complete'
    ),
    'magic_ready sent'
  );
end $$;

-- ---------------------------------------------------------------------------
-- 8) Partial/failed video => never incorrectly complete
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  fin jsonb;
  order_status text;
begin
  select order_id into oid from fixture_orders where pack = 'ultimate';
  perform public.fulfill_christmas_v2_order_payment(
    'evt_ultimate_paid', 'cs_ultimate_paid', 'checkout.session.completed',
    'paid', 'pi_ult', 2700, 'eur', oid
  );
  update public.christmas_v2_order_scenes
  set status = 'succeeded', progress_percent = 100, result_path = 'x.jpg', completed_at = now()
  where order_id = oid;
  update public.christmas_v2_order_videos
  set status = case when source_scene_key = 'by-the-christmas-tree' then 'failed' else 'succeeded' end,
      result_path = 'v.mp4',
      completed_at = now()
  where order_id = oid;
  fin := public.christmas_v2_finalize_generation_if_done(oid);
  select status into order_status from public.christmas_v2_orders where id = oid;
  perform pg_temp.record_assert(
    'partial_failure_not_complete',
    (fin->>'done')::boolean = true and order_status = 'partial_failure',
    fin::text || ' status=' || order_status
  );
end $$;

-- ---------------------------------------------------------------------------
-- 9) Video pack missing video rows (entitled > rows) stays awaiting_videos
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  fin jsonb;
begin
  oid := gen_random_uuid();
  insert into public.christmas_v2_orders (
    id, public_token_hash, email, email_normalized, sku, pack_key,
    amount_cents, currency, status, image_count, video_count, meta_event_id,
    paid_at, offer_snapshot
  ) values (
    oid, encode(digest(oid::text, 'sha256'), 'hex'),
    'iso+missingvids@example.test', 'iso+missingvids@example.test',
    'christmas-magic-eur17', 'magic', 1700, 'eur', 'generating', 5, 1,
    'iso_meta_missing_' || oid::text, now(),
    '{"sku":"christmas-magic-eur17","amountCents":1700,"currency":"eur","imageCount":5,"videoCount":1}'::jsonb
  );
  insert into public.christmas_v2_order_scenes (order_id, scene_key, scene_number, title, status, result_path)
  select oid, 's' || g, g, 's' || g, 'succeeded', 'r.jpg' from generate_series(1, 5) g;
  -- intentionally NO video rows
  fin := public.christmas_v2_finalize_generation_if_done(oid);
  perform pg_temp.record_assert(
    'missing_video_jobs_awaiting',
    (fin->>'done')::boolean = false and (fin->>'awaiting_videos')::boolean = true,
    fin::text
  );
end $$;

-- ---------------------------------------------------------------------------
-- 10) Legacy USD lifecycle still fulfillable at original amount/currency
-- ---------------------------------------------------------------------------
do $$
declare
  oid uuid;
  result jsonb;
begin
  select order_id into oid from fixture_orders where pack = 'legacy_usd';
  result := public.fulfill_christmas_v2_order_payment(
    'evt_legacy_usd', 'cs_legacy_usd', 'checkout.session.completed',
    'paid', 'pi_legacy', 300, 'usd', oid
  );
  perform pg_temp.record_assert(
    'legacy_usd_fulfill',
    (result->>'status') = 'fulfilled'
      and exists (select 1 from public.christmas_v2_orders where id = oid and currency = 'usd' and amount_cents = 300 and paid_at is not null),
    result::text
  );
end $$;

-- ---------------------------------------------------------------------------
-- 11) Forged EUR SKU amount incompatible with CHECK / snapshot integrity
-- ---------------------------------------------------------------------------
do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.christmas_v2_orders (
      public_token_hash, email, email_normalized, sku, pack_key,
      amount_cents, currency, status, image_count, video_count, meta_event_id
    ) values (
      encode(digest(random()::text, 'sha256'), 'hex'),
      'iso+badsku@example.test', 'iso+badsku@example.test',
      'christmas-starter-eur999', 'starter', 999, 'eur', 'awaiting_payment', 3, 0,
      'iso_badsku_' || gen_random_uuid()::text
    );
  exception when check_violation then
    rejected := true;
  end;
  perform pg_temp.record_assert('forged_sku_rejected_by_check', rejected, 'sku CHECK');
end $$;

-- ---------------------------------------------------------------------------
-- 12) SECURITY DEFINER search_path + execute grants
-- ---------------------------------------------------------------------------
do $$
declare
  sp text;
  anon_ok boolean;
begin
  select pg_get_functiondef(p.oid) into sp
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'fulfill_christmas_v2_order_payment'
  limit 1;
  perform pg_temp.record_assert(
    'fulfill_security_definer_search_path',
    sp ilike '%security definer%' and sp ilike '%search_path%public%',
    left(coalesce(sp, ''), 120)
  );

  select has_function_privilege('anon', 'public.fulfill_christmas_v2_order_payment(text,text,text,text,text,integer,text,uuid)', 'execute')
    into anon_ok;
  perform pg_temp.record_assert(
    'fulfill_not_granted_to_anon',
    anon_ok = false,
    'anon execute=' || anon_ok::text
  );
end $$;

-- ---------------------------------------------------------------------------
-- 13) Entitlement counts for EUR packs
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  scene_n int;
  video_n int;
begin
  for r in select * from fixture_orders where pack in ('starter','magic','ultimate') loop
    select count(*) into scene_n from public.christmas_v2_order_scenes where order_id = r.order_id;
    select count(*) into video_n from public.christmas_v2_order_videos where order_id = r.order_id;
    perform pg_temp.record_assert(
      'entitlements_' || r.pack,
      scene_n = r.images and video_n = r.videos,
      format('scenes=%s videos=%s expected %s/%s', scene_n, video_n, r.images, r.videos)
    );
  end loop;
end $$;

commit;

\echo '=== ASSERTION RESULTS ==='
select status, count(*) from assertion_results group by status order by 1;
select name, status, detail from assertion_results order by status desc, name;

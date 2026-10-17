-- Mock E2E for EUR 7/17/27 against disposable christmas_v2_iso (no Stripe/HF/email egress).
-- Simulates: create → pay → claim → succeed scenes → (videos) → finalize → email ledger.

\set ON_ERROR_STOP on
begin;

create temporary table e2e_results (
  pack text primary key,
  images_ok boolean,
  videos_ok boolean,
  status text,
  email_ok boolean,
  detail text
);

do $$
declare
  packs record;
  oid uuid;
  claim jsonb;
  fin jsonb;
  scene_keys text[] := array[
    'by-the-christmas-tree','snowy-winter-portrait','cozy-fireplace',
    'festive-kitchen','midnight-window','ornament-closeup',
    'scarf-portrait','candlelight','family-mantel','gift-opening'
  ];
  i int;
  scene_n int;
  video_n int;
  order_status text;
  email_ok boolean;
begin
  for packs in
    select * from (values
      ('starter', 700, 3, 0, 'christmas-starter-eur7', 'starter_ready'),
      ('magic', 1700, 5, 1, 'christmas-magic-eur17', 'magic_ready'),
      ('ultimate', 2700, 10, 3, 'christmas-ultimate-eur27', 'ultimate_ready')
    ) as t(pack, amount, images, videos, sku, email_kind)
  loop
    oid := gen_random_uuid();
    insert into public.christmas_v2_orders (
      id, public_token_hash, public_token_ciphertext, email, email_normalized,
      sku, pack_key, amount_cents, currency, status, image_count, video_count,
      meta_event_id, scene_keys, video_source_scene_keys, offer_catalog_version, offer_snapshot,
      photo_path, photo_content_type
    ) values (
      oid, encode(digest(oid::text, 'sha256'), 'hex'),
      encode(convert_to('tok_' || packs.pack, 'utf8'), 'base64'),
      'e2e+' || packs.pack || '@example.test', 'e2e+' || packs.pack || '@example.test',
      packs.sku, packs.pack, packs.amount, 'eur', 'awaiting_payment', packs.images, packs.videos,
      'e2e_meta_' || packs.pack || '_' || oid::text,
      to_jsonb(scene_keys[1:packs.images]),
      to_jsonb(scene_keys[1:packs.videos]),
      'v2_eur_2026_10',
      jsonb_build_object('sku', packs.sku, 'amountCents', packs.amount, 'currency', 'eur',
        'imageCount', packs.images, 'videoCount', packs.videos),
      oid::text || '/source.jpg', 'image/jpeg'
    );

    for i in 1..packs.images loop
      insert into public.christmas_v2_order_scenes (order_id, scene_key, scene_number, title, status)
      values (oid, scene_keys[i], i, scene_keys[i], 'queued');
    end loop;
    for i in 1..packs.videos loop
      insert into public.christmas_v2_order_videos (order_id, source_scene_key, status)
      values (oid, scene_keys[i], 'queued');
    end loop;

    perform public.fulfill_christmas_v2_order_payment(
      'e2e_evt_' || packs.pack || '_' || oid::text,
      'e2e_cs_' || packs.pack || '_' || oid::text,
      'checkout.session.completed',
      'paid', 'e2e_pi_' || packs.pack || '_' || oid::text, packs.amount, 'eur', oid
    );

    claim := public.claim_christmas_v2_generation_job(oid);
    if not (claim->>'claimed')::boolean then
      raise exception 'claim failed for %: %', packs.pack, claim;
    end if;

    update public.christmas_v2_order_scenes
    set status = 'succeeded', progress_percent = 100,
        result_bucket = 'christmas-generated',
        result_path = order_id::text || '/scenes/' || scene_key || '.jpg',
        model_name = 'mock',
        replicate_prediction_id = 'mock_' || id::text,
        completed_at = now()
    where order_id = oid;

    fin := public.christmas_v2_finalize_generation_if_done(oid);

    if packs.videos > 0 then
      if coalesce((fin->>'awaiting_videos')::boolean, false) is not true then
        raise exception 'expected awaiting_videos for %: %', packs.pack, fin;
      end if;
      update public.christmas_v2_order_videos
      set status = 'succeeded',
          result_bucket = 'christmas-generated',
          result_path = order_id::text || '/videos/' || id::text || '.mp4',
          model_name = 'mock',
          duration_seconds = 5,
          replicate_prediction_id = 'mock_video_' || id::text,
          completed_at = now()
      where order_id = oid;
      fin := public.christmas_v2_finalize_generation_if_done(oid);
    end if;

    select status into order_status from public.christmas_v2_orders where id = oid;
    select count(*) into scene_n from public.christmas_v2_order_scenes where order_id = oid and status = 'succeeded';
    select count(*) into video_n from public.christmas_v2_order_videos where order_id = oid and status = 'succeeded';

    -- Email only after complete (application rule); record ledger here for mock.
    email_ok := false;
    if order_status = 'complete' and (fin->>'done')::boolean then
      insert into public.christmas_v2_email_deliveries as d (order_id, kind, status)
      values (oid, packs.email_kind, 'sent')
      on conflict (order_id, kind) do update set status = 'sent';
      update public.christmas_v2_orders set delivery_email_sent_at = now() where id = oid;
      email_ok := true;
    end if;

    insert into e2e_results values (
      packs.pack,
      scene_n = packs.images,
      video_n = packs.videos,
      order_status,
      email_ok,
      fin::text
    );
  end loop;
end $$;

commit;

\echo '=== MOCK E2E MATRIX ==='
select pack,
  case when images_ok and videos_ok and status = 'complete' and email_ok then 'PASS' else 'FAIL' end as result,
  images_ok, videos_ok, status, email_ok
from e2e_results
order by case pack when 'starter' then 1 when 'magic' then 2 else 3 end;

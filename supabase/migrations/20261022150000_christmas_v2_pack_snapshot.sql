begin;
alter table public.christmas_v2_orders add column if not exists pack_snapshot jsonb;
update public.christmas_v2_orders set pack_snapshot = jsonb_build_object('version','historical','key',pack_key,'amountCents',amount_cents,'currency',currency,'imageCount',image_count,'videoCount',video_count) where pack_snapshot is null;
-- Existing christmas_v2_orders_currency_chk already accepts both historical USD and EUR.
commit;

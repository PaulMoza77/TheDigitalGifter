-- Additive affiliate product fields for Planner gifts.
-- source_meta holds provider + external id only (no recipient PII).

alter table public.christmas_gift_items
  drop constraint if exists christmas_gift_items_source_chk;

alter table public.christmas_gift_items
  add constraint christmas_gift_items_source_chk
  check (source_type in ('manual', 'gift_finder', 'wishlist', 'affiliate_product'));

alter table public.christmas_gift_items
  add column if not exists image_url text;

alter table public.christmas_gift_items
  add column if not exists price_checked_at timestamptz;

alter table public.christmas_gift_items
  add column if not exists source_meta jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'christmas_gift_items_image_url_chk'
  ) then
    alter table public.christmas_gift_items
      add constraint christmas_gift_items_image_url_chk
      check (image_url is null or char_length(image_url) <= 2000);
  end if;
end $$;

-- Kids Christmas commercial product: real funnel (not coming_soon),
-- private-by-default ACL, consent columns, decided retention windows.
-- purchasable remains false; price_cents remains 0. No live checkout activation.

begin;

alter table public.christmas_orders
  add column if not exists visibility text not null default 'private',
  add column if not exists guardian_consent boolean,
  add column if not exists consent_version text,
  add column if not exists consented_at timestamptz,
  add column if not exists retention_delete_after timestamptz;

update public.christmas_orders
set visibility = 'private'
where visibility is null or visibility = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'christmas_orders_visibility_chk'
  ) then
    alter table public.christmas_orders
      add constraint christmas_orders_visibility_chk
      check (visibility in ('private', 'token_share'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'christmas_orders_kids_private_chk'
  ) then
    alter table public.christmas_orders
      add constraint christmas_orders_kids_private_chk
      check (product_key <> 'christmas_kids' or visibility = 'private');
  end if;
end $$;

comment on column public.christmas_orders.visibility is
  'Default private. Kids orders must remain private (no public gallery).';
comment on column public.christmas_orders.retention_delete_after is
  'Kids V1 policy: unpaid source 7d; paid source 30d; paid result 90d. Consent audit kept 24 months.';

update public.christmas_products
set
  name = 'Kids Christmas Generator',
  description = 'A private Christmas portrait of your child. Parent consent required. Never shown in a public gallery.',
  metadata = coalesce(metadata, '{}'::jsonb)
    || '{"kids_v1":true,"foundation":true,"live_offer":false,"portrait_vertical":true,"privacy_required":true,"noindex":true,"public_gallery":false}'::jsonb
    - 'coming_soon',
  updated_at = now()
where product_key = 'christmas_kids';

insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  'single',
  'Single kids portrait',
  'Draft package configuration — not a live public offer.',
  'usd',
  0,
  null,
  true,
  false,
  '["1 private Christmas kids portrait","Parent/guardian consent required"]'::jsonb,
  10,
  '{"live_offer":false,"note":"price unpublished; set purchasable + price in a later launch task"}'::jsonb
from public.christmas_products p
where p.product_key = 'christmas_kids'
  and not exists (
    select 1 from public.christmas_packages pkg
    where pkg.product_id = p.id and pkg.package_key = 'single'
  );

update public.christmas_packages pkg
set purchasable = false,
    price_cents = 0,
    updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key = 'christmas_kids'
  and pkg.package_key = 'single';

insert into public.christmas_styles (
  style_key, display_name, description, prompt_template, negative_hints, enabled, sort_order, product_keys
) values
(
  'kids_classic_christmas',
  'Classic Christmas',
  'Warm traditional portrait that keeps their real age.',
  'Transform this child’s photo into a photoreal classic Christmas portrait. Preserve the exact facial identity, real age, and likeness. Do not age the child up or make them look older or more adult. Child-appropriate festive clothing only — no makeup, no adult styling. Soft warm Christmas-tree light, natural skin, no text, no watermark, no extra people, no deformed hands.',
  'age-up, adult makeup, sexualized, cartoon, text, watermark, extra people, deformed face',
  true,
  10,
  array['christmas_kids']::text[]
),
(
  'kids_cozy_fireplace',
  'Cozy Fireplace',
  'Soft firelight, pajamas-and-cocoa mood.',
  'Transform this child’s photo into a photoreal cozy fireplace Christmas portrait. Preserve exact identity and real age — do not age up. Warm fireplace glow, soft knit textures, child-appropriate clothing. Natural skin, no makeup, no text, no watermark, no extra people.',
  'age-up, adult styling, cartoon, text, watermark, extra people',
  true,
  20,
  array['christmas_kids']::text[]
),
(
  'kids_winter_wonderland',
  'Winter Wonderland',
  'Snowy outdoor Christmas magic, age-safe.',
  'Transform this child’s photo into a photoreal winter wonderland Christmas portrait. Preserve exact facial identity and real age. Soft falling snow, evergreens, warm lanterns. Realistic winter clothing suitable for a child. No makeup, no text, no watermark, no extra people.',
  'age-up, adult fashion, cartoon, text, watermark, extra people',
  true,
  30,
  array['christmas_kids']::text[]
),
(
  'kids_santas_workshop',
  'Santa''s Workshop',
  'Playful workshop scene without hiding their face.',
  'Transform this child’s photo into a photoreal Santa''s workshop Christmas portrait. Preserve exact identity and real age. Wooden toys, warm workshop lamps, subtle festive props that do not hide the face. Child-appropriate clothing. Natural proportions, no makeup, no text, no watermark, no extra people.',
  'age-up, face covered, cartoon, text, watermark, extra people',
  true,
  40,
  array['christmas_kids']::text[]
),
(
  'kids_christmas_morning',
  'Christmas Morning',
  'Soft morning light and festive calm.',
  'Transform this child’s photo into a photoreal Christmas morning portrait. Preserve exact identity and real age — do not age up. Soft daylight, calm festive living room, child-appropriate clothing. Natural skin, no makeup, no text, no watermark, no extra people.',
  'age-up, adult styling, cartoon, text, watermark, extra people',
  true,
  50,
  array['christmas_kids']::text[]
),
(
  'kids_north_pole',
  'North Pole',
  'Gentle aurora and snow, still photoreal.',
  'Transform this child’s photo into a photoreal North Pole Christmas portrait. Preserve exact facial identity and real age. Soft aurora sky, snow crystals, magical but realistic. Child-appropriate winter clothing. Natural face detail, no makeup, no text, no watermark, no extra people.',
  'age-up, neon overload, cartoon, text, watermark, extra people',
  true,
  60,
  array['christmas_kids']::text[]
),
(
  'kids_christmas_movie',
  'Christmas Movie',
  'Cinematic holiday still, child-safe.',
  'Transform this child’s photo into a photoreal Christmas-movie cinematic portrait. Preserve exact identity and real age. Soft bokeh, warm practical lights, storybook porch or living room. Child-appropriate clothing. Film-still aesthetic, no logos, no text, no watermark, no extra people.',
  'age-up, logos, title card, cartoon, text, watermark, extra people',
  true,
  70,
  array['christmas_kids']::text[]
),
(
  'kids_vintage_christmas',
  'Vintage Christmas',
  'Nostalgic film-era warmth, age preserved.',
  'Transform this child’s photo into a photoreal vintage Christmas portrait with gentle film grain. Preserve exact identity and real age. Mid-century holiday décor cues, soft vignette, natural skin. Child-appropriate clothing, no makeup, no text, no watermark, no extra people.',
  'age-up, heavy filter obscuring identity, cartoon, text, watermark, extra people',
  true,
  80,
  array['christmas_kids']::text[]
)
on conflict (style_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  prompt_template = excluded.prompt_template,
  negative_hints = excluded.negative_hints,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order,
  product_keys = excluded.product_keys,
  updated_at = now();

commit;

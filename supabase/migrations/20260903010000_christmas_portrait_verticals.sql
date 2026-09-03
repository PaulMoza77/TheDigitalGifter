-- Christmas portrait verticals: packages, styles, order metadata.
-- purchasable remains false; price_cents remains 0. No live checkout activation.

begin;

alter table public.christmas_orders
  add column if not exists portrait_type text,
  add column if not exists species text,
  add column if not exists source_route text;

create index if not exists christmas_orders_portrait_type_idx
  on public.christmas_orders (portrait_type, created_at desc);

create index if not exists christmas_orders_species_idx
  on public.christmas_orders (species, created_at desc);

-- Update product copy / clear coming_soon for live funnel verticals
update public.christmas_products
set
  name = 'Family Christmas',
  description = 'Turn your family photo into a magical Christmas portrait.',
  metadata = coalesce(metadata, '{}'::jsonb) || '{"foundation":true,"live_offer":false,"portrait_vertical":true}'::jsonb - 'coming_soon',
  updated_at = now()
where product_key = 'christmas_family';

update public.christmas_products
set
  name = 'Couples Christmas',
  description = 'A romantic Christmas couple portrait from one shared photo.',
  metadata = coalesce(metadata, '{}'::jsonb) || '{"foundation":true,"live_offer":false,"portrait_vertical":true}'::jsonb - 'coming_soon',
  updated_at = now()
where product_key = 'christmas_couple';

update public.christmas_products
set
  name = 'Pet Christmas',
  description = 'Christmas pet portraits for dogs and cats (not Secret Life packs).',
  metadata = coalesce(metadata, '{}'::jsonb) || '{"foundation":true,"live_offer":false,"portrait_vertical":true,"acquisition_routes":["/christmas/dogs","/christmas/cats"]}'::jsonb - 'coming_soon',
  updated_at = now()
where product_key = 'christmas_pet';

update public.christmas_products
set
  metadata = coalesce(metadata, '{}'::jsonb) || '{"foundation":true,"live_offer":false,"portrait_vertical":true}'::jsonb,
  updated_at = now()
where product_key = 'christmas_photo';

-- Draft packages (not purchasable)
insert into public.christmas_packages (
  product_id, package_key, package_name, description,
  currency, price_cents, compare_at_cents, active, purchasable, features, sort_order, metadata
)
select
  p.id,
  'single',
  case p.product_key
    when 'christmas_family' then 'Single family portrait'
    when 'christmas_couple' then 'Single couple portrait'
    when 'christmas_pet' then 'Single pet portrait'
    else 'Single portrait'
  end,
  'Draft package configuration — not a live public offer.',
  'usd',
  0,
  null,
  true,
  false,
  '["1 Christmas portrait"]'::jsonb,
  10,
  '{"live_offer":false,"note":"price unpublished; set purchasable + price in a later launch task"}'::jsonb
from public.christmas_products p
where p.product_key in ('christmas_family', 'christmas_couple', 'christmas_pet')
  and not exists (
    select 1 from public.christmas_packages pkg
    where pkg.product_id = p.id and pkg.package_key = 'single'
  );

-- Ensure photo package still non-purchasable / zero
update public.christmas_packages pkg
set purchasable = false,
    price_cents = 0,
    updated_at = now()
from public.christmas_products p
where pkg.product_id = p.id
  and p.product_key in ('christmas_photo', 'christmas_family', 'christmas_couple', 'christmas_pet')
  and pkg.package_key = 'single';

-- Seed vertical styles (server-owned). Photo styles already exist.
insert into public.christmas_styles (
  style_key, display_name, description, prompt_template, negative_hints, enabled, sort_order, product_keys
) values
(
  'classic_family_christmas',
  'Classic Family Christmas',
  'Warm traditional family portrait by the tree.',
  'Transform this family photo into a photoreal classic Christmas family portrait. Preserve the exact facial identity, approximate age, and likeness of every person. Keep the same number of people — do not add, remove, or clone anyone. Cohesive group posing near a decorated Christmas tree, soft warm lights, natural skin, no text, no watermark, no deformed hands.',
  'extra people, missing people, cloned faces, cartoon, text, watermark, deformed hands',
  true,
  10,
  array['christmas_family']::text[]
),
(
  'family_cozy_fireplace',
  'Cozy Fireplace',
  'Family gathered in firelight.',
  'Transform this family photo into a photoreal cozy fireplace Christmas portrait. Preserve every person''s exact identity and keep the same headcount. Warm fireplace glow, soft knit textures, natural grouping, no text, no watermark, no extra limbs.',
  'extra people, missing people, cartoon, text, watermark',
  true,
  20,
  array['christmas_family']::text[]
),
(
  'family_winter_wonderland',
  'Winter Wonderland',
  'Snowy outdoor family Christmas magic.',
  'Transform this family photo into a photoreal winter wonderland Christmas portrait. Preserve exact identities and the same number of people. Soft snow, evergreens, cool blue-hour light with warm lanterns. Natural proportions, no text, no watermark.',
  'extra people, missing people, cartoon, text, watermark',
  true,
  30,
  array['christmas_family']::text[]
),
(
  'family_elegant_christmas',
  'Elegant Christmas',
  'Refined holiday evening family portrait.',
  'Transform this family photo into a photoreal elegant Christmas evening portrait. Preserve every face identity and keep the same number of people. Tasteful gold accents, formal soft lighting, upscale holiday backdrop. No text, no watermark.',
  'extra people, missing people, cartoon, text, watermark',
  true,
  40,
  array['christmas_family']::text[]
),
(
  'family_christmas_morning',
  'Christmas Morning',
  'Soft morning light and festive calm.',
  'Transform this family photo into a photoreal Christmas morning portrait. Preserve exact identities and headcount. Soft daylight, subtle wrapping-paper tones, calm festive living room. Natural skin, no text, no watermark.',
  'extra people, missing people, cartoon, text, watermark',
  true,
  50,
  array['christmas_family']::text[]
),
(
  'family_luxury_christmas',
  'Luxury Christmas',
  'Polished boutique-holiday family portrait.',
  'Transform this family photo into a photoreal luxury Christmas portrait. Preserve exact identities and the same number of people. Refined décor, soft cinematic lighting, magazine-portrait quality without plastic skin. No text, no watermark.',
  'extra people, missing people, plastic skin, cartoon, text, watermark',
  true,
  60,
  array['christmas_family']::text[]
),
(
  'family_christmas_movie',
  'Christmas Movie',
  'Cinematic holiday still of the family.',
  'Transform this family photo into a photoreal Christmas-movie cinematic still. Preserve exact identities and headcount. Soft anamorphic bokeh, warm practical lights, storybook porch or living room. No logos, no text, no watermark.',
  'extra people, missing people, logos, cartoon, text, watermark',
  true,
  70,
  array['christmas_family']::text[]
),
(
  'family_vintage_christmas',
  'Vintage Family Christmas',
  'Nostalgic film-era family warmth.',
  'Transform this family photo into a photoreal vintage Christmas family portrait with gentle film grain. Preserve exact identities and the same number of people. Mid-century holiday décor cues, soft vignette, natural skin. No text, no watermark.',
  'extra people, missing people, cartoon, text, watermark, heavy filter obscuring faces',
  true,
  80,
  array['christmas_family']::text[]
),
(
  'romantic_snowfall',
  'Romantic Snowfall',
  'Soft snow and intimate winter light.',
  'Transform this couple photo into a photoreal romantic Christmas snowfall portrait. Preserve both people''s exact facial identities. Keep exactly two people — do not merge, clone, or drop either person. Soft falling snow, warm lantern glow, intimate pose, natural skin, no text, no watermark.',
  'one person, three people, merged faces, cartoon, text, watermark',
  true,
  10,
  array['christmas_couple']::text[]
),
(
  'couple_cozy_fireplace',
  'Cozy Fireplace',
  'Firelight couple portrait.',
  'Transform this couple photo into a photoreal cozy fireplace Christmas portrait. Preserve both identities exactly and keep two people only. Warm fireplace glow, soft textures, romantic but natural pose. No text, no watermark.',
  'one person, extra people, cartoon, text, watermark',
  true,
  20,
  array['christmas_couple']::text[]
),
(
  'couple_christmas_movie',
  'Christmas Movie',
  'Cinematic holiday couple still.',
  'Transform this couple photo into a photoreal Christmas-movie cinematic portrait. Preserve both faces exactly; keep two people. Soft bokeh, warm practical lights, storybook holiday street. No logos, no text, no watermark.',
  'one person, logos, cartoon, text, watermark',
  true,
  30,
  array['christmas_couple']::text[]
),
(
  'couple_elegant_christmas',
  'Elegant Christmas',
  'Evening formal couple portrait.',
  'Transform this couple photo into a photoreal elegant Christmas evening portrait. Preserve both identities; keep exactly two people. Tasteful gold accents, soft formal lighting. No text, no watermark.',
  'one person, extra people, cartoon, text, watermark',
  true,
  40,
  array['christmas_couple']::text[]
),
(
  'couple_winter_city',
  'Winter City',
  'City lights and winter coats.',
  'Transform this couple photo into a photoreal winter-city Christmas portrait. Preserve both identities; keep two people. Soft city bokeh, festive lights, realistic winter clothing. No text, no watermark.',
  'one person, cartoon, text, watermark',
  true,
  50,
  array['christmas_couple']::text[]
),
(
  'couple_christmas_market',
  'Christmas Market',
  'Festive market glow behind you.',
  'Transform this couple photo into a photoreal Christmas market portrait. Preserve both identities; keep exactly two people. Warm stall lights, subtle festive atmosphere, natural skin. No text, no watermark.',
  'one person, extra people, cartoon, text, watermark',
  true,
  60,
  array['christmas_couple']::text[]
),
(
  'couple_classic_portrait',
  'Classic Portrait',
  'Timeless studio-style couple Christmas look.',
  'Transform this couple photo into a photoreal classic Christmas couple portrait. Preserve both facial identities exactly; keep two people. Soft portrait lighting, subtle tree bokeh. No text, no watermark.',
  'one person, cartoon, text, watermark',
  true,
  70,
  array['christmas_couple']::text[]
),
(
  'couple_vintage_christmas',
  'Vintage Christmas',
  'Nostalgic film-era couple warmth.',
  'Transform this couple photo into a photoreal vintage Christmas portrait with gentle film grain. Preserve both identities; keep two people. Mid-century holiday cues, soft vignette. No text, no watermark.',
  'one person, cartoon, text, watermark, heavy filter',
  true,
  80,
  array['christmas_couple']::text[]
),
(
  'santa_pet',
  'Santa Pet',
  'Festive Santa-inspired pet portrait.',
  'Transform this pet photo into a photoreal Santa Christmas pet portrait. Preserve the exact species, coat colors, markings, and facial characteristics. Do not change the animal into a different species or add extra animals. Subtle festive Santa-hat or scarf prop only if it does not hide the face. Soft warm Christmas lighting, no text, no watermark.',
  'wrong species, extra animals, human face, cartoon, text, watermark',
  true,
  10,
  array['christmas_pet']::text[]
),
(
  'pet_cozy_christmas',
  'Cozy Christmas',
  'Firelight and soft blankets.',
  'Transform this pet photo into a photoreal cozy Christmas pet portrait. Preserve exact species, coat pattern, and face. Fireplace glow, soft textures, no extra animals, no text, no watermark.',
  'wrong species, extra animals, cartoon, text, watermark',
  true,
  20,
  array['christmas_pet']::text[]
),
(
  'pet_north_pole',
  'North Pole',
  'Snowy magical pet portrait.',
  'Transform this pet photo into a photoreal North Pole Christmas pet portrait. Preserve species, coat, and facial identity. Soft snow and aurora accents that stay realistic. No extra animals, no text, no watermark.',
  'wrong species, extra animals, cartoon, text, watermark',
  true,
  30,
  array['christmas_pet']::text[]
),
(
  'pet_christmas_sweater',
  'Christmas Sweater',
  'Festive knit without hiding identity.',
  'Transform this pet photo into a photoreal Christmas sweater pet portrait. Preserve exact species, markings, and face. A tasteful holiday sweater that does not obscure the face. Soft studio lighting, no extra animals, no text, no watermark.',
  'wrong species, face covered, extra animals, cartoon, text, watermark',
  true,
  40,
  array['christmas_pet']::text[]
),
(
  'pet_snow_portrait',
  'Snow Portrait',
  'Clean outdoor snow portrait.',
  'Transform this pet photo into a photoreal snow Christmas pet portrait. Preserve species, coat colors, and facial traits. Soft snowfall, evergreen bokeh, natural fur detail. No extra animals, no text, no watermark.',
  'wrong species, extra animals, cartoon, text, watermark',
  true,
  50,
  array['christmas_pet']::text[]
),
(
  'pet_christmas_card',
  'Christmas Card',
  'Greeting-card ready pet portrait.',
  'Transform this pet photo into a photoreal Christmas-card pet portrait. Preserve exact species and likeness. Clean festive backdrop suitable for a card, but no readable text, logos, or watermarks in the image. No extra animals.',
  'wrong species, text, logos, watermark, extra animals, cartoon',
  true,
  60,
  array['christmas_pet']::text[]
),
(
  'pet_royal_christmas',
  'Royal Christmas',
  'Regal holiday pet portrait.',
  'Transform this pet photo into a photoreal royal Christmas pet portrait. Preserve species, coat pattern, and face. Tasteful regal Christmas accents without distorting anatomy. No extra animals, no text, no watermark.',
  'wrong species, extra animals, deformed anatomy, cartoon, text, watermark',
  true,
  70,
  array['christmas_pet']::text[]
),
(
  'pet_vintage_christmas',
  'Vintage Christmas',
  'Nostalgic film-era pet portrait.',
  'Transform this pet photo into a photoreal vintage Christmas pet portrait with gentle film grain. Preserve exact species, markings, and facial identity. Soft vignette, warm nostalgic tones. No extra animals, no text, no watermark.',
  'wrong species, extra animals, cartoon, text, watermark',
  true,
  80,
  array['christmas_pet']::text[]
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

-- Tag existing photo styles
update public.christmas_styles
set product_keys = array['christmas_photo']::text[],
    updated_at = now()
where style_key in ('classic_christmas','winter_wonderland','santas_workshop','cozy_fireplace','elegant_christmas','north_pole','christmas_movie','vintage_christmas')
  and (product_keys is null or product_keys = array['christmas_photo']::text[] or cardinality(product_keys) = 0);

commit;

-- Additive Christmas Photo Generator schema.
-- Does not modify pet_* tables or prices.
-- Depends on 20260902120000_christmas_commerce_foundation.sql

begin;

-- ---------------------------------------------------------------------------
-- Styles (server-owned prompts)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_styles (
  style_key text primary key,
  display_name text not null,
  description text not null default '',
  thumbnail_path text,
  prompt_template text not null,
  negative_hints text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 100,
  product_keys text[] not null default array['christmas_photo']::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists christmas_styles_enabled_idx
  on public.christmas_styles (enabled, sort_order);

alter table public.christmas_styles enable row level security;

drop policy if exists christmas_styles_public_read on public.christmas_styles;
create policy christmas_styles_public_read
  on public.christmas_styles for select
  using (enabled = true or public.is_admin());

revoke all on table public.christmas_styles from anon, public;
grant select on table public.christmas_styles to anon, authenticated;
grant all on table public.christmas_styles to service_role;

insert into public.christmas_styles (
  style_key, display_name, description, prompt_template, negative_hints, enabled, sort_order
) values
(
  'classic_christmas',
  'Classic Christmas',
  'Warm traditional Christmas portrait lighting.',
  'Transform this photo into a photoreal classic Christmas portrait. Preserve the exact face identity, age, and likeness of every person. Place them in a timeless Christmas living-room scene with a decorated tree, soft warm lights, and gentle bokeh. Natural skin texture, flattering portrait lighting, no text, no watermark, no extra people, no deformed hands.',
  'cartoon, anime, text, watermark, extra limbs, deformed face',
  true,
  10
),
(
  'winter_wonderland',
  'Winter Wonderland',
  'Snowy outdoor Christmas magic.',
  'Transform this photo into a photoreal winter wonderland Christmas portrait. Preserve exact facial identity and likeness. Soft falling snow, evergreen trees, cool blue-hour light mixed with warm lantern glow. Natural skin, cinematic but realistic, no text, no watermark, no extra people.',
  'cartoon, text, watermark, plastic skin, extra limbs',
  true,
  20
),
(
  'santas_workshop',
  'Santa''s Workshop',
  'Cozy North Pole workshop ambiance.',
  'Transform this photo into a photoreal Santa''s workshop Christmas portrait. Preserve exact facial identity and likeness. Background of wooden toys, warm workshop lamps, subtle festive props. Keep the person as the hero subject. Natural proportions, no text, no watermark, no costume forced onto face.',
  'cartoon, text, watermark, uncanny face morph',
  true,
  30
),
(
  'cozy_fireplace',
  'Cozy Fireplace',
  'Firelight glow and soft blankets.',
  'Transform this photo into a photoreal cozy fireplace Christmas portrait. Preserve exact facial identity and likeness. Warm fireplace glow, soft knit textures, intimate holiday atmosphere. Natural skin, shallow depth of field, no text, no watermark, no extra limbs.',
  'cartoon, text, watermark, melted face',
  true,
  40
),
(
  'elegant_christmas',
  'Elegant Christmas',
  'Refined holiday evening portrait.',
  'Transform this photo into a photoreal elegant Christmas evening portrait. Preserve exact facial identity and likeness. Tasteful gold accents, formal soft lighting, upscale holiday backdrop. Photoreal fashion-portrait quality, no text, no watermark, no extra people.',
  'cartoon, text, watermark, oversharpened skin',
  true,
  50
),
(
  'north_pole',
  'North Pole',
  'Aurora sky and icy magic.',
  'Transform this photo into a photoreal North Pole Christmas portrait. Preserve exact facial identity and likeness. Soft aurora sky, snow crystals, magical but realistic atmosphere. Natural face detail, no text, no watermark, no deformed anatomy.',
  'cartoon, text, watermark, neon overload',
  true,
  60
),
(
  'christmas_movie',
  'Christmas Movie',
  'Cinematic holiday still-frame look.',
  'Transform this photo into a photoreal Christmas-movie cinematic portrait. Preserve exact facial identity and likeness. Soft anamorphic bokeh, warm practical lights, storybook holiday street or porch. Film still aesthetic, no logos, no text, no watermark.',
  'cartoon, text, watermark, logo, title card',
  true,
  70
),
(
  'vintage_christmas',
  'Vintage Christmas',
  'Nostalgic film-era Christmas warmth.',
  'Transform this photo into a photoreal vintage Christmas portrait with gentle film grain and warm nostalgic tones. Preserve exact facial identity and likeness. Mid-century holiday décor cues, soft vignette, natural skin, no text, no watermark, no heavy filters that hide the face.',
  'cartoon, text, watermark, heavy filter that obscures identity',
  true,
  80
)
on conflict (style_key) do nothing;

-- ---------------------------------------------------------------------------
-- Order extensions for photo generator
-- ---------------------------------------------------------------------------

alter table public.christmas_orders
  add column if not exists style_key text,
  add column if not exists source_bucket text,
  add column if not exists source_path text,
  add column if not exists source_content_type text,
  add column if not exists source_byte_size integer,
  add column if not exists source_width integer,
  add column if not exists source_height integer,
  add column if not exists generation_started_at timestamptz,
  add column if not exists generation_finished_at timestamptz,
  add column if not exists model_name text,
  add column if not exists model_version text,
  add column if not exists replicate_prediction_id text,
  add column if not exists result_asset_id uuid;

create index if not exists christmas_orders_style_idx
  on public.christmas_orders (style_key, created_at desc);

-- ---------------------------------------------------------------------------
-- Generation jobs
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  status text not null default 'queued',
  attempt_number integer not null default 0,
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error text,
  provider text,
  model_name text,
  prediction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_generation_jobs_status_chk check (
    status in ('queued', 'running', 'succeeded', 'failed', 'held')
  ),
  constraint christmas_generation_jobs_attempt_chk check (attempt_number >= 0)
);

create unique index if not exists christmas_generation_jobs_order_uidx
  on public.christmas_generation_jobs (order_id);

create index if not exists christmas_generation_jobs_status_idx
  on public.christmas_generation_jobs (status, created_at desc);

drop trigger if exists christmas_generation_jobs_touch_updated_at on public.christmas_generation_jobs;
create trigger christmas_generation_jobs_touch_updated_at
before update on public.christmas_generation_jobs
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_generation_jobs enable row level security;

drop policy if exists christmas_generation_jobs_admin_read on public.christmas_generation_jobs;
create policy christmas_generation_jobs_admin_read
  on public.christmas_generation_jobs for select
  using (public.is_admin());

revoke all on table public.christmas_generation_jobs from anon, authenticated, public;
grant select on table public.christmas_generation_jobs to authenticated;
grant all on table public.christmas_generation_jobs to service_role;

create or replace function public.claim_christmas_generation_job(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.christmas_generation_jobs%rowtype;
begin
  insert into public.christmas_generation_jobs (order_id, status, attempt_number)
  values (p_order_id, 'queued', 0)
  on conflict (order_id) do nothing;

  select * into job_row
  from public.christmas_generation_jobs
  where order_id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'missing_job');
  end if;

  if job_row.status = 'running' and job_row.claimed_at is not null
     and job_row.claimed_at > now() - interval '3 minutes' then
    return jsonb_build_object('claimed', false, 'status', 'already_running');
  end if;

  if job_row.status = 'succeeded' then
    return jsonb_build_object('claimed', false, 'status', 'already_succeeded');
  end if;

  update public.christmas_generation_jobs
  set
    status = 'running',
    attempt_number = attempt_number + 1,
    claimed_at = now(),
    last_error = null
  where order_id = p_order_id
  returning * into job_row;

  update public.christmas_orders
  set
    fulfillment_status = 'processing',
    generation_started_at = coalesce(generation_started_at, now())
  where id = p_order_id;

  return jsonb_build_object(
    'claimed', true,
    'status', job_row.status,
    'attempt_number', job_row.attempt_number
  );
end;
$$;

revoke all on function public.claim_christmas_generation_job(uuid) from anon, authenticated, public;
grant execute on function public.claim_christmas_generation_job(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage buckets (private)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('christmas-source', 'christmas-source', false, 15728640, array['image/jpeg','image/png','image/webp']),
  ('christmas-generated', 'christmas-generated', false, 20971520, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- No public storage policies — service role / signed URLs only.

commit;

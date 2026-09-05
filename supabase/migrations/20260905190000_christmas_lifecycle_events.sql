-- Christmas commerce lifecycle email ledger + marketing suppression seam.
-- Backward-compatible: christmas_orders.locale already exists (default 'en').
-- Does not touch send-a-gift / gift-tree schemas.

create table if not exists public.christmas_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  template_key text not null,
  channel text not null default 'email',
  category text not null,
  locale text not null default 'en',
  status text not null default 'queued',
  order_id uuid references public.christmas_orders (id) on delete set null,
  product_key text,
  email_normalized text,
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_lifecycle_events_channel_chk check (channel in ('email')),
  constraint christmas_lifecycle_events_category_chk check (
    category in ('transactional', 'marketing')
  ),
  constraint christmas_lifecycle_events_status_chk check (
    status in ('queued', 'sending', 'sent', 'failed', 'suppressed', 'skipped', 'dry_run')
  ),
  constraint christmas_lifecycle_events_locale_chk check (locale in ('en', 'ro')),
  constraint christmas_lifecycle_events_attempt_chk check (attempt_count >= 0)
);

create unique index if not exists christmas_lifecycle_events_event_key_uidx
  on public.christmas_lifecycle_events (event_key);

create index if not exists christmas_lifecycle_events_order_idx
  on public.christmas_lifecycle_events (order_id, created_at desc);

create index if not exists christmas_lifecycle_events_status_idx
  on public.christmas_lifecycle_events (status, created_at desc);

create index if not exists christmas_lifecycle_events_template_idx
  on public.christmas_lifecycle_events (template_key, created_at desc);

drop trigger if exists christmas_lifecycle_events_touch_updated_at on public.christmas_lifecycle_events;
create trigger christmas_lifecycle_events_touch_updated_at
before update on public.christmas_lifecycle_events
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_lifecycle_events enable row level security;

drop policy if exists christmas_lifecycle_events_admin_read on public.christmas_lifecycle_events;
create policy christmas_lifecycle_events_admin_read
  on public.christmas_lifecycle_events for select
  using (public.is_admin());

revoke all on table public.christmas_lifecycle_events from anon, authenticated, public;
grant select on table public.christmas_lifecycle_events to authenticated;
grant all on table public.christmas_lifecycle_events to service_role;

-- Atomic claim for cron/workers: only one sender wins per event_key.
create or replace function public.claim_christmas_lifecycle_event(
  p_event_key text,
  p_template_key text,
  p_category text,
  p_locale text default 'en',
  p_order_id uuid default null,
  p_product_key text default null,
  p_email_normalized text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.christmas_lifecycle_events%rowtype;
  inserted public.christmas_lifecycle_events%rowtype;
  loc text := case when lower(coalesce(p_locale, 'en')) = 'ro' then 'ro' else 'en' end;
begin
  if p_event_key is null or length(trim(p_event_key)) < 3 then
    return jsonb_build_object('ok', false, 'code', 'invalid_event_key');
  end if;
  if p_category not in ('transactional', 'marketing') then
    return jsonb_build_object('ok', false, 'code', 'invalid_category');
  end if;

  select * into existing
  from public.christmas_lifecycle_events
  where event_key = p_event_key;

  if found then
    if existing.status in ('sent', 'dry_run', 'suppressed', 'skipped') then
      return jsonb_build_object(
        'ok', true,
        'claimed', false,
        'already_final', true,
        'status', existing.status,
        'id', existing.id
      );
    end if;
    if existing.status = 'sending'
       and existing.claimed_at is not null
       and existing.claimed_at > now() - interval '10 minutes' then
      return jsonb_build_object(
        'ok', true,
        'claimed', false,
        'in_flight', true,
        'status', existing.status,
        'id', existing.id
      );
    end if;
    update public.christmas_lifecycle_events
    set
      status = 'sending',
      claimed_at = now(),
      attempt_count = attempt_count + 1,
      locale = loc,
      template_key = p_template_key,
      category = p_category,
      order_id = coalesce(p_order_id, order_id),
      product_key = coalesce(p_product_key, product_key),
      email_normalized = coalesce(p_email_normalized, email_normalized),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
    where id = existing.id
      and status in ('queued', 'failed', 'sending')
    returning * into inserted;
    if not found then
      return jsonb_build_object('ok', true, 'claimed', false, 'status', existing.status, 'id', existing.id);
    end if;
    return jsonb_build_object(
      'ok', true,
      'claimed', true,
      'status', inserted.status,
      'id', inserted.id,
      'attempt_count', inserted.attempt_count
    );
  end if;

  insert into public.christmas_lifecycle_events (
    event_key, template_key, category, locale, status,
    order_id, product_key, email_normalized, metadata,
    attempt_count, claimed_at
  ) values (
    p_event_key, p_template_key, p_category, loc, 'sending',
    p_order_id, p_product_key, p_email_normalized, coalesce(p_metadata, '{}'::jsonb),
    1, now()
  )
  on conflict (event_key) do nothing
  returning * into inserted;

  if inserted.id is null then
    select * into existing from public.christmas_lifecycle_events where event_key = p_event_key;
    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'already_final', existing.status in ('sent', 'dry_run', 'suppressed', 'skipped'),
      'status', existing.status,
      'id', existing.id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'status', inserted.status,
    'id', inserted.id,
    'attempt_count', inserted.attempt_count
  );
end;
$$;

revoke all on function public.claim_christmas_lifecycle_event(text, text, text, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_christmas_lifecycle_event(text, text, text, text, uuid, text, text, jsonb) to service_role;

comment on table public.christmas_lifecycle_events is
  'Idempotent Christmas suite lifecycle email ledger (secondary gap loop). Marketing sends gated by env + email_preferences.';

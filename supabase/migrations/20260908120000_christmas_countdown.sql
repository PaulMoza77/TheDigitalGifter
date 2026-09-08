-- Christmas countdown admin: configurable hub copy, first-party signups, admin analytics RPCs.
-- Additive. Does not alter Pet schema or existing Christmas commerce tables.

begin;

-- ---------------------------------------------------------------------------
-- Settings (public-safe copy; no secrets)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_countdown_settings (
  id text primary key default 'default',
  campaign_year integer not null default 2026,
  countdown_target_at timestamptz not null default timestamptz '2026-12-25 00:00:00+00',
  page_active boolean not null default true,
  signup_active boolean not null default true,
  headline text not null default 'Create Magical Christmas Cards with AI',
  supporting_copy text not null default 'Transform your holiday memories into stunning, personalized Christmas cards in seconds. No design skills needed — just upload, customize, and let our AI work its magic.',
  cta_text text not null default 'Start Creating',
  success_message text not null default 'You''re on the list. We''ll be in touch before Christmas.',
  reached_message text not null default 'Christmas is here. Create something worth sending.',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.christmas_countdown_settings (id)
values ('default')
on conflict (id) do nothing;

drop trigger if exists christmas_countdown_settings_touch_updated_at on public.christmas_countdown_settings;
create trigger christmas_countdown_settings_touch_updated_at
before update on public.christmas_countdown_settings
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_countdown_settings enable row level security;

drop policy if exists christmas_countdown_settings_public_read on public.christmas_countdown_settings;
create policy christmas_countdown_settings_public_read
  on public.christmas_countdown_settings for select
  using (true);

drop policy if exists christmas_countdown_settings_admin_update on public.christmas_countdown_settings;
create policy christmas_countdown_settings_admin_update
  on public.christmas_countdown_settings for update
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.christmas_countdown_settings from anon, authenticated, public;
grant select on table public.christmas_countdown_settings to anon, authenticated;
grant update on table public.christmas_countdown_settings to authenticated;
grant all on table public.christmas_countdown_settings to service_role;

-- ---------------------------------------------------------------------------
-- Signups (PII — admin read only; writes via security-definer RPC)
-- ---------------------------------------------------------------------------

create table if not exists public.christmas_countdown_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text generated always as (lower(trim(email))) stored,
  user_id uuid,
  signup_method text not null,
  campaign_year integer not null default 2026,
  source text,
  medium text,
  campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_page text,
  funnel_session_id uuid,
  marketing_opt_in boolean not null default false,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint christmas_countdown_signups_method_chk
    check (signup_method in ('email', 'google')),
  constraint christmas_countdown_signups_email_chk
    check (position('@' in email) > 1)
);

create unique index if not exists christmas_countdown_signups_year_email_uidx
  on public.christmas_countdown_signups (campaign_year, email_normalized);

create index if not exists christmas_countdown_signups_created_idx
  on public.christmas_countdown_signups (created_at desc);

create index if not exists christmas_countdown_signups_method_idx
  on public.christmas_countdown_signups (signup_method, created_at desc);

create index if not exists christmas_countdown_signups_source_idx
  on public.christmas_countdown_signups (source, campaign, created_at desc);

drop trigger if exists christmas_countdown_signups_touch_updated_at on public.christmas_countdown_signups;
create trigger christmas_countdown_signups_touch_updated_at
before update on public.christmas_countdown_signups
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_countdown_signups enable row level security;

drop policy if exists christmas_countdown_signups_admin_read on public.christmas_countdown_signups;
create policy christmas_countdown_signups_admin_read
  on public.christmas_countdown_signups for select
  using (public.is_admin());

revoke all on table public.christmas_countdown_signups from anon, authenticated, public;
grant select on table public.christmas_countdown_signups to authenticated;
grant all on table public.christmas_countdown_signups to service_role;

-- ---------------------------------------------------------------------------
-- Public config RPC (anon-safe; never returns emails)
-- ---------------------------------------------------------------------------

create or replace function public.public_christmas_countdown_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.christmas_countdown_settings;
begin
  select * into row from public.christmas_countdown_settings where id = 'default';
  if not found then
    return jsonb_build_object(
      'campaign_year', 2026,
      'countdown_target_at', '2026-12-25T00:00:00.000Z',
      'page_active', true,
      'signup_active', true,
      'headline', 'Create Magical Christmas Cards with AI',
      'supporting_copy', 'Transform your holiday memories into stunning, personalized Christmas cards in seconds. No design skills needed — just upload, customize, and let our AI work its magic.',
      'cta_text', 'Start Creating',
      'success_message', 'You''re on the list. We''ll be in touch before Christmas.',
      'reached_message', 'Christmas is here. Create something worth sending.'
    );
  end if;
  return jsonb_build_object(
    'campaign_year', row.campaign_year,
    'countdown_target_at', row.countdown_target_at,
    'page_active', row.page_active,
    'signup_active', row.signup_active,
    'headline', row.headline,
    'supporting_copy', row.supporting_copy,
    'cta_text', row.cta_text,
    'success_message', row.success_message,
    'reached_message', row.reached_message
  );
end;
$$;

revoke all on function public.public_christmas_countdown_config() from public;
grant execute on function public.public_christmas_countdown_config() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Signup RPC — first-touch attribution; no marketing auto-subscribe
-- ---------------------------------------------------------------------------

create or replace function public.register_christmas_countdown_signup(
  p_email text,
  p_signup_method text,
  p_user_id uuid default null,
  p_source text default null,
  p_medium text default null,
  p_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_referrer text default null,
  p_landing_page text default null,
  p_funnel_session_id uuid default null,
  p_marketing_opt_in boolean default false,
  p_campaign_year integer default 2026
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_method text;
  v_year integer;
  v_user uuid;
  v_jwt_email text;
  existing public.christmas_countdown_signups;
  created boolean := false;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  v_method := lower(trim(coalesce(p_signup_method, '')));
  v_year := coalesce(p_campaign_year, 2026);
  v_user := p_user_id;
  v_jwt_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));

  if v_method not in ('email', 'google') then
    raise exception 'invalid_signup_method';
  end if;
  if v_email = '' or position('@' in v_email) < 2 or char_length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  if v_year < 2024 or v_year > 2100 then
    raise exception 'invalid_campaign_year';
  end if;

  if v_method = 'google' then
    if auth.uid() is null then
      raise exception 'google_auth_required';
    end if;
    if v_user is not null and v_user <> auth.uid() then
      raise exception 'user_mismatch';
    end if;
    v_user := auth.uid();
    if v_jwt_email <> '' then
      v_email := v_jwt_email;
    end if;
  else
    -- Unauthenticated email capture: ignore a spoofed user_id.
    if auth.uid() is null then
      v_user := null;
    else
      v_user := auth.uid();
    end if;
  end if;

  select * into existing
  from public.christmas_countdown_signups
  where campaign_year = v_year
    and email_normalized = v_email
  for update;

  if found then
    update public.christmas_countdown_signups
    set
      last_seen_at = now(),
      user_id = coalesce(public.christmas_countdown_signups.user_id, v_user),
      signup_method = case
        when public.christmas_countdown_signups.signup_method = 'email' and v_method = 'google' then 'google'
        else public.christmas_countdown_signups.signup_method
      end,
      marketing_opt_in = public.christmas_countdown_signups.marketing_opt_in or coalesce(p_marketing_opt_in, false),
      funnel_session_id = coalesce(public.christmas_countdown_signups.funnel_session_id, p_funnel_session_id)
    where id = existing.id;
    return jsonb_build_object('ok', true, 'id', existing.id, 'created', false, 'duplicate', true);
  end if;

  insert into public.christmas_countdown_signups (
    email, user_id, signup_method, campaign_year,
    source, medium, campaign, utm_content, utm_term,
    referrer, landing_page, funnel_session_id, marketing_opt_in
  ) values (
    v_email,
    v_user,
    v_method,
    v_year,
    nullif(btrim(coalesce(p_source, '')), ''),
    nullif(btrim(coalesce(p_medium, '')), ''),
    nullif(btrim(coalesce(p_campaign, '')), ''),
    nullif(btrim(coalesce(p_utm_content, '')), ''),
    nullif(btrim(coalesce(p_utm_term, '')), ''),
    nullif(btrim(coalesce(p_referrer, '')), ''),
    nullif(btrim(coalesce(p_landing_page, '')), ''),
    p_funnel_session_id,
    coalesce(p_marketing_opt_in, false)
  )
  returning * into existing;

  created := true;

  -- Opt-in only. Never auto-subscribe. Compatible with unsubscribe_marketing.
  if coalesce(p_marketing_opt_in, false) then
    begin
      insert into public.email_preferences (email, user_id, marketing, updated_at)
      values (v_email, v_user, true, now())
      on conflict (email) do update
        set marketing = true,
            updated_at = now(),
            user_id = coalesce(public.email_preferences.user_id, excluded.user_id);
    exception when unique_violation then
      null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'id', existing.id, 'created', created, 'duplicate', false);
end;
$$;

revoke all on function public.register_christmas_countdown_signup(
  text, text, uuid, text, text, text, text, text, text, text, uuid, boolean, integer
) from public;
grant execute on function public.register_christmas_countdown_signup(
  text, text, uuid, text, text, text, text, text, text, text, uuid, boolean, integer
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin first-party KPIs (no PII)
-- ---------------------------------------------------------------------------

create or replace function public.admin_christmas_countdown_kpis(
  p_from timestamptz,
  p_to timestamptz,
  p_campaign_year integer default 2026
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_from, timestamptz '2024-01-01 00:00:00+00');
  v_to timestamptz := coalesce(p_to, now());
  signups_total integer := 0;
  signups_email integer := 0;
  signups_google integer := 0;
  signups_returning integer := 0;
  page_views integer := 0;
  join_started integer := 0;
  join_completed integer := 0;
  google_started integer := 0;
  google_completed integer := 0;
  return_visits integer := 0;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select
    count(*)::integer,
    count(*) filter (where signup_method = 'email')::integer,
    count(*) filter (where signup_method = 'google')::integer,
    count(*) filter (where last_seen_at > created_at + interval '12 hours')::integer
  into signups_total, signups_email, signups_google, signups_returning
  from public.christmas_countdown_signups
  where campaign_year = coalesce(p_campaign_year, 2026)
    and created_at >= v_from
    and created_at <= v_to;

  select
    count(distinct funnel_session_id) filter (where event_name = 'christmas_page_view' and coalesce(pathname, '') in ('/christmas', '/christmas/'))::integer,
    count(distinct funnel_session_id) filter (where event_name = 'christmas_join_started')::integer,
    count(distinct funnel_session_id) filter (where event_name = 'christmas_join_completed')::integer,
    count(distinct funnel_session_id) filter (where event_name = 'christmas_google_auth_started')::integer,
    count(distinct funnel_session_id) filter (where event_name = 'christmas_google_auth_completed')::integer,
    count(distinct funnel_session_id) filter (where event_name = 'christmas_return_visit')::integer
  into page_views, join_started, join_completed, google_started, google_completed, return_visits
  from public.christmas_funnel_events
  where coalesce(is_test, false) = false
    and created_at >= v_from
    and created_at <= v_to
    and coalesce(pathname, '') like '/christmas%';

  return jsonb_build_object(
    'signups_total', coalesce(signups_total, 0),
    'signups_email', coalesce(signups_email, 0),
    'signups_google', coalesce(signups_google, 0),
    'signups_returning', coalesce(signups_returning, 0),
    'first_party_page_view_sessions', coalesce(page_views, 0),
    'join_started_sessions', coalesce(join_started, 0),
    'join_completed_sessions', coalesce(join_completed, 0),
    'google_auth_started_sessions', coalesce(google_started, 0),
    'google_auth_completed_sessions', coalesce(google_completed, 0),
    'return_visit_sessions', coalesce(return_visits, 0)
  );
end;
$$;

revoke all on function public.admin_christmas_countdown_kpis(timestamptz, timestamptz, integer) from public;
grant execute on function public.admin_christmas_countdown_kpis(timestamptz, timestamptz, integer)
  to authenticated, service_role;

commit;

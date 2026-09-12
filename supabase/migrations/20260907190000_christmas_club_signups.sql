-- Christmas Club acquisition signups.
-- Additive. Guest email + authenticated Google. No advent calendar backend.

begin;

create table if not exists public.christmas_club_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  signup_method text not null default 'email',
  source text not null default 'christmas_club_landing',
  campaign_key text not null default 'christmas_club',
  campaign_year integer not null,
  locale text not null default 'en',
  landing_path text,
  funnel_session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  affiliate_ref text,
  status text not null default 'joined',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint christmas_club_signups_email_chk check (
    char_length(email) between 5 and 254 and position('@' in email) > 1
  ),
  constraint christmas_club_signups_method_chk check (
    signup_method in ('email', 'google')
  ),
  constraint christmas_club_signups_status_chk check (
    status in ('joined', 'unsubscribed')
  ),
  constraint christmas_club_signups_year_chk check (
    campaign_year between 2024 and 2100
  ),
  constraint christmas_club_signups_locale_chk check (char_length(locale) between 2 and 16)
);

create unique index if not exists christmas_club_signups_email_year_uidx
  on public.christmas_club_signups (lower(email), campaign_year);

create unique index if not exists christmas_club_signups_user_year_uidx
  on public.christmas_club_signups (user_id, campaign_year)
  where user_id is not null;

create index if not exists christmas_club_signups_created_idx
  on public.christmas_club_signups (campaign_year, created_at desc);

create index if not exists christmas_club_signups_source_idx
  on public.christmas_club_signups (source, campaign_year);

drop trigger if exists christmas_club_signups_touch on public.christmas_club_signups;
create trigger christmas_club_signups_touch
before update on public.christmas_club_signups
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_club_signups enable row level security;

drop policy if exists christmas_club_signups_admin_select on public.christmas_club_signups;
create policy christmas_club_signups_admin_select
  on public.christmas_club_signups for select
  using (public.is_admin());

drop policy if exists christmas_club_signups_owner_select on public.christmas_club_signups;
create policy christmas_club_signups_owner_select
  on public.christmas_club_signups for select
  using (user_id is not null and user_id = auth.uid());

revoke all on table public.christmas_club_signups from anon, authenticated, public;
grant select on table public.christmas_club_signups to authenticated;
grant all on table public.christmas_club_signups to service_role;

commit;

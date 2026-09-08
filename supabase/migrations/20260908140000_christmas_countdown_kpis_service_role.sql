-- Allow service-role callers (Edge / origin after assertAdmin) to read countdown KPIs.
-- is_admin() is keyed to the caller's JWT email; the service role has none, so the
-- original check returned "forbidden" and the admin UI showed dashes / 0% conversion.

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
  if auth.role() is distinct from 'service_role' and not public.is_admin() then
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

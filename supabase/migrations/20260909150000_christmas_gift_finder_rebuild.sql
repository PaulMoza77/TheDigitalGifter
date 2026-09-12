-- Gift Finder rebuild: personality, personal detail, ranking role
-- Additive. Preserves existing sessions.

begin;

alter table public.christmas_gift_finder_sessions
  add column if not exists personality_keys text[] not null default '{}';

alter table public.christmas_gift_finder_sessions
  add column if not exists personal_detail text not null default '';

alter table public.christmas_gift_finder_sessions
  drop constraint if exists christmas_gift_finder_sessions_personal_detail_chk;

alter table public.christmas_gift_finder_sessions
  add constraint christmas_gift_finder_sessions_personal_detail_chk
  check (char_length(personal_detail) <= 280);

alter table public.christmas_gift_finder_results
  add column if not exists ranking_role text;

alter table public.christmas_gift_finder_results
  add column if not exists gift_type text;

comment on column public.christmas_gift_finder_sessions.personal_detail is
  'Optional free-text context for generation only. Never send to analytics/ads.';

comment on column public.christmas_gift_finder_results.ranking_role is
  'Curated role: best_match | safe_choice | meaningful | experience | unexpected';

commit;

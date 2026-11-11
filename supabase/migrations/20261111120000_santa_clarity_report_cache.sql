-- Dedicated service-role cache: at most four scheduled attempts per 24 hours.
create table if not exists public.santa_clarity_report_cache (
  id boolean primary key default true check (id),
  next_attempt_at timestamptz not null default '-infinity',
  report jsonb
);
alter table public.santa_clarity_report_cache enable row level security;
revoke all on public.santa_clarity_report_cache from public, anon, authenticated;
grant select, insert, update on public.santa_clarity_report_cache to service_role;
insert into public.santa_clarity_report_cache(id) values(true) on conflict do nothing;
create or replace function public.claim_santa_clarity_report() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cached public.santa_clarity_report_cache; claimed boolean := false;
begin
  select * into cached from public.santa_clarity_report_cache where id = true for update;
  if cached.next_attempt_at <= now() then
    update public.santa_clarity_report_cache set next_attempt_at = now() + interval '6 hours' where id = true;
    claimed := true;
  end if;
  return jsonb_build_object('claimed', claimed, 'report', cached.report);
end;
$$;
revoke all on function public.claim_santa_clarity_report() from public, anon, authenticated;
grant execute on function public.claim_santa_clarity_report() to service_role;

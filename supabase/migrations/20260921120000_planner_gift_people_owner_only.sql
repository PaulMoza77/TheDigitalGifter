-- Gift recipients and gift items are private to the signed-in planner owner.

begin;

create or replace function public.christmas_planner_owns_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.christmas_planner_profiles p
      where p.id = p_profile_id
        and p.user_id = auth.uid()
    );
$$;

revoke all on function public.christmas_planner_owns_profile(uuid) from public, anon;
grant execute on function public.christmas_planner_owns_profile(uuid) to authenticated;

alter table public.christmas_gift_recipients enable row level security;
alter table public.christmas_gift_recipients force row level security;
alter table public.christmas_gift_items enable row level security;
alter table public.christmas_gift_items force row level security;
alter table public.christmas_planner_profiles enable row level security;
alter table public.christmas_planner_profiles force row level security;

drop policy if exists christmas_gift_recipients_owner_all on public.christmas_gift_recipients;
create policy christmas_gift_recipients_owner_all
  on public.christmas_gift_recipients for all
  using (public.christmas_planner_owns_profile(profile_id))
  with check (public.christmas_planner_owns_profile(profile_id));

drop policy if exists christmas_gift_items_owner_all on public.christmas_gift_items;
create policy christmas_gift_items_owner_all
  on public.christmas_gift_items for all
  using (public.christmas_planner_owns_profile(profile_id))
  with check (public.christmas_planner_owns_profile(profile_id));

drop policy if exists christmas_planner_profiles_owner_all on public.christmas_planner_profiles;
create policy christmas_planner_profiles_owner_all
  on public.christmas_planner_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;

-- Additive recipe metadata for Founding Pass catalog ingest.
alter table public.christmas_recipes
  add column if not exists notes text not null default '',
  add column if not exists cost_band text,
  add column if not exists cuisine text;

alter table public.christmas_grocery_items
  add column if not exists source_notes text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'christmas_recipes_cost_band_chk'
  ) then
    alter table public.christmas_recipes
      add constraint christmas_recipes_cost_band_chk
      check (cost_band is null or cost_band in ('low', 'mid', 'high'));
  end if;
end $$;

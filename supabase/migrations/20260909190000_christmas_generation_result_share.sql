-- Durable Christmas result sharing. Private by default; capability token is hash-only.
-- Additive. Does not enable checkout or any purchasable flag.

begin;

create table if not exists public.christmas_generation_shares (
  generation_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.christmas_orders (id) on delete cascade,
  asset_id uuid not null references public.christmas_order_assets (id) on delete cascade,
  share_token_hash text not null,
  share_enabled boolean not null default false,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint christmas_generation_shares_token_chk check (length(share_token_hash) = 64)
);

create unique index if not exists christmas_generation_shares_order_uidx
  on public.christmas_generation_shares (order_id);
create unique index if not exists christmas_generation_shares_asset_uidx
  on public.christmas_generation_shares (asset_id);
create index if not exists christmas_generation_shares_token_idx
  on public.christmas_generation_shares (share_token_hash)
  where share_enabled = true;

drop trigger if exists christmas_generation_shares_touch on public.christmas_generation_shares;
create trigger christmas_generation_shares_touch
before update on public.christmas_generation_shares
for each row execute function public.christmas_touch_updated_at();

alter table public.christmas_generation_shares enable row level security;

-- No browser role can inspect capability hashes or share rows directly.
revoke all on table public.christmas_generation_shares from anon, authenticated, public;
grant all on table public.christmas_generation_shares to service_role;

commit;

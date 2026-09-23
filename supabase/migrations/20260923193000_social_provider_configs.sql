-- Server-only OAuth client config for social providers.
-- Not exposed via PostgREST to anon/authenticated. Edge reads with service_role.

begin;

create table if not exists public.social_provider_configs (
  provider text primary key check (provider in ('meta', 'tiktok', 'youtube')),
  client_id text,
  client_secret_ciphertext text,
  redirect_uri text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

revoke all on public.social_provider_configs from public, anon, authenticated;
grant select, insert, update, delete on public.social_provider_configs to service_role;

commit;

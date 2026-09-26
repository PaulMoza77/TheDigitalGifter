-- Public generator billing and private source photos.
-- The existing debit_credits_on_generation_complete trigger is unchanged:
-- it debits once when status becomes completed, keyed by note generation:<id>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generator-sources',
  'generator-sources',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists generator_sources_owner_insert on storage.objects;
create policy generator_sources_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'generator-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists generator_sources_owner_select on storage.objects;
create policy generator_sources_owner_select
on storage.objects for select to authenticated
using (
  bucket_id = 'generator-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists generator_sources_owner_delete on storage.objects;
create policy generator_sources_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'generator-sources'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create or replace function public.freeze_public_generation_client_write()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.credit_cost := 1;
    new.credits := 1;
    new.final_image_url := null;
    new.result_image_url := null;
    new.error := null;
    return new;
  end if;

  new.status := old.status;
  new.credit_cost := old.credit_cost;
  new.credits := old.credits;
  new.final_image_url := old.final_image_url;
  new.result_image_url := old.result_image_url;
  new.preview_image_url := old.preview_image_url;
  new.error := old.error;
  new.prompt := old.prompt;
  new.metadata := old.metadata;
  new.source_image_url := old.source_image_url;
  return new;
end;
$$;

drop trigger if exists trg_freeze_public_generation_client_write on public.generations;
create trigger trg_freeze_public_generation_client_write
before insert or update on public.generations
for each row
execute function public.freeze_public_generation_client_write();

create or replace function public.claim_public_generator_submit(p_id uuid, p_claim text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.generations;
  existing_claim text;
  claimed_at timestamptz;
  stale boolean;
begin
  select * into row from public.generations where id = p_id for update;
  if row.id is null then
    return jsonb_build_object('claimed', false, 'missing', true);
  end if;

  if row.status = 'completed' and coalesce(row.final_image_url, row.result_image_url, '') <> '' then
    return jsonb_build_object('claimed', false, 'status', row.status, 'metadata', row.metadata);
  end if;

  if coalesce(row.metadata->>'provider_request_id', '') <> ''
     or coalesce(row.metadata->>'provider_output_url', '') <> '' then
    return jsonb_build_object('claimed', false, 'status', row.status, 'metadata', row.metadata);
  end if;

  existing_claim := coalesce(row.metadata->>'submit_claim', '');
  stale := false;
  if existing_claim <> '' and existing_claim <> p_claim then
    begin
      claimed_at := (row.metadata->>'submit_claimed_at')::timestamptz;
      stale := claimed_at < now() - interval '3 minutes';
    exception when others then
      stale := false;
    end;
    if not stale and row.status is distinct from 'failed' and row.status is distinct from 'error' then
      return jsonb_build_object('claimed', false, 'status', row.status, 'metadata', row.metadata);
    end if;
  end if;

  update public.generations
  set
    status = 'processing',
    error = null,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'submit_claim', p_claim,
      'submit_claimed_at', now()
    )
  where id = p_id
  returning * into row;

  return jsonb_build_object('claimed', true, 'status', row.status, 'metadata', row.metadata);
end;
$$;

revoke all on function public.claim_public_generator_submit(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_public_generator_submit(uuid, text) to service_role;

-- Deploy-time handoff only. The deploy script copies this into the edge secret and deletes the row.
-- Not granted to the API roles.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.generator_higgsfield_handoff (
  id int primary key,
  credential text not null
);
revoke all on table private.generator_higgsfield_handoff from public, anon, authenticated;
alter table private.generator_higgsfield_handoff enable row level security;

create or replace function public.generator_higgsfield_authorization()
returns text
language plpgsql
security definer
set search_path = private, public
as $$
declare
  val text;
  jwt_role text;
begin
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), '')
  );
  if jwt_role is distinct from 'service_role' then
    return null;
  end if;
  select credential into val from private.generator_higgsfield_handoff where id = 1;
  return val;
end;
$$;

revoke all on function public.generator_higgsfield_authorization() from public, anon, authenticated;
grant execute on function public.generator_higgsfield_authorization() to service_role;

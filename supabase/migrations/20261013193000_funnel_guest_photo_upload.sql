-- Guest occasion funnels upload directly to storage.objects (bucket uploads,
-- prefix funnel/) with the anon key. RLS is enabled on storage.objects and this
-- database had no storage policies, so every insert failed with
-- "new row violates row-level security policy".
--
-- Allow only a single path segment under funnel/ and only image extensions.
-- No anon update, delete, or list. Other prefixes in the public uploads bucket
-- (historical inputs/) stay denied. Signed uploads used by Christmas/pet
-- funnels are minted by the service role and are unchanged.

drop policy if exists "funnel_guest_photo_insert" on storage.objects;

create policy "funnel_guest_photo_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'uploads'
  and coalesce((storage.foldername(name))[1], '') = 'funnel'
  and coalesce(array_length(storage.foldername(name), 1), 0) = 1
  and lower(storage.extension(name)) in (
    'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'
  )
  and position('..' in name) = 0
);

-- Public /generator uploads to generator-sources as the signed-in user.
-- Same empty-policy failure mode. Owner folder must be auth.uid().
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

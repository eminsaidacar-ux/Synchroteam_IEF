-- IEF Audit — Supabase Storage
-- Bucket privé "photos" avec accès scoped par organisation via path.
-- Structure des paths : {organisation_id}/{site_id}/{equipement_id}/{filename}

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Les policies lisent le 1er segment du path comme organisation_id
drop policy if exists "photos_read_own_org"   on storage.objects;
drop policy if exists "photos_write_own_org"  on storage.objects;
drop policy if exists "photos_update_own_org" on storage.objects;
drop policy if exists "photos_delete_own_org" on storage.objects;

create policy "photos_read_own_org" on storage.objects for select
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid = public.current_org_id()
  );

create policy "photos_write_own_org" on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid = public.current_org_id()
  );

create policy "photos_update_own_org" on storage.objects for update
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid = public.current_org_id()
  );

create policy "photos_delete_own_org" on storage.objects for delete
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1]::uuid = public.current_org_id()
  );

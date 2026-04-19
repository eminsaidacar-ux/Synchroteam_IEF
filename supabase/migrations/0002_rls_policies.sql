-- IEF Audit — Row Level Security
-- Chaque utilisateur ne peut accéder qu'aux données de son organisation.

-- ============================================================
-- Helper : organisation_id de l'utilisateur courant
-- ============================================================
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organisation_id from public.users where id = auth.uid();
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

-- ============================================================
-- Activation RLS
-- ============================================================
alter table public.organisations enable row level security;
alter table public.users         enable row level security;
alter table public.sites         enable row level security;
alter table public.equipements   enable row level security;
alter table public.photos        enable row level security;
alter table public.rapports      enable row level security;

-- ============================================================
-- ORGANISATIONS : lecture seule de sa propre org
-- ============================================================
drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations for select
  using (id = public.current_org_id());

-- ============================================================
-- USERS : chacun voit les membres de son org ; se modifie lui-même
-- ============================================================
drop policy if exists users_select_same_org on public.users;
create policy users_select_same_org on public.users for select
  using (organisation_id = public.current_org_id() or id = auth.uid());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- SITES : scoped organisation
-- ============================================================
drop policy if exists sites_select on public.sites;
create policy sites_select on public.sites for select
  using (organisation_id = public.current_org_id());

drop policy if exists sites_insert on public.sites;
create policy sites_insert on public.sites for insert
  with check (organisation_id = public.current_org_id());

drop policy if exists sites_update on public.sites;
create policy sites_update on public.sites for update
  using (organisation_id = public.current_org_id())
  with check (organisation_id = public.current_org_id());

drop policy if exists sites_delete on public.sites;
create policy sites_delete on public.sites for delete
  using (organisation_id = public.current_org_id() and public.current_role() = 'admin');

-- ============================================================
-- EQUIPEMENTS : via site → organisation
-- ============================================================
drop policy if exists equip_select on public.equipements;
create policy equip_select on public.equipements for select
  using (exists (
    select 1 from public.sites s
    where s.id = equipements.site_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists equip_insert on public.equipements;
create policy equip_insert on public.equipements for insert
  with check (exists (
    select 1 from public.sites s
    where s.id = equipements.site_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists equip_update on public.equipements;
create policy equip_update on public.equipements for update
  using (exists (
    select 1 from public.sites s
    where s.id = equipements.site_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists equip_delete on public.equipements;
create policy equip_delete on public.equipements for delete
  using (exists (
    select 1 from public.sites s
    where s.id = equipements.site_id and s.organisation_id = public.current_org_id()
  ));

-- ============================================================
-- PHOTOS : via equipement → site → organisation
-- ============================================================
drop policy if exists photos_select on public.photos;
create policy photos_select on public.photos for select
  using (exists (
    select 1 from public.equipements e
    join public.sites s on s.id = e.site_id
    where e.id = photos.equipement_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos for insert
  with check (exists (
    select 1 from public.equipements e
    join public.sites s on s.id = e.site_id
    where e.id = photos.equipement_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists photos_update on public.photos;
create policy photos_update on public.photos for update
  using (exists (
    select 1 from public.equipements e
    join public.sites s on s.id = e.site_id
    where e.id = photos.equipement_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists photos_delete on public.photos;
create policy photos_delete on public.photos for delete
  using (exists (
    select 1 from public.equipements e
    join public.sites s on s.id = e.site_id
    where e.id = photos.equipement_id and s.organisation_id = public.current_org_id()
  ));

-- ============================================================
-- RAPPORTS : via site → organisation
-- ============================================================
drop policy if exists rapports_select on public.rapports;
create policy rapports_select on public.rapports for select
  using (exists (
    select 1 from public.sites s
    where s.id = rapports.site_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists rapports_insert on public.rapports;
create policy rapports_insert on public.rapports for insert
  with check (exists (
    select 1 from public.sites s
    where s.id = rapports.site_id and s.organisation_id = public.current_org_id()
  ));

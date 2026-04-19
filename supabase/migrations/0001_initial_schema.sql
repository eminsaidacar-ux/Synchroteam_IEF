-- IEF Audit — Schéma initial
-- Plateforme multi-organisations, multi-familles d'équipements.
-- Toutes les tables sont protégées par Row Level Security (RLS).

create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANISATIONS
-- ============================================================
create table if not exists public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- USERS (mirroir de auth.users, avec role + organisation)
-- ============================================================
create table if not exists public.users (
  id               uuid primary key references auth.users(id) on delete cascade,
  organisation_id  uuid references public.organisations(id) on delete set null,
  email            text unique not null,
  role             text not null default 'technicien' check (role in ('admin','technicien','client')),
  created_at       timestamptz not null default now()
);

create index if not exists users_org_idx on public.users(organisation_id);

-- ============================================================
-- SITES
-- ============================================================
create table if not exists public.sites (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  address          text,
  ref_affaire      text,
  niveaux          jsonb not null default '["SS","RDC","R+1","R+2","R+3","Terrasse"]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists sites_org_idx on public.sites(organisation_id);

-- ============================================================
-- EQUIPEMENTS (toutes familles)
-- ============================================================
create table if not exists public.equipements (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites(id) on delete cascade,
  famille      text not null check (famille in (
    'porte','fenetre','rideau_metal','volet_roulant',
    'portail','barriere','automatisme','acces'
  )),
  ref          text not null,
  niveau       text,
  zone         text,
  emplacement  text,
  specs        jsonb not null default '{}'::jsonb,
  accessoires  jsonb not null default '{}'::jsonb,
  etat         text check (etat in ('Bon','Moyen','Mauvais','Hors service')),
  priorite     text check (priorite in ('Normale','Importante','Urgente')),
  actions      jsonb not null default '[]'::jsonb,
  observations text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.users(id) on delete set null
);

create index if not exists equipements_site_idx     on public.equipements(site_id);
create index if not exists equipements_famille_idx  on public.equipements(famille);
create index if not exists equipements_niveau_idx   on public.equipements(niveau);
create unique index if not exists equipements_site_ref_uk
  on public.equipements(site_id, ref);

-- ============================================================
-- PHOTOS
-- ============================================================
create table if not exists public.photos (
  id             uuid primary key default gen_random_uuid(),
  equipement_id  uuid not null references public.equipements(id) on delete cascade,
  storage_path   text not null,
  inclure_pdf    boolean not null default true,
  ordre          integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists photos_equip_idx on public.photos(equipement_id);

-- ============================================================
-- RAPPORTS
-- ============================================================
create table if not exists public.rapports (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.sites(id) on delete cascade,
  famille       text,
  niveau        text,
  pdf_path      text,
  generated_at  timestamptz not null default now(),
  generated_by  uuid references public.users(id) on delete set null
);

create index if not exists rapports_site_idx on public.rapports(site_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_sites_updated on public.sites;
create trigger trg_sites_updated before update on public.sites
  for each row execute function public.set_updated_at();

drop trigger if exists trg_equipements_updated on public.equipements;
create trigger trg_equipements_updated before update on public.equipements
  for each row execute function public.set_updated_at();

-- ============================================================
-- TRIGGER de provisioning users (auto-créer public.users au signup)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'technicien')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

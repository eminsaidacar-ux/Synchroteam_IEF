-- BPU en base — tarifs versionnés + plafonds NTE par type d'intervention EG.
-- Remplace les prix codés en dur dans frontend/src/lib/bpu.js (ordre de
-- mission n°2, chantier 3.1).
--
-- Versioning : une ligne par (code, date_effet). Le tarif applicable est la
-- ligne active dont date_effet est la plus récente et <= aujourd'hui.
-- On n'update jamais un prix : on insère une nouvelle version (date_effet)
-- et on peut désactiver l'ancienne (actif = false) si besoin d'un retrait.
--
-- Règle maison « prix non ronds » : décimales limitées à ,30 / ,40 / ,70 / ,80.
-- Exception : les taux horaires MO (60 / 110 €/h) sont des valeurs de
-- doctrine, figées telles quelles par l'ordre de mission.

-- ============================================================
-- TARIFS BPU (fournitures + main d'œuvre)
-- ============================================================
create table if not exists public.bpu_tarifs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  libelle     text not null,
  famille     text not null,
  unite       text not null,
  prix_ht     numeric(10,2) not null check (prix_ht >= 0),
  mo_heures   numeric(6,2)  not null default 0 check (mo_heures >= 0),
  actif       boolean not null default true,
  date_effet  date not null default current_date,
  created_at  timestamptz not null default now()
);

create unique index if not exists bpu_tarifs_code_effet_uk
  on public.bpu_tarifs(code, date_effet);
create index if not exists bpu_tarifs_actif_idx
  on public.bpu_tarifs(actif) where actif;

-- ============================================================
-- PLAFONDS NTE (Not To Exceed) par type d'intervention EG
-- ============================================================
create table if not exists public.bpu_plafonds_nte (
  id                 uuid primary key default gen_random_uuid(),
  type_intervention  text not null,
  plafond_ht         numeric(10,2) not null check (plafond_ht > 0),
  actif              boolean not null default true,
  date_effet         date not null default current_date,
  created_at         timestamptz not null default now()
);

create unique index if not exists bpu_plafonds_type_effet_uk
  on public.bpu_plafonds_nte(type_intervention, date_effet);

-- ============================================================
-- RLS — référentiel global : lecture pour tout utilisateur authentifié,
-- écriture réservée aux admins (cohérent avec current_role() de 0002).
-- ============================================================
alter table public.bpu_tarifs       enable row level security;
alter table public.bpu_plafonds_nte enable row level security;

drop policy if exists bpu_tarifs_select on public.bpu_tarifs;
create policy bpu_tarifs_select on public.bpu_tarifs for select
  using (auth.uid() is not null);

drop policy if exists bpu_tarifs_insert on public.bpu_tarifs;
create policy bpu_tarifs_insert on public.bpu_tarifs for insert
  with check (public.current_role() = 'admin');

drop policy if exists bpu_tarifs_update on public.bpu_tarifs;
create policy bpu_tarifs_update on public.bpu_tarifs for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists bpu_plafonds_select on public.bpu_plafonds_nte;
create policy bpu_plafonds_select on public.bpu_plafonds_nte for select
  using (auth.uid() is not null);

drop policy if exists bpu_plafonds_insert on public.bpu_plafonds_nte;
create policy bpu_plafonds_insert on public.bpu_plafonds_nte for insert
  with check (public.current_role() = 'admin');

drop policy if exists bpu_plafonds_update on public.bpu_plafonds_nte;
create policy bpu_plafonds_update on public.bpu_plafonds_nte for update
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- ============================================================
-- SEED — taux MO doctrine + tarifs actuels convertis (prix non ronds)
-- ============================================================
insert into public.bpu_tarifs (code, libelle, famille, unite, prix_ht, mo_heures, date_effet) values
  -- Main d'œuvre (taux doctrine, figés par l'ordre de mission n°2)
  ('MO-1TECH',      'Main d''œuvre — 1 technicien',   'Main d''œuvre', 'h',  60.00, 0,    '2026-07-19'),
  ('MO-2TECH',      'Main d''œuvre — 2 techniciens',  'Main d''œuvre', 'h', 110.00, 0,    '2026-07-19'),
  -- Fournitures / prestations (ex-bpu.js, converties règle « prix non ronds »)
  ('JOINT-CF',      'Remplacement joint CF',          'Menuiserie',    'ml', 18.30, 0.50, '2026-07-19'),
  ('FERME-PORTE',   'Remplacement ferme-porte',       'Serrurerie',    'u',  84.70, 1.00, '2026-07-19'),
  ('GRAISS-SERR',   'Graissage serrure',              'Entretien',     'u',  12.40, 0.25, '2026-07-19'),
  ('REPR-PEINT',    'Reprise peinture',               'Finition',      'm²', 34.80, 1.00, '2026-07-19'),
  ('BEQUILLE',      'Remplacement béquille',          'Quincaillerie', 'u',  45.30, 0.50, '2026-07-19'),
  ('REGL-FERM',     'Réglage fermeture',              'Entretien',     'u',  19.70, 0.50, '2026-07-19')
on conflict (code, date_effet) do nothing;

insert into public.bpu_plafonds_nte (type_intervention, plafond_ht, date_effet) values
  ('Dépannage serrurerie',            289.70, '2026-07-19'),
  ('Dépannage rideau métallique',     489.30, '2026-07-19'),
  ('Dépannage porte automatique',     549.80, '2026-07-19'),
  ('Vitrerie / sécurisation',         389.40, '2026-07-19'),
  ('Maintenance préventive',          189.70, '2026-07-19'),
  ('Urgence hors heures ouvrées',     649.80, '2026-07-19')
on conflict (type_intervention, date_effet) do nothing;

-- Photos enrichies — métadonnées EXIF/GPS, horodatage serveur et liaison
-- avant/après au rapport (ordre de mission n°2, chantier 3.3).
--
-- Migration additive uniquement :
--   taken_at            date de prise de vue (EXIF DateTimeOriginal, sinon null)
--   lat / lng           position GPS (EXIF prioritaire, sinon géoloc navigateur)
--   server_uploaded_at  horodatage serveur (default now() : posé côté Postgres
--                       à l'insert — donc à la SYNC pour une écriture offline)
--   phase               'avant' / 'apres' travaux (nullable = non qualifiée)
--   rapport_id          rattachement au rapport généré (photos avant/après)
--
-- RLS : les policies existantes de 0002 (photos_* via equipement → site → org)
-- couvrent les nouvelles colonnes — aucune nouvelle policy nécessaire.

alter table public.photos
  add column if not exists taken_at           timestamptz,
  add column if not exists lat                double precision,
  add column if not exists lng                double precision,
  add column if not exists server_uploaded_at timestamptz not null default now(),
  add column if not exists phase              text check (phase in ('avant','apres')),
  add column if not exists rapport_id         uuid references public.rapports(id) on delete set null;

create index if not exists photos_rapport_idx on public.photos(rapport_id)
  where rapport_id is not null;
create index if not exists photos_phase_idx on public.photos(phase)
  where phase is not null;

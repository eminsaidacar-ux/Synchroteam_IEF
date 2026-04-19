-- Audit versionning : snapshot complet d'un site à un instant T.
-- Chaque génération de rapport produit un snapshot. Permet de comparer
-- deux audits à 6 mois et voir ce qui s'est dégradé / a été corrigé.

create table if not exists public.audit_snapshots (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references public.sites(id) on delete cascade,
  data           jsonb not null,
  hash_sha256    text not null,
  famille_scope  text,
  niveau_scope   text,
  signed_by      text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.users(id) on delete set null
);

create index if not exists audit_snapshots_site_idx on public.audit_snapshots(site_id);
create index if not exists audit_snapshots_created_idx on public.audit_snapshots(created_at desc);

alter table public.audit_snapshots enable row level security;

drop policy if exists snapshots_select on public.audit_snapshots;
create policy snapshots_select on public.audit_snapshots for select
  using (exists (
    select 1 from public.sites s
    where s.id = audit_snapshots.site_id and s.organisation_id = public.current_org_id()
  ));

drop policy if exists snapshots_insert on public.audit_snapshots;
create policy snapshots_insert on public.audit_snapshots for insert
  with check (exists (
    select 1 from public.sites s
    where s.id = audit_snapshots.site_id and s.organisation_id = public.current_org_id()
  ));

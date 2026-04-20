-- Geolocalisation des sites pour la vue carte (Leaflet + OSM).
alter table public.sites
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create index if not exists sites_geo_idx on public.sites(lat, lng)
  where lat is not null and lng is not null;

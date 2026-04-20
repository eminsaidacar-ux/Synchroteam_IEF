import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

// Recherche cross-sites : équipements dont ref/zone/emplacement/observations
// matchent la query + sites dont name/ref_affaire matchent.
// En mode local : tout est indexé en RAM (pas de FTS), c'est OK jusqu'à
// quelques milliers d'équipements.
export function useGlobalSearch(query) {
  return useQuery({
    enabled: !!query && query.length >= 2,
    queryKey: ['global-search', query],
    staleTime: 5_000,
    queryFn: async () => {
      const [sitesRes, equipRes] = await Promise.all([
        supabase.from('sites').select('id, name, ref_affaire, address'),
        supabase.from('equipements').select('id, site_id, ref, famille, niveau, zone, emplacement, observations, etat, priorite'),
      ]);
      const q = query.toLowerCase();
      const match = (str) => (str ?? '').toLowerCase().includes(q);

      const sites = (sitesRes.data ?? []).filter((s) =>
        match(s.name) || match(s.ref_affaire) || match(s.address)
      );
      const equipements = (equipRes.data ?? []).filter((e) =>
        match(e.ref) || match(e.zone) || match(e.emplacement) || match(e.observations) ||
        match(e.niveau) || match(e.famille)
      );

      return { sites, equipements };
    },
  });
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { indexTarifs } from '../lib/bpu.js';

// Chargement du référentiel BPU depuis la base (bpu_tarifs + bpu_plafonds_nte,
// migration 0006), avec cache local pour le fonctionnement offline :
//   - à chaque fetch réussi, le référentiel est persisté en localStorage ;
//   - si le réseau est indisponible (ou Supabase en erreur), on retombe sur
//     la dernière copie cachée (source: 'cache') ;
//   - sans réseau NI cache, le devis affiche les lignes « Non chiffré »
//     (source: 'vide').
// networkMode 'always' : le queryFn doit s'exécuter même offline pour
// pouvoir servir le cache.

const CACHE_KEY = 'ief:bpu-cache';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(payload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch { /* quota */ }
}

export function useBpu() {
  const query = useQuery({
    queryKey: ['bpu'],
    networkMode: 'always',
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      try {
        const [tarifsRes, plafondsRes] = await Promise.all([
          supabase.from('bpu_tarifs').select('*').eq('actif', true),
          supabase.from('bpu_plafonds_nte').select('*').eq('actif', true),
        ]);
        if (tarifsRes.error)   throw tarifsRes.error;
        if (plafondsRes.error) throw plafondsRes.error;
        const payload = {
          tarifs:   tarifsRes.data ?? [],
          plafonds: plafondsRes.data ?? [],
          fetched_at: new Date().toISOString(),
        };
        if (payload.tarifs.length > 0) writeCache(payload);
        return { ...payload, source: payload.tarifs.length > 0 ? 'reseau' : 'vide' };
      } catch (e) {
        const cached = readCache();
        if (cached) return { ...cached, source: 'cache' };
        return { tarifs: [], plafonds: [], fetched_at: null, source: 'vide', erreur: e.message };
      }
    },
  });

  const bpu = useMemo(() => {
    if (!query.data) return null;
    return {
      ...indexTarifs(query.data.tarifs),
      plafonds: query.data.plafonds ?? [],
      source: query.data.source,
      fetched_at: query.data.fetched_at,
    };
  }, [query.data]);

  return { ...query, bpu };
}

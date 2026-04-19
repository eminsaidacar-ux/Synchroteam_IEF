import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

const DEFAULT_NIVEAUX = ['SS', 'RDC', 'R+1', 'R+2', 'R+3', 'Terrasse'];

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites')
        .select('*, equipements(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSite(siteId) {
  return useQuery({
    enabled: !!siteId,
    queryKey: ['site', siteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('sites').select('*').eq('id', siteId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const row = {
        name: payload.name,
        address: payload.address ?? null,
        ref_affaire: payload.ref_affaire ?? null,
        niveaux: payload.niveaux ?? DEFAULT_NIVEAUX,
      };
      if (payload.id) {
        const { data, error } = await supabase.from('sites').update(row).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      if (payload.organisation_id) row.organisation_id = payload.organisation_id;
      const { data, error } = await supabase.from('sites').insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      if (s?.id) qc.invalidateQueries({ queryKey: ['site', s.id] });
    },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('sites').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });
}

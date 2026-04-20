import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

export function useEquipements(siteId, { famille, niveau } = {}) {
  return useQuery({
    enabled: !!siteId,
    queryKey: ['equipements', siteId, famille ?? null, niveau ?? null],
    queryFn: async () => {
      let q = supabase
        .from('equipements')
        .select('*, photos(id, storage_path, inclure_pdf, ordre)')
        .eq('site_id', siteId)
        .order('ref', { ascending: true });
      if (famille) q = q.eq('famille', famille);
      if (niveau)  q = q.eq('niveau', niveau);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEquipement(id) {
  return useQuery({
    enabled: !!id,
    queryKey: ['equipement', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipements')
        .select('*, photos(id, storage_path, inclure_pdf, ordre)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertEquipement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      // Update partiel : ne patche que les clés explicitement fournies,
      // pour permettre les bulk actions (juste { id, site_id, etat }).
      if (payload.id) {
        const patch = {};
        for (const k of ['famille', 'ref', 'niveau', 'zone', 'emplacement',
                         'specs', 'accessoires', 'etat', 'priorite',
                         'actions', 'observations']) {
          if (k in payload) patch[k] = payload[k];
        }
        const { data, error } = await supabase.from('equipements')
          .update(patch).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      // Insert : tous les champs avec defaults.
      const row = {
        site_id: payload.site_id,
        famille: payload.famille,
        ref: payload.ref,
        niveau: payload.niveau ?? null,
        zone: payload.zone ?? null,
        emplacement: payload.emplacement ?? null,
        specs: payload.specs ?? {},
        accessoires: payload.accessoires ?? {},
        etat: payload.etat ?? null,
        priorite: payload.priorite ?? null,
        actions: payload.actions ?? [],
        observations: payload.observations ?? null,
      };
      const { data, error } = await supabase.from('equipements').insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['equipements', row.site_id] });
      qc.invalidateQueries({ queryKey: ['equipement', row.id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteEquipement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('equipements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipements', vars.site_id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

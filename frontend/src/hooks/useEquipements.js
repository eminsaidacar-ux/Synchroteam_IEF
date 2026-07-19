import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { isOffline, enqueue } from '../lib/outbox.js';

const PHOTO_COLS = 'photos(id, storage_path, inclure_pdf, ordre, phase, taken_at, lat, lng, rapport_id)';

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useEquipements(siteId, { famille, niveau } = {}) {
  return useQuery({
    enabled: !!siteId,
    queryKey: ['equipements', siteId, famille ?? null, niveau ?? null],
    queryFn: async () => {
      let q = supabase
        .from('equipements')
        .select(`*, ${PHOTO_COLS}`)
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
        .select(`*, ${PHOTO_COLS}`)
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
    // networkMode 'always' : la mutation doit s'exécuter même hors ligne
    // pour pouvoir enfiler l'écriture dans l'outbox (lib/outbox.js).
    networkMode: 'always',
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
        if (isOffline()) {
          await enqueue({ kind: 'db', table: 'equipements', op: 'update', payload: patch, match: { id: payload.id } });
          return { ...payload, ...patch, updated_at: new Date().toISOString(), sync_pending: true };
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
      if (isOffline()) {
        const now = new Date().toISOString();
        const local = { id: uuid(), created_at: now, updated_at: now, ...row };
        await enqueue({ kind: 'db', table: 'equipements', op: 'insert', payload: local });
        return { ...local, photos: [], sync_pending: true };
      }
      const { data, error } = await supabase.from('equipements').insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      if (row?.sync_pending) {
        // Hors ligne : mise à jour optimiste du cache (les refetch sont en
        // pause tant que le réseau est coupé).
        qc.setQueryData(['equipement', row.id], (old) => ({ ...(old ?? {}), ...row }));
        qc.setQueryData(['equipements', row.site_id, null, null], (old) => {
          if (!old) return old;
          const idx = old.findIndex((e) => e.id === row.id);
          if (idx === -1) return [...old, row];
          const next = old.slice();
          next[idx] = { ...next[idx], ...row };
          return next;
        });
      }
      qc.invalidateQueries({ queryKey: ['equipements', row.site_id] });
      qc.invalidateQueries({ queryKey: ['equipement', row.id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteEquipement() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ id }) => {
      if (isOffline()) {
        await enqueue({ kind: 'db', table: 'equipements', op: 'delete', match: { id } });
        return;
      }
      const { error } = await supabase.from('equipements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipements', vars.site_id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

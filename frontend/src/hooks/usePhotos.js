import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, PHOTOS_BUCKET } from '../lib/supabase.js';
import { compressImage } from '../lib/compress.js';
import { extractExif, getBrowserPosition } from '../lib/exif.js';
import { isOffline, enqueue, enqueuePhotoUpload } from '../lib/outbox.js';

// Construit le path canonique d'une photo dans le bucket.
// {organisation_id}/{site_id}/{equipement_id}/{timestamp}-{rand}.jpg
function buildPath({ organisation_id, site_id, equipement_id }) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${organisation_id}/${site_id}/${equipement_id}/${Date.now()}-${rand}.jpg`;
}

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useSignedPhotoUrl(storage_path) {
  return useQuery({
    enabled: !!storage_path,
    queryKey: ['photo-url', storage_path],
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .createSignedUrl(storage_path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ file, equipement, site, organisation_id, inclure_pdf = true, ordre = 0, phase = null }) => {
      // 1) Métadonnées : EXIF sur le fichier ORIGINAL (avant compression,
      //    qui repasse par canvas et détruit les métadonnées), puis
      //    géolocalisation navigateur en fallback si pas de GPS EXIF.
      const exif = await extractExif(file);
      let { lat, lng } = exif;
      if (lat == null || lng == null) {
        const pos = await getBrowserPosition();
        if (pos) ({ lat, lng } = pos);
      }

      // 2) Compression pour l'upload.
      const blob = await compressImage(file);
      const path = buildPath({
        organisation_id,
        site_id: site.id,
        equipement_id: equipement.id,
      });

      const row = {
        equipement_id: equipement.id,
        storage_path: path,
        inclure_pdf,
        ordre,
        phase,
        taken_at: exif.taken_at,
        lat: lat ?? null,
        lng: lng ?? null,
        // server_uploaded_at : posé par Postgres (default now()) à l'insert,
        // donc au moment de la SYNC pour une écriture offline.
      };

      // 3) Hors ligne : blob + insert mis en file dans l'outbox IndexedDB.
      if (isOffline()) {
        const local = { id: uuid(), created_at: new Date().toISOString(), ...row, sync_pending: true };
        await enqueuePhotoUpload({ path, blob, row: { id: local.id, ...row } });
        return local;
      }

      const up = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
      });
      if (up.error) throw up.error;

      const { data, error } = await supabase
        .from('photos')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (photo, vars) => {
      if (photo?.sync_pending) {
        // Hors ligne : on greffe la photo optimiste dans le cache (les
        // refetch sont en pause tant que le réseau est coupé).
        qc.setQueryData(['equipement', vars.equipement.id], (old) =>
          old ? { ...old, photos: [...(old.photos ?? []), photo] } : old
        );
      }
      qc.invalidateQueries({ queryKey: ['equipement', vars.equipement.id] });
      qc.invalidateQueries({ queryKey: ['equipements', vars.site.id] });
    },
  });
}

// Patch générique d'une ligne photo, avec mise en file offline.
async function updatePhoto(id, patch) {
  if (isOffline()) {
    await enqueue({ kind: 'db', table: 'photos', op: 'update', payload: patch, match: { id } });
    return { id, ...patch, sync_pending: true };
  }
  const { data, error } = await supabase
    .from('photos')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function useTogglePhotoPdf() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ id, inclure_pdf }) => updatePhoto(id, { inclure_pdf }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipement'] }),
  });
}

// Qualifie une photo « avant » / « apres » travaux (null = non qualifiée).
export function useSetPhotoPhase() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ id, phase }) => updatePhoto(id, { phase }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipement'] }),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ id, storage_path }) => {
      if (isOffline()) {
        await enqueue({ kind: 'storage-remove', path: storage_path });
        await enqueue({ kind: 'db', table: 'photos', op: 'delete', match: { id } });
        return;
      }
      await supabase.storage.from(PHOTOS_BUCKET).remove([storage_path]);
      const { error } = await supabase.from('photos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipement'] }),
  });
}

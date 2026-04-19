import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, PHOTOS_BUCKET } from '../lib/supabase.js';
import { compressImage } from '../lib/compress.js';

// Construit le path canonique d'une photo dans le bucket.
// {organisation_id}/{site_id}/{equipement_id}/{timestamp}-{rand}.jpg
function buildPath({ organisation_id, site_id, equipement_id }) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${organisation_id}/${site_id}/${equipement_id}/${Date.now()}-${rand}.jpg`;
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
    mutationFn: async ({ file, equipement, site, organisation_id, inclure_pdf = true, ordre = 0 }) => {
      const blob = await compressImage(file);
      const path = buildPath({
        organisation_id,
        site_id: site.id,
        equipement_id: equipement.id,
      });
      const up = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
      });
      if (up.error) throw up.error;

      const { data, error } = await supabase
        .from('photos')
        .insert({ equipement_id: equipement.id, storage_path: path, inclure_pdf, ordre })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipement', vars.equipement.id] });
      qc.invalidateQueries({ queryKey: ['equipements', vars.site.id] });
    },
  });
}

export function useTogglePhotoPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, inclure_pdf }) => {
      const { data, error } = await supabase
        .from('photos')
        .update({ inclure_pdf })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipement'] }),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storage_path }) => {
      await supabase.storage.from(PHOTOS_BUCKET).remove([storage_path]);
      const { error } = await supabase.from('photos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipement'] }),
  });
}

// Migration du JSON exporté par l'outil HTML legacy (audit portes).
// Chaque "door" devient un équipement de famille "porte" attaché au site créé.
//
// Les photos sont stockées en base64 dans l'outil legacy. On les décode,
// on les compresse, puis on les upload vers Supabase Storage.

import { supabase, PHOTOS_BUCKET } from './supabase.js';
import { compressImage, dataURLtoBlob } from './compress.js';

export async function importLegacyJson(json, { organisation_id, onProgress }) {
  if (!json?.site || !Array.isArray(json?.doors)) {
    throw new Error('JSON invalide : attendu { site, doors: [...] }');
  }

  onProgress?.({ step: 'site', message: 'Création du site…' });

  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .insert({
      organisation_id,
      name: json.site.name ?? 'Site importé',
      address: json.site.address ?? null,
      ref_affaire: json.site.ref ?? null,
      niveaux: Array.isArray(json.site.niveaux) && json.site.niveaux.length
        ? json.site.niveaux
        : ['SS', 'RDC', 'R+1', 'R+2', 'R+3', 'Terrasse'],
    })
    .select()
    .single();
  if (siteErr) throw siteErr;

  const summary = { site_id: site.id, equipements: 0, photos: 0 };

  for (let i = 0; i < json.doors.length; i++) {
    const d = json.doors[i];
    onProgress?.({
      step: 'equipement', index: i, total: json.doors.length,
      message: `Équipement ${i + 1}/${json.doors.length} · ${d.ref ?? ''}`,
    });

    const specs = {
      type_ouvrage: d.type_ouvrage ?? null,
      materiau: d.mat ?? null,
      classe_securite: d.classe ?? null,
      largeur_mm: numOrNull(d.largeur),
      hauteur_mm: numOrNull(d.hauteur),
      sens_ouverture: d.sens ?? null,
    };

    const accessoires = {
      list: Array.isArray(d.accessoires) ? d.accessoires : [],
      details: d.accDetails ?? {},
    };

    const { data: equip, error: eqErr } = await supabase
      .from('equipements')
      .insert({
        site_id: site.id,
        famille: 'porte',
        ref: d.ref ?? `P${String(i + 1).padStart(3, '0')}`,
        niveau: d.niveau ?? null,
        zone: d.zone ?? null,
        emplacement: d.emplacement ?? null,
        specs,
        accessoires,
        etat: d.etat ?? null,
        priorite: d.priorite ?? null,
        actions: Array.isArray(d.actions) ? d.actions : [],
        observations: d.observations ?? null,
      })
      .select()
      .single();
    if (eqErr) throw eqErr;
    summary.equipements++;

    const photos    = Array.isArray(d.photos)    ? d.photos    : [];
    const photosPdf = Array.isArray(d.photosPdf) ? d.photosPdf : [];
    for (let p = 0; p < photos.length; p++) {
      const dataUrl = photos[p];
      if (!dataUrl?.startsWith('data:')) continue;
      try {
        const blob = await compressImage(dataURLtoBlob(dataUrl));
        const path = `${organisation_id}/${site.id}/${equip.id}/${Date.now()}-${p}.jpg`;
        const up = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });
        if (up.error) throw up.error;
        await supabase.from('photos').insert({
          equipement_id: equip.id,
          storage_path: path,
          inclure_pdf: photosPdf[p] !== false,
          ordre: p,
        });
        summary.photos++;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[import] photo ignorée', err);
      }
    }
  }

  onProgress?.({ step: 'done', message: 'Terminé.' });
  return summary;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

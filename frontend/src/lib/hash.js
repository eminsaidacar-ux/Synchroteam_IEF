// SHA-256 via la Web Crypto API (disponible partout sauf IE).
// Utilisé pour hasher le snapshot d'audit inclus dans le PDF — valeur juridique :
// le hash prouve que le contenu signé n'a pas été modifié après coup.

export async function sha256Hex(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Snapshot canonique d'un équipement pour le hash : on fige les champs
// matériels, on ignore created_at/updated_at qui changent à chaque lecture.
function canonical(equipement) {
  const keep = [
    'id', 'ref', 'famille', 'niveau', 'zone', 'emplacement',
    'specs', 'etat', 'priorite', 'actions', 'observations',
  ];
  const out = {};
  for (const k of keep) out[k] = equipement[k] ?? null;
  out.photos = (equipement.photos ?? []).map((p) => ({ storage_path: p.storage_path, inclure_pdf: p.inclure_pdf }));
  return out;
}

export async function hashSnapshot({ site, equipements, famille, niveau, generatedAt }) {
  const snapshot = {
    site: { id: site.id, name: site.name, ref_affaire: site.ref_affaire ?? null },
    scope: { famille: famille ?? null, niveau: niveau ?? null },
    generatedAt,
    equipements: equipements.map(canonical).sort((a, b) => a.ref.localeCompare(b.ref)),
  };
  const json = JSON.stringify(snapshot);
  const hash = await sha256Hex(json);
  return { hash, snapshot };
}

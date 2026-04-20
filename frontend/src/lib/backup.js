// Export / import complet des données locales (localStorage).
// Permet à Emin de sauvegarder un snapshot de ses données de dev ou de le
// passer à Mehdi pour debug.

const PREFIX = 'ief:';
const TABLES = ['organisations', 'users', 'sites', 'equipements', 'photos', 'rapports', 'audit_snapshots'];

function read(k) {
  const raw = localStorage.getItem(k);
  return raw ? JSON.parse(raw) : null;
}

export function exportBackup() {
  const tables = {};
  for (const t of TABLES) tables[t] = read(PREFIX + t) ?? [];
  const photos = read(PREFIX + 'storage:photos') ?? {};
  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
    storage_photos: photos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ief-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  const totalEq = tables.equipements?.length ?? 0;
  const totalSites = tables.sites?.length ?? 0;
  const totalPhotos = Object.keys(photos).length;
  return { totalSites, totalEq, totalPhotos };
}

export async function importBackup(file, { merge = false } = {}) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (data.version !== 1 || !data.tables) {
    throw new Error('Format de backup invalide (version ou structure)');
  }
  if (!merge) {
    // Replace mode : on écrase tout.
    for (const t of TABLES) localStorage.setItem(PREFIX + t, JSON.stringify(data.tables[t] ?? []));
    localStorage.setItem(PREFIX + 'storage:photos', JSON.stringify(data.storage_photos ?? {}));
  } else {
    // Merge : ajoute les rows dont l'id n'existe pas déjà.
    for (const t of TABLES) {
      const existing = read(PREFIX + t) ?? [];
      const existingIds = new Set(existing.map((r) => r.id));
      const incoming = (data.tables[t] ?? []).filter((r) => !existingIds.has(r.id));
      localStorage.setItem(PREFIX + t, JSON.stringify([...existing, ...incoming]));
    }
    const existingPhotos = read(PREFIX + 'storage:photos') ?? {};
    localStorage.setItem(PREFIX + 'storage:photos', JSON.stringify({ ...existingPhotos, ...(data.storage_photos ?? {}) }));
  }
  return {
    sites: data.tables.sites?.length ?? 0,
    equipements: data.tables.equipements?.length ?? 0,
    photos: Object.keys(data.storage_photos ?? {}).length,
  };
}

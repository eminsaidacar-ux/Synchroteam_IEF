// Diff entre deux snapshots d'audit. Match les équipements par ref, détecte
// les ajouts / suppressions / changements d'état / priorité / actions.

export function diffSnapshots(older, newer) {
  const a = new Map((older?.equipements ?? []).map((e) => [e.ref, e]));
  const b = new Map((newer?.equipements ?? []).map((e) => [e.ref, e]));

  const added    = [];
  const removed  = [];
  const modified = [];

  for (const [ref, e] of b) {
    if (!a.has(ref)) { added.push(e); continue; }
    const prev = a.get(ref);
    const changes = [];
    if (prev.etat !== e.etat)         changes.push({ field: 'état',     from: prev.etat, to: e.etat });
    if (prev.priorite !== e.priorite) changes.push({ field: 'priorité', from: prev.priorite, to: e.priorite });
    const prevActions = new Set(prev.actions ?? []);
    const nextActions = new Set(e.actions ?? []);
    const addedActions   = [...nextActions].filter((x) => !prevActions.has(x));
    const removedActions = [...prevActions].filter((x) => !nextActions.has(x));
    if (addedActions.length)   changes.push({ field: 'actions +', value: addedActions });
    if (removedActions.length) changes.push({ field: 'actions −', value: removedActions });
    if ((prev.observations ?? '') !== (e.observations ?? '')) {
      changes.push({ field: 'observations', from: prev.observations ?? '—', to: e.observations ?? '—' });
    }
    if (changes.length) modified.push({ ref, equipement: e, changes });
  }
  for (const [ref, e] of a) {
    if (!b.has(ref)) removed.push(e);
  }

  // Dégradations : état qui passe à un niveau plus mauvais (valeur ordinale).
  const etatOrder = { 'Bon': 0, 'Moyen': 1, 'Mauvais': 2, 'Hors service': 3 };
  const degradations = modified.filter((m) =>
    m.changes.some((c) => c.field === 'état' && (etatOrder[c.to] ?? 0) > (etatOrder[c.from] ?? 0))
  );
  const ameliorations = modified.filter((m) =>
    m.changes.some((c) => c.field === 'état' && (etatOrder[c.to] ?? 0) < (etatOrder[c.from] ?? 0))
  );

  return { added, removed, modified, degradations, ameliorations };
}

// BPU (Bordereau de Prix Unitaires) — mapping action → ligne de devis.
// Prix indicatifs marché IDF mars 2026, à ajuster selon négo fournisseurs.
//
// TODO phase 2 : BPU personnalisable par organisation (Supabase table
// bpu_items avec org_id), import Excel.

export const BPU = {
  'Remplacement joint CF':         { unite: 'ml',  prix_ht: 18, mo_heures: 0.5, categorie: 'Menuiserie' },
  'Remplacement ferme-porte':      { unite: 'u',   prix_ht: 85, mo_heures: 1.0, categorie: 'Serrurerie' },
  'Graissage serrure':             { unite: 'u',   prix_ht: 12, mo_heures: 0.25, categorie: 'Entretien' },
  'Reprise peinture':              { unite: 'm²',  prix_ht: 35, mo_heures: 1.0, categorie: 'Finition' },
  'Remplacement béquille':         { unite: 'u',   prix_ht: 45, mo_heures: 0.5, categorie: 'Quincaillerie' },
  'Réglage fermeture':             { unite: 'u',   prix_ht: 20, mo_heures: 0.5, categorie: 'Entretien' },
};

// Taux horaire main d'œuvre technicien qualifié IDF.
export const TAUX_HORAIRE_MO = 55;

export function lineForAction(label) {
  const item = BPU[label];
  if (!item) return null;
  const mo_cout = item.mo_heures * TAUX_HORAIRE_MO;
  return {
    libelle: label,
    unite: item.unite,
    prix_fourniture_ht: item.prix_ht,
    mo_heures: item.mo_heures,
    mo_cout,
    prix_total_ht: item.prix_ht + mo_cout,
    categorie: item.categorie,
  };
}

// Agrège les actions de tous les équipements d'un site.
// Retourne : { lignes: [{ libelle, qte, unite, prix_unitaire, total }], total_ht }
export function buildDevis(equipements) {
  const counts = {};
  for (const e of equipements) {
    for (const action of e.actions ?? []) {
      counts[action] = (counts[action] ?? 0) + 1;
    }
  }
  const lignes = [];
  let total_ht = 0;
  for (const [label, qte] of Object.entries(counts)) {
    const base = lineForAction(label);
    if (!base) {
      lignes.push({
        libelle: label, qte, unite: 'u',
        prix_unitaire_ht: 0, total_ht: 0,
        categorie: 'Non chiffré',
      });
      continue;
    }
    const total = base.prix_total_ht * qte;
    lignes.push({
      libelle: label, qte, unite: base.unite,
      prix_unitaire_ht: base.prix_total_ht,
      prix_fourniture_ht: base.prix_fourniture_ht,
      mo_heures: base.mo_heures,
      mo_cout: base.mo_cout,
      total_ht: total,
      categorie: base.categorie,
    });
    total_ht += total;
  }
  lignes.sort((a, b) => a.categorie.localeCompare(b.categorie) || a.libelle.localeCompare(b.libelle));
  return { lignes, total_ht };
}

export function euros(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n ?? 0);
}

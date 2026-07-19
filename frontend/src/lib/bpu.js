// BPU (Bordereau de Prix Unitaires) — moteur de chiffrage PUR.
// Les tarifs vivent en base (table bpu_tarifs, migration 0006) et sont
// chargés par le hook useBpu (hooks/useBpu.js) avec cache local offline.
// AUCUN prix n'est codé en dur ici : ce module ne fait que combiner les
// équipements audités avec le référentiel tarifaire qu'on lui passe.

// Codes des taux horaires main d'œuvre (lignes de bpu_tarifs).
export const MO_UN_TECHNICIEN    = 'MO-1TECH';
export const MO_DEUX_TECHNICIENS = 'MO-2TECH';

// Réduit les lignes brutes de bpu_tarifs (versionnées par date_effet) au
// tarif applicable : par code, la version active la plus récente dont
// date_effet <= aujourd'hui. Retourne { parCode, parLibelle, tauxMo }.
export function indexTarifs(rows = []) {
  const today = new Date().toISOString().slice(0, 10);
  const parCode = {};
  for (const r of rows) {
    if (r.actif === false) continue;
    if (r.date_effet && String(r.date_effet) > today) continue;
    const cur = parCode[r.code];
    if (!cur || String(r.date_effet ?? '') > String(cur.date_effet ?? '')) parCode[r.code] = r;
  }
  const parLibelle = {};
  for (const t of Object.values(parCode)) parLibelle[t.libelle] = t;
  return {
    parCode,
    parLibelle,
    tauxMo: {
      un_technicien:    parCode[MO_UN_TECHNICIEN]?.prix_ht ?? null,
      deux_techniciens: parCode[MO_DEUX_TECHNICIENS]?.prix_ht ?? null,
    },
  };
}

// Ligne de devis pour une action recommandée (libellé), à partir du
// référentiel indexé. Retourne null si l'action n'est pas au BPU.
export function lineForAction(label, bpu) {
  const item = bpu?.parLibelle?.[label];
  const taux = bpu?.tauxMo?.un_technicien;
  if (!item || taux == null) return null;
  const prix_ht  = Number(item.prix_ht);
  const mo_heures = Number(item.mo_heures ?? 0);
  const mo_cout  = mo_heures * Number(taux);
  return {
    code: item.code,
    libelle: label,
    unite: item.unite,
    prix_fourniture_ht: prix_ht,
    mo_heures,
    mo_cout,
    prix_total_ht: prix_ht + mo_cout,
    categorie: item.famille,
  };
}

// Agrège les actions de tous les équipements d'un site.
// Retourne : { lignes: [{ libelle, qte, unite, prix_unitaire_ht, total_ht }], total_ht }
export function buildDevis(equipements, bpu) {
  const counts = {};
  for (const e of equipements) {
    for (const action of e.actions ?? []) {
      counts[action] = (counts[action] ?? 0) + 1;
    }
  }
  const lignes = [];
  let total_ht = 0;
  for (const [label, qte] of Object.entries(counts)) {
    const base = lineForAction(label, bpu);
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

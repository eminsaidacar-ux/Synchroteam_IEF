import { useMemo, useState } from 'react';
import { useSites } from '../hooks/useSites.js';
import { useEquipements } from '../hooks/useEquipements.js';
import { useBpu } from '../hooks/useBpu.js';
import { buildDevis, euros } from '../lib/bpu.js';
import { Download } from 'lucide-react';

// Page Pré-devis : sélection d'un site → agrégation des actions recommandées
// sur tous ses équipements → tableau chiffré avec total HT et export CSV.
// Les tarifs proviennent de la base (bpu_tarifs, versionnée) via useBpu,
// avec cache local en cas de coupure réseau.
export default function Devis() {
  const { data: sites = [] } = useSites();
  const [siteId, setSiteId] = useState(null);
  const { data: equipements = [] } = useEquipements(siteId);
  const { bpu } = useBpu();
  const site = sites.find((s) => s.id === siteId);

  const devis = useMemo(() => buildDevis(equipements, bpu), [equipements, bpu]);

  const downloadCsv = () => {
    const header = 'Catégorie;Libellé;Qté;Unité;Prix unit. HT;Total HT';
    const lines = devis.lignes.map((l) =>
      [l.categorie, l.libelle, l.qte, l.unite, l.prix_unitaire_ht, l.total_ht].join(';')
    );
    const total = `;;;;TOTAL HT;${devis.total_ht.toFixed(2)}`;
    const blob = new Blob([[header, ...lines, total].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devis_${(site?.name ?? 'site').replace(/\W+/g, '_')}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pré-devis</h1>
      <p className="text-sm text-muted">
        Chiffrage automatique à partir des actions recommandées saisies par le technicien.
        Tarifs BPU chargés depuis la base (<span className="ref">bpu_tarifs</span>, versionnée)
        {bpu?.tauxMo?.un_technicien != null && (
          <> — MO {euros(bpu.tauxMo.un_technicien)}/h (1 tech.) · {euros(bpu.tauxMo.deux_techniciens)}/h (2 tech.)</>
        )}.
      </p>

      {bpu?.source === 'cache' && (
        <p className="text-xs text-accent">
          Hors ligne : tarifs issus du dernier cache local
          {bpu.fetched_at && <> ({new Date(bpu.fetched_at).toLocaleString('fr-FR')})</>}.
        </p>
      )}
      {bpu?.source === 'vide' && (
        <p className="text-xs text-bad">
          Tarifs BPU indisponibles (aucune donnée en base ni en cache) — les lignes
          apparaîtront « Non chiffré ».
        </p>
      )}

      <div className="card p-4 space-y-3">
        <div>
          <label className="block mb-1">Site</label>
          <select className="w-full" value={siteId ?? ''} onChange={(e) => setSiteId(e.target.value || null)}>
            <option value="">— Choisir un site —</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {siteId && (
        <div className="card overflow-hidden">
          {devis.lignes.length === 0 ? (
            <p className="p-4 text-muted text-sm">
              Aucune action recommandée saisie. Ajoute des actions sur les équipements pour générer un pré-devis.
            </p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-bg text-muted">
                  <tr>
                    <th className="text-left p-3">Catégorie</th>
                    <th className="text-left p-3">Libellé</th>
                    <th className="text-right p-3">Qté</th>
                    <th className="text-left p-3">Unité</th>
                    <th className="text-right p-3">PU HT</th>
                    <th className="text-right p-3">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {devis.lignes.map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 text-muted text-xs">{l.categorie}</td>
                      <td className="p-3">{l.libelle}</td>
                      <td className="p-3 text-right">{l.qte}</td>
                      <td className="p-3 text-muted">{l.unite}</td>
                      <td className="p-3 text-right ref">{euros(l.prix_unitaire_ht)}</td>
                      <td className="p-3 text-right ref">{euros(l.total_ht)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-bg">
                    <td colSpan={5} className="p-3 text-right font-semibold">Total HT</td>
                    <td className="p-3 text-right ref font-semibold text-accent">{euros(devis.total_ht)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="p-3 border-t border-border flex justify-end">
                <button className="btn" onClick={downloadCsv}>
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

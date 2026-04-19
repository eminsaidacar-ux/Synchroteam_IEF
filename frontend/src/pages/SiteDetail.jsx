import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { useSite } from '../hooks/useSites.js';
import { useEquipements } from '../hooks/useEquipements.js';
import EquipementCard from '../components/equipements/EquipementCard.jsx';
import ChipSelect from '../components/ui/ChipSelect.jsx';
import { FAMILLES } from '../lib/familles.js';

export default function SiteDetail() {
  const { siteId } = useParams();
  const nav = useNavigate();
  const { data: site, isLoading } = useSite(siteId);
  const [famille, setFamille] = useState(null);
  const [niveau, setNiveau]   = useState(null);
  const { data: equipements = [] } = useEquipements(siteId, { famille, niveau });

  const familleOptions = useMemo(
    () => [{ value: null, label: 'Toutes' }, ...FAMILLES.map((f) => ({ value: f.key, label: `${f.icon} ${f.label}` }))],
    []
  );
  const niveauOptions = useMemo(
    () => [{ value: null, label: 'Tous' }, ...(site?.niveaux ?? []).map((n) => ({ value: n, label: n }))],
    [site]
  );

  if (isLoading) return <p className="text-muted">Chargement…</p>;
  if (!site)     return <p className="text-muted">Site introuvable.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{site.name}</h1>
          <p className="text-sm text-muted truncate">
            {site.ref_affaire ? <span className="ref">{site.ref_affaire} · </span> : null}
            {site.address ?? '—'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/rapports?site=${siteId}`} className="btn">
            <FileText size={16} /> Rapport
          </Link>
          <button className="btn btn-primary" onClick={() => nav(`/sites/${siteId}/audit`)}>
            <Plus size={16} /> Équipement
          </button>
        </div>
      </div>

      <div className="card p-3 space-y-3">
        <ChipSelect label="Famille" value={famille} options={familleOptions} onChange={setFamille} />
        <ChipSelect label="Niveau"  value={niveau}  options={niveauOptions}  onChange={setNiveau} />
      </div>

      {equipements.length === 0 ? (
        <div className="card p-8 text-center text-muted">Aucun équipement sur ces filtres.</div>
      ) : (
        <ul className="space-y-2">
          {equipements.map((e) => <EquipementCard key={e.id} equipement={e} siteId={siteId} />)}
        </ul>
      )}
    </div>
  );
}

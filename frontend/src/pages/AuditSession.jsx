import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSite } from '../hooks/useSites.js';
import { useEquipement } from '../hooks/useEquipements.js';
import EquipementForm from '../components/equipements/EquipementForm.jsx';

// Écran plein écran d'édition d'un équipement (création ou modification).
// Mode terrain mobile-first.
export default function AuditSession() {
  const { siteId, equipId } = useParams();
  const nav = useNavigate();
  const { data: site }       = useSite(siteId);
  const { data: equipement } = useEquipement(equipId);
  const isLoading = !site || (equipId && !equipement);

  if (isLoading) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to={`/sites/${siteId}`} className="btn btn-ghost">
          <ArrowLeft size={16} /> Retour
        </Link>
        <div className="text-sm text-muted truncate">{site.name}</div>
      </div>

      <EquipementForm
        site={site}
        equipement={equipement}
        onSaved={(saved) => {
          if (!equipId) nav(`/sites/${siteId}/audit/${saved.id}`, { replace: true });
        }}
      />
    </div>
  );
}

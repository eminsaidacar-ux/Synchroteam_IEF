import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { EtatBadge, PrioriteBadge } from '../ui/Badge.jsx';
import { familleIcon, familleLabel } from '../../lib/familles.js';
import { useDeleteEquipement } from '../../hooks/useEquipements.js';

export default function EquipementCard({ equipement, siteId }) {
  const del = useDeleteEquipement();
  const photosCount = equipement.photos?.length ?? 0;
  return (
    <li className="card p-3 flex items-start gap-3">
      <div className="text-2xl leading-none pt-0.5">{familleIcon(equipement.famille)}</div>
      <Link to={`/sites/${siteId}/audit/${equipement.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="ref text-sm">{equipement.ref}</span>
          <EtatBadge etat={equipement.etat} />
          <PrioriteBadge priorite={equipement.priorite} />
        </div>
        <div className="text-sm text-muted mt-1 truncate">
          {familleLabel(equipement.famille)} · {equipement.niveau ?? '—'}
          {equipement.zone ? ` · ${equipement.zone}` : ''}
          {equipement.emplacement ? ` · ${equipement.emplacement}` : ''}
        </div>
        {photosCount > 0 && (
          <div className="text-xs text-muted mt-1">📷 {photosCount} photo(s)</div>
        )}
      </Link>
      <button
        className="btn btn-ghost text-bad"
        aria-label="Supprimer"
        onClick={() => { if (confirm(`Supprimer ${equipement.ref} ?`)) del.mutate({ id: equipement.id, site_id: siteId }); }}
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}

import { etatBadgeClass } from '../../lib/familles.js';

export function EtatBadge({ etat }) {
  if (!etat) return null;
  return <span className={`badge ${etatBadgeClass(etat)}`}>{etat}</span>;
}

export function PrioriteBadge({ priorite }) {
  if (!priorite) return null;
  const cls = priorite === 'Urgente' ? 'badge-bad' : priorite === 'Importante' ? 'badge-warn' : 'badge-good';
  return <span className={`badge ${cls}`}>{priorite}</span>;
}

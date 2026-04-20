import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, FileText, QrCode, CheckSquare, Square, Trash2, X } from 'lucide-react';
import { useSite } from '../hooks/useSites.js';
import { useEquipements, useUpsertEquipement, useDeleteEquipement } from '../hooks/useEquipements.js';
import EquipementCard from '../components/equipements/EquipementCard.jsx';
import ChipSelect from '../components/ui/ChipSelect.jsx';
import { EtatBadge, PrioriteBadge } from '../components/ui/Badge.jsx';
import { FAMILLES, ETATS, PRIORITES, familleIcon, familleLabel } from '../lib/familles.js';

export default function SiteDetail() {
  const { siteId } = useParams();
  const nav = useNavigate();
  const { data: site, isLoading } = useSite(siteId);
  const [famille, setFamille] = useState(null);
  const [niveau, setNiveau]   = useState(null);
  const { data: equipements = [] } = useEquipements(siteId, { famille, niveau });
  const [selected, setSelected] = useState(() => new Set());

  const familleOptions = useMemo(
    () => [{ value: null, label: 'Toutes' }, ...FAMILLES.map((f) => ({ value: f.key, label: `${f.icon} ${f.label}` }))],
    []
  );
  const niveauOptions = useMemo(
    () => [{ value: null, label: 'Tous' }, ...(site?.niveaux ?? []).map((n) => ({ value: n, label: n }))],
    [site]
  );

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(equipements.map((e) => e.id)));
  const clearSelection = () => setSelected(new Set());

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
          <a href={`/sites/${siteId}/qr-sheet`} target="_blank" rel="noreferrer" className="btn" title="Planche QR imprimable">
            <QrCode size={16} /> <span className="hidden sm:inline">QR</span>
          </a>
          <Link to={`/rapports?site=${siteId}`} className="btn">
            <FileText size={16} /> <span className="hidden sm:inline">Rapport</span>
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

      {equipements.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <button className="btn btn-ghost" onClick={selected.size === equipements.length ? clearSelection : selectAll}>
            {selected.size === equipements.length ? <CheckSquare size={14} /> : <Square size={14} />}
            {selected.size === 0 ? 'Tout sélectionner' : `${selected.size} sélectionné(s)`}
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <BulkToolbar
          siteId={siteId}
          selectedIds={[...selected]}
          onDone={clearSelection}
        />
      )}

      {equipements.length === 0 ? (
        <div className="card p-8 text-center text-muted">Aucun équipement sur ces filtres.</div>
      ) : (
        <ul className="space-y-2">
          {equipements.map((e) => (
            <div key={e.id} className="flex items-start gap-2">
              <button
                onClick={() => toggleSelect(e.id)}
                className="mt-3 shrink-0"
                aria-label={selected.has(e.id) ? 'Désélectionner' : 'Sélectionner'}
              >
                {selected.has(e.id)
                  ? <CheckSquare size={18} className="text-accent" />
                  : <Square size={18} className="text-muted" />}
              </button>
              <div className="flex-1 min-w-0">
                <EquipementCard equipement={e} siteId={siteId} />
              </div>
            </div>
          ))}
        </ul>
      )}
    </div>
  );
}

function BulkToolbar({ siteId, selectedIds, onDone }) {
  const upsert = useUpsertEquipement();
  const del    = useDeleteEquipement();
  const [busy, setBusy] = useState(false);

  const apply = async (patch) => {
    setBusy(true);
    try {
      for (const id of selectedIds) {
        await upsert.mutateAsync({ id, site_id: siteId, ...patch });
      }
      onDone();
    } finally { setBusy(false); }
  };

  const removeSelected = async () => {
    if (!confirm(`Supprimer ${selectedIds.length} équipement(s) ?`)) return;
    setBusy(true);
    try {
      for (const id of selectedIds) {
        await del.mutateAsync({ id, site_id: siteId });
      }
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <div className="card p-3 border border-accent/40 bg-accent/5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Actions groupées sur {selectedIds.length} équipement(s)</div>
        <button className="btn btn-ghost" onClick={onDone}><X size={14} /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs text-muted mr-1">État :</span>
          {ETATS.map((e) => (
            <button key={e} disabled={busy}
              className="chip" onClick={() => apply({ etat: e })}>
              <EtatBadge etat={e} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs text-muted mr-1">Priorité :</span>
          {PRIORITES.map((p) => (
            <button key={p} disabled={busy}
              className="chip" onClick={() => apply({ priorite: p })}>
              <PrioriteBadge priorite={p} />
            </button>
          ))}
        </div>
        <button className="btn btn-ghost text-bad ml-auto" onClick={removeSelected} disabled={busy}>
          <Trash2 size={14} /> Supprimer
        </button>
      </div>
    </div>
  );
}

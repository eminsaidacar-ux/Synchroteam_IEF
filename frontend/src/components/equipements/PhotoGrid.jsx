import { Trash2, Check, CloudOff } from 'lucide-react';
import { useSignedPhotoUrl, useTogglePhotoPdf, useDeletePhoto, useSetPhotoPhase } from '../../hooks/usePhotos.js';

export default function PhotoGrid({ photos = [] }) {
  if (photos.length === 0) return <p className="text-sm text-muted">Aucune photo.</p>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos
        .slice()
        .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
        .map((p) => <PhotoTile key={p.id} photo={p} />)}
    </div>
  );
}

// Cycle de qualification : sans phase → avant → après → sans phase.
function nextPhase(phase) {
  return phase === 'avant' ? 'apres' : phase === 'apres' ? null : 'avant';
}
const PHASE_LABEL = { avant: 'Avant', apres: 'Après' };

function metaTitle(photo) {
  const parts = [];
  if (photo.taken_at) parts.push(`Prise le ${new Date(photo.taken_at).toLocaleString('fr-FR')}`);
  if (photo.lat != null && photo.lng != null) parts.push(`GPS ${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)}`);
  return parts.join(' · ');
}

function PhotoTile({ photo }) {
  const { data: url } = useSignedPhotoUrl(photo.storage_path);
  const toggle   = useTogglePhotoPdf();
  const del      = useDeletePhoto();
  const setPhase = useSetPhotoPhase();

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-bg aspect-square">
      {url ? (
        <img src={url} alt="" title={metaTitle(photo)} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full animate-pulse bg-border" />
      )}

      <button
        type="button"
        title={photo.inclure_pdf ? 'Incluse dans le PDF' : 'Non incluse'}
        onClick={() => toggle.mutate({ id: photo.id, inclure_pdf: !photo.inclure_pdf })}
        className={`absolute top-1 left-1 h-6 w-6 rounded-md grid place-items-center border ${
          photo.inclure_pdf
            ? 'bg-accent text-black border-accent'
            : 'bg-black/50 text-muted border-border'
        }`}
      >
        <Check size={14} />
      </button>

      <button
        type="button"
        title="Supprimer"
        onClick={() => { if (confirm('Supprimer cette photo ?')) del.mutate({ id: photo.id, storage_path: photo.storage_path }); }}
        className="absolute top-1 right-1 h-6 w-6 rounded-md grid place-items-center bg-black/50 text-bad border border-border"
      >
        <Trash2 size={14} />
      </button>

      {/* Qualification avant/après : clic = cycle sans phase → avant → après */}
      <button
        type="button"
        title="Phase avant/après travaux (clic pour changer)"
        onClick={() => setPhase.mutate({ id: photo.id, phase: nextPhase(photo.phase) })}
        className={`absolute bottom-1 left-1 h-6 px-2 rounded-md text-[10px] border ${
          photo.phase
            ? 'bg-accent text-black border-accent font-semibold'
            : 'bg-black/50 text-muted border-border'
        }`}
      >
        {PHASE_LABEL[photo.phase] ?? 'Phase ?'}
      </button>

      {photo.sync_pending && (
        <span
          title="En attente de synchronisation"
          className="absolute bottom-1 right-1 h-6 w-6 rounded-md grid place-items-center bg-black/60 text-accent border border-border"
        >
          <CloudOff size={12} />
        </span>
      )}
    </div>
  );
}

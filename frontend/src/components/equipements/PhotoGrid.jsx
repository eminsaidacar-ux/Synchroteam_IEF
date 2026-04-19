import { Trash2, Check } from 'lucide-react';
import { useSignedPhotoUrl, useTogglePhotoPdf, useDeletePhoto } from '../../hooks/usePhotos.js';

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

function PhotoTile({ photo }) {
  const { data: url } = useSignedPhotoUrl(photo.storage_path);
  const toggle = useTogglePhotoPdf();
  const del    = useDeletePhoto();

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-bg aspect-square">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
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
    </div>
  );
}

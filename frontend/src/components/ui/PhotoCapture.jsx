import { useRef } from 'react';
import { Camera, ImagePlus } from 'lucide-react';

// Déclencheur de capture photo : sur mobile ouvre directement la caméra native
// (capture="environment"). Sur desktop, fallback sur la picker de fichier.
export default function PhotoCapture({ onFiles, disabled }) {
  const camRef  = useRef(null);
  const fileRef = useRef(null);

  const onChange = (e) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    e.target.value = '';
  };

  return (
    <div className="flex gap-2">
      <button type="button" className="btn btn-primary" onClick={() => camRef.current?.click()} disabled={disabled}>
        <Camera size={16} /> Photo
      </button>
      <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={disabled}>
        <ImagePlus size={16} /> Galerie
      </button>
      <input ref={camRef}  type="file" accept="image/*" capture="environment" hidden onChange={onChange} />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onChange} />
    </div>
  );
}

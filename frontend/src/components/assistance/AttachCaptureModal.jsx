import { useState } from 'react';
import { X, Paperclip, Download } from 'lucide-react';
import { useSites } from '../../hooks/useSites.js';
import { useEquipements } from '../../hooks/useEquipements.js';
import { useUploadPhoto } from '../../hooks/usePhotos.js';
import { useAuth } from '../../lib/auth.jsx';

// Modal pour rattacher une capture (issue d'une session d'assistance) à
// un équipement existant. Alternative : téléchargement direct.
export default function AttachCaptureModal({ capture, onClose, onAttached }) {
  const { data: sites = [] } = useSites();
  const { profile } = useAuth();
  const [siteId, setSiteId] = useState(null);
  const [equipId, setEquipId] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data: equipements = [] } = useEquipements(siteId);
  const upload = useUploadPhoto();

  const site = sites.find((s) => s.id === siteId);
  const equipement = equipements.find((e) => e.id === equipId);

  const download = () => {
    const a = document.createElement('a');
    a.href = capture.url;
    a.download = `capture-assistance-${Date.now()}.jpg`;
    a.click();
  };

  const attach = async () => {
    if (!site || !equipement) return;
    setBusy(true);
    try {
      await upload.mutateAsync({
        file: capture.blob,
        equipement,
        site,
        organisation_id: profile?.organisation_id,
      });
      onAttached?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-lg animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <h2 className="font-semibold flex-1">Rattacher la capture</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-xl overflow-hidden border border-border bg-black">
            <img src={capture.url} alt="capture" className="w-full max-h-60 object-contain" />
          </div>
          <div>
            <label>Site</label>
            <select className="w-full mt-1" value={siteId ?? ''} onChange={(e) => { setSiteId(e.target.value || null); setEquipId(null); }}>
              <option value="">— Choisir un site —</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {siteId && (
            <div>
              <label>Équipement</label>
              <select className="w-full mt-1" value={equipId ?? ''} onChange={(e) => setEquipId(e.target.value || null)}>
                <option value="">— Choisir un équipement —</option>
                {equipements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.ref} — {e.niveau ?? ''} {e.zone ? `· ${e.zone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex items-center gap-2 justify-end">
          <button className="btn" onClick={download}>
            <Download size={14} /> Télécharger
          </button>
          <button className="btn btn-primary" onClick={attach} disabled={!equipement || busy}>
            <Paperclip size={14} /> {busy ? 'Upload…' : 'Rattacher'}
          </button>
        </div>
      </div>
    </div>
  );
}

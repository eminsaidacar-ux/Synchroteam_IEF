import { useParams } from 'react-router-dom';
import { useSite } from '../hooks/useSites.js';
import { useEquipements } from '../hooks/useEquipements.js';
import QrCode, { qrUrlFor } from '../components/ui/QrCode.jsx';
import { familleIcon } from '../lib/familles.js';

// Planche QR imprimable : grille 3×N d'étiquettes A4 (70×37 mm chacune
// façon Avery 3475). Le bouton "Imprimer" ouvre la boîte de dialogue
// d'impression du navigateur.
export default function QrSheet() {
  const { siteId } = useParams();
  const { data: site }         = useSite(siteId);
  const { data: equipements = [] } = useEquipements(siteId);

  if (!site) return <p className="text-muted p-4">Chargement…</p>;

  return (
    <div className="qr-sheet">
      <style>{`
        @media print {
          .qr-sheet { background: white !important; color: black !important; }
          .qr-toolbar { display: none !important; }
          .qr-grid { grid-template-columns: repeat(3, 70mm); gap: 0; }
          .qr-label { page-break-inside: avoid; }
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
        }
        .qr-sheet { padding: 16px; }
        .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
        .qr-label {
          background: white; color: #0f1117; padding: 6px;
          border: 1px dashed #bbb; border-radius: 4px;
          display: flex; align-items: center; gap: 8px;
          width: 70mm; height: 37mm;
        }
        .qr-label .meta { font-size: 9pt; line-height: 1.1; min-width: 0; }
        .qr-label .ref { font-family: 'DM Mono', monospace; font-size: 10pt; font-weight: 600; }
      `}</style>

      <div className="qr-toolbar flex items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-text">Planche QR — {site.name}</h1>
          <p className="text-sm text-muted">{equipements.length} étiquette(s) · format Avery 3475 (70×37 mm)</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>Imprimer</button>
      </div>

      <div className="qr-grid">
        {equipements.map((e) => (
          <div key={e.id} className="qr-label">
            <QrCode value={qrUrlFor({ siteId: site.id, equipementId: e.id })} size={110} />
            <div className="meta">
              <div className="ref">{e.ref}</div>
              <div>{familleIcon(e.famille)} {e.niveau ?? '—'}</div>
              {e.emplacement && <div style={{ color: '#666' }}>{e.emplacement}</div>}
              <div style={{ color: '#999', marginTop: 2 }}>{site.ref_affaire ?? site.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

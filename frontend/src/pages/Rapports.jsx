import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { useSites } from '../hooks/useSites.js';
import { useEquipements } from '../hooks/useEquipements.js';
import ChipSelect from '../components/ui/ChipSelect.jsx';
import SignaturePad from '../components/ui/SignaturePad.jsx';
import { FAMILLES } from '../lib/familles.js';
import { buildAndDownloadReport } from '../lib/pdf.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Rapports() {
  const [search] = useSearchParams();
  const initialSite = search.get('site');
  const { data: sites = [] } = useSites();
  const { profile } = useAuth();
  const [siteId, setSiteId]   = useState(initialSite ?? null);
  const [famille, setFamille] = useState(null);
  const [niveau, setNiveau]   = useState(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [signature, setSignature] = useState(null);
  const [signedBy, setSignedBy]   = useState('');
  const [lastHash, setLastHash]   = useState(null);

  const site = sites.find((s) => s.id === siteId);
  const { data: equipements = [] } = useEquipements(siteId, { famille, niveau });

  const niveauOptions = useMemo(
    () => [{ value: null, label: 'Tous' }, ...(site?.niveaux ?? []).map((n) => ({ value: n, label: n }))],
    [site]
  );
  const familleOptions = useMemo(
    () => [
      { value: null, label: 'Toutes' },
      ...FAMILLES.map((f) => ({ value: f.key, label: `${f.icon} ${f.label}` })),
    ],
    []
  );

  async function onGenerate() {
    if (!site) return;
    setBusy(true); setError(null);
    try {
      const { hash } = await buildAndDownloadReport({
        site, equipements, famille, niveau,
        org: profile?.organisations?.name,
        signature, signedBy: signedBy || null,
      });
      setLastHash(hash);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Rapports</h1>

      <div className="card p-4 space-y-3">
        <div>
          <label className="block mb-1">Site</label>
          <select className="w-full" value={siteId ?? ''} onChange={(e) => setSiteId(e.target.value || null)}>
            <option value="">— Choisir un site —</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <ChipSelect label="Famille" value={famille} options={familleOptions} onChange={setFamille} />
        <ChipSelect label="Niveau"  value={niveau}  options={niveauOptions}  onChange={setNiveau} />
        <div className="pt-2 text-sm text-muted">
          {siteId ? `${equipements.length} équipement(s) inclus.` : 'Sélectionnez un site.'}
        </div>
        {error && <p className="text-bad text-sm">{error}</p>}
        <button className="btn btn-primary w-full justify-center" onClick={onGenerate}
          disabled={!siteId || busy || equipements.length === 0}>
          <FileDown size={16} /> {busy ? 'Génération…' : 'Générer le PDF'}
        </button>
        {lastHash && (
          <div className="text-xs text-muted border-t border-border pt-3 space-y-1">
            <div className="text-good">✓ Rapport généré</div>
            <div>Empreinte SHA-256 :</div>
            <div className="ref break-all text-[11px]">{lastHash}</div>
          </div>
        )}
      </div>

      {siteId && equipements.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">Signature client (optionnel)</h2>
          <p className="text-sm text-muted">
            Faire signer le maître d'ouvrage avant génération : la signature est
            intégrée au PDF et le contenu est hashé en SHA-256 (valeur probante).
          </p>
          <div>
            <label>Nom du signataire</label>
            <input className="w-full mt-1" value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)} placeholder="Nom Prénom, qualité" />
          </div>
          {signature ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-border overflow-hidden bg-white">
                <img src={signature} alt="signature" className="block w-full" />
              </div>
              <button className="btn btn-ghost" onClick={() => setSignature(null)}>Refaire la signature</button>
            </div>
          ) : (
            <SignaturePad onSign={setSignature} />
          )}
        </div>
      )}
    </div>
  );
}

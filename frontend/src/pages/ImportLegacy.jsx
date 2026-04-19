import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { importLegacyJson } from '../lib/importLegacy.js';
import { useAuth } from '../lib/auth.jsx';
import { useQueryClient } from '@tanstack/react-query';

export default function ImportLegacy() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!profile?.organisation_id) {
      setError('Votre compte n\'est pas rattaché à une organisation.');
      return;
    }
    setBusy(true); setError(null); setSummary(null); setStatus('Lecture du fichier…');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importLegacyJson(json, {
        organisation_id: profile.organisation_id,
        onProgress: (p) => setStatus(p.message),
      });
      setSummary(res);
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Import JSON (outil HTML legacy)</h1>
      <p className="text-sm text-muted">
        Sélectionnez un fichier JSON exporté depuis l'outil HTML d'audit de portes.
        Chaque porte sera convertie en équipement de famille « porte », et les
        photos base64 seront téléversées vers Supabase Storage.
      </p>

      <div className="card p-6">
        <label className="btn btn-primary inline-flex cursor-pointer">
          <Upload size={16} /> Choisir un fichier .json
          <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        {status && <p className="mt-4 text-sm text-muted">{status}</p>}
        {error && <p className="mt-4 text-sm text-bad">{error}</p>}
        {summary && (
          <div className="mt-4 text-sm">
            ✅ Import terminé : {summary.equipements} équipement(s), {summary.photos} photo(s).
            <Link to={`/sites/${summary.site_id}`} className="btn btn-ghost ml-2">Ouvrir le site</Link>
          </div>
        )}
      </div>
    </div>
  );
}

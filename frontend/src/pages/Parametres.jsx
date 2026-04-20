import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, RotateCcw, AlertTriangle } from 'lucide-react';
import { exportBackup, importBackup } from '../lib/backup.js';

// Page Paramètres : backup/restore local + reset.
// Les réglages par site (niveaux, zones, BPU...) se font directement sur
// chaque site (voir SiteSettings dans Sites.jsx).
export default function Parametres() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState(null);
  const [err, setErr]   = useState(null);

  async function onExport() {
    setErr(null); setMsg(null);
    try {
      const s = exportBackup();
      setMsg(`Export : ${s.totalSites} sites, ${s.totalEq} équipements, ${s.totalPhotos} photos.`);
    } catch (e) { setErr(e.message); }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const mode = confirm('Fusionner avec les données existantes ?\n\nOK = fusion (ajoute uniquement les nouvelles lignes).\nAnnuler = écrasement (remplace tout).')
        ? 'merge' : 'replace';
      const s = await importBackup(file, { merge: mode === 'merge' });
      setMsg(`Import terminé (${mode}) : ${s.sites} sites, ${s.equipements} équip., ${s.photos} photos. Recharge la page pour voir les changements.`);
      qc.invalidateQueries();
    } catch (err) { setErr(err.message); }
    finally { setBusy(false); }
  }

  function onReset() {
    if (!confirm('Supprimer TOUTES les données locales ? Cette action est irréversible.')) return;
    if (typeof window.__ief_reset === 'function') window.__ief_reset();
    setMsg('Données remises à zéro. Recharge la page.');
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Paramètres</h1>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Backup local</h2>
        <p className="text-sm text-muted">
          Exporte toutes tes données (sites, équipements, photos, snapshots)
          sous forme d'un seul fichier JSON. À garder précieusement, ou à
          partager avec Mehdi pour debug.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={onExport} disabled={busy}>
            <Download size={14} /> Exporter
          </button>
          <label className="btn cursor-pointer">
            <Upload size={14} /> Importer
            <input type="file" accept="application/json" className="hidden" onChange={onImport} disabled={busy} />
          </label>
        </div>
        {msg && <p className="text-sm text-good">✓ {msg}</p>}
        {err && <p className="text-sm text-bad">✗ {err}</p>}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className="text-bad" /> Zone dangereuse
        </h2>
        <p className="text-sm text-muted">
          Supprime toutes les données locales et recrée l'organisation par
          défaut. Les fichiers de backup exportés ne sont pas affectés.
        </p>
        <button className="btn text-bad border-bad/30" onClick={onReset}>
          <RotateCcw size={14} /> Remettre à zéro les données locales
        </button>
      </section>
    </div>
  );
}

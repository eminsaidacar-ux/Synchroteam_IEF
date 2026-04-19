import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { useSites, useUpsertSite, useDeleteSite } from '../hooks/useSites.js';
import { useAuth } from '../lib/auth.jsx';

export default function Sites() {
  const { data: sites = [], isLoading } = useSites();
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sites</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> Nouveau site
        </button>
      </div>

      {showForm && (
        <SiteForm
          organisation_id={profile?.organisation_id}
          onDone={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <p className="text-muted">Chargement…</p>
      ) : sites.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <Building2 className="mx-auto mb-3" />
          Aucun site. Créez-en un pour démarrer votre premier audit.
        </div>
      ) : (
        <ul className="space-y-3">
          {sites.map((s) => <SiteRow key={s.id} site={s} />)}
        </ul>
      )}
    </div>
  );
}

function SiteRow({ site }) {
  const del = useDeleteSite();
  const count = site.equipements?.[0]?.count ?? 0;
  return (
    <li className="card p-4 flex items-center justify-between gap-4">
      <Link to={`/sites/${site.id}`} className="flex-1 min-w-0">
        <div className="font-medium truncate">{site.name}</div>
        <div className="text-sm text-muted truncate">
          {site.ref_affaire ? <span className="ref">{site.ref_affaire} · </span> : null}
          {site.address ?? '—'}
        </div>
        <div className="text-xs text-muted mt-1">{count} équipement(s)</div>
      </Link>
      <button
        className="btn btn-ghost text-bad"
        onClick={() => { if (confirm('Supprimer ce site et toutes ses données ?')) del.mutate(site.id); }}
        aria-label="Supprimer"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}

function SiteForm({ organisation_id, onDone }) {
  const upsert = useUpsertSite();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [refAffaire, setRefAffaire] = useState('');

  async function submit(e) {
    e.preventDefault();
    await upsert.mutateAsync({ name, address, ref_affaire: refAffaire, organisation_id });
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="card p-4 grid md:grid-cols-3 gap-3">
      <div>
        <label>Nom</label>
        <input className="w-full mt-1" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label>Réf. affaire</label>
        <input className="w-full mt-1 ref" value={refAffaire} onChange={(e) => setRefAffaire(e.target.value)} />
      </div>
      <div>
        <label>Adresse</label>
        <input className="w-full mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="md:col-span-3 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={upsert.isPending}>Enregistrer</button>
      </div>
    </form>
  );
}

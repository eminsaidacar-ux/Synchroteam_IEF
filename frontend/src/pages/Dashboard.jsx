import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { FAMILLES } from '../lib/familles.js';

function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const [{ count: sites }, { count: equipements }, { data: byEtat }] = await Promise.all([
        supabase.from('sites').select('*', { count: 'exact', head: true }),
        supabase.from('equipements').select('*', { count: 'exact', head: true }),
        supabase.from('equipements').select('etat'),
      ]);
      const tally = { Bon: 0, Moyen: 0, Mauvais: 0, 'Hors service': 0 };
      (byEtat ?? []).forEach((r) => { if (r.etat && tally[r.etat] != null) tally[r.etat]++; });
      return { sites: sites ?? 0, equipements: equipements ?? 0, tally };
    },
  });
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { data } = useStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Bienvenue{profile?.email ? `, ${profile.email}` : ''}</h1>
        <p className="text-muted text-sm mt-1">
          {profile?.organisations?.name ?? 'Organisation non assignée'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Sites"        value={data?.sites ?? '—'} />
        <Stat label="Équipements"  value={data?.equipements ?? '—'} />
        <Stat label="Urgents"      value={data?.tally?.Mauvais ?? 0} tone="bad" />
        <Stat label="Hors service" value={data?.tally?.['Hors service'] ?? 0} tone="ko" />
      </div>

      <div className="card p-4">
        <h2 className="font-semibold mb-3">Familles d'équipements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {FAMILLES.map((f) => (
            <div key={f.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg">
              <span>{f.icon}</span>
              <span className="text-sm">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Link to="/sites" className="btn btn-primary">Voir les sites</Link>
        <Link to="/import" className="btn">Importer JSON legacy</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const color =
    tone === 'bad' ? 'text-bad' :
    tone === 'ko'  ? 'text-ko'  :
    'text-text';
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

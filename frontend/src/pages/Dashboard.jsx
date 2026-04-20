import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { FAMILLES, familleLabel, familleIcon } from '../lib/familles.js';
import BarChart, { StackedBar } from '../components/ui/BarChart.jsx';

const ETAT_COLORS = {
  Bon: '#22c55e', Moyen: '#f59e0b', Mauvais: '#ef4444', 'Hors service': '#a855f7',
};
const PRIO_COLORS = { Normale: '#6b7280', Importante: '#f59e0b', Urgente: '#ef4444' };

function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const [sitesRes, equipRes] = await Promise.all([
        supabase.from('sites').select('*', { count: 'exact', head: true }),
        supabase.from('equipements').select('famille, etat, priorite, niveau'),
      ]);
      const rows = equipRes.data ?? [];
      const tallyEtat = { Bon: 0, Moyen: 0, Mauvais: 0, 'Hors service': 0, '—': 0 };
      const tallyPrio = { Normale: 0, Importante: 0, Urgente: 0, '—': 0 };
      const byFamille = {};
      const byNiveau  = {};
      for (const r of rows) {
        tallyEtat[r.etat ?? '—']++;
        tallyPrio[r.priorite ?? '—']++;
        byFamille[r.famille ?? '—'] = (byFamille[r.famille ?? '—'] ?? 0) + 1;
        byNiveau[r.niveau ?? '—']   = (byNiveau[r.niveau ?? '—']   ?? 0) + 1;
      }
      return {
        sites: sitesRes.count ?? 0,
        equipements: rows.length,
        tallyEtat, tallyPrio, byFamille, byNiveau,
      };
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
        <Stat label="Urgents"      value={data?.tallyEtat?.Mauvais ?? 0} tone="bad" />
        <Stat label="Hors service" value={data?.tallyEtat?.['Hors service'] ?? 0} tone="ko" />
      </div>

      {data && data.equipements > 0 && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <section className="card p-4 space-y-3">
              <h2 className="font-semibold">Répartition par état</h2>
              <StackedBar segments={[
                { label: 'Bon',          value: data.tallyEtat.Bon,            color: ETAT_COLORS.Bon },
                { label: 'Moyen',        value: data.tallyEtat.Moyen,          color: ETAT_COLORS.Moyen },
                { label: 'Mauvais',      value: data.tallyEtat.Mauvais,        color: ETAT_COLORS.Mauvais },
                { label: 'Hors service', value: data.tallyEtat['Hors service'], color: ETAT_COLORS['Hors service'] },
              ]} height={14} />
              <BarChart data={[
                { label: 'Bon',          value: data.tallyEtat.Bon,            color: ETAT_COLORS.Bon },
                { label: 'Moyen',        value: data.tallyEtat.Moyen,          color: ETAT_COLORS.Moyen },
                { label: 'Mauvais',      value: data.tallyEtat.Mauvais,        color: ETAT_COLORS.Mauvais },
                { label: 'Hors service', value: data.tallyEtat['Hors service'], color: ETAT_COLORS['Hors service'] },
              ]} />
            </section>

            <section className="card p-4 space-y-3">
              <h2 className="font-semibold">Répartition par priorité</h2>
              <BarChart data={[
                { label: 'Normale',    value: data.tallyPrio.Normale,    color: PRIO_COLORS.Normale },
                { label: 'Importante', value: data.tallyPrio.Importante, color: PRIO_COLORS.Importante },
                { label: 'Urgente',    value: data.tallyPrio.Urgente,    color: PRIO_COLORS.Urgente },
              ]} />
            </section>
          </div>

          <section className="card p-4 space-y-3">
            <h2 className="font-semibold">Volume par famille</h2>
            <BarChart data={FAMILLES.map((f) => ({
              label: `${f.icon} ${f.label}`,
              value: data.byFamille[f.key] ?? 0,
            })).filter((d) => d.value > 0)} />
          </section>
        </>
      )}

      {(!data || data.equipements === 0) && (
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
      )}

      <div className="flex flex-wrap gap-2">
        <Link to="/sites"    className="btn btn-primary">Voir les sites</Link>
        <Link to="/scan"     className="btn">Scanner un QR</Link>
        <Link to="/import"   className="btn">Importer JSON legacy</Link>
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

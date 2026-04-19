import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { useSites } from '../hooks/useSites.js';
import { diffSnapshots } from '../lib/diff.js';
import { familleLabel } from '../lib/familles.js';
import { Clock, GitCompare, TrendingDown, TrendingUp, Plus, Minus } from 'lucide-react';

function useSnapshots(siteId) {
  return useQuery({
    enabled: !!siteId,
    queryKey: ['snapshots', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_snapshots')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function Historique() {
  const { data: sites = [] } = useSites();
  const [siteId, setSiteId] = useState(null);
  const { data: snapshots = [] } = useSnapshots(siteId);
  const [leftId, setLeftId] = useState(null);
  const [rightId, setRightId] = useState(null);

  const left  = snapshots.find((s) => s.id === leftId);
  const right = snapshots.find((s) => s.id === rightId);
  const diff = useMemo(
    () => (left && right ? diffSnapshots(left.data, right.data) : null),
    [left, right]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Historique d'audit</h1>
      <p className="text-sm text-muted">
        Chaque génération de rapport crée un snapshot horodaté et hashé. Sélectionne
        deux snapshots pour voir le diff : nouveautés, suppressions, dégradations,
        améliorations.
      </p>

      <div className="card p-4 space-y-3">
        <label className="block mb-1">Site</label>
        <select className="w-full" value={siteId ?? ''} onChange={(e) => {
          setSiteId(e.target.value || null); setLeftId(null); setRightId(null);
        }}>
          <option value="">— Choisir un site —</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {siteId && (
        snapshots.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <Clock className="mx-auto mb-3" />
            Pas encore de snapshot. Génère un rapport PDF pour créer le premier.
          </div>
        ) : (
          <div className="card">
            <ul className="divide-y divide-border">
              {snapshots.map((s) => (
                <SnapshotRow key={s.id} snapshot={s}
                  selectedLeft={leftId === s.id}
                  selectedRight={rightId === s.id}
                  onSelect={(side) => {
                    if (side === 'left')  setLeftId(leftId === s.id ? null : s.id);
                    if (side === 'right') setRightId(rightId === s.id ? null : s.id);
                  }}
                />
              ))}
            </ul>
          </div>
        )
      )}

      {left && right && diff && <DiffView left={left} right={right} diff={diff} />}
    </div>
  );
}

function SnapshotRow({ snapshot, selectedLeft, selectedRight, onSelect }) {
  const when = new Date(snapshot.created_at).toLocaleString('fr-FR');
  const eqCount = snapshot.data?.equipements?.length ?? 0;
  const scope = [
    snapshot.famille_scope ? familleLabel(snapshot.famille_scope) : 'Toutes familles',
    snapshot.niveau_scope  ? `Niveau ${snapshot.niveau_scope}` : 'Tous niveaux',
  ].join(' · ');

  return (
    <li className="p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm">{when}</div>
        <div className="text-xs text-muted">{scope} · {eqCount} équip.{snapshot.signed_by ? ` · signé par ${snapshot.signed_by}` : ''}</div>
        <div className="text-[10px] ref text-muted truncate mt-1">{snapshot.hash_sha256?.slice(0, 16)}…</div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          className={`btn ${selectedLeft ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onSelect('left')}
        >
          Avant
        </button>
        <button
          className={`btn ${selectedRight ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onSelect('right')}
        >
          Après
        </button>
      </div>
    </li>
  );
}

function DiffView({ left, right, diff }) {
  const leftWhen  = new Date(left.created_at).toLocaleDateString('fr-FR');
  const rightWhen = new Date(right.created_at).toLocaleDateString('fr-FR');

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare size={16} className="text-accent" />
        <h2 className="font-semibold">Diff : {leftWhen} → {rightWhen}</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <DiffStat label="Ajoutés"       count={diff.added.length}       icon={<Plus size={14} />}        tone="good" />
        <DiffStat label="Supprimés"     count={diff.removed.length}     icon={<Minus size={14} />}       tone="muted" />
        <DiffStat label="Dégradations"  count={diff.degradations.length} icon={<TrendingDown size={14} />} tone="bad" />
        <DiffStat label="Améliorations" count={diff.ameliorations.length} icon={<TrendingUp size={14} />}   tone="good" />
      </div>

      {diff.added.length > 0 && (
        <Section title={`Ajoutés (${diff.added.length})`} items={diff.added.map((e) => (
          <div key={e.id} className="text-sm">
            <span className="ref">{e.ref}</span> — {e.etat ?? '—'} / {e.priorite ?? '—'}
          </div>
        ))} />
      )}

      {diff.removed.length > 0 && (
        <Section title={`Supprimés (${diff.removed.length})`} items={diff.removed.map((e) => (
          <div key={e.id} className="text-sm text-muted">
            <span className="ref">{e.ref}</span>
          </div>
        ))} />
      )}

      {diff.modified.length > 0 && (
        <Section title={`Modifiés (${diff.modified.length})`} items={diff.modified.map((m) => (
          <div key={m.ref} className="text-sm border-b border-border/50 pb-2 last:border-0">
            <div className="ref">{m.ref}</div>
            <ul className="text-xs text-muted mt-1 space-y-0.5">
              {m.changes.map((c, i) => (
                <li key={i}>
                  <span className="text-text">{c.field}</span>{' '}
                  {c.value ? (Array.isArray(c.value) ? c.value.join(', ') : c.value) : (
                    <>
                      <span className="text-muted">{c.from ?? '—'}</span>
                      {' → '}
                      <span className="text-text">{c.to ?? '—'}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))} />
      )}
    </div>
  );
}

function DiffStat({ label, count, icon, tone }) {
  const color = tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : 'text-muted';
  return (
    <div className="bg-bg border border-border rounded-lg p-3">
      <div className="text-xs text-muted flex items-center gap-1">{icon} {label}</div>
      <div className={`text-xl font-semibold mt-1 ${color}`}>{count}</div>
    </div>
  );
}

function Section({ title, items }) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="space-y-1">{items}</div>
    </div>
  );
}

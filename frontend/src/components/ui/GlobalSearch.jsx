import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Building2, Sparkles, QrCode, Video, Calculator, FileText,
  Settings, Clock, Map, Upload, LayoutDashboard,
} from 'lucide-react';
import { useGlobalSearch } from '../../hooks/useGlobalSearch.js';
import { familleIcon, familleLabel } from '../../lib/familles.js';
import { EtatBadge } from './Badge.jsx';

const QUICK_ACTIONS = [
  { id: 'dashboard',    label: 'Dashboard',          to: '/',           icon: LayoutDashboard },
  { id: 'sites',        label: 'Voir les sites',     to: '/sites',      icon: Building2 },
  { id: 'carte',        label: 'Ouvrir la carte',    to: '/carte',      icon: Map },
  { id: 'scan',         label: 'Scanner un QR',      to: '/scan',       icon: QrCode },
  { id: 'assistance',   label: 'Télé-assistance',    to: '/assistance', icon: Video },
  { id: 'rapports',     label: 'Générer un rapport', to: '/rapports',   icon: FileText },
  { id: 'devis',        label: 'Pré-devis',          to: '/devis',      icon: Calculator },
  { id: 'historique',   label: 'Historique audits',  to: '/historique', icon: Clock },
  { id: 'import',       label: 'Importer JSON',      to: '/import',     icon: Upload },
  { id: 'parametres',   label: 'Paramètres',         to: '/parametres', icon: Settings },
];

// Palette de commandes Spotlight-like : recherche floue + actions rapides.
// Navigation clavier complète, état sélectionné, groupes sectionnés.
export default function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const { data } = useGlobalSearch(query);
  const nav = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (!open) { setQuery(''); setCursor(0); } }, [open]);

  const q = query.trim().toLowerCase();
  const actions = useMemo(
    () => q.length === 0
      ? QUICK_ACTIONS
      : QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q)),
    [q]
  );

  const groups = [];
  if (actions.length)               groups.push({ name: 'Actions',     items: actions.map((a) => ({ kind: 'action', ...a })) });
  if ((data?.sites ?? []).length)   groups.push({ name: 'Sites',       items: data.sites.map((s) => ({ kind: 'site', id: s.id, item: s })) });
  if ((data?.equipements ?? []).length) groups.push({ name: 'Équipements', items: data.equipements.map((e) => ({ kind: 'equip', id: e.id, item: e })) });

  const flat = groups.flatMap((g) => g.items);
  const max = flat.length;

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(`[data-idx="${cursor}"]`);
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const goTo = (item) => {
    if (item.kind === 'action') nav(item.to);
    else if (item.kind === 'site')  nav(`/sites/${item.item.id}`);
    else if (item.kind === 'equip') nav(`/sites/${item.item.site_id}/audit/${item.item.id}`);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { setCursor((c) => Math.min(c + 1, max - 1)); e.preventDefault(); return; }
    if (e.key === 'ArrowUp')   { setCursor((c) => Math.max(c - 1, 0));       e.preventDefault(); return; }
    if (e.key === 'Enter' && flat[cursor]) { goTo(flat[cursor]); }
  };

  if (!open) return null;

  let runningIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl card-glass shadow-popover overflow-hidden animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            className="input-cmd text-text placeholder:text-subtle"
            placeholder="Recherche ou commande…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKey}
          />
          <kbd className="shrink-0">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {max === 0 ? (
            <div className="px-4 py-12 text-center text-muted text-sm flex flex-col items-center gap-2">
              <Sparkles size={18} className="text-subtle" />
              <span>Aucun résultat pour « {query} »</span>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-2">
                <div className="px-4 pt-2 pb-1 text-[10px] text-subtle uppercase tracking-wider font-medium">
                  {g.name}
                </div>
                {g.items.map((item) => {
                  const idx = runningIdx++;
                  const active = idx === cursor;
                  return (
                    <button
                      key={`${item.kind}-${item.id ?? idx}`}
                      data-idx={idx}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => goTo(item)}
                      className={[
                        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                        active ? 'bg-accent/10 text-text' : 'text-text2 hover:bg-white/[0.03]',
                      ].join(' ')}
                    >
                      <Row item={item} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-subtle">
          <span className="flex items-center gap-2">
            <kbd>↑</kbd><kbd>↓</kbd> naviguer
          </span>
          <span className="flex items-center gap-2">
            <kbd>↵</kbd> ouvrir
          </span>
          <span className="flex items-center gap-2">
            <kbd>ESC</kbd> fermer
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ item }) {
  if (item.kind === 'action') {
    const Icon = item.icon;
    return (
      <>
        <Icon size={15} className="text-muted shrink-0" />
        <span className="text-sm">{item.label}</span>
      </>
    );
  }
  if (item.kind === 'site') {
    const s = item.item;
    return (
      <>
        <Building2 size={15} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{s.name}</div>
          <div className="text-[11px] text-muted truncate">
            {s.ref_affaire && <span className="ref">{s.ref_affaire} · </span>}
            {s.address ?? '—'}
          </div>
        </div>
      </>
    );
  }
  const e = item.item;
  return (
    <>
      <span className="text-base leading-none">{familleIcon(e.famille)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="ref text-sm">{e.ref}</span>
          <EtatBadge etat={e.etat} />
        </div>
        <div className="text-[11px] text-muted truncate">
          {familleLabel(e.famille)} · {e.niveau ?? '—'}
          {e.zone ? ` · ${e.zone}` : ''}
        </div>
      </div>
    </>
  );
}

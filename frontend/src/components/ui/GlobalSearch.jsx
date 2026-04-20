import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Building2 } from 'lucide-react';
import { useGlobalSearch } from '../../hooks/useGlobalSearch.js';
import { familleIcon, familleLabel } from '../../lib/familles.js';
import { EtatBadge } from './Badge.jsx';

// Modal de recherche globale : Cmd/Ctrl+K ou clic sur l'icône loupe.
// Cherche dans les sites et équipements, navigation clavier ↑↓ Entrée.
export default function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const { data } = useGlobalSearch(query);
  const nav = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const results = [
    ...(data?.sites ?? []).map((s) => ({ kind: 'site', item: s })),
    ...(data?.equipements ?? []).map((e) => ({ kind: 'equip', item: e })),
  ];
  const max = results.length;

  const goTo = (r) => {
    if (r.kind === 'site') nav(`/sites/${r.item.id}`);
    else nav(`/sites/${r.item.site_id}/audit/${r.item.id}`);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { setCursor((c) => Math.min(c + 1, max - 1)); e.preventDefault(); return; }
    if (e.key === 'ArrowUp')   { setCursor((c) => Math.max(c - 1, 0));        e.preventDefault(); return; }
    if (e.key === 'Enter' && results[cursor]) { goTo(results[cursor]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-4" onClick={onClose}>
      <div className="card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search size={16} className="text-muted" />
          <input
            ref={inputRef}
            autoFocus
            className="flex-1 bg-transparent border-0 p-0 focus:ring-0"
            placeholder="Rechercher un site, une référence, une zone…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKey}
          />
          <button className="btn btn-ghost" onClick={onClose} aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 ? (
            <p className="p-4 text-sm text-muted">Tape au moins 2 caractères. Raccourci : <span className="ref">Ctrl+K</span></p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted">Aucun résultat.</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={`${r.kind}-${r.item.id}`}
                    className={`p-3 cursor-pointer border-b border-border/50 ${i === cursor ? 'bg-accent/10' : ''}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => goTo(r)}>
                  {r.kind === 'site' ? (
                    <div className="flex items-center gap-3">
                      <Building2 size={16} className="text-accent" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{r.item.name}</div>
                        <div className="text-xs text-muted truncate">
                          {r.item.ref_affaire && <span className="ref">{r.item.ref_affaire} · </span>}
                          {r.item.address ?? '—'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{familleIcon(r.item.famille)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="ref text-sm">{r.item.ref}</span>
                          <EtatBadge etat={r.item.etat} />
                        </div>
                        <div className="text-xs text-muted truncate">
                          {familleLabel(r.item.famille)} · {r.item.niveau ?? '—'}
                          {r.item.zone ? ` · ${r.item.zone}` : ''}
                          {r.item.emplacement ? ` · ${r.item.emplacement}` : ''}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

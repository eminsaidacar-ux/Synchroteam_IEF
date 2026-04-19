import { useState } from 'react';
import { CATALOGUE, applyProduct } from '../../lib/catalogue.js';

// Sélecteur de produit du catalogue. Quand l'utilisateur choisit un produit,
// on merge ses defaults dans specs (sans écraser les valeurs déjà saisies).
export default function ProductPicker({ famille, specs, onChange }) {
  const products = CATALOGUE[famille];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  if (!products || products.length === 0) return null;

  const filtered = query
    ? products.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
    : products;

  const pick = (product) => {
    onChange(applyProduct(specs, product));
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="btn w-full justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-muted text-sm">📚 Pré-remplir depuis le catalogue</span>
        <span className="text-xs text-accent">{products.length} produits</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full card p-2 max-h-80 overflow-y-auto">
          <input
            autoFocus
            className="w-full mb-2 text-sm"
            placeholder="Rechercher (marque, ref…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="space-y-1">
            {filtered.length === 0 && <li className="text-muted text-sm p-2">Aucun résultat.</li>}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-bg border border-transparent hover:border-border text-sm"
                  onClick={() => pick(p)}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-muted ref">
                    {p.marque_moteur ?? p.marque} · {p.ref_moteur ?? p.ref_centrale ?? p.ref}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

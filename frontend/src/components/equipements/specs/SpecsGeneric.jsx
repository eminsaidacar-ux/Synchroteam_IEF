// Fallback pour les familles sans formulaire dédié (barriere, automatisme...).
// Permet la saisie libre de paires clé/valeur.

export default function SpecsGeneric({ specs, onChange }) {
  const entries = Object.entries(specs ?? {});
  const set = (k, v) => onChange({ ...specs, [k]: v });
  const remove = (k) => {
    const next = { ...specs };
    delete next[k];
    onChange(next);
  };
  const add = () => {
    const key = prompt('Nom du champ ?');
    if (!key) return;
    set(key, '');
  };
  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-muted">Aucun champ pour l'instant.</p>
      )}
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 items-center">
          <span className="text-sm text-muted min-w-[120px]">{k}</span>
          <input className="flex-1" value={v ?? ''} onChange={(e) => set(k, e.target.value)} />
          <button type="button" className="btn btn-ghost text-bad" onClick={() => remove(k)}>×</button>
        </div>
      ))}
      <button type="button" className="btn" onClick={add}>+ Ajouter un champ</button>
    </div>
  );
}

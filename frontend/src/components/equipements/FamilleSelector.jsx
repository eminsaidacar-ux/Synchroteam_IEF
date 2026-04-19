import { FAMILLES } from '../../lib/familles.js';

export default function FamilleSelector({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {FAMILLES.map((f) => (
        <button
          key={f.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(f.key)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
            value === f.key
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border bg-bg text-muted hover:text-text'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          <span>{f.icon}</span>
          <span className="truncate">{f.label}</span>
        </button>
      ))}
    </div>
  );
}

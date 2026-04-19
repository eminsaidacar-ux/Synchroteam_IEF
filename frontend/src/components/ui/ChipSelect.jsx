export default function ChipSelect({ label, value, options, onChange, multiple = false }) {
  const isActive = (o) => multiple ? (value ?? []).includes(o) : value === o;
  const toggle = (o) => {
    if (!multiple) return onChange(o);
    const arr = new Set(value ?? []);
    arr.has(o) ? arr.delete(o) : arr.add(o);
    onChange([...arr]);
  };
  return (
    <div>
      {label && <label className="block mb-1">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const v = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          return (
            <button
              type="button"
              key={`${lbl}-${i}`}
              className={`chip ${isActive(v) ? 'chip-active' : ''}`}
              onClick={() => toggle(v)}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

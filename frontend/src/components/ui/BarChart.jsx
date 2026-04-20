// Graphique en barres horizontales, pur SVG sans dépendance. Accepte
// data: [{ label, value, color? }]. Total affiché à droite.

export default function BarChart({ data, max }) {
  const ceiling = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const pct = Math.round((d.value / ceiling) * 100);
        return (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <div className="w-24 truncate text-muted">{d.label}</div>
            <div className="flex-1 relative h-5 bg-bg rounded overflow-hidden">
              <div
                className="h-full rounded"
                style={{ width: `${pct}%`, backgroundColor: d.color ?? '#ff6b00', transition: 'width 0.3s' }}
              />
            </div>
            <div className="w-8 text-right ref text-xs">{d.value}</div>
          </div>
        );
      })}
    </div>
  );
}

// Barres empilées horizontales (stacked).
// segments: [{ label, value, color }].
export function StackedBar({ segments, height = 10 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex w-full rounded overflow-hidden" style={{ height }}>
      {segments.map((s, i) => (
        <div key={i}
             title={`${s.label} : ${s.value}`}
             style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
      ))}
    </div>
  );
}

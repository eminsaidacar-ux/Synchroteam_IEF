import ChipSelect from '../../ui/ChipSelect.jsx';

const TYPES     = ['Ouverture à la française', 'Oscillo-battant', 'Coulissante', 'Fixe', 'Châssis soufflant'];
const MATERIAUX = ['ALU', 'PVC', 'BOIS', 'MIX'];
const VITRAGES  = ['4/16/4', '6/16/4', 'Monolithique', 'Feuilleté'];
const VTYPES    = ['Clair', 'Sécurit', 'Dépoli', 'Acoustique'];

export default function SpecsFenetre({ specs, onChange }) {
  const set = (k, v) => onChange({ ...specs, [k]: v });
  return (
    <div className="space-y-4">
      <ChipSelect label="Type" value={specs.type} options={TYPES} onChange={(v) => set('type', v)} />
      <ChipSelect label="Matériau" value={specs.materiau} options={MATERIAUX} onChange={(v) => set('materiau', v)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>Largeur (mm)</label>
          <input type="number" className="w-full mt-1" value={specs.largeur_mm ?? ''}
            onChange={(e) => set('largeur_mm', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label>Hauteur (mm)</label>
          <input type="number" className="w-full mt-1" value={specs.hauteur_mm ?? ''}
            onChange={(e) => set('hauteur_mm', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>
      <ChipSelect label="Vitrage composition" value={specs.vitrage_composition} options={VITRAGES}
        onChange={(v) => set('vitrage_composition', v)} />
      <ChipSelect label="Vitrage type" value={specs.vitrage_type} options={VTYPES}
        onChange={(v) => set('vitrage_type', v)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>Uw (W/m²·K)</label>
          <input type="number" step="0.01" className="w-full mt-1" value={specs.uw ?? ''}
            onChange={(e) => set('uw', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label>Nb vantaux</label>
          <input type="number" className="w-full mt-1" value={specs.nb_vantaux ?? ''}
            onChange={(e) => set('nb_vantaux', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>
    </div>
  );
}

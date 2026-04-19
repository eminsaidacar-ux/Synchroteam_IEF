import ChipSelect from '../../ui/ChipSelect.jsx';

const TYPES     = ['Simple vantail', 'Double vantaux', 'Coulissante', 'Portail', 'Porte de service', 'Trappe'];
const MATERIAUX = ['MET', 'ALU', 'BOIS', 'PVC', 'MIX'];
const CLASSES   = ['STD', 'PF', 'CF30', 'CF60', 'CF90', 'CF120'];
const SENS      = ['Gauche', 'Droite', 'Double', 'Coulissante', 'Autre'];

export default function SpecsPorte({ specs, onChange }) {
  const set = (k, v) => onChange({ ...specs, [k]: v });
  return (
    <div className="space-y-4">
      <ChipSelect label="Type d'ouvrage" value={specs.type_ouvrage} options={TYPES}
        onChange={(v) => set('type_ouvrage', v)} />
      <ChipSelect label="Matériau" value={specs.materiau} options={MATERIAUX}
        onChange={(v) => set('materiau', v)} />
      <ChipSelect label="Classe sécurité" value={specs.classe_securite} options={CLASSES}
        onChange={(v) => set('classe_securite', v)} />
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
      <ChipSelect label="Sens d'ouverture" value={specs.sens_ouverture} options={SENS}
        onChange={(v) => set('sens_ouverture', v)} />
    </div>
  );
}

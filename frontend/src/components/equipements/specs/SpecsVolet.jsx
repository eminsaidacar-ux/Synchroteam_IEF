import ChipSelect from '../../ui/ChipSelect.jsx';

const TYPES     = ['Aluminium', 'PVC', 'Acier'];
const MARQUES   = ['Somfy', 'Nice', 'Simu'];
const COMMANDES = ['Interrupteur', 'Télécommande', 'Domotique'];

export default function SpecsVolet({ specs, onChange }) {
  const set = (k, v) => onChange({ ...specs, [k]: v });
  return (
    <div className="space-y-4">
      <ChipSelect label="Type" value={specs.type} options={TYPES} onChange={(v) => set('type', v)} />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!specs.motorise}
          onChange={(e) => set('motorise', e.target.checked)} />
        <span>Motorisé</span>
      </label>
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
      <ChipSelect label="Marque moteur" value={specs.marque_moteur} options={MARQUES}
        onChange={(v) => set('marque_moteur', v)} />
      <div>
        <label>Réf. moteur</label>
        <input className="w-full mt-1 ref" value={specs.ref_moteur ?? ''}
          onChange={(e) => set('ref_moteur', e.target.value)} />
      </div>
      <ChipSelect label="Commande" value={specs.commande} options={COMMANDES}
        onChange={(v) => set('commande', v)} />
    </div>
  );
}

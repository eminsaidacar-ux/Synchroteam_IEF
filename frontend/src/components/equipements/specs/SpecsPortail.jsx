import ChipSelect from '../../ui/ChipSelect.jsx';
import ProductPicker from '../../ui/ProductPicker.jsx';

const TYPES   = ['Coulissant', 'Battant', 'Levant', 'Barrière levante', 'Bollard'];
const MARQUES = ['Came', 'Roger', 'BFT', 'Nice', 'Faac'];
const ALIM    = ['220V', '24V', 'Solaire'];

export default function SpecsPortail({ specs, onChange }) {
  const set = (k, v) => onChange({ ...specs, [k]: v });
  return (
    <div className="space-y-4">
      <ProductPicker famille="portail" specs={specs} onChange={onChange} />
      <ChipSelect label="Type" value={specs.type} options={TYPES} onChange={(v) => set('type', v)} />
      <div>
        <label>Largeur (mm)</label>
        <input type="number" className="w-full mt-1" value={specs.largeur_mm ?? ''}
          onChange={(e) => set('largeur_mm', e.target.value ? Number(e.target.value) : null)} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!specs.motorise}
          onChange={(e) => set('motorise', e.target.checked)} />
        <span>Motorisé</span>
      </label>
      <ChipSelect label="Marque" value={specs.marque} options={MARQUES}
        onChange={(v) => set('marque', v)} />
      <div>
        <label>Réf. centrale</label>
        <input className="w-full mt-1 ref" value={specs.ref_centrale ?? ''}
          onChange={(e) => set('ref_centrale', e.target.value)} />
      </div>
      <ChipSelect label="Alimentation" value={specs.alimentation} options={ALIM}
        onChange={(v) => set('alimentation', v)} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!specs.boucle_magnetique}
            onChange={(e) => set('boucle_magnetique', e.target.checked)} />
          <span>Boucle magnétique</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!specs.cellules}
            onChange={(e) => set('cellules', e.target.checked)} />
          <span>Cellules</span>
        </label>
        <label className="flex items-center gap-2 col-span-2">
          <input type="checkbox" checked={!!specs.feux_clignotants}
            onChange={(e) => set('feux_clignotants', e.target.checked)} />
          <span>Feux clignotants</span>
        </label>
      </div>
    </div>
  );
}

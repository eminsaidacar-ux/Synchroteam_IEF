import ChipSelect from '../../ui/ChipSelect.jsx';
import ProductPicker from '../../ui/ProductPicker.jsx';

const TYPES     = ['Rideau lames', 'Rideau grille', 'Rideau microperforé', 'Porte sectionnelle'];
const MARQUES   = ['Somfy', 'Nice', 'Came', 'Roger'];
const COMMANDES = ['Télécommande', 'Bouton poussoir', 'Badge', 'Temporisé'];
const FDC       = ['Mécanique', 'Électronique'];

export default function SpecsRideauMetal({ specs, onChange }) {
  const set = (k, v) => onChange({ ...specs, [k]: v });
  return (
    <div className="space-y-4">
      <ProductPicker famille="rideau_metal" specs={specs} onChange={onChange} />
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
      <ChipSelect label="Fin de course" value={specs.fin_de_course} options={FDC}
        onChange={(v) => set('fin_de_course', v)} />
    </div>
  );
}

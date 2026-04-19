import ChipSelect from '../../ui/ChipSelect.jsx';

const TYPES      = ['Lecteur badge', 'Digicode', 'Interphone', 'Visiophone', 'Contrôleur'];
const PROTOCOLES = ['Wiegand', 'OSDP', '125kHz', '13.56MHz'];

export default function SpecsAcces({ specs, onChange }) {
  const set = (k, v) => onChange({ ...specs, [k]: v });
  return (
    <div className="space-y-4">
      <ChipSelect label="Type" value={specs.type} options={TYPES} onChange={(v) => set('type', v)} />
      <div>
        <label>Marque</label>
        <input className="w-full mt-1" value={specs.marque ?? ''}
          onChange={(e) => set('marque', e.target.value)} />
      </div>
      <div>
        <label>Référence</label>
        <input className="w-full mt-1 ref" value={specs.ref ?? ''}
          onChange={(e) => set('ref', e.target.value)} />
      </div>
      <ChipSelect label="Protocole" value={specs.protocole} options={PROTOCOLES}
        onChange={(v) => set('protocole', v)} />
      <div>
        <label>Nombre d'utilisateurs</label>
        <input type="number" className="w-full mt-1" value={specs.nb_utilisateurs ?? ''}
          onChange={(e) => set('nb_utilisateurs', e.target.value ? Number(e.target.value) : null)} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!specs.connecte}
          onChange={(e) => set('connecte', e.target.checked)} />
        <span>Connecté (IP/cloud)</span>
      </label>
    </div>
  );
}

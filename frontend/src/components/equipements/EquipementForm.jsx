import { useEffect, useState } from 'react';
import ChipSelect from '../ui/ChipSelect.jsx';
import FamilleSelector from './FamilleSelector.jsx';
import SpecsRouter from './SpecsRouter.jsx';
import PhotoCapture from '../ui/PhotoCapture.jsx';
import PhotoGrid from './PhotoGrid.jsx';
import { ETATS, PRIORITES, FAMILLES } from '../../lib/familles.js';
import { useUpsertEquipement } from '../../hooks/useEquipements.js';
import { useUploadPhoto } from '../../hooks/usePhotos.js';
import { useAuth } from '../../lib/auth.jsx';

const DEFAULT_ACTIONS = [
  'Remplacement joint CF',
  'Remplacement ferme-porte',
  'Graissage serrure',
  'Reprise peinture',
  'Remplacement béquille',
  'Réglage fermeture',
];

export default function EquipementForm({ site, equipement, onSaved }) {
  const isNew = !equipement?.id;
  const { profile } = useAuth();
  const upsert = useUpsertEquipement();
  const upload = useUploadPhoto();

  const [famille, setFamille]           = useState(equipement?.famille ?? 'porte');
  const [ref, setRef]                   = useState(equipement?.ref ?? '');
  const [niveau, setNiveau]             = useState(equipement?.niveau ?? '');
  const [zone, setZone]                 = useState(equipement?.zone ?? '');
  const [emplacement, setEmplacement]   = useState(equipement?.emplacement ?? '');
  const [specs, setSpecs]               = useState(equipement?.specs ?? {});
  const [etat, setEtat]                 = useState(equipement?.etat ?? null);
  const [priorite, setPriorite]         = useState(equipement?.priorite ?? null);
  const [actions, setActions]           = useState(equipement?.actions ?? []);
  const [observations, setObservations] = useState(equipement?.observations ?? '');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);

  const niveaux = site?.niveaux ?? [];

  useEffect(() => {
    if (!isNew || ref) return;
    const prefix = FAMILLES.find((f) => f.key === famille)?.refPrefix ?? 'E';
    const num = String((site?.equipements?.length ?? 0) + 1).padStart(3, '0');
    setRef(`${prefix}${num}`);
  }, [famille, isNew, ref, site]);

  async function save() {
    setSaving(true); setError(null);
    try {
      const saved = await upsert.mutateAsync({
        id: equipement?.id,
        site_id: site.id,
        famille, ref, niveau: niveau || null, zone, emplacement, specs,
        etat, priorite, actions, observations,
      });
      onSaved?.(saved);
      return saved;
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onPhotoFiles(files) {
    let target = equipement;
    if (!target?.id) {
      target = await save();
      if (!target?.id) return;
    }
    for (const file of files) {
      await upload.mutateAsync({
        file,
        equipement: target,
        site,
        organisation_id: profile?.organisation_id,
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Famille</h2>
        <FamilleSelector value={famille} onChange={setFamille} disabled={!isNew} />
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Identification</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>Réf.</label>
            <input className="w-full mt-1 ref" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div>
            <label>Zone</label>
            <input className="w-full mt-1" value={zone} onChange={(e) => setZone(e.target.value)} />
          </div>
        </div>
        <ChipSelect label="Niveau" value={niveau} options={niveaux} onChange={setNiveau} />
        <div>
          <label>Emplacement</label>
          <input className="w-full mt-1" value={emplacement} onChange={(e) => setEmplacement(e.target.value)} />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Caractéristiques</h2>
        <SpecsRouter famille={famille} specs={specs} onChange={setSpecs} />
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Constat</h2>
        <ChipSelect label="État"     value={etat}     options={ETATS}     onChange={setEtat} />
        <ChipSelect label="Priorité" value={priorite} options={PRIORITES} onChange={setPriorite} />
        <ChipSelect label="Actions recommandées" value={actions} options={DEFAULT_ACTIONS}
          onChange={setActions} multiple />
        <div>
          <label>Observations</label>
          <textarea rows={3} className="w-full mt-1" value={observations}
            onChange={(e) => setObservations(e.target.value)} />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Photos</h2>
        {isNew ? (
          <p className="text-sm text-muted">Enregistrez d'abord l'équipement pour ajouter des photos.</p>
        ) : (
          <>
            <PhotoCapture onFiles={onPhotoFiles} disabled={upload.isPending} />
            <PhotoGrid photos={equipement?.photos ?? []} />
          </>
        )}
      </section>

      {error && <p className="text-bad text-sm">{error}</p>}

      <div className="sticky bottom-16 md:static md:mt-4">
        <button onClick={save} disabled={saving} className="btn btn-primary w-full justify-center">
          {saving ? 'Enregistrement…' : isNew ? 'Créer' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

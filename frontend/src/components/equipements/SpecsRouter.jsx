import SpecsPorte from './specs/SpecsPorte.jsx';
import SpecsFenetre from './specs/SpecsFenetre.jsx';
import SpecsRideauMetal from './specs/SpecsRideauMetal.jsx';
import SpecsPortail from './specs/SpecsPortail.jsx';
import SpecsVolet from './specs/SpecsVolet.jsx';
import SpecsAcces from './specs/SpecsAcces.jsx';
import SpecsGeneric from './specs/SpecsGeneric.jsx';

const COMPONENTS = {
  porte: SpecsPorte,
  fenetre: SpecsFenetre,
  rideau_metal: SpecsRideauMetal,
  portail: SpecsPortail,
  barriere: SpecsPortail,
  volet_roulant: SpecsVolet,
  acces: SpecsAcces,
  automatisme: SpecsGeneric,
};

export default function SpecsRouter({ famille, specs, onChange }) {
  const Cmp = COMPONENTS[famille] ?? SpecsGeneric;
  return <Cmp specs={specs ?? {}} onChange={onChange} />;
}

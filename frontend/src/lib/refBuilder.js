// Génération automatique des références normalisées d'équipement.
// Format : {PREFIX}{N}-{NIVEAU}-{COMPOSANTS...}
// Ex : P001-SS-PC-MET-CF60 / F042-R+2-ALU-OB / R007-RDC-LAMES

import { FAMILLES } from './familles.js';

const pad = (n, w = 3) => String(n).padStart(w, '0');

// Nettoie un segment : enlève accents/espaces, majuscules, compacte.
function seg(v) {
  if (v == null || v === '') return '';
  return String(v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9+]/g, '');
}

// Abréviations typiques par famille pour compacter la ref.
const TYPE_ABBREV = {
  porte: {
    'Simple vantail': 'SV', 'Double vantaux': 'DV', 'Coulissante': 'COUL',
    'Portail': 'PT', 'Porte de service': 'PS', 'Trappe': 'TR',
  },
  fenetre: {
    'Ouverture à la française': 'OF', 'Oscillo-battant': 'OB',
    'Coulissante': 'COUL', 'Fixe': 'FIX', 'Châssis soufflant': 'CS',
  },
  rideau_metal: {
    'Rideau lames': 'LAMES', 'Rideau grille': 'GRILLE',
    'Rideau microperforé': 'MICRO', 'Porte sectionnelle': 'SECT',
  },
  portail: {
    'Coulissant': 'COUL', 'Battant': 'BAT', 'Levant': 'LEV',
    'Barrière levante': 'BL', 'Bollard': 'BOL',
  },
  volet_roulant: { 'Aluminium': 'ALU', 'PVC': 'PVC', 'Acier': 'AC' },
  acces: {
    'Lecteur badge': 'BADGE', 'Digicode': 'DIGI', 'Interphone': 'ITP',
    'Visiophone': 'VSP', 'Contrôleur': 'CTRL',
  },
};

function abbrev(famille, value) {
  const a = TYPE_ABBREV[famille]?.[value];
  return a ?? seg(value);
}

function componentsByFamille(famille, specs = {}) {
  switch (famille) {
    case 'porte':
      return [
        abbrev('porte', specs.type_ouvrage),
        seg(specs.materiau),
        seg(specs.classe_securite),
      ];
    case 'fenetre':
      return [
        seg(specs.materiau),
        abbrev('fenetre', specs.type),
      ];
    case 'rideau_metal':
      return [
        abbrev('rideau_metal', specs.type),
        specs.motorise ? 'MOT' : '',
      ];
    case 'portail':
    case 'barriere':
      return [
        abbrev('portail', specs.type),
        specs.motorise ? 'MOT' : '',
      ];
    case 'volet_roulant':
      return [
        abbrev('volet_roulant', specs.type),
        specs.motorise ? 'MOT' : '',
      ];
    case 'acces':
      return [
        abbrev('acces', specs.type),
        seg(specs.protocole),
      ];
    default:
      return [];
  }
}

export function buildRef({ famille, specs, niveau, zone, ordre }) {
  const prefix = FAMILLES.find((f) => f.key === famille)?.refPrefix ?? 'E';
  const n = pad(ordre ?? 1);
  const niv = seg(niveau);
  const zn  = seg(zone);
  const comps = componentsByFamille(famille, specs).filter(Boolean);
  return [`${prefix}${n}`, niv, zn, ...comps].filter(Boolean).join('-');
}

// Ref courte pour affichage en liste (tronque les composants techniques).
export function shortRef(ref) {
  if (!ref) return '';
  const parts = ref.split('-');
  return parts.slice(0, 3).join('-');
}

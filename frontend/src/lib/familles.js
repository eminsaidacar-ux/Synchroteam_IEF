// Catalogue des familles d'équipements. Chaque famille définit ses specs,
// son icône (emoji), son label et son préfixe de référence.

export const FAMILLES = [
  { key: 'porte',          label: 'Portes',              icon: '🚪', refPrefix: 'P' },
  { key: 'fenetre',        label: 'Fenêtres',            icon: '🪟', refPrefix: 'F' },
  { key: 'rideau_metal',   label: 'Rideaux métalliques', icon: '🔩', refPrefix: 'R' },
  { key: 'volet_roulant',  label: 'Volets roulants',     icon: '🪟', refPrefix: 'V' },
  { key: 'portail',        label: 'Portails',            icon: '🚗', refPrefix: 'PT' },
  { key: 'barriere',       label: 'Barrières',           icon: '🚧', refPrefix: 'B' },
  { key: 'automatisme',    label: 'Automatismes',        icon: '⚙️', refPrefix: 'A' },
  { key: 'acces',          label: "Contrôle d'accès",    icon: '🔒', refPrefix: 'CA' },
];

export const FAMILLE_KEYS = FAMILLES.map((f) => f.key);

export const familleLabel = (key) =>
  FAMILLES.find((f) => f.key === key)?.label ?? key;

export const familleIcon = (key) =>
  FAMILLES.find((f) => f.key === key)?.icon ?? '📦';

export const ETATS     = ['Bon', 'Moyen', 'Mauvais', 'Hors service'];
export const PRIORITES = ['Normale', 'Importante', 'Urgente'];

export const etatBadgeClass = (etat) => ({
  Bon: 'badge-good',
  Moyen: 'badge-warn',
  Mauvais: 'badge-bad',
  'Hors service': 'badge-ko',
}[etat] ?? '');

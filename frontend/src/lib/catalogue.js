// Référentiel produits — base statique des moteurs et équipements les plus
// courants rencontrés en audit. Chaque entrée définit ses specs par défaut,
// qui sont mergées dans le formulaire quand le technicien sélectionne le produit.
//
// TODO phase 2 : migrer vers une table Supabase pour que chaque organisation
// puisse l'enrichir + partage inter-clients.

export const CATALOGUE = {
  // ============ Rideaux métalliques / portes sectionnelles ============
  rideau_metal: [
    {
      id: 'somfy-rsx-pro',
      label: 'Somfy RSX Pro',
      marque_moteur: 'Somfy',
      ref_moteur: 'RSX Pro',
      defaults: { type: 'Rideau lames', motorise: true, commande: 'Télécommande', fin_de_course: 'Électronique' },
    },
    {
      id: 'nice-era-m',
      label: 'Nice Era M',
      marque_moteur: 'Nice',
      ref_moteur: 'Era M',
      defaults: { type: 'Rideau lames', motorise: true, commande: 'Télécommande', fin_de_course: 'Électronique' },
    },
    {
      id: 'came-c-bxe',
      label: 'Came C-BXE',
      marque_moteur: 'Came',
      ref_moteur: 'C-BXE',
      defaults: { type: 'Rideau lames', motorise: true, commande: 'Bouton poussoir', fin_de_course: 'Mécanique' },
    },
    {
      id: 'hormann-superlift',
      label: 'Hörmann Superlift',
      marque_moteur: 'Hörmann',
      ref_moteur: 'Supramatic E4',
      defaults: { type: 'Porte sectionnelle', motorise: true, commande: 'Télécommande', fin_de_course: 'Électronique' },
    },
  ],

  // ============ Portails motorisés ============
  portail: [
    {
      id: 'came-bx-74',
      label: 'Came BX-74',
      marque: 'Came', ref_centrale: 'ZBX',
      defaults: { type: 'Coulissant', motorise: true, alimentation: '220V', cellules: true, feux_clignotants: true },
    },
    {
      id: 'faac-741',
      label: 'Faac 741',
      marque: 'Faac', ref_centrale: '452MPS',
      defaults: { type: 'Coulissant', motorise: true, alimentation: '220V', cellules: true },
    },
    {
      id: 'bft-ares',
      label: 'BFT Ares',
      marque: 'BFT', ref_centrale: 'Thalia',
      defaults: { type: 'Coulissant', motorise: true, alimentation: '220V' },
    },
    {
      id: 'nice-wingo',
      label: 'Nice Wingo',
      marque: 'Nice', ref_centrale: 'MC824H',
      defaults: { type: 'Battant', motorise: true, alimentation: '220V', cellules: true },
    },
    {
      id: 'came-gard',
      label: 'Came Gard 4040',
      marque: 'Came', ref_centrale: 'ZL38',
      defaults: { type: 'Barrière levante', motorise: true, alimentation: '220V', boucle_magnetique: true },
    },
  ],

  // ============ Volets roulants ============
  volet_roulant: [
    {
      id: 'somfy-oximo-50',
      label: 'Somfy Oximo 50',
      marque_moteur: 'Somfy', ref_moteur: 'Oximo 50',
      defaults: { type: 'Aluminium', motorise: true, commande: 'Interrupteur' },
    },
    {
      id: 'somfy-io-rts',
      label: 'Somfy io-homecontrol',
      marque_moteur: 'Somfy', ref_moteur: 'Oximo io',
      defaults: { type: 'Aluminium', motorise: true, commande: 'Domotique' },
    },
    {
      id: 'nice-era-star',
      label: 'Nice Era Star',
      marque_moteur: 'Nice', ref_moteur: 'Era Star MA',
      defaults: { type: 'Aluminium', motorise: true, commande: 'Télécommande' },
    },
    {
      id: 'simu-t5',
      label: 'Simu T5',
      marque_moteur: 'Simu', ref_moteur: 'T5 Hz.02',
      defaults: { type: 'PVC', motorise: true, commande: 'Interrupteur' },
    },
  ],

  // ============ Contrôle d'accès ============
  acces: [
    {
      id: 'urmet-1760',
      label: 'Urmet Digicode 1760',
      marque: 'Urmet', ref: '1760/1',
      defaults: { type: 'Digicode', protocole: 'Wiegand', nb_utilisateurs: 100, connecte: false },
    },
    {
      id: 'intratone-kiboo',
      label: 'Intratone Kiboo',
      marque: 'Intratone', ref: 'Kiboo',
      defaults: { type: 'Interphone', protocole: '13.56MHz', connecte: true },
    },
    {
      id: 'comelit-simplebus',
      label: 'Comelit SimpleBus',
      marque: 'Comelit', ref: 'Mini ViP',
      defaults: { type: 'Visiophone', connecte: false },
    },
    {
      id: 'vigik-b10',
      label: 'Vigik B10',
      marque: 'Cogelec', ref: 'B10',
      defaults: { type: 'Lecteur badge', protocole: '13.56MHz', connecte: true },
    },
  ],
};

// Applique les defaults d'un produit aux specs existantes (sans écraser
// les champs déjà renseignés manuellement).
export function applyProduct(specs = {}, product) {
  if (!product) return specs;
  const patch = { ...product.defaults };
  for (const k of ['marque', 'marque_moteur', 'ref', 'ref_moteur', 'ref_centrale']) {
    if (product[k]) patch[k] = product[k];
  }
  // Les champs déjà remplis manuellement ne sont pas écrasés.
  const next = { ...specs };
  for (const [k, v] of Object.entries(patch)) {
    if (next[k] == null || next[k] === '') next[k] = v;
  }
  return next;
}

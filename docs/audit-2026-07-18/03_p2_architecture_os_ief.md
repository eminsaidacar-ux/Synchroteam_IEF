# P2 — DOSSIER D'ARCHITECTURE : L'OS IEF
### Synthèse arbitrée. Dossier complet (schémas Mermaid, SQL intégral, tableaux agents) : annexe D. Contre-points intégrés : annexe E §3.

## Décision structurante n°1 : étendre l'existant, pas réécrire

Le dépôt contient la plateforme « IEF Audit » (React 18 + Vite + Tailwind + TanStack Query, Supabase Postgres/RLS/Auth/Storage, PWA, E2E Playwright). L'état des lieux de l'architecte a été **vérifié fichier par fichier par la contre-expertise : exact point par point**. ~35 % de l'OS IEF cible existe déjà.

| Réutilisable tel quel | À refactorer | À jeter |
|---|---|---|
| Multi-org + RLS, sites (avec lat/lng), équipements 8 familles, QR codes, signature tactile + hash SHA-256, versionning audit, PDF, E2E, CI/CD Vercel | Offline données (aujourd'hui localStorage mode dev → outbox IndexedDB avec sync), visio (PeerJS broker public + STUN seul → PeerServer + coturn auto-hébergés, sinon échec en 4G/CGNAT), BPU statique (55 €/h en dur, incohérent avec la doctrine 60/110 → tarifs en DB), photos (ajouter EXIF/GPS/horodatage) | `backup.js`, auth mock locale |

## Architecture cible (résumé)

- **Odoo reste la vérité comptable** : clients, devis, factures. Le pont (Supabase Edge Functions) pousse/tire par API mais **n'écrit jamais** factures ni clients. Table `refs_externes` pour le mapping des ids.
- **L'OS IEF gère le terrain** : tickets (numéro universel généré par séquence **à la création** — transposition serveur du péage P1, fin définitive du problème myId), interventions (anti-collision planning par contrainte GIST, à étendre au binôme `technicien_2_id`), rapports guidés par checklist métier, astreinte + rattachement SR différé, 492 sites EG + équipements + historique par équipement.
- **Achats (V2)** : bons de commande, fournisseurs multi-catalogues (Trénois, Foussier, Würth, Rexel, Francofa), prix d'achat historisés en append-only, rapprochement devis fournisseur ↔ ligne de devis client, vue `v_marge_affaire` — la **vraie** marge (au coût chargé calibré par Fayçal, pas au prix de vente).
- **Contrôles structurels en base** : clôture impossible sans rapport (trigger), `audit_log` append-only, agents IA **sans écriture directe** — uniquement des RPC validantes `SECURITY DEFINER` + file `agent_taches` + table `approbations` (qui peut approuver quoi).
- **Couche agents** : TEO orchestrateur + 5 sous-agents (triage/dispatch, chiffrage, achats, facturation/relances, qualité/audit). Règle d'or : **un agent n'envoie jamais rien, il prépare** ; l'envoi/l'engagement est humain (Emin ou Chayma selon la matrice d'approbation). Mécanique : file en DB (SKIP LOCKED) + webhooks.
- **Portail donneur d'ordre** : à vendre aux syndics/hôtels ; **pas à EG** (leurs coordinateurs vivent dans ServiceChannel — adoption improbable, requalification contre-expertise).

## Stack et coûts

Supabase + Vercel + Edge Functions TypeScript + PeerServer/coturn sur petit VPS. Argument décisif : stack mainstream que Claude Code peut construire et maintenir seul (parade au précédent « développeur externe unique »). Infra ~70-130 €/mois vs ~100-170 €/mois de Synchroteam économisés : **cash neutre — l'argument de vente est le ROI fonctionnel** (zéro re-saisie, marge réelle par affaire, rapprochement du soir supprimé), pas l'économie d'abonnement. Tarifs publics à date, non contractuels. Région Supabase « Paris » à vérifier avant d'écrire « données en France » (sinon dire « UE », honnêtement).

## MVP → V1 → V2

- **MVP (8 semaines)** — la suggestion « rapport mobile + photos » de la mission a été challengée et écartée : l'existant la couvre déjà à ~70 %. MVP retenu : **le dossier d'intervention de bout en bout** — ticket → job → rapport signé → PDF poussé sur la carte Odoo — qui supprime une douleur quotidienne réelle (le rapprochement manuel du soir). Double piste avec Synchroteam pendant toute la période, critère de sortie chiffré.
- **V1 (+3-4 mois)** : planning drag & drop, module astreinte, matching SR, 2 premiers agents (triage, facturation/relances), ingestion Gmail server-side — **après** migration du hub mail sur le domaine (le compte Gmail grand public est trop fragile pour un OAuth Google Cloud de production). Résiliation Synchroteam seulement après 30 jours d'uptime observé + extraction complète de l'historique jobs (à faire **dès le MVP**, la profondeur d'historique de `job/list` étant à vérifier).
- **V2** : achats/marge réelle, agents complets, maintenance préventive.

## Charge et calendrier (requalifiés)

85-110 jours de développement Claude Code = **enveloppe**, pas estimation fine. La variable de dérapage n'est pas la vélocité de développement : c'est le **pilotage produit** (qui décrit le besoin, qui tranche les micro-choix). Condition : créneau hebdo protégé d'Emin, ou délégation des arbitrages non-doctrine à Hichem/Fayçal. Calendrier 12-14 mois ±50 % (l'incertitude porte sur le calendrier, pas sur la charge). Revue Emin ~25-30 h **hors** pilotage.

## Exploitation (ajout contre-expertise, D-2)

Après résiliation Synchroteam, une panne Supabase/Vercel un samedi soir laisserait l'astreinte 7j/7 sans outil — et personne n'est « d'astreinte du logiciel ». Parades : supervision uptime (gratuite), mode dégradé documenté = le flux P1 (dictée à TEO + carte Odoo) reste le plan B permanent, bascule Synchroteam retardée à 30 j d'uptime. RGPD : information individuelle préalable de Jorge/Yanis (géolocalisation, photos horodatées, audit trail nominatif) + registre des traitements **avant** la mise en production.

## Kolus : verdict

Ne pas adopter comme socle : `crmId` non settable par API = rédhibitoire (le lien avec Odoo serait manuel pour 492 sites), API non contractuelle, dépendance à un éditeur early-stage. Garder le trial jusqu'à septembre 2026 comme filet de sécurité, benchmark UX (la visio est le standard à égaler) — et parade immédiate et gratuite au manque de compétence contrôle d'accès de Jorge (visio-assistance Emin ↔ terrain).

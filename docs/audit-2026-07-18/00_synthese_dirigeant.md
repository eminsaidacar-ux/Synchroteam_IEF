# SYNTHÈSE DIRIGEANT — AUDIT IEF & CO
### 18/07/2026 — 1 page — les 5 décisions à prendre

Méthode : quatre expertises parallèles (process/erreurs, contexte/tokens, cash/pilotage, architecture logicielle) passées au crible d'une contre-expertise contradictoire qui a vérifié le code ligne à ligne et inspecté le dépôt existant. Tout ce qui suit a survécu à cette relecture ; les chiffres survendus ont été requalifiés.

**Constat central.** Le diagnostic du dossier de mission est confirmé : l'exécution précède le contrôle, et la mémoire repose sur des textes que l'IA doit *décider* de relire. Toutes les erreurs historiques (adresse Suresnes, myId absent, mail factuel faux, planification inférée) ont eu lieu **alors que la doctrine était relue**. La parade n'est donc pas plus de doctrine : c'est du contrôle **structurel** — du code qui refuse d'écrire.

**Découverte de l'audit.** Le dépôt git contient déjà une plateforme « IEF Audit » fonctionnelle (React + Supabase : sites, équipements, photos, rapports PDF signés SHA-256, PWA, visio WebRTC, QR). Vérifiée fichier par fichier : elle couvre ~35 % de l'OS IEF cible. P2 ne part pas de zéro.

---

## Les 5 décisions

**D1 — Instaurer le « péage » : toute écriture Odoo/Synchroteam passe par `ief_lib` v1.1.**
Une bibliothèque Python unique (livrée, corrigée, compilée) dont chaque fonction refuse d'écrire si une règle est violée : entité de facturation EG, livraison = site, ticket universel posé à la création (fin du problème myId), prix non ronds, TVA 20 %, cran d'arrêt sur mails sensibles (brouillon à valider, jamais d'envoi direct). Les 7 points de contrôle cessent d'être une checklist : ils deviennent inviolables. **Préalable non négociable : une session de vérification en réel avec les clés API** (liste fermée de ~10 points à tester) avant de figer le code en article 171.

**D2 — Sécuriser les clés et la mémoire (angle mort de tout le monde, priorité 1).**
Aujourd'hui les clés pleines-puissances du compte d'Emin circulent en clair dans la conversation, et les articles 140/169/170 (la mémoire de l'entreprise) n'ont ni sauvegarde ni versionnage. Décision : créer un utilisateur API Odoo dédié à droits restreints, protocole d'injection unique + rotation mensuelle, export hebdomadaire des articles clés (5 lignes dans le rituel du vendredi).

**D3 — Rituel cash « zéro terminé-non-facturé à J+2 », structurel.**
La clôture terrain devient un geste atomique : `cloturer_terrain()` vérifie le devis confirmé, crée une activité Odoo datée J+2 sur Chayma, puis passe la carte en À FACTURER. L'activité Odoo survit aux conversations : le délai a un porteur même si TEO oublie. Escalade automatique à Emin sur activité échue. Dashboard cash en 6 requêtes au point du matin, cash en première ligne. Cas « BLOQUÉ SR » (EG) suivi à part en € et en âge. Question à trancher au passage : les factures EG doivent-elles être déposées dans ServiceChannel ? Si oui, étendre la délégation de Chayma à la soumission (demander à EG un **second utilisateur** ServiceChannel à son nom — pas de partage de login).

**D4 — Refonte du contexte : viser ×2 à ×4 mesurés (pas de promesse miracle).**
Noyau stable (identité, invariants, arbre d'ouverture — ~2 500 tokens) recopié une fois dans les instructions du projet Claude (geste Emin, poste fixe, 2-3 fois/an) ; registre 169 reformaté en lignes fixes (1 ligne = 1 dossier, ≤ 25 actifs + parking anti-écrasement de sujets) ; règles inviolables migrées dans le code, plus jamais relues ; skills à la demande. L'économie est réelle mais la lib elle-même reste résidente (~12 k tokens fixes) : on annonce ×2-4, mesurés avant/après par script — pas les ×7-10 initialement estimés.

**D5 — Lancer le MVP OS IEF en étendant l'existant ; ne pas adopter Kolus comme socle.**
MVP retenu (challengé et arbitré) : non pas « le rapport mobile » (déjà couvert à ~70 % par l'existant) mais le **dossier d'intervention de bout en bout** — ticket → job → rapport signé → PDF poussé sur la carte Odoo — qui supprime le rapprochement manuel du soir. 8 semaines en double piste avec Synchroteam ; résiliation seulement après 30 jours d'uptime observé, avec mode dégradé astreinte documenté (le flux P1 dictée-TEO reste le plan B permanent). Kolus : crmId non settable par API = rédhibitoire comme socle ; garder le trial jusqu'à septembre comme filet et benchmark UX (et sa visio comme parade immédiate au manque de compétence contrôle d'accès de Jorge). **Condition de réussite : un créneau hebdo protégé de pilotage produit (Emin ou délégué à Hichem/Fayçal pour les arbitrages non-doctrine)** — c'est la variable de dérapage, pas la vélocité de développement.

---

**Ce que ça change pour l'équipe** : Chayma reçoit les activités J+2 et (si EG accepte) un accès ServiceChannel à son nom ; Fayçal calibre le coût horaire chargé (préalable à tout affichage de « marge ») et prend les achats ≤ 5 000 € ; Hichem devient backup astreinte et pilote produit possible ; Jorge/Yanis : WhatsApp transféré au hub avec pour seule règle « objet = nom du site » — pas de trace = pas fait.

*Détail des mises en œuvre : `01` (quick wins), `02` + `ief_lib/` (code), `03` (architecture), `04` (roadmap), `05` (risques). Annexes A-E : rapports complets des cinq expertises.*

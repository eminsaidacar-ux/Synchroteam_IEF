# P1 — BIBLIOTHÈQUE ANTI-ERREUR `ief_lib` v1.1
### Le code des fonctions encapsulées validantes — version unifiée et contre-expertisée

**Fichier canonique : [`ief_lib/ief_lib.py`](ief_lib/ief_lib.py)** (stdlib uniquement, Python 3.10+, secrets via variables d'environnement, aucune clé en clair). Corrections appliquées : [`ief_lib/CHANGELOG_v1.1.md`](ief_lib/CHANGELOG_v1.1.md). Code source v1.0 et argumentaire complet : annexe A. Contre-expertise ligne à ligne : annexe E §1-2.

## Principe

Les 7 points de contrôle et les verrous V1-V6 cessent d'être une checklist relue *après* l'écriture : ils deviennent des **validations bloquantes exécutées avant** l'écriture. Une fonction qui détecte une violation liste TOUTES les violations et refuse d'écrire (`raise`). Après chaque écriture, une relecture automatique compare le résultat à l'intention et `raise` en cas d'écart. Les erreurs historiques 1 à 4 (§5 de la mission) deviennent structurellement impossibles :

| Erreur historique | Verrou codé |
|---|---|
| Adresse de livraison laissée sur Suresnes ; facture au nom du site | livraison = site obligatoire ; entité de facturation vérifiée par `child_of` 9 (robuste aux sites `is_company`) |
| myId absent à la création, irrécupérable après clôture | ticket = 1er argument obligatoire de `creer_job()` ; non-EG : ticket interne `IEF-AAAAMMJJ-P<id>` généré par la lib |
| Erreur factuelle dans un mail parti | `envoyer_mail_client` exige `source_verifiee=True` + `source_citee` ; preuve d'envoi = un `mail.message` **postérieur** à l'envoi (plus de faux « vérifié ») |
| Planification sur inférence d'un vocal ambigu | `planifier_job(source="inference")` refuse d'écrire ; le tampon TEC031 est refusé en assignation finale |

## Fonctions exposées (contrat)

**Écriture (le péage)** : `creer_carte_eg()`, `creer_devis()` (lien carte↔devis via `opportunity_id`, obligatoire pour EG), `creer_job()`, `planifier_job()`, `envoyer_mail_client()` (cran d'arrêt → `BROUILLON_A_VALIDER` ; Emin toujours en copie ; liens #E30613 ; contrôle plus-addressing IONOS ; signature lue depuis l'article 160 par la lib), `rattacher_sr()`, `cloturer_terrain()` (devis confirmé exigé, activité J+2 Chayma créée avant le passage de carte), `creer_variante_catalogue()` (piège `[[4, id, 0]]` encapsulé).

**Lecture (dashboard & audit)** : `dashboard_cash()` (double filet terrain→CRM et CRM→compta, statut « BLOQUÉ SR » à part), `devis_en_attente()` (paliers J+5/J+12/J+30), `impayes()`, `factures_brouillon()`, `encours_par_client()`, `escalades_facturation()`, `audit_flash()`, compteurs qualité.

**Mémoire (protocole registre unifié)** : `JOURNAL` auto-rempli par chaque fonction d'écriture, `maj_registre()` (write-ahead), `checkpoint()` (consolidation en lignes 169), `parker()` (anti-écrasement de sujets).

**Transport** : `st_list()` unique pour toutes les listes Synchroteam — `raise` si l'enveloppe attendue est absente (jamais de liste vide silencieuse) ; urlencode systématique ; datetimes en Europe/Paris explicite.

## Conditions de déploiement

1. **Campagne « À VÉRIFIER EN RÉEL » d'abord** (liste fermée en `01_p1_quick_wins.md` §2 et dans la docstring `CAMPAGNE_DE_VERIFICATION` du fichier) — une session avec les clés, puis on fige.
2. Stockage en article Odoo 171, bloc code/`<pre>` uniquement ; hash SHA-256 vérifié au chargement (intégrité après collage).
3. Amendement doctrine 140 (une phrase) : toute écriture passe par la lib ; un `execute_kw` brut en écriture est une erreur auditable.
4. Test d'injection hebdomadaire (AM-14, annexe A) : une fois par semaine, tenter volontairement une écriture non conforme et vérifier que la lib la refuse — on teste les parades comme on teste les sauvegardes.

## Ce que la lib ne couvre pas (assumé)

- ServiceChannel (aucun accès API) : Accept et saisies restent humains — d'où la délégation Chayma (second utilisateur).
- Les lectures libres (search_read exploratoires) restent hors péage : le risque porte sur l'écriture.
- La lib réside dans la fenêtre de conversation (~12 k tokens) : coût assumé, compté dans l'objectif ×2-4 de l'architecture contexte (annexe B requalifiée).

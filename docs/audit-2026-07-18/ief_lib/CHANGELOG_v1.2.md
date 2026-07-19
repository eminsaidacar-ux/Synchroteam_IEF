# CHANGELOG — ief_lib v1.1 → v1.2
### Fichier canonique unique : `ief_lib.py` — 19/07/2026
Base : v1.1 (18/07/2026). Objet : intégration des 13 résultats de la campagne
« À vérifier en réel » exécutée 13/13 EN PRODUCTION le 18/07/2026 (ordre de
mission n°2, Chantier 1). Les résultats de campagne sont la vérité ground-truth
et sont FIGÉS dans le code. Les 14 marqueurs `A VERIFIER EN REEL` de la v1.1
sont retirés ; la docstring `CAMPAGNE_DE_VERIFICATION` est supprimée, remplacée
par une note d'en-tête « campagne exécutée 13/13 le 18/07/2026, résultats
figés ». Chaque point figé est commenté « CAMPAGNE 18/07/2026 (figé) » à
l'endroit exact du code.

## Chaque point de campagne → changement appliqué

| Point de campagne (ground truth) | Changement dans le code |
|---|---|
| Enveloppe listes = `{page, pageSize, records, recordsTotal, data}`, tableau = `data` | `st_list()` : enveloppe FERME `data` — plus de tentative `records` (qui est un compteur, pas une liste) ; raise si `data` absent, message citant l'enveloppe attendue. Marqueur point 1 retiré. |
| Statuts observés : created, scheduled, synchronized, paused, completed, validated, cancelled | `ST_STATUTS_TERMINES = {"completed", "validated"}` (set figé ; « closed » n'existe pas — l'hypothèse Agent A est abandonnée). Marqueur point 2 retiré. |
| Timezone Synchroteam : heure locale Europe/Paris, format `AAAA-MM-JJ HH:MM` sans suffixe TZ | Nouvelle constante `FORMATS_DT_ST` + fonction `st_parse_dt()` (→ datetime AWARE Europe/Paris, secondes tolérées, raise si illisible). `planifier_job()` accepte désormais `HH:MM` et `HH:MM:SS` et documente l'heure locale. Marqueurs point 5 retirés (planifier_job, jobs_termines). |
| Complétion réelle : champs `actualStart`/`actualEnd` sur job/details | `jobs_termines()` (source du filet A du dashboard cash) : `fin = actualEnd` avec FALLBACK `scheduledEnd` si absent — « terminé » n'est plus daté sur le planifié mais sur le réel (ex. campagne : 3 h 30 d'écart). |
| `dateFrom`/`dateTo` de job/list fonctionnels, historique profond OK (1 245 jobs 2020-2024) | Docstring de `_trouver_job_st_par_myid()` mise à jour (fonctionnement confirmé, figé). Marqueur point 4 retiré. |
| Payload `job/send` = `{customer:{id}, site:{id}, type:{name}, description, myId}` ; `job/send` avec `id` = update partiel | `creer_job()` : nouveau paramètre optionnel `type_nom` → `type:{name}` ; payload confirmé documenté (myId à la création, verrouillé après clôture du rapport) ; `address` conservé en fallback documenté hors payload campagne. Marqueur point 3 retiré. |
| Payload `job/schedule` = `{id, technician:{id}, scheduledStart, scheduledEnd}` | `planifier_job()` : payload inchangé, désormais documenté comme CONFIRMÉ EN PROD (les deux datetimes exigés, heure locale Europe/Paris). |
| `site/list` : le paramètre `search` NE FILTRE PAS | Déjà en place en v1.1 (`chercher_site_st` : pagination + filtre local) — re-confirmé par la campagne, documenté « figé ». |
| Odoo 19 : champ des taxes de ligne = **`tax_ids`** (`tax_id` n'existe plus), TVA 20 % = tax id 36 | `creer_devis()` : écriture `"tax_ids": [[6,0,[36]]]` et relecture ligne à ligne sur `tax_ids` (les deux occurrences `tax_id` corrigées). Marqueur point 6 retiré. |
| Sites EG : `child_of` 9 validé sur 3 sites réels (commercial_partner_id=9, is_company=False) | `_v_site_eg()` : contrôle `child_of` 9 CONSERVÉ (validé en prod, plus robuste aux imports). Marqueur point 7 retiré. |
| `mail.activity.type` To-Do = id 4 confirmé | `_activity_type_todo()` : résolution dynamique CONSERVÉE, avec `ACTIVITY_TYPE_TODO_FALLBACK = 4` — si la recherche par nom ne rend rien, fallback sur 4 au lieu de bloquer. Marqueur point 9 retiré. |
| Partner 9 : `property_payment_term_id` = [4, "30 Days"] DÉJÀ POSÉ | Aucun avertissement à ce sujet dans la lib (retiré du plan de campagne) ; `factures_impayees()` documente que les calculs de retard EG sont FIABLES. Contrôlé à chaque session par `autotest()` (point 5). Marqueur point 10 retiré. |
| `search_count` mail.message ~0,8 s : acceptable | Commentaire figé dans `_detecter_sensibilite()` (détection premier contact conservée telle quelle). Marqueur point 11 retiré. |
| `mail.mail` : champs `state` et `failure_reason` disponibles | Diagnostic d'envoi de `envoyer_mail_client()` : `failure_reason` AJOUTÉ aux champs lus de la file mail.mail. Marqueur point 13 retiré. |
| Article 160 (signatures) : accessible | `signature_canonique()` : marqueur point 12 retiré ; accessibilité contrôlée à chaque session par `autotest()`. |
| **STAGES CRM — doublons (découverte critique)** : 17 stages, 2 pipelines mélangés, DEVIS ENVOYÉ en id 4 ET 14, DEVIS ACCEPTÉ en 10 ET 12 | Voir section dédiée ci-dessous. Marqueur point 8 retiré. |

## STAGES figés (remplacement de `resoudre_stage()`)

- `resoudre_stage()` (résolution par nom) est **SUPPRIMÉE** : avec les doublons
  de noms découverts, toute recherche par nom est ambiguë PAR CONSTRUCTION et
  aurait levé une ambiguïté dès le premier appel.
- Nouveau dictionnaire FIGÉ (ids canoniques, article 170) :
  `STAGES = {"NOUVEAU": 2, "DEVIS A FAIRE": 3, "DEVIS ENVOYE": 4,
  "INTERVENTION PLANIFIEE": 5, "COMMANDE A FAIRE": 6, "A PLANIFIER": 7,
  "A FACTURER": 8, "CLOTURE": 9, "DEVIS ACCEPTE": 10}` — remplace l'ancien
  `STAGES_CRM` (qui portait deux ids `None` à résoudre).
- **Liste noire explicite** : `STAGES_INTERDITS = frozenset({12, 13, 14, 17,
  18, 19})` (second pipeline) — `stage_id()` raise si l'un de ces ids est
  atteint ; interdits à la lib, où que ce soit.
- Nouvel accesseur `stage_id(nom)` avec **contrôle anti-renommage au premier
  usage** de chaque stage dans la session : read du nom réel en base,
  comparaison normalisée (accents/casse/underscores via `_normaliser_nom_stage`,
  car les noms réels portent des accents : « DEVIS ENVOYÉ », « À PLANIFIER »,
  « CLÔTURÉ ») au nom attendu ; **raise si divergence** — le jour où quelqu'un
  renomme ou réordonne un stage, la lib s'arrête au lieu d'écrire dans la
  mauvaise colonne. Résultat mis en cache session (1 read par stage maximum).
- Sites d'appel migrés : `creer_carte_eg` (défaut `stage="A PLANIFIER"`),
  `cloturer_terrain` et `termines_non_factures_filet_A`
  (`stage_id("A FACTURER")` / `stage_id("CLOTURE")`).

## `autotest()` — nouveau, remplace la campagne (section 11)

Fonction embarquée, **LECTURE SEULE**, à lancer en DÉBUT de session avant toute
écriture (≈ 10 lectures chirurgicales, 2-3 s). 10 points, rapport court
OK/ÉCHEC par point + résumé ; un seul ÉCHEC = ne rien écrire :
1. `stages_figes` — noms réels des 9 stages vs dict STAGES (un seul read) ;
2. `stages_liste_noire` — aucun id interdit dans STAGES (contrôle local) ;
3. `tva_36` — la taxe 36 existe et vaut 20 % ;
4. `activite_todo_4` — mail.activity.type 4 existe (To-Do) ;
5. `partner_9_paiement` — property_payment_term_id posé sur le partner 9 ;
6. `enveloppe_st_data` — `job/list?pageSize=1` contient bien la clé `data` ;
7. `article_160_signatures` — article 160 accessible et non vide ;
8. `registre_169` — article 169 accessible ;
9. `tampon_exclu` — TEC031 hors de TECHNICIENS_PLANIFIABLES (local, X-10) ;
10. `hash_integrite` — SHA-256 du fichier stable depuis le chargement
    (en exécution par collage : renvoi vers `empreinte_texte()` / article 172).

## Divers

- En-tête : article de stockage = **172** (PAS 171, déjà occupé — décision D1) ;
  `ARTICLE_LIB = 172`, nouvelle constante `ARTICLE_STAGES = 170` ; toutes les
  mentions « article 171 » (section intégrité, message de chargement,
  `empreinte_texte`) corrigées en 172.
- Protocole secrets **INCHANGÉ** (clé actuelle via `os.environ`) ; le point
  « PRIORITÉ 1 : utilisateur API dédié » est remplacé par la décision **D2
  arbitrée** (18/07/2026) : pas d'utilisateur dédié pour le moment, NE PAS
  re-proposer (R-1 reste ouvert au registre des risques).
- `VERSION = "1.2"` ; import `unicodedata` ajouté (normalisation des noms de
  stages) — toujours stdlib pur, aucun `import requests`, aucun secret en clair.
- Conservé intégralement de la v1.1 : hash SHA-256 affiché au chargement,
  `empreinte_texte()`, toutes les validations bloquantes (tickets A-1, prix
  non ronds, site ≠ 9, montants interdits en description, cran d'arrêt mails,
  verrou V2 inférence, source_verifiee/source_citee, preuve d'envoi A-2,
  plus-addressing IONOS), JOURNAL / `parker()` / `checkpoint()` /
  `maj_registre()` (write-ahead), toutes les fonctions cash et
  `dashboard_cash()`, `rattacher_sr()`, `creer_variante_catalogue()`,
  `audit_flash()`.

## Vérifications effectuées avant livraison

- `python3 -m py_compile ief_lib.py` : OK.
- Mini-test hors-ligne (mock, non livré) : 25/25 points OK — logique
  STAGES/liste noire/anti-renommage (y compris renommage simulé et id interdit
  injecté), parsing datetime Europe/Paris (UTC+1/+2 selon saison, raise si
  illisible), enveloppe `data` ferme de `st_list`, statuts terminés figés,
  `jobs_termines` sur actualEnd + fallback, validations de `planifier_job`.

## Hash SHA-256 du fichier final (à reporter en tête de l'article 172)

```
82169b2416d44aa89922d0dd436c4478b549ba12a7040e7da484910e1b91c06c  ief_lib.py
```

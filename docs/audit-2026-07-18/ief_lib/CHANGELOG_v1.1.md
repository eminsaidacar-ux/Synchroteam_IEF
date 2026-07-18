# CHANGELOG — ief_lib v1.0 → v1.1
### Fichier canonique unique : `ief_lib.py` — 18/07/2026
Base : code v1.0 de l'Agent A. Toutes les corrections de la contre-expertise
Agent E (§8, détail §1.2, §2.2, §4) sont appliquées, plus l'intégration des
fonctions cash (Agent C) et mémoire (Agent B). Référence de chaque entrée :
identifiant E → ce qui a changé dans le code.

## Corrections bloquantes

- **A-1 — Tickets non-EG** : nouveau format de ticket interne universel
  `IEF-AAAAMMJJ-P<id>` (regex `RE_IEF`, générateur `nouveau_ticket_interne()`).
  `_v_reference_ticket(ref, eg)` est désormais paramétré : bloquant SR/AST en
  mode EG, accepte aussi `IEF-…` sinon. Jamais de devis ni de job sans ticket,
  pour aucun client — le premier devis copro ne casse plus et ne force plus de
  contournement de la lib. `creer_job` accepte le format IEF.
- **A-2 — Preuve d'envoi mail** : `envoyer_mail_client()` capture le dernier
  `mail.message` id du dossier AVANT l'envoi (`_dernier_message_id`) ; la
  preuve exige un message **postérieur** dont le **sujet correspond**, sinon
  `raise` (plus de faux « ENVOYE_ET_VERIFIE » fabriqué par un message antérieur).
  Diagnostic joint : lecture de la file `mail.mail` (state outgoing/exception).
  `verifier_rendu_mail()` prend `apres_message_id` + `sujet_attendu` bloquant.
- **C-1 — `cloturer_terrain()` DANS la lib** : (1) recherche du `sale.order`
  **confirmé** lié au ticket, `raise` sinon (interdiction structurelle de
  passer une carte en À FACTURER sans devis) ; (2) activité Odoo J+2 sur
  Chayma (user 20) créée **d'abord**, carte passée en À FACTURER **ensuite**
  (le porteur de délai existe avant le changement d'état) ; (3) `_relecture`
  des deux écritures. Plus aucun write brut hors péage.
- **A-5 / C-2 / X-6 — Enveloppe Synchroteam** : fonction unique `st_list()`
  qui tente `data` puis `records` et **RAISE** si aucune clé n'est présente
  (fin des listes vides silencieuses — pire classe de bug pour un système
  anti-erreur). Utilisée partout via le générateur `st_pages()` (audit_flash,
  chercher_site_st, jobs_termines, filet A, recherche par myId). Statuts de
  clôture centralisés dans l'unique constante `ST_STATUTS_TERMINES`
  (marquée À VÉRIFIER EN RÉEL — A testait 3 statuts, C en testait 2).

## Corrections majeures

- **A-3 — Premier contact** : Emin (toujours en copie) est **exclu** de la
  boucle de détection ; logique inversée et corrigée :
  `premier_contact = any(search_count == 0 pour les destinataires externes)`.
  Domaine corrigé : `["partner_ids", "in", [int(pid)]]` (liste, pas scalaire).
- **A-4 — Seuils mails sensibles** : l'override d'environnement
  `SEUIL_MAIL_SENSIBLE_HT` est **supprimé**. Barème différencié en dur dans
  `SEUILS_MAIL_HT` : EG 5000 / hôtel 3000 / copro 1500 / particulier 1500 /
  défaut 3000, plus les déclencheurs non monétaires (sinistre, premier
  contact, remise) inchangés. Modification = amendement 140 validé Emin.
- **A-6 — `_v_site_eg`** : le rattachement au parent 9 est testé par
  `search_count("res.partner", [["id","=",site_id],["id","child_of",9]])` au
  lieu de `commercial_partner_id` — robuste aux fiches sites `is_company`
  issues d'imports en masse (qui sont leur propre commercial_partner_id).
- **A-8 — `creer_variante_catalogue()`** ajoutée : le trou du péage sur
  l'enrichissement catalogue (workflow CHIFFRE) est comblé, avec le piège §6
  `product.template.attribute.line` write `[[4, value_id, 0]]` encapsulé,
  création de la `product.attribute.value` si absente, et relecture.
- **C-3 — Lien carte↔devis** : paramètre `opportunity_id` sur `creer_devis()`,
  **obligatoire si `eg=True`** ; écrit dans le sale.order et relu. Alimente
  `delai_emission()` (qui ne mesurera plus 0 devis), le filet A et rattacher_sr.
- **C-4 — Transport unique stdlib** : tout le pan Synchroteam (y compris les
  requêtes cash de C) passe par `urllib` via `_st_call`/`st_get`/`st_post`/
  `st_list`. **Aucun `import requests` dans le fichier.** Une seule convention
  de secrets (`os.environ`).
- **X-4 — Signature lue par la lib** : `envoyer_mail_client(signature_html=None)`
  → `signature_canonique()` lit l'article Odoo 160 (read chirurgical), **une
  fois par session** (cache module `_CACHE_SIGNATURE`), verbatim garanti.
- **X-8 / Agent B — Mémoire structurelle intégrée** : `JOURNAL` (log en
  mémoire auto-rempli par `_log()` en fin de **chaque** fonction d'écriture),
  `parker(sujet, etat)` + `PILE` (anti-écrasement de sujets), `checkpoint()`
  (affiche journal + pile, consolide en lignes de registre, persiste la pile
  en section PARKING), `maj_registre()` (**write-ahead** d'une ligne à
  l'ouverture d'un dossier). Format registre 169 = celui de l'Agent B : bloc
  `<pre>`, 8 colonnes fixes `ID|CLIENT|OBJET|ETAT|PROCHAINE_ACTION|QUI|
  ECHEANCE|REFS`, vocabulaire d'états fermé (`ETATS_REGISTRE`), budgets durs
  (ligne ≤ 110 chars, ≤ 25 actifs, ≤ 10 parkés), horodatage Europe/Paris en
  tête, relecture après chaque écriture du registre.

## Corrections mineures et risques (lot A-7, A-9/R-1, R-4, R-7, X-10, C-5)

- **A-7 / X-10 — Tampon TEC031** : exclu de `planifier_job()` via la constante
  `TECHNICIENS_PLANIFIABLES` (refus en amont) ; reste surveillé en aval par
  `audit_flash()` (rien ne dort au tampon > 48 h).
- **A-7 — None en XML-RPC** : dans les lignes de devis, la clé `name` est
  **omise** si le libellé est vide (plus jamais de `None` envoyé ; Odoo
  calcule la description depuis le produit).
- **A-7 — Signature exclue du scan des liens** : `verifier_rendu_mail()`
  ignore les `<a>` dont le `href` appartient à la signature (fin des fausses
  alertes à chaque envoi si la signature canonique contient des liens non rouges).
- **A-7 — `RE_SR` faible documenté** : commentaire explicite (toute suite de
  6-10 chiffres passe, y compris une date AAAAMMJJ) — validation assumée.
- **A-9 / R-1 — Protocole secrets en tête de fichier** : message d'injection
  unique `os.environ` jamais recité, rotation mensuelle des clés, utilisateur
  API Odoo dédié « TEO API » remonté en PRIORITÉ 1 (AM-7).
- **R-4 — Timezone** : `zoneinfo.ZoneInfo("Europe/Paris")` explicite partout
  (`maintenant()` / `aujourdhui()`), plus aucun `datetime.now()` /
  `date.today()` naïf (vérifié par AST). Timezone des réponses Synchroteam
  marquée À VÉRIFIER EN RÉEL.
- **R-7 — Intégrité du source** : SHA-256 du fichier calculé et affiché au
  chargement (`EMPREINTE_SHA256`) ; `empreinte_texte()` pour vérifier un code
  collé depuis l'article 171 (parade aux altérations du rich-text Odoo :
  guillemets typographiques, espaces insécables).

## Intégration des requêtes cash (Agent C, corrigées)

`jobs_termines`, `termines_non_factures_filet_A` (+ jobs sans myId séparés),
`termines_non_factures_filet_B` (+ marquage `bloque_sr`), `devis_en_attente`,
`factures_impayees`, `factures_brouillon`, `encours_par_client`,
`taux_transformation`, `dso` (caveat write_date affiché), `recurrence_clients`,
`delai_emission` (**C-5 : lectures de cartes batchées, plus de N+1**),
`escalades_facturation`, et l'agrégateur `dashboard_cash()` (ordre = impact
cash). **C-5 : « marge » renommée** — `ecart_valorisation_mo()` (60/110 € sont
des prix de vente, pas des coûts ; jamais le mot « marge » devant Emin).
**C-5 : `activity_type_id` résolu dynamiquement** (`_activity_type_todo()`,
cache session), plus de `4` en dur. Stages manquants (NOUVEAU, À FACTURER)
résolus par `resoudre_stage()` (recherche stricte, ambiguïté bloquante —
jamais devinés), conformément à la doctrine v1.0 conservée.

## Conservé de la v1.0 (déclaré solide par E, §1.3)

`odoo_create` (create → liste déballée), `_relecture` post-écriture,
`rattacher_sr` (cascade, ambiguïté bloquante, cas myId verrouillé consigné),
convention `AST-AAAAMMJJ-P<id>`, `chercher_site_st` (pagination + filtre
local), `audit_flash` (4 contrôles d'origine + ajout AM-6 : file mail.mail en
exception), refus d'inventer des ids de stage, cran d'arrêt
`BROUILLON_A_VALIDER`, Emin toujours en copie (union forcée), liens
`#E30613` gras soulignés + interdiction des background CSS, contrôle
plus-addressing IONOS (554), wizard `mail.compose.message` (jamais
`message_post`), `res_ids` liste d'entiers, pièces jointes `[[6,0,[ids]]]`,
urlencode systématique des GET Synchroteam, `job/send` partiel,
`job/schedule` seul endpoint d'assignation, `job/unschedule` fiable,
`portail_lien` (access_token uuid4 + relecture), verrou V2 (`source=
"inference"` refusé dans `planifier_job`), verrou n°3 (`source_verifiee` +
`source_citee` obligatoires).

## Points restant À VÉRIFIER EN RÉEL (avant de figer l'article 171)

Regroupés dans la docstring `CAMPAGNE_DE_VERIFICATION` en tête de fichier,
avec la commande exacte pour chacun (13 points) : enveloppe `data`/`records`,
statuts de clôture jobs, payloads `job/send`/`job/schedule`, `dateFrom`,
timezone Synchroteam, `tax_id` vs `tax_ids` (Odoo 19), `child_of` sur les
sites EG, stages CRM manquants, `mail.activity.type`, conditions de paiement
du partner 9, coût du `search_count` mail.message, structure de l'article 160,
champs de diagnostic `mail.mail`. Chaque point est aussi marqué
`# A VERIFIER EN REEL:` à l'endroit exact du code concerné (14 marqueurs).

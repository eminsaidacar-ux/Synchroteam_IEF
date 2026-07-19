# AGENT E — CONTRADICTEUR
## Contre-expertise des livrables A, B, C, D — Audit IEF & CO, 18/07/2026
*Référentiels de vérification : §3 (accès/systèmes) et §6 (pièges techniques) du dossier de mission. Le dépôt `/home/user/Synchroteam_IEF` a été inspecté fichier par fichier pour contrôler les affirmations de D. Sévérités : **BLOQUANT** (casse à la première exécution ou produit un faux résultat silencieux), **MAJEUR** (erreur de conception à corriger avant déploiement), **MINEUR** (à corriger sans urgence), **À VÉRIFIER EN RÉEL** (invérifiable sans les clés API — ne pas figer avant test).*

---

## 1. RELECTURE LIGNE À LIGNE DU CODE — AGENT A (`ief_lib`)

### 1.1 Conformité aux pièges §6 — verdict global : conforme

| Piège §6 | Traitement dans la lib | Verdict |
|---|---|---|
| `create` renvoie une liste | `odoo_create()` déballe systématiquement | ✔ |
| `res_ids` = liste d'entiers | `"res_ids": [int(res_id)]` | ✔ |
| Pièces jointes `[[6,0,[ids]]]` | `attachment_ids` conforme | ✔ |
| `message_post` échappe le HTML | wizard `mail.compose.message` utilisé partout | ✔ |
| `access_token` uuid4 | `portail_lien()` écrit le token soi-même + relecture | ✔ |
| Marshalling du `send()` | exception avalée, preuve d'envoi = relecture `mail.message`, interdiction de réémettre en aveugle | ✔ (mais voir A-2) |
| `job/send` avec id = MàJ partielle | utilisé correctement dans `rattacher_sr` | ✔ |
| `job/schedule` exige scheduledStart/End | validés (format + ordre) avant POST | ✔ |
| urlencode des GET | `_st_call` urlencode tous les params | ✔ |
| `site/list` ne filtre pas | `chercher_site_st` pagine + filtre localement | ✔ |
| `product.template.attribute.line` `[[4,id,0]]` | **ABSENT** — voir A-8 | ✘ |

### 1.2 Erreurs détectées dans le code de A

**A-1 — BLOQUANT — `creer_devis` et `creer_job` refusent TOUT dossier non-EG.**
`_v_reference_ticket()` exige un SR (6-10 chiffres) ou un ticket `AST-…` sur **tous** les devis (`violations += _v_reference_ticket(reference_client)` est inconditionnel, y compris `eg=False`) et sur tous les jobs (`creer_job` valide `my_id` contre les mêmes regex). Or Matera, Ronceray, Homebox, les particuliers n'ont ni SR ni AST. Tel quel, le premier devis copro casse à la première exécution — ou pire, force TEO à contourner la lib (exactement ce que le péage veut interdire).
**Correction exacte** : définir un format de ticket interne universel (ex. `IEF-AAAAMMJJ-Pxxxx`, généré par la lib comme l'AST) accepté par la regex, OU rendre `_v_reference_ticket` conditionnel : bloquant si `eg=True`, simple avertissement sinon. Le n° universel pour tous est préférable — il est déjà doctrine (§4 mission : « myId = n° de ticket universel ») et c'est le pivot du dashboard C (filet A) et de l'OS IEF de D.

**A-2 — BLOQUANT — faux « ENVOYE_ET_VERIFIE » possible.**
`verifier_rendu_mail` prend le **dernier** `mail.message` du dossier. Si le send a réellement échoué et qu'un message antérieur existe sur le dossier (note interne, mail précédent), `message_trouve=True` et `envoyer_mail_client` retourne « ENVOYE_ET_VERIFIE » — l'écart de sujet ne produit qu'une ligne « ALERTE » non bloquante dans `controles`. C'est le verrou de l'erreur historique n°3 qui se contourne lui-même.
**Correction exacte** : dans `envoyer_mail_client`, capturer l'horodatage (ou le dernier message id) AVANT l'envoi ; preuve d'envoi = un `mail.message` **postérieur** dont le sujet correspond ; sinon raise. Ajouter la lecture de `mail.mail` (`state` in `outgoing/exception`) pour le diagnostic.

**A-3 — MAJEUR — la détection « premier contact » est cassée dans les deux sens.**
`_detecter_sensibilite` itère sur `destinataires_pids` = `dest`, qui contient **toujours Emin** (union forcée). Emin ayant forcément un historique `mail.message`, `premier_contact` retombe à `False` à chaque appel : le déclencheur V3 « premier contact » ne se déclenchera **jamais** en auto-détection. De plus la logique est inversée : « un destinataire a un historique → pas premier contact » alors qu'il faut « **un destinataire externe n'a aucun** historique → premier contact ».
**Correction exacte** : exclure `emin_pid` de la boucle et inverser : `premier_contact = any(search_count(...) == 0 for pid in dest - {emin_pid})`. Au passage, corriger le domaine : `["partner_ids", "in", [int(pid)]]` (liste, pas scalaire — Odoo récent rejette `in` avec un scalaire). **À VÉRIFIER EN RÉEL** : coût et tolérance du `search_count` sur `mail.message`.

**A-4 — MAJEUR — la variable d'env `SEUIL_MAIL_SENSIBLE_HT` écrase le barème différencié.**
`seuil = float(os.environ.get("SEUIL_MAIL_SENSIBLE_HT", seuil))` : si la variable est posée (elle est listée « optionnelle » en tête de la lib), le barème 5000/3000/1500 défendu en §5.3 est aplati silencieusement à une valeur unique. Contradiction interne au livrable A.
**Correction** : supprimer l'override d'environnement, ou ne le faire porter que sur la clé `defaut`.

**A-5 — MAJEUR — enveloppe de réponse Synchroteam incohérente avec C (panne silencieuse).**
A lit `lot.get("data") or []` sur `job/list` ; C lit `r.json().get("records", [])`. Une des deux clés est fausse : le code fautif retournera **une liste vide sans erreur** → `audit_flash` ou le filet A du dashboard C affichera « rien à signaler » à tort. C'est la pire classe de bug pour un système anti-erreur.
**Correction** : trancher par un appel réel (**À VÉRIFIER EN RÉEL** — une seule requête `job/list?pageSize=1` suffit), centraliser dans UNE fonction `st_list()` de la lib utilisée par A et C, et faire **raise** si la clé attendue est absente de la réponse (jamais de `.get(..., [])` par défaut sur une enveloppe).

**A-6 — MAJEUR — `_v_site_eg` peut rejeter des sites légitimes.**
`racine = commercial_partner_id or parent_id` : si les fiches sites EG sont marquées `is_company=True` (fréquent après import en masse), `commercial_partner_id` = le site **lui-même** → `racine != 9` → refus à tort de tous les devis EG. **À VÉRIFIER EN RÉEL** sur 2-3 sites réels ; correction robuste : tester le rattachement par `search_count("res.partner", [["id","=",site_id],["id","child_of",9]])` au lieu de comparer `commercial_partner_id`.

**A-7 — MINEUR (lot)**
- `planifier_job` accepte le technicien **tampon** TEC031 (il est dans `TECHNICIENS.values()`) alors que la constante le déclare « jamais une assignation finale ». Correction : exclure `tampon` de `planifier_job`, le réserver à `creer_job`.
- `RE_SR = \b\d{6,10}\b` : toute date `AAAAMMJJ` (8 chiffres) passe pour un SR — y compris celle contenue dans un code AST. Validation faible, acceptable, à documenter.
- `"name": l.get("libelle") or None` dans les lignes de devis : ne pas envoyer `None` en XML-RPC (même avec `allow_none`) — omettre la clé si vide, Odoo calculera la description depuis le produit.
- `verifier_rendu_mail` scanne les `<a>` du body **rendu**, qui inclut la signature : si la signature canonique (article 160) contient des liens non rouges, fausse alerte à chaque envoi. Exclure la signature du scan ou vérifier une fois pour toutes la signature.
- Champ `tax_id` sur `sale.order.line` : nom historique correct jusqu'à Odoo 17 ; **À VÉRIFIER EN RÉEL** en Odoo 19 (`tax_id` vs `tax_ids`) — l'échec serait bruyant (KeyError/ValueError), donc non silencieux, mais à tester avant de figer l'article 171.
- Statuts de clôture Synchroteam : A teste `("completed","validated","closed")`, C `("completed","validated")`. Harmoniser après **vérification en réel** de la liste exacte des statuts (casse comprise).
- Payloads Synchroteam (`job/send` : `site {id}`, `customer {id}`, `address` ; `job/schedule` : `technician {id}`) : formats plausibles mais **À VÉRIFIER EN RÉEL** — A le signale lui-même en fin de livrable, c'est à faire AVANT de figer l'article 171. Idem le paramètre `dateFrom` de `job/list`.

**A-8 — MAJEUR — trou du péage : la création de variantes catalogue.**
`creer_devis` raise « créer la variante manquante d'abord — workflow CHIFFRE », mais la lib n'offre **aucune** fonction de création de variante. Le workflow CHIFFRE devra donc faire des writes bruts (`product.template.attribute.line`, piège §6 `[[4,id,0]]` listé dans la mission et absent de la lib) — en violation de l'amendement « toute écriture passe par la lib ».
**Correction** : ajouter `creer_variante_catalogue()` à la lib (avec le piège `[[4,id,0]]` encapsulé), ou exempter explicitement l'enrichissement catalogue du péage dans l'amendement 140 (moins bon).

**A-9 — MINEUR — mécanisme d'injection des secrets non spécifié.**
La lib lit `os.environ`, mais rien ne dit COMMENT Emin pose une variable d'environnement dans l'outil d'exécution Python d'une conversation Claude. En pratique Emin collera les clés dans un message → elles vivent dans le contexte de la conversation toute la journée (exposition + tokens). À trancher dans la synthèse : premier message dédié de session qui exécute `os.environ[...] = "..."` puis n'est plus jamais cité, rotation régulière des clés, et AM-7 (utilisateur API dédié) passe de « assurantiel » à « prioritaire ».

### 1.3 Ce que A a de solide (vérifié, à garder tel quel)
Le principe du péage ; `odoo_create` ; `_relecture` post-écriture ; la cascade `rattacher_sr` (ambiguïté bloquante, cas myId verrouillé consigné) ; la convention `AST-AAAAMMJJ-P<id>` (déterminisme réel — l'id partner est le bon choix) ; `chercher_site_st` ; le refus d'inventer des ids de stage ; `audit_flash` (les 4 contrôles sont les bons, dont `child_of` 9 + `!= 9` sur les factures, correct) ; la matrice de délégation §5.2 ; les seuils différenciés §5.3 (le raisonnement est juste — c'est l'implémentation A-4 qui le trahit) ; les angles morts AM-1 à AM-14, tous pertinents, en particulier AM-7 (clé API = compte Emin) et AM-14 (tester les parades).

---

## 2. RELECTURE LIGNE À LIGNE DU CODE — AGENT C

### 2.1 Conformité §6 : bonne (urlencode ✔, create-liste géré dans `cloturer_terrain` ✔, `fields` filtrés partout ✔, `read_group` côté serveur ✔, stages résolus avant usage ✔, `commercial_partner_id` pour agréger EG ✔ — c'est même le bon champ, bien vu).

### 2.2 Erreurs détectées dans le code de C

**C-1 — BLOQUANT — `cloturer_terrain` viole le péage de A et son propre cahier des charges.**
(a) Elle fait des écritures brutes `odoo("crm.lead","write",...)` et `mail.activity create` hors `ief_lib` — en contradiction frontale avec l'amendement doctrine de A (« un execute_kw brut en écriture est une erreur auditable »). (b) Le §2.3 de C affirme « `cloturer_terrain` exige un devis confirmé ; interdiction structurelle de passer une carte en À FACTURER sans sale.order lié » — **le code ne contient aucune vérification de devis**. (c) Le commentaire promet « 3 écritures ensemble ou aucune » : le code en fait 2, sans atomicité (si la création d'activité échoue, la carte est déjà passée en À FACTURER sans porteur de délai — précisément la fuite que le rituel veut fermer).
**Correction exacte** : déplacer `cloturer_terrain` DANS `ief_lib` v1.1, avec : (1) recherche du `sale.order` confirmé lié au ticket, raise sinon ; (2) création de l'activité **d'abord**, passage de la carte **ensuite** (l'ordre inverse est le sens sûr) ; (3) `_relecture` des deux écritures.

**C-2 — BLOQUANT — enveloppe `records` vs `data`** : voir A-5. Le filet A entier repose dessus.

**C-3 — MAJEUR — `delai_emission` mesurera 0 devis.**
Elle filtre `["opportunity_id","!=",False]`, mais `creer_devis()` de A ne pose jamais `opportunity_id`, et rien n'indique que le workflow CHIFFRE actuel le pose. L'indicateur D sera structurellement vide.
**Correction** : ajouter un paramètre `opportunity_id` (recommandé : obligatoire pour EG) à `creer_devis()` — bénéfice collatéral : le lien carte↔devis manque aussi à `rattacher_sr` et au filet A, qui matchent aujourd'hui par chaîne de caractères.

**C-4 — MAJEUR — dépendance à `requests`.**
Le socle de C importe `requests` (non-stdlib) quand A s'impose la stdlib. Si l'environnement d'exécution de TEO n'a pas `requests`, tout le pan Synchroteam de C casse à la première ligne. **Correction** : C consomme `st_get`/`st_list` de `ief_lib` (urllib), un seul transport, un seul point de vérité. Supprime aussi la double convention de secrets (env vars chez A, placeholder collé chez C).

**C-5 — MINEUR (lot)**
- `dso()` : `write_date` bouge à CHAQUE write (note, correction) → DSO surestimé. Assumé par C (« grain hebdo »), à garder avec le caveat affiché dans le reporting.
- « Marge théorique = devis − heures × 60/110 € » : 60/110 sont des prix de **vente**, pas des coûts — le chiffre produit n'est pas une marge, c'est un écart au barème. D utilise 45 €/h de coût chargé. Harmoniser la définition (coût chargé à calibrer par Fayçal) avant d'afficher le mot « marge » à Emin ; sinon le renommer « écart de valorisation ».
- `delai_emission` fait un `read` crm.lead **par devis** (N+1, ~150 lectures) : lire les leads en un seul `read` batché.
- `recurrence_clients` : borne `< now` exclut le jour courant ; sans conséquence au grain trimestriel.
- `jobs_termines` date les jobs par `scheduledEnd`, pas par la date réelle de complétion — **À VÉRIFIER EN RÉEL** s'il existe un champ `dateCompleted`/équivalent.
- `escalades_facturation` : correct — en Odoo, une activité faite est supprimée, donc la requête ne remonte bien que l'en-cours. ✔
- `activity_type_id: 4` : C dit lui-même de le résoudre une fois — à faire, ne pas déployer avec le 4 en dur.

### 2.3 Ce que C a de solide (à garder tel quel)
Le double filet A/B (terrain→CRM et CRM→compta) est la meilleure idée cash de l'audit ; `invoice_status='to invoice'` est le bon champ ; le statut « BLOQUÉ SR » séparé (cash gelé par EG ≠ cash gelé par IEF) ; `factures_brouillon()` ; l'activité Odoo comme porteur de délai (survit aux conversations — exactement la parade au pattern racine) ; le point hebdo cash une page avec bloc « décision demandée » ; les verdicts sur les 4 compteurs ; le refus motivé du NPS et de la rentabilité par technicien ; les 8 angles morts cash (acomptes, payment terms du partner 9 à poser, relance-factures, fenêtre de facturation ServiceChannel).

---

## 3. VÉRIFICATION DES AFFIRMATIONS DE D CONTRE LE DÉPÔT

J'ai inspecté le dépôt. **Toutes les affirmations factuelles échantillonnées de D sont exactes** — c'est le livrable le plus vérifiable des quatre :

| Affirmation D | Constat dans le dépôt | Verdict |
|---|---|---|
| BPU codé en dur à 55 €/h, incohérent doctrine | `frontend/src/lib/bpu.js:17` : `TAUX_HORAIRE_MO = 55` | ✔ exact |
| Visio sur broker PeerJS public + STUN Google seul | `frontend/src/lib/peerClient.js` : commentaire 0.peerjs.com, `stun.l.google.com` uniquement, aucun TURN | ✔ exact (et le diagnostic « échec en 4G/CGNAT » est techniquement fondé) |
| `photos` sans `taken_at`/`lat`/`lng` | `supabase/migrations/0001` : table photos = 6 colonnes, aucune méta EXIF | ✔ exact |
| Offline données = localStorage mode dev | `frontend/src/lib/localClient.js` : « Drop-in local backed par localStorage » | ✔ exact |
| PWA CacheFirst/NetworkFirst | `frontend/vite.config.js` | ✔ exact |
| Rôles existants admin/technicien/client ; contrainte `users_role_check` à remplacer | `0001` ligne 23 (check inline → nom auto `users_role_check`, le `drop constraint if exists` de la 0006 est correct) | ✔ exact |
| sites lat/lng (migration 0005), hash SHA-256 (0004), E2E Playwright, vercel.json, CI GitHub Actions | tous présents | ✔ exact |

**Contre-points sur D :**

**D-1 — MAJEUR — l'estimation 85-110 j est un ordre de grandeur, pas une estimation.**
Elle est ventilée par phase mais pas par fonctionnalité, et l'unité « jours = sessions de développement effectives Claude Code » est floue. Surtout, le goulot n'est pas chiffré au bon endroit : 25-30 h de « revue Emin » n'incluent pas le **pilotage** des sessions de dev (qui lance, qui décrit le besoin, qui tranche les micro-choix ?). Emin est terrain + commercial + astreinte : 8 semaines de MVP supposent ~3 sessions/semaine pilotées — c'est LA variable de dérapage, pas la vélocité de Claude Code. **Requalification** : garder 85-110 j comme enveloppe, mais conditionner le calendrier à un créneau hebdo protégé d'Emin (ou déléguer le pilotage produit à Hichem/Fayçal pour les arbitrages non-doctrine) et ajouter ±50 % sur le calendrier, pas sur la charge.
- **À VÉRIFIER** : région Supabase « AWS eu-west-3 (Paris) » — si indisponible, c'est Francfort/Irlande, et l'argument « données en France » devient « données en UE » (à reformuler honnêtement, pas grave mais ne pas survendre).
- **À VÉRIFIER** : profondeur d'historique restituée par `job/list` Synchroteam pour l'extraction legacy complète (risque n°2 de D).

**D-2 — MAJEUR — risque absent : la panne de l'OS IEF pendant l'astreinte.**
Après résiliation Synchroteam (V1), une indisponibilité Supabase/Vercel un samedi soir laisse l'astreinte 7j/7 sans outil. Aucune ligne du registre de risques de D ne couvre l'exploitation (qui est d'astreinte du LOGICIEL ? Claude Code ne l'est pas). **Parade à ajouter** : mode dégradé documenté (le flux astreinte P1 — dictée à TEO + carte Odoo — reste le plan B permanent, c'est gratuit puisqu'il existera), supervision uptime (UptimeRobot free), et ne résilier Synchroteam qu'après 30 jours d'uptime observé.

**D-3 — MINEUR (lot)**
- L'anti-collision planning ne couvre pas `technicien_2_id` (le binôme peut être double-réservé) — ajouter une 2e contrainte ou une vérification RPC.
- `next_ticket_numero()` n'est branchée nulle part (ni default, ni appel RPC montré) — à câbler dans `rpc_creer_ticket`.
- Portail donneur d'ordre pour EG : les coordinateurs vivent dans ServiceChannel ; l'adoption est improbable pour EG — le vendre pour syndics/hôtels, pas pour EG.
- Magic link pour Jorge/Yanis : suppose un email consulté sur mobile terrain ; prévoir l'alternative OTP SMS si friction.
- Coûts (Supabase 25 $, Vercel 20 $, Synchroteam 24-42 €/user) : plausibles, non contractuels — étiqueter « tarifs publics à date ».

**Ce que D a de solide** : la décision « étendre, pas réécrire » est correcte et démontrée pièces en main ; le challenge du MVP (« le dossier de bout en bout, pas le rapport ») est le meilleur arbitrage produit de l'audit ; Odoo = vérité comptable avec pont qui n'écrit jamais factures/clients ; agents sans écriture directe → RPC validantes (transposition serveur exacte du péage P1) ; le verdict Kolus (crmId non settable = rédhibitoire, trial utilisé comme filet + benchmark) ; la double piste Synchroteam avec critère de sortie chiffré.

---

## 4. CONTRADICTIONS INTER-AGENTS — LISTE ET ARBITRAGES

| # | Contradiction | Arbitrage |
|---|---|---|
| X-1 | **« Le code = 0 token » (B, étage 3) vs « TEO colle le bloc en début de session » (A §2.1).** La lib fait ~30 k caractères ≈ 8-10 k tokens qui entrent dans la fenêtre à chaque session ET y restent à chaque tour. Le « contexte fixe cible 2,2-3 k » de B est donc faux dans le protocole de A : la cible réelle est ~11-13 k. | Les deux ont à moitié raison : le code économise bien la RELECTURE des règles, mais pas son propre transport. Corriger B : cible fixe ≈ 12 k, gain sur le fixe ×1,7-2,5 (pas ×8). Étudier le stockage de `ief_lib.py` en fichier de projet Claude (chargé une fois) — le coût résiduel reste dans la fenêtre. |
| X-2 | **Le ×7-10 de B** repose sur (a) X-1, (b) l'hypothèse que le coût journalier ≈ contexte fixe × tours, en négligeant le contenu conversationnel (dialogues, résultats d'outils) qui ne baisse pas, et (c) ignore le prompt caching de l'app Claude qui réduit déjà le coût du contexte répété. | Direction juste, amplitude survendue. Annoncer à Emin : **×2 à ×4 mesurés**, avec le script de mesure §1.1 de B (qui est la bonne méthode) exécuté avant/après. Ne jamais écrire ×7-10 dans la synthèse. |
| X-3 | **`cloturer_terrain` : existe-t-elle chez A ?** Non. Elle n'existe que dans le livrable C, hors lib, en writes bruts. B référence en plus `cloturer_dossier()`, `maj_registre()`, `checkpoint()`, `parker()`, `JOURNAL/_log` « dans ief_lib » — **aucune n'est dans le code v1.0 de A** (aucun appel `_log` dans les fonctions d'écriture). | La synthèse doit exiger une **ief_lib v1.1 unifiée** : fonctions de A corrigées (§1.2) + `cloturer_terrain` (C-1) + `creer_variante_catalogue` (A-8) + `JOURNAL`, `parker`, `checkpoint`, `maj_registre` (B §4-5). Sans ça, trois livrables citent du code fantôme. |
| X-4 | **« Les règles inviolables vivent dans le code » (A) — B aligné ?** Oui, explicitement (B §3.2 : « Dans le code. Uniquement dans le code »), et D transpose le même principe en RPC SQL. Pas de contradiction de fond. MAIS B affirme que la signature (article 160) est « lue et injectée par `envoyer_mail_client()`, ne transite plus jamais par la fenêtre » — le code de A exige `signature_html` en **paramètre fourni par TEO** : elle transite. | Alignement doctrinal confirmé ; corriger le code : `envoyer_mail_client(signature=None)` → la lib lit l'article 160 elle-même (read chirurgical hors fenêtre… non : le read passe par la fenêtre une fois — l'économie réelle est « une fois par session » au lieu de « à chaque envoi », déjà bien). |
| X-5 | **Doctrine dans les instructions projet Claude (B) vs Emin en vocal mobile.** TEO **ne peut pas** écrire les instructions d'un projet Claude : l'étape (b) du protocole d'amendement de B (« recopier 140 dans les instructions ») est un geste manuel d'Emin — 8 000 caractères à coller, irréaliste en mobilité, d'où une fenêtre de divergence permanente entre 140 (amendé en vocal) et le miroir. | Garder le déplacement (le gain token est réel) mais changer le contenu : les instructions projet ne portent que le **stable** (identité, arbre d'ouverture, LISTE des invariants — choses amendées 2-3 fois/an, recopiées par Emin depuis un poste fixe) ; tout ce qui s'amende en vocal reste dans 140/169/170 côté Odoo, que TEO sait écrire. L'audit hebdo compare les deux (déjà prévu par B §7.2). |
| X-6 | **Statuts Synchroteam** : A clôture = `completed/validated/closed`, C = `completed/validated`. Et enveloppe `data` vs `records` (A-5/C-2). | Une fonction `st_list()` unique dans la lib + liste de statuts figée après un appel réel. |
| X-7 | **Marge** : C calcule « marge théorique » avec 60/110 € (prix de vente) ; D avec 45 €/h (coût chargé). Deux chiffres différents sous le même mot, dont un montré à Emin dès P1. | Définition unique : coût chargé calibré par Fayçal ; en attendant, C renomme son indicateur « écart de valorisation MO ». |
| X-8 | **Registre 169** : A impose le write-ahead (avant chaque dossier), B le checkpoint de fin de session + filet du matin. Pas contradictoire mais deux protocoles concurrents dont un seul sera suivi. | Unifier : write-ahead d'UNE ligne à l'ouverture d'un dossier (A, coût nul) + checkpoint de clôture qui consolide (B) + filet horodatage du matin (B). L'écrire dans le skill point-quotidien une seule fois. |
| X-9 | **Seuil V3** : A propose 5000/3000/1500 différenciés ; B cite encore « >3 000 € » partout. | Suivre A (avec correction A-4) ; B met à jour sa table de routage. Le cran d'arrêt lui-même reste codé dans la lib. |
| X-10 | **Le tampon TEC031** : constante de A dit « jamais une assignation finale », `planifier_job` l'accepte ; AM-9 le surveille en aval. | Refuser en amont (planifier_job) ET surveiller en aval (audit_flash) — corriger la lib. |

---

## 5. ACTIONNABILITÉ — RECOMMANDATIONS CASSÉES OU REQUALIFIÉES (contrôle §3)

| Recommandation | Problème vs §3 | Verdict |
|---|---|---|
| Délégation Accept ServiceChannel à Chayma (A §5.2) | §3 : SC = « AUCUN accès » API, mais Emin a un login humain. « Partager le login » = partage de credentials, potentiellement contraire aux CGU SC/contrat EG, et casse la traçabilité (qui a accepté ?). | **Requalifier** : demander à EG/SC la création d'un **second utilisateur** au nom de Chayma (SC est multi-utilisateurs chez les providers). Si refus : partage de login en pis-aller assumé, consigné. Ne pas présenter comme « 1 h de travail » — il y a une dépendance externe. |
| Hichem « apprend 2 fonctions de la lib via TEO » (A §5.2) | TEO vit dans le compte/projet Claude d'Emin ; Hichem n'a pas d'accès TEO listé en §3. | **Requalifier** : Hichem dicte à Emin/TEO, ou planifie directement dans Synchroteam UI (il a l'habitude outil) — la lib n'est pas son interface en P1. |
| Objet WhatsApp `[WA] <ticket> — <site>` imposé aux techniciens (A §3.2) | Jorge/Yanis ne connaissent pas les n° SR/AST (ils vivent dans Synchroteam mobile où ils voient le myId… s'il est posé). Exiger le ticket exact dans un objet Gmail tapé au téléphone est une discipline de plus — le livrable A combat précisément ce type de parade. | **Requalifier** : pour les TECHS, objet = nom du site seulement (matching site→cartes ouvertes par TEO, ambiguïté → question) ; l'objet complet `[WA] <ticket>` n'est exigé que d'Emin. La règle « pas de trace = pas payé » reste. |
| `SEUILS`, stages, `activity_type_id` en dur avant résolution | Conformes : A et C refusent tous deux de deviner les ids et donnent la requête de résolution. | ✔ actionnable tel quel (à faire en premier, C §6 étape 1 a raison). |
| B : bascule en « une demi-journée » | Sous-estimé : réécrire 140 en noyau + 3 nouveaux skills + refonte 169 + validation Emin = 2-3 sessions étalées, car chaque étape exige un arbitrage d'Emin (dispo mobile). | **Requalifier** : 1 semaine calendaire, même contenu. |
| C : tout le dashboard « sans nouvel outil » | ✔ conforme §3 (XML-RPC seul), sous réserve C-4 (`requests`). | ✔ après correction C-4. |
| D : Gmail API server-side (watch/Pub-Sub), PeerServer+coturn, Supabase, Vercel | Nouveaux outils — **autorisés en P2** (la contrainte « sans nouvel outil » ne porte que sur P1). L'ingestion Gmail exige un projet Google Cloud OAuth sur le compte gratuit ief.maintenance : faisable mais fragile (compte grand public, cf. AM-5 de A) — argument de plus pour migrer le hub sur le domaine AVANT la V1 de l'OS. | ✔ avec ce séquencement ajouté. |

---

## 6. RISQUES QUE PERSONNE N'A VUS

**R-1 — Les secrets vivent dans la fenêtre de conversation.** « Emin injecte les clés au lancement » = un message chat contenant les clés API pleines-puissances (celles du dirigeant, cf. AM-7), présent dans le contexte toute la journée, tous les jours. Aucun agent n'a décrit le mécanisme réel ni le risque. Parade : message d'injection unique jamais recité + rotation mensuelle des clés + AM-7 (utilisateur API restreint) remonté en priorité 1, pas « J+30 assurantiel ».

**R-2 — RGPD / géolocalisation des salariés.** Le pointage GPS arrivée/départ (D §4), les photos horodatées géolocalisées, l'audit_log nominatif : traitement de données de salariés → information individuelle préalable de Jorge/Yanis obligatoire, finalité et durée de conservation à documenter (registre des traitements — une PME y est tenue). Une contestation prud'homale s'appuierait dessus. Coût de mise en conformité : une page + une signature, mais AVANT la mise en prod, pas après.

**R-3 — Bus factor TEO.** Tout l'édifice P1 (triage, relances, dashboard, rituels) suppose TEO disponible. Panne Anthropic, quota atteint à 15 h, compte suspendu : aucun des quatre livrables ne prévoit le mode dégradé « une journée sans TEO ». Parade : fiche réflexe 1 page (Chayma : triage manuel des SR par labels Gmail ; Emin : Accept + planif directe Synchroteam) — le système doit dégrader vers l'humain, pas vers rien.

**R-4 — Fuseaux horaires.** Datetimes Synchroteam (UTC ? locale ?) vs `datetime.now()` naïf dans A et C : un job d'astreinte à 23 h peut changer de jour selon le référentiel, faussant AST-AAAAMMJJ, les âges et les fenêtres de matching. **À VÉRIFIER EN RÉEL** (un job/details suffit) et normaliser Europe/Paris dans la lib.

**R-5 — Où se déposent les factures EG ?** Si EG exige la soumission des factures DANS ServiceChannel (pratique standard des plateformes FM), alors le rituel J+2 de C bute sur le même SPOF Emin que l'Accept — et la délégation §5.2 de A ne couvre que l'Accept. Question à poser à Emin avant de figer le rituel ; si oui, étendre la délégation SC de Chayma à la soumission de factures.

**R-6 — Pas de sauvegarde de la mémoire système.** Les articles 140/160/169/170/171 sont la mémoire de l'entreprise, éditables par tout utilisateur Odoo, sans versionnage (AM-10 ne couvre que 140) ni export. Une fausse manip de Chayma efface le registre. Parade : export hebdo des articles clés (un read + copie datée en sous-article ou Drive) — 5 lignes dans le rituel du vendredi.

**R-7 — L'article 171 (code de la lib) est un point de défaillance unique.** Le code canonique vit dans un article Odoo rich-text : l'éditeur Odoo peut altérer silencieusement le texte (guillemets typographiques, espaces insécables → SyntaxError Python au collage). Parade : stocker en bloc `<pre>`/code, et un hash du fichier vérifié au chargement (3 lignes dans la lib).

---

## 7. VERDICTS PAR AGENT

### Agent A — Process & erreurs
- **(a) Solide, à garder** : le péage comme principe ; convention AST ; `rattacher_sr` ; `audit_flash` ; matrice de délégation ; seuils différenciés (le raisonnement) ; AM-1→14 ; priorisation §7.
- **(b) À corriger (corrections en §1.2)** : A-1 tickets non-EG (bloquant), A-2 preuve d'envoi (bloquant), A-3 premier contact, A-4 override env, A-5 enveloppe ST, A-6 `_v_site_eg`, A-8 variantes catalogue, A-7 lot mineur, A-9 protocole secrets. Marquer explicitement « À VÉRIFIER EN RÉEL avant de figer l'article 171 » : payloads job/send-schedule, enveloppe des listes, statuts, `tax_id` Odoo 19, `dateFrom`.
- **(c) À jeter** : rien de structurel. La phrase « transformer un oubli silencieux en mensonge explicite » (§1, verrou n°3) est à reformuler dans la synthèse dirigeant — l'argument est bon, la formulation anthropomorphique prête le flanc.

### Agent B — Contexte & tokens
- **(a) Solide** : architecture 4 étages à budgets durs ; format registre 169 (`<pre>`, 8 états, parking) ; arbre de décision skill/code/noyau ; arbre d'ouverture de session ; règles de lecture chirurgicale ; `parker()`/anti-écrasement ; le script de mesure §1.1.
- **(b) À corriger** : X-1 (compter le coût résident de la lib → cible fixe ~12 k, pas 2,5 k) ; X-2 (annoncer ×2-4, pas ×7-10) ; X-5 (instructions projet = contenu stable uniquement, recopie = geste Emin poste fixe) ; X-4 (signature lue par la lib, pas passée en paramètre) ; « demi-journée » → 1 semaine ; mettre à jour les seuils V3 (X-9).
- **(c) À jeter** : la ligne « Signature… 0 (injectée par le code) −100 % » du tableau 1.4 telle quelle (fausse en l'état du code) ; toute promesse chiffrée non re-mesurée par le script §1.1.

### Agent C — Cash & pilotage
- **(a) Solide** : double filet A/B ; BLOQUÉ SR ; activité Odoo porteuse de délai ; escalade J+2 ; factures brouillon ; point hebdo cash 1 page ; verdicts compteurs ; angles morts cash 1-8 (acomptes et payment terms partner 9 en tête).
- **(b) À corriger** : C-1 `cloturer_terrain` → dans la lib, avec contrôle devis + ordre activité-puis-carte (bloquant) ; C-2 enveloppe ST (bloquant) ; C-3 `opportunity_id` ; C-4 `requests` → transport lib ; C-5 lot (renommer « marge », batcher `delai_emission`, résoudre `activity_type_id`).
- **(c) À jeter** : rien. C est le livrable le plus proche du déployable.

### Agent D — Architecte
- **(a) Solide** : état des lieux du dépôt **vérifié exact point par point** ; décision « étendre » ; MVP « dossier de bout en bout » ; Odoo vérité comptable ; agents à RPC validantes ; verdict Kolus ; double piste avec critère de sortie.
- **(b) À corriger** : D-1 (charge : garder l'enveloppe, requalifier le calendrier et nommer le pilote produit) ; D-2 (ajouter le risque « panne de l'OS pendant astreinte » + supervision + Synchroteam gardé 30 j post-bascule) ; D-3 lot (binôme anti-collision, `next_ticket_numero` à câbler, portail pas pour EG, OTP SMS) ; séquencer « hub mail sur le domaine » AVANT l'ingestion Gmail de la V1 ; vérifier la région Supabase Paris avant d'écrire « données en France ».
- **(c) À jeter** : l'affirmation « l'économie Synchroteam couvre l'infrastructure » comme argument de vente (D le dit lui-même : neutre à ±50 €/mois) — la synthèse ne doit vendre que le ROI fonctionnel.

---

## 8. CORRECTIONS INDISPENSABLES AVANT SYNTHÈSE (ordre de priorité)

1. **ief_lib v1.1 unifiée** : A-1 (tickets non-EG), A-2 (preuve d'envoi), C-1 (`cloturer_terrain` dans la lib), A-5/C-2 (`st_list()` unique qui raise), A-3, A-4, A-6, A-8, X-4, X-10 + fonctions B (`JOURNAL`, `parker`, `checkpoint`, `maj_registre`). Un seul fichier, une seule source.
2. **Campagne « À VÉRIFIER EN RÉEL » avant de figer l'article 171** (1 session avec les clés) : enveloppe `data`/`records`, payloads `job/send`/`job/schedule`, statuts jobs, `dateFrom`, timezone Synchroteam, `tax_id` Odoo 19, `commercial_partner_id` des sites EG, stages manquants, `activity_type_id`, payment terms partner 9.
3. **Chiffres de B requalifiés** : ×2-4 (pas ×7-10), cible fixe ~12 k tokens, mesure avant/après par le script §1.1 ; instructions projet = contenu stable seulement.
4. **Requalifications d'actionnabilité** : Accept SC = second utilisateur (dépendance externe EG) ; objet WhatsApp simplifié pour les techs ; Hichem hors lib en P1.
5. **Risques ajoutés au registre** : R-1 secrets en fenêtre (AM-7 → priorité 1), R-2 RGPD géoloc salariés, R-3 mode dégradé sans TEO, R-4 timezone, R-5 factures EG dans SC (question à Emin), R-6/R-7 sauvegarde des articles et intégrité du code 171, D-2 panne OS pendant astreinte.
6. **Harmonisation « marge »** (X-7) et unification du protocole registre (X-8).

*Fin de la contre-expertise Agent E.*

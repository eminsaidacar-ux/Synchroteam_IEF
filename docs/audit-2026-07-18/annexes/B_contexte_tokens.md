# AGENT B — CONTEXTE & TOKENS (§7.2)
## Architecture de contexte minimale pour TEO — Audit IEF & CO, 18/07/2026

**Principe directeur retenu** : un token chargé à l'ouverture n'est pas payé une fois — il est re-transporté à CHAQUE tour de la conversation. Sur une conversation de journée (30-60 tours), chaque kilo-token de contexte fixe coûte 30-60 kilo-tokens d'input cumulés. L'optimisation ne porte donc pas sur « lire moins » mais sur **ne jamais faire entrer dans la fenêtre ce qui peut être exécuté par du code ou lu chirurgicalement au moment précis du besoin**.

---

## 1. MODÈLE DE COÛT RÉEL

### 1.1 Hypothèses de mesure (à recaler en 5 min, méthode fournie)

Ratio retenu pour du français : **1 token ≈ 3,3 caractères**. Les articles Odoo Knowledge sont stockés en HTML (`body`), et le balisage (`<p>`, `<span>`, styles) inflige un **surcoût ×1,5 à ×2** quand le body brut entre dans la fenêtre via un résultat d'outil.

Mesure exacte à faire par TEO (une fois, à coller dans le rapport d'audit) :
```python
for aid in [140, 160, 164, 169, 170] + list(range(141, 152)):
    a = models.execute_kw(db, uid, key, 'knowledge.article', 'read', [[aid]], {'fields': ['name', 'body']})
    body = a[0]['body'] or ''
    print(aid, a[0]['name'], len(body), 'chars ≈', len(body)//3, 'tokens bruts (HTML inclus)')
```

### 1.2 Coût actuel par ouverture de session (estimation)

| Artefact chargé à l'ouverture | Taille estimée | Tokens (HTML inclus) |
|---|---|---|
| Doctrine 140 complète (a grossi par accrétion) | 40-60 k chars | **12 000-18 000** |
| Registre 169 (15-25 dossiers, lignes verbeuses) | 5-8 k chars | 1 500-2 500 |
| Référentiel 170 (contacts, liens, seuils) | 8-12 k chars | 2 500-3 500 |
| Signatures 160 + modèle rapport 164 (si mail/rapport dans la journée) | 4-6 k chars | 1 200-1 800 |
| Overhead des appels (search_read verbeux, champs non filtrés, relectures) | — | 2 000-4 000 |
| **Total ouverture** | | **≈ 19 000-30 000 tokens** |

### 1.3 Le multiplicateur — le vrai coût

Conversation type « une par jour » : 30-60 tours. Le contexte fixe est re-facturé en input à chaque tour :

- **Aujourd'hui** : ~24 k tokens fixes × 40 tours ≈ **960 k tokens/jour** de pur transport de doctrine. ~20 M tokens/mois consommés à relire des règles déjà connues.
- **Cible** (détail §2) : ~2,5 k tokens fixes × 40 tours ≈ **100 k tokens/jour**.

### 1.4 Économie chiffrée

| Poste | Aujourd'hui | Cible | Gain |
|---|---|---|---|
| Contexte fixe à l'ouverture | 19-30 k | **2,2-3 k** | **-88 à -92 %** |
| Ouverture « question ponctuelle » | idem (doctrine relue quand même) | **0 lecture Odoo** | -100 % |
| Signature mail (relue à chaque envoi) | ~600 tokens/envoi | 0 (injectée par le code, §2.4) | -100 % |
| Coût journalier cumulé (40 tours) | ~1 M tokens | ~100-150 k | **ordre de grandeur ×7-10** |

C'est l'écart entre « Emin tape le plafond d'usage à 15 h » et « la journée entière tient dans le quota ».

---

## 2. ARCHITECTURE CIBLE

### 2.1 Vue d'ensemble — 4 étages, chacun avec un budget dur

| Étage | Contenu | Où il vit | Coût contexte | Budget dur |
|---|---|---|---|---|
| **0. Noyau permanent** | identité, invariants (liste), arbre d'ouverture, index | **Instructions du projet Claude** (miroir de l'article 140 réécrit) | payé à chaque tour, mais jamais « lu » via API | **≤ 2 500 tokens** |
| **1. État vivant** | registre 169 optimisé | article Odoo 169, lu à l'ouverture des points et reprises de dossier | ~800-1 000 tokens quand lu | ≤ 3 500 chars |
| **2. Procédures** | skills (frontmatter toujours visible, corps à l'invocation) | fichiers skills existants + 3 nouveaux | ~100 tokens/skill en permanence, corps 1-3 k seulement si déclenché | corps ≤ 3 000 tokens |
| **3. Faits & code** | constantes, seuils, pièges API, validations | **bibliothèque anti-erreur (Agent A)** + articles atomiques lus par ID | **0 token** (le code s'exécute, ne se lit pas) | article ≤ 4 000 chars |

**Le déplacement clé** : le noyau quitte Odoo pour les **instructions du projet Claude**. Il est alors présent gratuitement en lecture (aucun appel API, aucun résultat d'outil dans la fenêtre) — l'article 140 reste la source de vérité amendable, recopiée dans les instructions du projet à chaque amendement validé par Emin (protocole en §2.3). Fin du pattern « TEO doit décider de relire la doctrine ».

### 2.2 Registre 169 optimisé — format exact

Une ligne = un dossier. Colonnes fixes, séparateur `|`, **texte brut dans un unique bloc `<pre>`** (le rich-text Odoo est interdit dans cet article : c'est ce qui tue le ratio tokens/info).

```
=== REGISTRE DOSSIERS OUVERTS — MAJ 2026-07-18 19:40 (TEO) ===
FORMAT: ID|CLIENT|OBJET|ETAT|PROCHAINE_ACTION|QUI|ECHEANCE|REFS
--- ACTIFS (max 25 lignes) ---
D-2607-01|EG-BP Chelles|Porte auto HS|DEVIS_ENVOYE|Relancer Mehmet|TEO|21/07|SR482913;S00341;J1120
D-2607-02|Matera Colombes|Portail copro|A_CHIFFRER|Attente photos Jorge|JORGE|19/07|crm347
D-2606-11|Ronceray|Serrure ch.204|A_FACTURER|Facture Chayma|CHAYMA|20/07|S00329
--- PARKING (sujets non tranchés, max 10) ---
P-01|Comparatif moteurs Somfy/Nice|Attente budget Emin, synthèse en annexe 151|12/07
P-02|Kolus crmId UI-only|Décision sept.2026|01/07
--- REGLES DU REGISTRE ---
ETATS: NOUVEAU A_CHIFFRER DEVIS_ENVOYE ATTENTE_CLIENT A_PLANIFIER PLANIFIE A_FACTURER BLOQUE
Ligne ≤ 110 chars. >25 actifs → archiver clos vers 169-ARCH-AAAA-MM. Dossier sans action >7j → remonter au point du matin.
```

- **Taille max : 25 lignes × 110 chars + parking ≈ 3 300 chars ≈ 950 tokens.** C'est le SEUL artefact lu intégralement à l'ouverture d'un point.
- `REFS` porte les identifiants machine (n° SR, devis S00xxx, job Synchroteam, carte crm) → toute reprise de dossier part de cette ligne et va lire **la carte Odoo elle-même** (`crm.lead read` avec `fields` filtrés, ~150 tokens), jamais une annexe narrative.
- Vocabulaire d'états fermé (8 valeurs) = grep-able, comparable semaine à semaine, exploitable par les compteurs de l'Agent C.
- Les dossiers clos partent en `169-ARCH-AAAA-MM` (sous-article mensuel, jamais relu sauf demande explicite).

### 2.3 Doctrine 140 découpée — qui va où

L'article 140 est réécrit en **140-NOYAU, ≤ 8 000 caractères**, cinq sections :

1. **Identité & ton** (300 chars) — qui est TEO, pour qui, ton des mails.
2. **Invariants** (12 lignes max, une par règle) — la LISTE des règles inviolables avec la mention « appliquées par ief_lib, voir §3 » ; le noyau porte la conscience, le code porte l'application.
3. **Arbre d'ouverture de session** (§4.3 ci-dessous, ~600 chars).
4. **Index** — une ligne par skill et par article : `169 registre | 170 réf. humain | 160 signatures (lues par le code) | 164 → skill rapport-sync | 141-151 : [intitulé 5 mots chacun]`.
5. **Protocole d'amendement** : tout amendement validé par Emin = (a) écrire dans 140, (b) recopier 140 dans les instructions du projet, (c) si la règle est bloquante → ticket de modif de ief_lib. Un amendement qui grossirait le noyau au-delà de 8 000 chars doit déplacer quelque chose vers un skill ou le code : **le budget est dur, c'est lui qui empêche la ré-accrétion**.

Migration du contenu actuel de 140 (table de routage) :

| Contenu actuel de la doctrine | Destination | Justification |
|---|---|---|
| Règles devis EG (entité SAS EG RETAIL, site=livraison, SR en réf, NTE, unité Forfait) | **code** `creer_devis_eg()` (Agent A) + rappel 3 lignes dans skill `devis-ief` | violables par oubli, coût de violation élevé (avoir) |
| Prix non ronds, remises max 3-4 % | **code** (validation bloquante) + skill `devis-ief` | idem |
| TVA 20 % copro (tax id 36 forcée) | **code** — `creer_devis()` refuse toute autre taxe sans flag explicite | inviolable |
| myId à la création des jobs | **code** `creer_job()` — myId paramètre obligatoire | irréversible après clôture |
| Signatures canoniques (160) | restent en article 160, **lues et injectées par `envoyer_mail_client()`** | verbatim garanti, ne transitent plus JAMAIS par la fenêtre de TEO (~600 tokens économisés par envoi) |
| Modèle rapport 164 | corps du skill `rapport-sync` | procédural, déclenché par mot-clé |
| Arbre de triage mails | déjà dans skill `triage-mails` | rien à faire |
| Cadences relance J+3/J+5/J+12/J+30 | skill `relance-devis` | procédural |
| Rituels matin/soir, 4 compteurs | skill `point-quotidien` (avec Agent C) | procédural |
| Verrou V2 (inférences vocales « j'ai compris X = Y ») | **noyau** — comportemental, actif à tout moment | non rattachable à un mot-clé |
| Verrou V3 (cran d'arrêt mails sensibles : sinistre / >3 000 € / 1er contact) | **code** — `envoyer_mail_client()` bloque et exige confirmation | inviolable |
| Pièges API §6 (marshalling, [[6,0,…]], urlencode, site/list…) | **dans l'implémentation de ief_lib** (commentaires) | ne doivent plus JAMAIS occuper de contexte |
| Contacts, IDs, seuils chiffrés (170) | **`ief_lib/constantes.py`** : `TAX_TVA20=36, EG_PARENT=9, SEUIL_MAIL_SENSIBLE=3000, TECHS={...}`, coordinateurs EG | le code n'a pas besoin qu'on les lise |
| 170 — partie humaine (liens portails, notes non machine) | article 170 allégé, sous-articles ≤ 2 000 chars par domaine, lus par ID au besoin | rare, factuel |

### 2.4 Skills — existants enrichis, nouveaux à créer

Frontmatter ≈ 80-100 tokens chacun toujours visibles : 8 skills = **~800 tokens de coût permanent, assumé** (c'est le prix du déclenchement automatique, très rentable contre 12-18 k de doctrine).

| Skill | Statut | Corps (contenu, budget ≤ 3 k tokens) |
|---|---|---|
| `devis-ief` | existant, enrichir | + rappels règles EG/copro (3 lignes, le code fait foi), grille 60/110 €-h, mot-code CHIFFRE inchangé |
| `triage-mails` | existant | inchangé (déjà économe par conception) |
| `point-quotidien` | existant, enrichir | + étape 0 : lire 169 dont PARKING ; + étape finale : CHECKPOINT (§4.2) |
| `rapport-sync` | existant, enrichir | + modèle 164 intégré au corps (164 devient archive) |
| `relance-devis` | existant | + cadences complètes migrées de la doctrine |
| **`checkpoint`** | **nouveau** | clôture de session : journal → registre 169, sujets parkés, cf. §4.2. Déclencheurs : « checkpoint », « on ferme », fin de point du soir |
| **`mail-client`** | **nouveau** | geste d'envoi : wizard mail.compose, vérif rendu post-envoi, liens #E30613, Emin en copie — les validations restent dans le code |
| **`astreinte-eg`** | **nouveau** (coord. Agent A §7.4) | rattachement différé SR : détection SR entrant → matching cartes « astreinte sans SR » → cascade carte+devis+job |

### 2.5 Lectures chirurgicales — règles d'appel API

1. **Toujours lire par ID connu** (`read([id], fields=[...])`), jamais `search_read` exploratoire sur Knowledge.
2. **Toujours filtrer `fields`** : une carte CRM = `['name','stage_id','partner_id','x_ticket','expected_revenue']`, pas le record complet (économie ×5-10 par lecture).
3. **Un article = un sujet, ≤ 4 000 chars** : la granularité de lecture d'Odoo étant l'article entier, la taille de l'article EST le coût de la lecture. Scinder tout article qui dépasse.
4. **Jamais deux lectures du même artefact dans une session** — il est déjà dans la fenêtre.
5. **Contacts** : lire `res.partner` (source de vérité, ~100 tokens filtrés), pas l'article 170.
6. **Points quotidiens archivés** : au point du matin, lire uniquement le point de la veille (~500 tokens), jamais l'historique.

---

## 3. SKILLS vs DOCTRINE vs CODE — LE CRITÈRE, ET LA DÉCISION

### 3.1 Arbre de décision (fréquence × taille × criticité)

```
La règle peut-elle être violée par oubli avec un coût de réparation > 30 min
(avoir, myId perdu, mail faux parti) ?
├─ OUI → CODE (validation bloquante ief_lib). Point final.
└─ NON
   ├─ C'est un SAVOIR-FAIRE rattachable à un mot-clé de déclenchement ?
   │    → SKILL (corps chargé à l'invocation seulement)
   ├─ C'est un FAIT (ID, contact, seuil, prix) ?
   │    → constantes.py si le code s'en sert, sinon article atomique lu par ID
   └─ C'est une POSTURE active à tout moment (ton, « j'ai compris X = Y ») ?
        → NOYAU (et lui seul), sous budget dur 2 500 tokens
```

Règle chiffrée d'arbitrage skill vs noyau en cas de doute : **si (invocations/semaine × taille en k tokens) < 5 × taille**, c'est-à-dire si la règle sert dans moins de ~70 % des sessions, elle sort du noyau.

### 3.2 Tranché : où vivent les règles inviolables

**Dans le code. Uniquement dans le code.** (Alignement total avec l'option retenue par l'Agent A.)

- TVA 20 % → `creer_devis()` force tax id 36 ; toute exception exige `tva_override=` + confirmation Emin loggée.
- Entité de facturation EG → `creer_devis_eg()` fixe partner facturation = SAS EG RETAIL (id 9 parent), site en livraison seule, refuse de créer sans `num_sr=`.
- myId → paramètre obligatoire de `creer_job()`, l'appel sans myId lève une exception.

La doctrine ne PROTÈGE pas : les erreurs n°1, 2, 3 de l'historique ont toutes été commises alors que la règle était écrite noir sur blanc dans la doctrine relue. Un texte relu est un conseil ; une validation est un mur. Le noyau conserve la **liste** des invariants (une ligne chacun) pour que TEO sache expliquer un refus de la lib à Emin — mais l'application ne dépend plus jamais de la relecture. Corollaire token : ~4-5 k tokens de règles de gestes sortent définitivement de la fenêtre.

---

## 4. MÉMOIRE STRUCTURELLE — RENDRE LA RELECTURE INUTILE

Pattern racine : « la mémoire repose sur des textes que l'IA doit décider de relire ». Réponse : la mémoire est **produite mécaniquement par les gestes eux-mêmes** et consommée selon un arbre fixe.

### 4.1 Le journal de session automatique (le cœur du dispositif)

Chaque fonction d'écriture de ief_lib (Agent A) journalise elle-même :

```python
JOURNAL = []  # module ief_lib, vit toute la session

def _log(action, **refs):
    JOURNAL.append({"ts": datetime.now().isoformat(timespec='minutes'),
                    "action": action, **refs})
# appelé en fin de creer_devis(), creer_job(), envoyer_mail_client(), creer_carte_eg()...
```

**TEO n'a plus à se souvenir de ce qu'il a fait : le code qui l'a fait s'en souvient.** Le registre 169 n'est plus tenu par discipline mais dérivé du journal.

### 4.2 Checkpoint de fin de session obligatoire (skill `checkpoint`)

Déclenché par « on ferme », « checkpoint », et systématiquement en dernière étape du point du soir :

1. `ief_lib.checkpoint()` affiche le JOURNAL (actions de la session) + la pile de sujets (§5).
2. TEO génère les lignes registre impactées (créations, changements d'état, nouvelles échéances).
3. Écriture de l'article 169 par la lib (`maj_registre(lignes)` — mise à jour du `<pre>`, horodatage en tête).
4. Sortie : « Registre à jour — N actifs, M parkés, prochaine échéance : … » (une ligne à Emin).

Filet structurel : le point du matin (skill point-quotidien, étape 0) **compare l'horodatage de 169 à la date du jour**. Si le registre n'a pas été mis à jour depuis >24 h alors que le journal Odoo (`mail.message` des cartes) montre de l'activité, TEO ouvre par : « ⚠ Checkpoint d'hier manquant — je reconstitue avant le point. » L'oubli devient visible et rattrapable, jamais silencieux.

### 4.3 Arbre de décision d'ouverture de session (dans le noyau)

```
Demande entrante →
├─ Mot-clé d'un skill (chiffre/devis, mails, point, relance, rapports, astreinte)
│    → le skill se déclenche. AUCUNE lecture doctrine, AUCUNE lecture 169 intégrale.
├─ Question ponctuelle / discussion / avis
│    → ZÉRO lecture Odoo. Répondre. (Le noyau suffit.)
├─ « on reprend [dossier X] »
│    → lire 169, isoler LA ligne, puis lire la carte/le devis référencés (fields filtrés).
├─ Point du matin / première session du jour
│    → 169 complet (~950 tokens) + point de la veille (~500) + skill point-quotidien. RIEN d'autre.
└─ Sujet inconnu / ambigu
     → lire 169 seul ; ne charger un skill ou un article que si le sujet s'y rattache.
```

Coût d'ouverture par type : ponctuelle **0**, reprise dossier **~300 tokens**, point du matin **~1 500 tokens**. Contre 19-30 k uniformes aujourd'hui.

### 4.4 Convention de clôture de dossier

`cloturer_dossier("D-2607-01")` (lib) : passe la ligne en archive `169-ARCH-AAAA-MM`, vérifie que la carte Odoo est en CLÔTURÉ (9) et qu'aucun montant n'est « terminé non facturé » (pont vers Agent C) — sinon refuse la clôture. La cohérence registre ↔ Odoo est vérifiée par le code au moment du geste, pas par relecture.

---

## 5. ANTI-ÉCRASEMENT DE SUJETS (erreur n°6)

Mécanisme à trois étages, zéro outil nouveau :

**a) En conversation — la pile de sujets (lib, coût ~0).**
```python
PILE = []  # ief_lib
def parker(sujet, etat_1_ligne):
    PILE.append({"sujet": sujet, "etat": etat_1_ligne,
                 "ts": datetime.now().isoformat(timespec='minutes')})
    return f"⏸ PARKÉ : {sujet} — {etat_1_ligne}"
```
**Convention comportementale (noyau, 2 lignes)** : quand Emin change de sujet avant qu'une décision/action soit posée (typique du vocal mobile), TEO répond d'ABORD par le marqueur d'une ligne « ⏸ Sujet parké : [A] — [état] », appelle `parker()`, PUIS traite le nouveau sujet. Coût : ~20 tokens par bascule. Le marqueur est aussi un signal à Emin qu'il peut dire « reprends le parké ».

**b) Au checkpoint — persistance.** `checkpoint()` affiche `PILE` ; tout sujet non repris dans la session est écrit dans la section `--- PARKING ---` du registre 169 (format §2.2 : `P-nn|sujet|contexte 1 ligne|date`). Rien ne meurt avec la conversation.

**c) Au point du matin — résurgence.** Étape 0 du skill point-quotidien : « Sujets parkés en attente : P-01 …, P-02 … — on en reprend un ? ». Règle d'hygiène : un P-nn vieux de >14 j est soit promu en dossier D-xxxx (avec prochaine action), soit tué explicitement par Emin — le parking ne devient jamais un cimetière (max 10 lignes, budget dur).

Cas limite couvert : urgence en pleine rédaction de devis → `parker("Devis Matera portail", "métré fait, prix en cours, rien écrit dans Odoo")` ; même si la conversation est abandonnée sur mobile, le point du soir ou le filet 4.2 du lendemain récupère la pile.

---

## 6. PLAN DE BASCULE (déployable par TEO en conversation, sans nouvel outil)

| # | Action | Qui | Durée | Gain immédiat |
|---|---|---|---|---|
| 1 | Mesurer les tailles réelles (script §1.1) et coller les chiffres dans le rapport | TEO | 10 min | modèle de coût calé |
| 2 | Réécrire 169 au format §2.2 (bloc `<pre>`, 8 états, parking) | TEO + validation Emin | 30 min | -60 % sur chaque lecture du registre |
| 3 | Réécrire 140 en NOYAU ≤ 8 000 chars + recopie dans les instructions du projet Claude | TEO + Emin | 1 h | **-12 à -18 k tokens/session** |
| 4 | Créer `constantes.py` dans ief_lib (IDs, seuils, contacts machine) — avec Agent A | TEO | 30 min | 170 sort du chargement d'ouverture |
| 5 | Enrichir les 5 skills existants + créer `checkpoint`, `mail-client`, `astreinte-eg` | TEO | 2 h | doctrine procédurale hors fenêtre |
| 6 | Brancher JOURNAL + `parker()` + `checkpoint()` dans ief_lib | TEO (avec Agent A) | 1 h | mémoire structurelle active |
| 7 | Une semaine de rodage : vérifier au point du soir que 169 ≤ 25 lignes et noyau ≤ 8 000 chars | Emin + TEO | — | les budgets durs tiennent |

Total : **une demi-journée de bascule**, économie récurrente d'un ordre de grandeur (×7-10) sur la consommation quotidienne, et une mémoire qui ne dépend plus de la discipline de relecture.

---

## 7. POINTS DE VIGILANCE (pour l'Agent E)

1. Les estimations §1.2 sont à ±40 % tant que le script §1.1 n'a pas tourné — l'ordre de grandeur (×7-10) est robuste, les valeurs absolues non.
2. Le miroir 140 ↔ instructions du projet introduit un risque de divergence : le protocole d'amendement (§2.3, étape b) est la parade ; l'audit hebdo vérifie l'égalité des deux textes (comparaison de hash possible en Python).
3. Le frontmatter permanent des skills (~800 tokens pour 8 skills) plafonne le nombre de skills : au-delà de ~12, regrouper.
4. `checkpoint()` reste déclenché par TEO/Emin : le filet 4.2 (contrôle d'horodatage au point du matin) est ce qui le rend structurel — il doit être dans le corps du skill point-quotidien, pas dans la doctrine.
5. Dépendance à ief_lib (Agent A) pour §3.2, §4.1, §5 : si la lib glisse, replier temporairement les invariants en tête des skills concernés (dégradé acceptable, +300 tokens/skill).

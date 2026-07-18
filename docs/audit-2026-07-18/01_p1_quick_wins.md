# P1 — QUICK WINS
### Classés par ratio impact/effort. Chaque item : implémentation exacte, prête à l'emploi.

Légende effort : ▲ = < 1 h, ▲▲ = ½ journée, ▲▲▲ = 1 semaine calendaire (étalée). Tout est déployable par TEO en conversation, sans nouvel outil, sauf mention « geste Emin » ou « dépendance externe ».

| # | Quick win | Impact | Effort | Délai | Implémentation |
|---|---|---|---|---|---|
| 1 | Résolution des IDs manquants + payment terms partner 9 | Fiabilise tout le reste (requêtes cash, activités, retards EG) | ▲ | Jour 1 | §1 ci-dessous |
| 2 | Campagne « À VÉRIFIER EN RÉEL » (1 session avec les clés) | Débloque le déploiement de la lib sans casse | ▲▲ | Jour 1-2 | §2 |
| 3 | Déploiement `ief_lib` v1.1 + amendement doctrine « péage » | Rend les 7 contrôles inviolables ; fin du myId oublié, de l'adresse Suresnes, du mail factuel faux | ▲▲ | Semaine 1 | §3 + `02_p1_bibliotheque_anti_erreur.md` |
| 4 | Rituel cash J+2 (`cloturer_terrain` + activités Odoo + escalade) | Priorité n°1 d'Emin : zéro terminé-non-facturé | ▲ | Semaine 1 | §4 |
| 5 | Dashboard cash au point du matin (6 requêtes, ~2-3 k tokens) | Cash visible chaque matin, priorisé | ▲ | Semaine 1 | Annexe C §1, corrigée v1.1 (`dashboard_cash()`) |
| 6 | Registre 169 reformaté + protocole unifié (write-ahead / checkpoint / parking) | Fin de la perte de contexte inter-conversations et des sujets écrasés | ▲▲ | Semaine 1 | §5 |
| 7 | Sécurité : user API dédié, injection unique des clés, export hebdo des articles mémoire | Ferme le risque n°1 (R-1) détecté par la contre-expertise | ▲ (geste Emin) | Semaine 1 | §6 |
| 8 | WhatsApp → hub Gmail au fil de l'eau | Fin du flux opérationnel invisible | ▲ | Semaine 1 | §7 |
| 9 | Rattachement SR différé : convention `AST-…` + `rattacher_sr()` | Fin du rattachement artisanal des astreintes EG | ▲ | Semaine 1 | §8 |
| 10 | Noyau doctrine → instructions projet Claude (contenu stable seul) | ×2-4 tokens mesurés | ▲▲ (geste Emin poste fixe) | Semaine 2 | Annexe B §2-3, requalifiée X-1/X-2/X-5 |
| 11 | Délégations : second utilisateur ServiceChannel pour Chayma ; seuils cran d'arrêt différenciés | Bus factor Emin réduit sur Accept + mails | ▲ (dépendance externe EG) | Semaine 2-4 | §9 |
| 12 | Skill `relance-factures` N1/N2/N3 + compteurs qualité consolidés | Encaissement accéléré, boucle qualité pilotable | ▲▲ | Semaine 2 | Annexe C §3-4 |

---

## §1 — IDs manquants (à faire EN PREMIER, 15 min)

À exécuter une fois, résultats figés dans l'article 170 (référentiel) et dans `constantes` de la lib :

```python
# stages CRM manquants (NOUVEAU, À FACTURER) — ne JAMAIS deviner un id de stage
stages = odoo("crm.stage", "search_read", [[]], {"fields": ["id", "name", "sequence"]})
# type d'activité "À faire" (ne pas déployer avec le 4 en dur)
types = odoo("mail.activity.type", "search_read", [[]], {"fields": ["id", "name"]})
# conditions de paiement du partner EG 9 (aujourd'hui absentes → tout calcul de retard EG est faux)
p9 = odoo("res.partner", "read", [[9]], {"fields": ["property_payment_term_id"]})
# si vide : demander à Emin le délai contractuel EG (45 j ? 60 j ?) puis poser property_payment_term_id
```

## §2 — Campagne « À VÉRIFIER EN RÉEL » (liste fermée, 1 session)

Avant de figer le code en article 171. Détail des commandes dans la docstring `CAMPAGNE_DE_VERIFICATION` de `ief_lib.py` :
1. Enveloppe des listes Synchroteam : `data` vs `records` (un `job/list?pageSize=1` suffit) — le point le plus critique, une erreur = listes vides silencieuses.
2. Payloads exacts `job/send` (site/customer/address) et `job/schedule` (technician).
3. Liste exacte des statuts de jobs (casse comprise) → constante `ST_STATUTS_TERMINES`.
4. Timezone des datetimes Synchroteam (un `job/details` suffit) → normalisation Europe/Paris.
5. `tax_id` vs `tax_ids` sur `sale.order.line` en Odoo 19.
6. `commercial_partner_id` réel de 2-3 sites EG (validation du contrôle `child_of` 9).
7. Existence d'un champ « date de complétion réelle » des jobs (sinon `scheduledEnd` assumé).
8. Paramètre `dateFrom` de `job/list`.
9. Coût/tolérance du `search_count` sur `mail.message` (détection premier contact).
10. Profondeur d'historique restituée par `job/list` (pour l'extraction legacy P2).

## §3 — Déploiement du péage

1. Stocker `ief_lib.py` en article Odoo 171, **bloc code/`<pre>` uniquement** (l'éditeur rich-text corrompt les guillemets) ; le hash SHA-256 affiché au chargement vérifie l'intégrité après collage.
2. Amender la doctrine 140 d'une phrase : *« Toute écriture Odoo ou Synchroteam passe par une fonction de ief_lib (article 171). Un execute_kw ou un POST brut en écriture est une erreur auditable. »*
3. Exemption explicite : lectures libres (search_read) ; écritures = lib uniquement, y compris l'enrichissement catalogue (`creer_variante_catalogue()` fournie).
4. `audit_flash()` au point du matin : devis EG sans SR, AST > 7 j non rattachées, factures postées au nom d'un site, jobs pourrissant sur le tampon TEC031.

## §4 — Rituel cash J+2 (structurel, pas disciplinaire)

- Clôture terrain = **un seul geste** : `cloturer_terrain(ticket)` — vérifie le `sale.order` confirmé lié (raise sinon), crée l'activité « Facturer <ticket> » datée J+2 assignée à Chayma (user 20) **d'abord**, passe la carte en À FACTURER **ensuite** (l'ordre sûr), relit les deux écritures.
- Le porteur du délai est l'activité Odoo : elle survit aux conversations et aux oublis de TEO — c'est la parade exacte au pattern racine.
- Point du matin : `escalades_facturation()` remonte les activités échues → ligne rouge nominative pour Emin.
- Vendredi : le bloc cash du classeur reprend les 3 chiffres (terminé-non-facturé, bloqué SR, impayé échu), chacun avec une action nominative pour lundi.

## §5 — Registre 169 et mémoire structurelle (protocole unifié)

Format (annexe B, arbitrage X-8) : bloc `<pre>`, 1 ligne = 1 dossier, colonnes fixes `TICKET | CLIENT | ÉTAT | PROCHAINE ACTION | QUI BLOQUE | ÉCHÉANCE | MAJ`, 8 états fermés, ≤ 25 dossiers actifs + section `PARKING` (≤ 10, purge J+14), archives mensuelles.
Protocole unique, écrit une seule fois dans le skill `point-quotidien` :
1. **Write-ahead** : à l'ouverture d'un dossier, `maj_registre()` pose la ligne AVANT de travailler (coût ~0).
2. **Checkpoint** : en clôture de session, `checkpoint()` consolide le JOURNAL (auto-rempli par chaque fonction d'écriture de la lib) en lignes de registre.
3. **Filet du matin** : le point du matin contrôle l'horodatage de 169 — un oubli devient visible, pas silencieux.
4. **Anti-écrasement** : changement de sujet en cours de conversation → `parker(sujet)` (~20 tokens), le sujet ressort en étape 0 du point du matin suivant.

## §6 — Sécurité (R-1, priorité 1)

1. Créer un utilisateur API Odoo dédié (droits : CRM, ventes, activités, knowledge — pas de comptabilité générale, pas d'admin) ; la clé d'Emin (s.benhalima) ne sert plus aux automatisations.
2. Injection des clés : UN message de début de session qui exécute `os.environ[...] = "…"`, jamais recité ensuite ; rotation mensuelle (rappel dans le rituel du vendredi, 1er du mois).
3. Export hebdo des articles 140/160/169/170/171 : un read + copie datée en sous-article d'archive (ou Drive) — 5 lignes dans le rituel du vendredi. La mémoire de l'entreprise cesse d'être effaçable par une fausse manip.

## §7 — WhatsApp (arbitré)

- **Règle unique** : ce qui n'est pas transféré au hub n'existe pas (« pas de trace = pas fait »).
- **Emin** : transfert au fil de l'eau vers ief.maintenance@gmail.com, objet `[WA] <ticket> — <site>`.
- **Jorge/Yanis** (requalification contre-expertise : ils ne connaissent pas les n° SR) : objet = **nom du site seulement** ; TEO fait le matching site → cartes ouvertes, ambiguïté → question, jamais de guess.
- Filet : question fermée au point du soir (« du WhatsApp opérationnel non transféré aujourd'hui ? ») ; export mensuel des fils en archive. API WhatsApp Business = P2, pas avant.

## §8 — Rattachement SR différé (EG astreinte)

- À la création d'un dossier d'astreinte sans SR, la lib pose **simultanément** sur carte + devis + job la convention déterministe `AST-AAAAMMJJ-P<id_partner_site>` (l'id partner rend le matching déterministe, pas le nom du site).
- À l'arrivée du mail SR (détection au triage) : `rattacher_sr(sr, ast)` met à jour en cascade carte (référence), devis (client_order_ref), job Synchroteam (`job/send` partiel) ; cas myId verrouillé post-clôture → consigné en note, jamais forcé ; plusieurs candidats → question à Emin, jamais de guess.
- `audit_flash()` alerte sur toute AST > 7 j sans SR (fenêtre de facturation EG).

## §9 — Délégations et cran d'arrêt

| Qui | Délégué | Garde-fou |
|---|---|---|
| Chayma | Brouillons de mails standard ; Accept ServiceChannel ≤ NTE ; avoirs ≤ 500 € | **Second utilisateur SC à son nom** (demande officielle à EG — pas de partage de login : traçabilité + CGU) ; au-delà des plafonds → Emin |
| Fayçal | Achats ≤ 5 000 € ; calibrage du coût horaire chargé (préalable à tout affichage « marge ») | Au-delà → Emin |
| Hichem | Chantiers + backup astreinte ; candidat pilote produit P2 | En P1 il dicte à Emin/TEO ou utilise Synchroteam UI — la lib n'est pas son interface |

Cran d'arrêt mails sensibles, seuils différenciés **codés dans la lib** (plus d'override d'environnement) : EG 5 000 € HT, hôtellerie 3 000 €, copro/particuliers 1 500 €, défaut 3 000 € ; déclencheurs additionnels : sinistre, premier contact (détection corrigée), toute remise. Résultat = `BROUILLON_A_VALIDER`, jamais d'envoi direct.

---

*Compteurs hebdo consolidés (annexe C, validée) : erreurs (format ligne grepable), taux de transformation devis (seuil 50 %), délai d'émission (médiane, 3 j), DSO médian global + EG (45/60 j), 3 chiffres cash, récurrence 90 j (clients éteints nominatifs), taux de rapports clôturés J+1 (90 %), compteur d'avoirs. « Marge » renommée « écart de valorisation MO » tant que Fayçal n'a pas calibré le coût chargé.*

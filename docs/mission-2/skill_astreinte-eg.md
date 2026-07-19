---
name: astreinte-eg
description: Astreinte EG Retail / EFR (stations Esso-BP) et rattachement différé du SR. Déclencher sur « astreinte », « appel de permanence », « Pascal Baudel », « le SR est tombé », « rattache le SR », un mail ServiceChannel correspondant à une intervention déjà faite, ou une alerte AST sans SR au point du matin.
---

# ASTREINTE EG — ticket provisoire et rattachement différé du SR

Spécificité EG : la nuit et le week-end, le cadre de permanence EG (ex. Pascal Baudel) appelle Emin **en direct, SANS ticket**. Le n° SR est émis par EG **en semaine, a posteriori** → le rattachement différé est la règle, pas l'exception. Convention pivot : **`AST-AAAAMMJJ-P<id_partner_Odoo_du_site>`** (suffixe `-B`, `-C` si plusieurs appels même site même jour) — l'id partner rend le matching déterministe : égalité stricte de chaîne, zéro jugement.

## Phase 1 — L'appel d'astreinte (T0, nuit/week-end)

1. Recueillir la dictée d'Emin : **site, symptôme, urgence, nom de l'appelant, heure de l'appel**. Ces quatre derniers vont dans la description de la carte : c'est le registre d'astreinte opposable en cas de litige sur les délais.
2. Résoudre le site : recherche partner Odoo (enfant du parent 9) et/ou `chercher_site_st()` (site/list : le paramètre search NE FILTRE PAS — pagination `data` + filtre local, la lib s'en charge). **Si ≠ 1 candidat : question fermée à Emin, jamais de choix silencieux.**
3. `creer_carte_eg(titre, site_pid, astreinte=True)` : génère l'AST, le pose dans le titre, vérifie le rattachement child_of 9 et l'adresse, marque « ASTREINTE SANS SR — rattachement différé attendu ».
4. `creer_job(ast, ...)` : l'AST est le myId, posé À LA CRÉATION (verrouillé après clôture du rapport — irrécupérable ensuite). Description sans aucun montant.
5. Si l'ordre de planification est explicite : `planifier_job(job_id, technicien, debut, fin, source="ordre_explicite")`. Vocal ambigu → afficher « j'ai compris X = Y », attendre la confirmation, la lib refuse toute inférence.
6. Write-ahead : `maj_registre("D-…", "EG-<site>", "<objet>", "BLOQUE", "guetter SR sur le hub", "TEO", "<J+7>", "AST-…")` (protocole : skill point-quotidien).
7. Si un devis suit (visite chiffrée) : `creer_devis(..., reference_client=<AST>, eg=True, opportunity_id=<lead_id>)` — l'AST tient lieu de SR dans la référence client jusqu'au rattachement.

## Phase 2 — Le SR tombe sur le hub Gmail (T+1 à T+5 j, en semaine)

8. Le triage-mails détecte le mail ServiceChannel. Extraire : n° SR, nom/adresse du site, date du ticket.
9. Résoudre le site du mail → id partner Odoo (au doute d'orthographe : matcher sur adresse/code postal). Chercher les cartes `AST-*-P<cet id>` sans SR, fenêtre J-10 :
   - **1 candidat** → étape 10.
   - **0 candidat** → ce n'est pas une astreinte : circuit SR normal (Accept manuel puis `creer_carte_eg(ticket=SR)`).
   - **>1 candidat** → question fermée à Emin : « SR <n> = intervention du <date 1> (AST-…) ou du <date 2> (AST-…-B) ? ». **Jamais de guess.**
10. `rattacher_sr(sr, ast_id)` — cascade en trois legs, chaque écriture relue :
    - **carte** : titre `[SR <n> (ex AST-…)]` + note datée en description ;
    - **devis** : `client_order_ref` mis à jour ;
    - **job** : myId mis à jour par job/send PARTIEL si le rapport n'est pas clos. **Si le job est clos (`completed`/`validated`) : myId VERROUILLÉ — la lib ne force jamais** : le mapping AST→SR est consigné sur la carte et à reporter au registre 169. C'est le seul mode dégradé admis.
    - La fonction raise si plusieurs cartes ou devis matchent l'AST : ambiguïté = arbitrage Emin, pas de correction en aveugle.
11. Rappel systématique en sortie : **l'Accept ServiceChannel est un geste MANUEL** (Emin ou délégataire — TEO n'a aucun accès SC). Le signaler tant que non confirmé ; la ligne 169 ne se ferme qu'après. NB : les factures EG ne passent PAS par ServiceChannel (R-8) — le rattachement SR sert le devis et la référence, pas le circuit de facturation.
12. Clôture de la ligne 169 : `AST-… → SR … | rattaché le … | Accept fait`.

## Phase 3 — Filet

13. `audit_flash()` au point du matin remonte tout **AST > 7 j sans SR** : relancer les coordinateurs EG (contacts en article 170) via le skill mail-client, `categorie_client="eg"`. À J+14 sans SR : arbitrage Emin — facturer sous référence AST avec mention explicite.
14. Cas couverts sans improvisation : SR arrivé avant la carte (→ 0 candidat, circuit normal ; la question WhatsApp du soir attrape l'intervention orpheline) ; rapport déjà clos (→ mapping consigné, étape 10) ; deux appels même site même jour (→ suffixe `-B` via `nouveau_ticket_astreinte(..., suffixe="B")`) ; SR jamais émis (→ étape 13).

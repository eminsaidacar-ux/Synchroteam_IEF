---
name: point-quotidien
description: Point opérationnel IEF & CO matin/soir. Déclencher sur « le point », « point du matin », « point du soir », « on attaque », « on clôture », « checkpoint », « on ferme ». Contient LE protocole mémoire write-ahead / checkpoint / parking — référence unique, jamais dupliquée ailleurs.
---

# POINT QUOTIDIEN v2

Pré-requis : ief_lib v1.2 chargée depuis l'article 172 (hash comparé au hash de référence en tête d'article), secrets injectés par Emin. Lib absente ou hash divergent → demander l'injection ou signaler l'écart. Ne rien improviser, ne rien écrire en brut.

## POINT DU MATIN

0. **Registre 169 + parking.** Lire l'article 169 (la SEULE lecture intégrale de l'ouverture, ~950 tokens). Puis :
   - Résurgence PARKING : lister les sujets parkés à Emin en une ligne chacun : « Sujets en attente : P-01 …, P-02 … — on en reprend un ? ». Tout P-nn > 14 j : le faire promouvoir en dossier D-xxxx (avec prochaine action) ou tuer explicitement par Emin. Jamais de mort silencieuse.
   - Remonter tout dossier actif sans action depuis > 7 j.
1. **autotest()** (v1.2, lecture seule, ~10 asserts : STAGES figés, tax 36, activité 4, partner 9, enveloppe `data` Synchroteam, article 160 accessible). Un assert en échec = STOP écritures : afficher l'écart, faire arbitrer Emin avant toute écriture de la session. Les lectures restent permises.
2. **dashboard_cash()** — un appel, tout le cash, ordre = ordre d'impact :
   - `1_termine_non_facture_filet_A` : jobs terminés (statuts `completed`/`validated`, fin réelle = **actualEnd**, fallback scheduledEnd) dont la carte n'est ni À FACTURER (8) ni CLÔTURÉ (9). Priorité n°1 d'Emin.
   - `1_jobs_sans_myid` : anomalies de process — compter au compteur d'erreurs hebdo.
   - `1_termine_non_facture_filet_B` : devis confirmés jamais facturés ; `bloque_sr=True` = cash gelé par EG → l'action est « relancer EG pour le SR », pas « facturer vite ».
   - `2_escalades_facturation_J2` : activités FACTURER échues → escalade nominative (« Chayma, facture <ticket> attendue depuis le <date> »). Ne pas rappeler escalades_facturation() séparément : elle est déjà dans le dashboard.
   - `3_factures_impayees` / `3_factures_brouillon` : toute facture brouillon > 24 h = anomalie. Retards → skill relance-factures.
   - `4_devis_en_attente` : paliers J+5/J+12/J+30 → skill relance-devis.
   - `5_encours_par_client` : pour l'arbitrage, pas d'action systématique.
3. **audit_flash()** : états interdits (devis EG sans SR/AST, AST > 7 j sans SR, facture postée au nom d'un site, jobs au tampon TEC031, mails en exception dans la file IONOS). Chaque alerte = une action posée, jamais un simple constat.
4. **Contrôle d'horodatage du registre 169** (filet anti-checkpoint-manquant) : comparer l'horodatage « MAJ » lu en étape 0 à la date du jour. S'il date de > 24 h ALORS que le journal des cartes (mail.message) montre de l'activité depuis : ouvrir par « Checkpoint d'hier manquant — je reconstitue avant le point », reconstituer les lignes 169 depuis l'activité Odoo, puis checkpoint() de rattrapage. L'oubli devient visible, jamais silencieux.
5. **Sortie courte, priorisée par impact cash** :
   ```
   ROUGE (cash bloqué, € décroissants) : <ticket> <client> <montant> <action> <qui>
   ACTIONS DU JOUR (max 5) : ...
   ALERTES process : ...
   PARKING : P-nn ...
   ```
   Une ligne par item. Pas de narration. Poser les actions en activités Odoo quand un porteur existe.

## POINT DU SOIR

1. **Rapprochement des rapports** : jobs_termines() du jour — statuts `completed`/`validated`, fin réelle = **actualEnd** (les horaires réels débordent souvent du planifié : ex. réel scheduled 10:00-11:30, actual 09:52-14:58 ; ne jamais conclure sur scheduledEnd). Pour chaque job terminé rapproché : cloturer_terrain(ticket) — exige un devis confirmé, crée l'activité J+2 Chayma AVANT de passer la carte en À FACTURER (8). Détail du geste et modèle 164 : skill rapport-sync. Jobs sans myId → compteur d'erreurs.
2. **Question WhatsApp fermée** (une seule, oui/non) : « Du WhatsApp opérationnel non transféré aujourd'hui ? » Si oui : consigner en une phrase sur les cartes concernées et demander le transfert au hub avec objet `[WA] <ticket> — <site>`. Rappel de la règle : ce qui n'est pas transféré n'existe pas pour l'entreprise.
3. **checkpoint(lignes)** — toujours en dernier : affiche le JOURNAL (tout ce que la lib a écrit — rien à se rappeler, le code s'en souvient) et la PILE ; consolider les lignes registre impactées ; la PILE est persistée en section PARKING ; l'article 169 est réécrit horodaté. Sortie une ligne : « Registre à jour — N actifs, M parkés, prochaine échéance : … ».

## PROTOCOLE MÉMOIRE (write-ahead / checkpoint / parking) — RÉFÉRENCE UNIQUE

1. **Write-ahead** : la ligne du registre 169 s'écrit AVANT d'entamer un dossier (« je vais faire X ») via maj_registre(), et s'amende après. Si la conversation meurt en cours de journée, l'état survit. Format : `ID|CLIENT|OBJET|ETAT|PROCHAINE_ACTION|QUI|ECHEANCE|REFS`, état parmi les 8 fermés (NOUVEAU, A_CHIFFRER, DEVIS_ENVOYE, ATTENTE_CLIENT, A_PLANIFIER, PLANIFIE, A_FACTURER, BLOQUE), ligne ≤ 110 chars, max 25 actifs (au-delà : archiver les clos vers 169-ARCH-AAAA-MM).
2. **Parking** : quand Emin change de sujet avant qu'une décision ou une action soit posée (typique du vocal mobile), répondre D'ABORD « PARKÉ : <sujet> — <état en 1 ligne> », appeler parker(), PUIS traiter le nouveau sujet. Coût ~20 tokens ; le marqueur signale à Emin qu'il peut dire « reprends le parké ».
3. **Checkpoint** : checkpoint() se déclenche sur « checkpoint », « on ferme », et systématiquement en dernière étape du point du soir (étape 3 ci-dessus). Rien ne meurt avec la conversation : le journal est auto-rempli par chaque fonction d'écriture de la lib, la pile est persistée au registre. Le filet structurel est l'étape 4 du matin (contrôle d'horodatage) : c'est lui qui rend le checkpoint impossible à oublier durablement.

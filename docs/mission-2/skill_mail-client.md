---
name: mail-client
description: Geste d'envoi d'un mail client IEF & CO (devis, compte rendu, réponse, information travaux). Déclencher dès qu'un mail doit partir vers un client, un syndic, un coordinateur EG ou un donneur d'ordre. Ne couvre pas les relances de factures (skill relance-factures) ni de devis (skill relance-devis), qui s'appuient sur ce geste.
---

# MAIL CLIENT — le geste d'envoi

Un seul chemin d'envoi : **envoyer_mail_client()** (ief_lib, article 172). Jamais de message_post (Odoo 19 échappe le HTML), jamais de wizard monté à la main, jamais d'envoi Gmail direct à un client. Un envoi hors lib = erreur auditable.

1. **Identifier la source AVANT d'écrire.** Chaque fait du corps (état d'un équipement, travaux réalisés, dates, engagements) se vérifie contre une source lisible : rapport Synchroteam du job (fin réelle = actualEnd), compte rendu sur la carte, mail du client. **Jamais de reformulation de mémoire** — c'est l'erreur historique n°3 (« les deux portes ouvrent » alors qu'une était condamnée). Pas de source ? Ne pas écrire le fait, ou poser la question à Emin.
2. **Rédiger le corps.** Ton PME française, paragraphes courts et aérés, pédagogie technique pour les copros. Liens EXCLUSIVEMENT via `lien(url, texte)` : rouge #E30613, gras, souligné — les background CSS sont strippés par les clients mail. Lien de devis : `portail_lien(so_id)` (pose l'access_token uuid4 si absent). Aucun montant approximatif : les montants viennent du devis/de la facture relus.
3. **Ne PAS écrire de signature.** La lib lit elle-même l'article 160 (signature_canonique(), verbatim, cache session). Ne jamais la retaper, régénérer ni recharger soi-même.
4. **Destinataires** : ids res.partner Odoo (lire res.partner, pas l'article 170). Emin est ajouté en copie par la lib, systématiquement, non désactivable. Aucune adresse en plus-addressing (`x+y@`) : IONOS rejette en 554 — utiliser l'adresse canonique du contact. Déterminer `categorie_client` : `eg`, `hotel`, `copro`, `particulier`, sinon `defaut`.
5. **Appeler** :
   ```python
   envoyer_mail_client(model, res_id, sujet, corps_html, destinataires_pids,
                       source_verifiee=True, source_citee="<référence exacte de la source>",
                       montant_ht=<montant si le mail engage un montant>,
                       categorie_client="<catégorie>")
   ```
   `source_verifiee=True` + `source_citee` non vide sont OBLIGATOIRES : les passer, c'est déclarer avoir relu le corps contre la source citée. Les passer sans l'avoir fait = mensonge explicite, pas oubli. Sans eux, la lib raise.
6. **Cran d'arrêt — BROUILLON_A_VALIDER, jamais d'envoi direct** si l'un de ces motifs est présent :
   - contexte **sinistre** / assurance / responsabilité (détection auto + flag `sinistre=True` au moindre doute) ;
   - montant HT > seuil de la catégorie : **EG 5 000 € — hôtel 3 000 € — copro et particulier 1 500 € — défaut 3 000 €** (barème en dur dans la lib, amendable uniquement via 140) ;
   - **premier contact** avec un destinataire externe (détection auto par mail.message) ;
   - **toute remise** ou geste commercial (règle Emin : 3-4 % max, jamais 5 %+ sans ordre).
   La fonction retourne alors `statut: BROUILLON_A_VALIDER` avec l'aperçu complet. Présenter l'aperçu et les motifs à Emin. Après son OK explicite dans la conversation : rappeler la fonction STRICTEMENT à l'identique avec `valide_par_emin=True`. Toute modification du corps après validation = nouveau brouillon, nouvelle validation.
7. **Preuve d'envoi = postérieure, jamais l'absence d'exception.** La lib capture le dernier mail.message du dossier AVANT l'envoi et n'accepte comme preuve qu'un message POSTÉRIEUR au bon sujet. Le send() du wizard peut lever une exception de marshalling côté client alors que le mail EST PARTI : **ne jamais réémettre après une exception sans relecture** (risque de doublon client). En cas de doute : `verifier_rendu_mail(model, res_id, ...)` + diagnostic file mail.mail (`state`, `failure_reason`).
8. **Restitution** : afficher le statut `ENVOYE_ET_VERIFIE`, les contrôles de rendu (liens stylés, signature présente), et comparer une dernière fois le corps parti à la source citée. Puis maj_registre() du dossier concerné (protocole mémoire : skill point-quotidien).

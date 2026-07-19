---
name: relance-factures
description: Relance des factures impayées IEF & CO en trois paliers N1/N2/N3. Déclencher sur « relance les factures », « les impayés », ou au point du matin quand factures_impayees() remonte des retards. Ne couvre pas les relances de devis (skill relance-devis).
---

# RELANCE FACTURES — N1 / N2 / N3

Source unique : `factures_impayees()` (ief_lib) — factures postées, `payment_state` non payé/partiel, `retard_j` calculé sur `invoice_date_due`. Envoi : toujours via le skill mail-client (`envoyer_mail_client()`), qui gère cran d'arrêt, copie Emin, signature (article 160) et preuve d'envoi.

## Procédure

1. Lister les retards : N1 dès **J+7** après échéance, N2 dès **J+21**, N3 dès **J+45**. Un palier par facture et par passage ; consigner date et palier de chaque relance sur le dossier (note + registre 169) pour ne jamais renvoyer deux fois le même palier.
2. **Trier les comptes-cadres d'abord.** Toute facture dont le client commercial est **SAS EG RETAIL (partner 9)** sort du circuit N1/N2/N3 → circuit EG (§ ci-dessous). Conditions de paiement du partner 9 : 30 jours, déjà posées — les calculs de retard EG sont fiables.
3. Avant chaque relance, relire la facture LE JOUR MÊME (`payment_state`, `amount_residual`) : jamais de relance sur une facture payée ou soldée entre-temps. `source_citee` = « facture <numéro> + payment_state du <date du jour> ».
4. Préparer le lien de paiement Stripe de la facture (lien de paiement Odoo/Stripe du document), inséré via `lien(<url>, "Régler la facture en ligne")`.
5. Remplir le gabarit du palier (ci-dessous) : variables entre <chevrons>, aucun autre changement de texte. Paiement partiel → remplacer le montant par « le solde de <montant restant> € TTC ».
6. Envoyer :
   - **N1 et N2** : envoi direct via envoyer_mail_client() (le cran d'arrêt standard s'applique : montant > seuil catégorie, sinistre, premier contact → brouillon).
   - **N3 : TOUJOURS brouillon pour Emin.** Présenter le texte rempli et attendre son OK explicite avant tout appel avec `valide_par_emin=True`. Une mise en demeure ne part jamais seule.
7. Après envoi : noter palier + date sur le dossier, maj_registre(), et poser l'échéance du palier suivant.

## Circuit spécifique comptes-cadres EG (R-8 tranché)

Les factures EG ne passent PAS par ServiceChannel : EG dispose d'un **service factures dédié** (adresse en article 170). Conséquences :
- pas de cadence N1/N2/N3 automatique : un mail de suivi récapitulatif au service factures EG, à la demande d'Emin ou quand des factures dépassent l'échéance 30 jours ;
- destinataires = service factures EG, jamais les coordinateurs SR, jamais une saisie ServiceChannel ;
- rappeler dans chaque ligne le n° SR et le site (leurs clés de traitement) ;
- tout passage à un ton ferme envers EG = décision Emin (compte structurant).

**Gabarit EG** (objet : `Suivi de règlement <IEF & CO> : factures échues SAS EG RETAIL`) :

> Bonjour,
>
> Vous trouverez ci-dessous l'état de nos factures arrivées à échéance à ce jour :
>
> <tableau : n° facture / n° SR / site / montant TTC / date d'échéance / retard en jours>
>
> Merci de nous indiquer le statut de traitement de ces factures et, le cas échéant, les éléments manquants pour leur mise en paiement.
>
> Bonne journée,

## Gabarits N1 / N2 / N3

Règles d'écriture communes : ton de PME française, phrases simples, paragraphes courts et aérés, aucun « -- », pas de formules creuses. La signature est ajoutée par la lib : le corps s'arrête après la formule de politesse.

### N1 — courtoise (J+7 après échéance)

Objet : `Facture <numéro> : règlement en attente`

> Bonjour <prénom>,
>
> Sauf erreur de notre part, la facture <numéro> du <date de facture>, d'un montant de <montant> € TTC et arrivée à échéance le <date d'échéance>, reste en attente de règlement.
>
> Il s'agit sans doute d'un simple oubli. Le plus rapide est le paiement en ligne sécurisé : <lien Stripe : Régler la facture en ligne>. Le virement reste bien sûr possible, nos coordonnées bancaires figurent sur la facture.
>
> Si votre règlement est déjà parti, merci de ne pas tenir compte de ce message.
>
> Bonne journée,

### N2 — ferme (J+21 après échéance)

Objet : `Relance : facture <numéro> échue depuis le <date d'échéance>`

> Bonjour <prénom>,
>
> Malgré notre message du <date de la relance N1>, la facture <numéro> de <montant> € TTC, échue le <date d'échéance>, demeure impayée à ce jour.
>
> Nous vous remercions de procéder au règlement sous 8 jours. Vous pouvez payer en quelques instants par ce lien sécurisé : <lien Stripe : Régler la facture en ligne>.
>
> Si vous rencontrez une difficulté, ou si un point de cette facture appelle une précision, répondez à ce message ou appelez-nous : nous trouverons une solution rapidement.
>
> Sans règlement ni retour de votre part sous ce délai, nous serions contraints de passer à l'étape suivante de notre procédure de recouvrement.
>
> Cordialement,

### N3 — mise en demeure simple (J+45 après échéance) : TOUJOURS brouillon Emin

Objet : `Mise en demeure : facture <numéro>`

> Bonjour <prénom>,
>
> Malgré nos relances du <date N1> et du <date N2>, la facture <numéro> de <montant> € TTC, échue depuis le <date d'échéance>, soit <nombre de jours> jours à ce jour, reste impayée.
>
> Par la présente, nous vous mettons en demeure de régler cette somme sous 8 jours à compter de la réception de ce message. Vous pouvez régler dès maintenant en ligne : <lien Stripe : Régler la facture en ligne>, ou par virement aux coordonnées figurant sur la facture.
>
> À défaut de règlement dans ce délai, des pénalités de retard ainsi que l'indemnité forfaitaire de recouvrement de 40 euros prévues par le code de commerce seront appliquées, et nous confierons le dossier au recouvrement.
>
> Nous restons joignables si un élément particulier explique ce retard, et nous préférons, comme toujours, une issue simple et rapide.
>
> Cordialement,

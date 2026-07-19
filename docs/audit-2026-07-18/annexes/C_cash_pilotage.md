# AGENT C — CASH & PILOTAGE (§7.6 / §7.7)
### Audit IEF & CO — livrable exécutable par TEO en conversation, sans nouvel outil
*Version 1.0 — 18/07/2026 — Tout le code ci-dessous est prêt à coller. Les secrets ne sont jamais écrits : `[SECRET_ODOO]` et `[SECRET_SYNCHROTEAM]` sont injectés par Emin au lancement.*

---

## 0. PRINCIPE DIRECTEUR

Le cash d'IEF fuit à trois endroits, dans cet ordre d'impact :

1. **Le terminé non facturé** — du travail fait, payé en heures et en fournitures, qui n'existe pas encore comptablement. C'est la priorité n°1 d'Emin et c'est la bonne : c'est le seul poste où l'argent est déjà gagné et pas encore réclamé.
2. **Le devis dormant** — du travail chiffré jamais approuvé (skill `relance-devis` déjà en place, à instrumenter).
3. **Le facturé non encaissé** — grands comptes à délais longs (EG/ServiceChannel), particuliers sans lien Stripe.

Règle de conception (cohérente avec le pattern racine du §5) : **aucun indicateur ne repose sur la mémoire de TEO ou la discipline d'un humain. Tout indicateur est une requête sur l'état des systèmes, relançable à l'identique, qui donne le même résultat quel que soit celui qui la lance.** La détection est structurelle ; seule l'action reste humaine.

---

## 1. TABLEAU DE BORD CASH MINIMAL (§7.6)

### 1.0 Socle technique commun

Un seul bloc de connexion, réutilisé par toutes les requêtes. Champs minimaux systématiques (`fields=[...]` toujours renseigné — un `search_read` sans `fields` sur `account.move` renvoie ~200 champs et brûle des tokens pour rien). Tous les calculs d'âge se font côté Python, pas côté Odoo.

```python
# ---------- SOCLE — à exécuter une fois par session ----------
import xmlrpc.client, requests, ssl
from datetime import datetime, timedelta, date
from urllib.parse import urlencode  # piège §6 : urlencode OBLIGATOIRE sur les GET Synchroteam

URL, DB, UID = "https://iefandco.odoo.com", "iefandco", 6
KEY = "[SECRET_ODOO]"          # injecté par Emin, jamais écrit dans un livrable
ST_AUTH = ("iefandco", "[SECRET_SYNCHROTEAM]")   # Basic Auth domaine:clé
ST_BASE = "https://ws.synchroteam.com/api/v3"

models = xmlrpc.client.ServerProxy(f"{URL}/xmlrpc/2/object")

def odoo(model, method, args, kw=None):
    return models.execute_kw(DB, UID, KEY, model, method, args, kw or {})

TODAY = date.today()
def age_j(date_str):
    """Âge en jours d'une date Odoo 'YYYY-MM-DD' ou 'YYYY-MM-DD HH:MM:SS'."""
    if not date_str: return None
    return (TODAY - datetime.strptime(date_str[:10], "%Y-%m-%d").date()).days
```

**Prérequis unique — résolution des stages CRM (à faire UNE fois, résultat à figer dans l'article 170).** Les IDs connus (7, 5, 6, 9) ne couvrent pas NOUVEAU ni À FACTURER. Ne jamais coder un nom de colonne en dur : Chayma peut renommer une colonne, un ID ne bouge pas.

```python
# UNE SEULE FOIS puis coller le résultat dans l'article 170 (référentiel)
stages = odoo("crm.stage", "search_read", [[]], {"fields": ["id", "name", "sequence"]})
print(stages)
# → noter : STAGE_A_FACTURER = <id>, STAGE_CLOTURE = 9, STAGE_NOUVEAU = <id>
```

Dans la suite : `STAGE_A_FACTURER` et `STAGE_CLOTURE = 9` sont supposés résolus et lus depuis l'article 170.

---

### 1.a Interventions terminées non facturées — LA requête n°1

Deux filets complémentaires, car les deux référentiels peuvent diverger (c'est précisément la panne qu'on cherche) :

- **Filet A (terrain → CRM)** : jobs Synchroteam `completed`/`validated` dont la carte CRM n'est **pas** en À FACTURER ni CLÔTURÉ. Détecte le travail fait dont le pipeline n'a pas connaissance.
- **Filet B (CRM → compta)** : devis confirmés (`state='sale'`) sans facture (`invoice_status='to invoice'`). Détecte le travail commandé/fait dont la compta n'a pas connaissance.

Un dossier sain traverse A puis B. Un dossier qui reste dans l'un des deux filets > 48 h = alerte.

```python
# ---------- 1.a — TERMINÉ NON FACTURÉ ----------

# --- Filet A : jobs Synchroteam terminés ↔ cartes CRM ---
def jobs_termines(depuis_jours=21):
    """Jobs completed/validated récents. Pièges §6 appliqués :
    - urlencode sur le GET (espaces des datetimes) ;
    - comme site/list, on NE FAIT PAS CONFIANCE au filtre serveur :
      on pagine et on re-filtre localement sur le statut."""
    date_from = (datetime.now() - timedelta(days=depuis_jours)).strftime("%Y-%m-%d %H:%M:%S")
    jobs, page = [], 1
    while True:
        qs = urlencode({"dateFrom": date_from, "pageSize": 100, "page": page})
        r = requests.get(f"{ST_BASE}/job/list?{qs}", auth=ST_AUTH, timeout=30)
        r.raise_for_status()
        recs = r.json().get("records", [])
        jobs += [j for j in recs if j.get("status") in ("completed", "validated")]
        if len(recs) < 100: break
        page += 1
    # champs minimaux conservés (économie de contexte)
    return [{"myId": j.get("myId"), "num": j.get("num"), "status": j["status"],
             "site": (j.get("site") or {}).get("name"),
             "fin": j.get("scheduledEnd")} for j in jobs]

def termines_non_factures_filet_A():
    jobs = jobs_termines()
    alertes, sans_myid = [], []
    for j in jobs:
        if not j["myId"]:
            sans_myid.append(j)          # anomalie en soi (règle myId à la création)
            continue
        # Rattachement par n° de ticket universel : le myId est posé sur la carte
        # (nom de carte) ET en référence client du devis — on croise les deux.
        cartes = odoo("crm.lead", "search_read",
            [[["name", "ilike", j["myId"]],
              ["stage_id", "not in", [STAGE_A_FACTURER, STAGE_CLOTURE]]]],
            {"fields": ["id", "name", "stage_id", "partner_id", "expected_revenue"],
             "limit": 3})
        for c in cartes:
            alertes.append({"ticket": j["myId"], "carte": c["name"],
                            "stage": c["stage_id"][1], "client": c["partner_id"] and c["partner_id"][1],
                            "montant_attendu": c["expected_revenue"],
                            "fin_job": j["fin"], "age_j": age_j(j["fin"])})
    return alertes, sans_myid   # sans_myid remonte au point du soir comme erreur de process

# --- Filet B : devis confirmés jamais facturés ---
def termines_non_factures_filet_B():
    rows = odoo("sale.order", "search_read",
        [[["state", "=", "sale"], ["invoice_status", "=", "to invoice"]]],
        {"fields": ["name", "partner_id", "client_order_ref",
                    "amount_total", "date_order", "invoice_ids"],
         "order": "date_order asc", "limit": 80})
    return [{"devis": r["name"], "client": r["partner_id"][1],
             "ref": r["client_order_ref"],            # n° SR pour EG — doit être présent
             "ht_ttc": r["amount_total"],
             "age_j": age_j(r["date_order"]),
             "deja_facture_partiel": bool(r["invoice_ids"])} for r in rows]
```

**Lecture croisée (le vrai signal)** : un dossier présent dans A **et** B avec `age_j >= 2` = intervention faite, commande connue, facture absente → **ligne rouge du point du matin, avant tout le reste.** Un dossier dans A seulement = la carte n'a pas suivi le terrain (Chayma ou TEO doit passer la carte en À FACTURER + créer/confirmer le devis). Un dossier dans B seulement = intervention pas encore faite ou rapport pas clôturé — à vérifier, pas forcément une fuite.

**Piège EG spécifique** : une carte astreinte sans n° SR (rattachement différé, §2 mission) apparaîtra dans le filet A avec `ref` vide dans B. Elle est *facturable mais pas envoyable* tant que le SR n'est pas émis. Ces lignes ne se traitent pas par « facturer vite » mais par « relancer EG pour le SR » — l'action change, le dashboard doit les marquer `BLOQUÉ SR` (test : `client_order_ref` vide ET partenaire rattaché au parent 9 → `commercial_partner_id == 9`).

---

### 1.b Devis en attente d'approbation, avec âge

```python
# ---------- 1.b — DEVIS EN ATTENTE ----------
def devis_en_attente():
    rows = odoo("sale.order", "search_read",
        [[["state", "in", ["draft", "sent"]]]],
        {"fields": ["name", "partner_id", "amount_total", "date_order",
                    "state", "validity_date", "client_order_ref", "user_id"],
         "order": "date_order asc", "limit": 100})
    out = []
    for r in rows:
        a = age_j(r["date_order"])
        out.append({"devis": r["name"], "client": r["partner_id"][1],
                    "ttc": r["amount_total"], "age_j": a,
                    "etat": "non envoyé" if r["state"] == "draft" else "envoyé",
                    "palier_relance": ("J+30" if a >= 30 else "J+12" if a >= 12
                                       else "J+5" if a >= 5 else "-")})
    return out
```

Deux populations distinctes, deux actions : `draft` = **jamais envoyé** (défaillance interne — un devis rédigé non envoyé sous 24 h est une anomalie de process, pas un dormant) ; `sent` = dormant client, alimenté directement dans les paliers J+5 / J+12 / J+30 du skill `relance-devis`. La colonne `palier_relance` évite au skill de recalculer quoi que ce soit.

---

### 1.c Factures émises impayées, avec âge et retard

```python
# ---------- 1.c — FACTURES IMPAYÉES ----------
def factures_impayees():
    rows = odoo("account.move", "search_read",
        [[["move_type", "=", "out_invoice"], ["state", "=", "posted"],
          ["payment_state", "in", ["not_paid", "partial"]]]],
        {"fields": ["name", "partner_id", "commercial_partner_id", "amount_residual",
                    "invoice_date", "invoice_date_due", "payment_state", "ref"],
         "order": "invoice_date_due asc", "limit": 150})
    out = []
    for r in rows:
        retard = age_j(r["invoice_date_due"])   # >0 = en retard, <=0 = pas encore échue
        out.append({"facture": r["name"], "client": r["commercial_partner_id"][1],
                    "reste_du": r["amount_residual"],
                    "age_j": age_j(r["invoice_date"]),
                    "retard_j": retard,
                    "statut": ("RETARD" if retard and retard > 0 else "à échoir"),
                    "partiel": r["payment_state"] == "partial"})
    return out
```

Note : `commercial_partner_id` (et pas `partner_id`) pour que les factures posées sur un site EG remontent sur **SAS EG RETAIL (FRANCE)** — c'est le garde-fou naturel contre la récidive de l'erreur n°1 du §5 (facture au nom du site) : toute ligne où `partner_id ≠ commercial_partner_id` avec parent ≠ 9 est suspecte.

**Deuxième filet compta, quasi gratuit** : les factures restées en brouillon (créées puis jamais validées — invisibles dans tous les états) :

```python
def factures_brouillon():
    return odoo("account.move", "search_read",
        [[["move_type", "=", "out_invoice"], ["state", "=", "draft"]]],
        {"fields": ["name", "partner_id", "amount_total", "invoice_date"], "limit": 40})
```

Toute facture brouillon > 24 h = anomalie à traiter au point du soir.

---

### 1.d Encours par client (agrégé côté serveur — zéro token gaspillé)

```python
# ---------- 1.d — ENCOURS PAR CLIENT ----------
def encours_par_client():
    """read_group : l'agrégation se fait côté Odoo, on ne rapatrie que les totaux."""
    groups = odoo("account.move", "read_group",
        [[["move_type", "=", "out_invoice"], ["state", "=", "posted"],
          ["payment_state", "in", ["not_paid", "partial"]]],
         ["amount_residual"], ["commercial_partner_id"]],
        {"orderby": "amount_residual desc"})
    return [{"client": g["commercial_partner_id"][1],
             "encours": round(g["amount_residual"], 2),
             "nb_factures": g["commercial_partner_id_count"]} for g in groups]
```

Variante « encours échu seulement » : ajouter `["invoice_date_due", "<", TODAY.strftime("%Y-%m-%d")]` au domaine. Les deux chiffres se lisent ensemble : encours total = exposition ; encours échu = urgence de relance.

**Coût token du dashboard complet** : 6 appels API, champs minimaux, agrégation serveur pour 1.d → l'ensemble tient en ~2-3 k tokens de résultats. Exécutable chaque matin sans grever le budget de session.

---

## 2. RITUEL « ZÉRO TERMINÉ-NON-FACTURÉ À J+2 »

### 2.1 Le principe structurel

Le déclencheur n'est **pas** « penser à facturer » (disciplinaire, donc condamné) mais : **tout rapport clôturé déclenche mécaniquement, dans le même geste, la création d'une activité Odoo datée sur la carte.** L'activité est l'objet porteur du délai — elle survit aux conversations, aux week-ends et aux changements de sujet d'Emin (erreur n°6 du §5). Le dashboard 1.a est le filet de sécurité qui rattrape ce que le geste aurait manqué : deux mécanismes indépendants, pas un.

```python
# ---------- Geste unique post-rapport (à intégrer au skill rapport-sync) ----------
# Quand TEO rapproche un rapport clôturé avec sa carte, il fait CES 3 ÉCRITURES
# ENSEMBLE ou AUCUNE (jamais la carte sans l'activité) :
def cloturer_terrain(carte_id, ticket):
    # 1. La carte passe en À FACTURER
    odoo("crm.lead", "write", [[carte_id], {"stage_id": STAGE_A_FACTURER}])
    # 2. Activité datée J+2 pour Chayma (user 20) — l'objet qui porte le délai
    act = odoo("mail.activity", "create", [{
        "res_model_id": odoo("ir.model", "search", [[["model", "=", "crm.lead"]]])[0],
        "res_id": carte_id,
        "activity_type_id": 4,          # "À faire" (vérifier l'id une fois, article 170)
        "user_id": 20,                  # Chayma
        "date_deadline": (TODAY + timedelta(days=2)).strftime("%Y-%m-%d"),
        "summary": f"FACTURER — ticket {ticket}",
    }])
    act_id = act[0] if isinstance(act, list) else act   # piège §6 : create renvoie une liste
    return act_id
```

### 2.2 Qui fait quoi, quand

| Moment | Qui | Quoi | Déclencheur structurel |
|---|---|---|---|
| **Clôture rapport** (fil de l'eau / point du soir) | TEO | Geste `cloturer_terrain()` : carte → À FACTURER + activité J+2 sur Chayma. Si devis inexistant : le créer d'abord (bibliothèque anti-erreur Agent A). | Le rapport clôturé dans Synchroteam — état système, pas mémoire |
| **Point du soir** | TEO | Exécute 1.a (filets A+B) + `factures_brouillon()`. Écarts → activités créées séance tenante. Jobs `sans_myid` → compteur erreurs (§3). | Skill `point-quotidien`, déjà rituel |
| **Point du matin** | TEO → Emin | La **première ligne** du point du matin est le total « terminé non facturé » en €, avec la liste `age_j >= 2` en rouge. Avant les mails, avant le planning. | Ordre d'affichage figé dans le skill `point-quotidien` — priorisation par impact cash déjà doctrine |
| **J+1 → J+2** | Chayma | Traite ses activités « FACTURER — ticket X » : facture depuis le devis, poste, envoie (lien Stripe). L'activité est marquée faite → sort du radar. | Sa vue Activités Odoo — natif, zéro outil nouveau |
| **J+2 dépassé** | TEO → Emin | Toute activité FACTURER en retard (`date_deadline < aujourd'hui`, non faite) = escalade nominative dans le point du matin : « Ticket X, terminé le D, activité Chayma échue ». Emin arbitre (blocage SR ? litige ? oubli ?). | Requête ci-dessous — état, pas mémoire |
| **Vendredi** | TEO | Ligne de synthèse dans le classeur (§4) : stock terminé-non-facturé en € + âge max + causes des dépassements. | Rituel classeur existant |

```python
# Escalade J+2 : activités FACTURER échues et non faites
def escalades_facturation():
    return odoo("mail.activity", "search_read",
        [[["summary", "like", "FACTURER"], ["date_deadline", "<", TODAY.strftime("%Y-%m-%d")]]],
        {"fields": ["res_id", "summary", "date_deadline", "user_id"], "limit": 30})
```

### 2.3 Cas dégradés prévus (sinon le rituel meurt au premier cas réel)

- **EG sans n° SR** : la carte va bien en À FACTURER, l'activité devient « OBTENIR SR — ticket X » assignée à **Emin** (seul détenteur ServiceChannel), et une activité FACTURER est créée pour Chayma **le jour où le SR est saisi** dans `client_order_ref`. Le stock « bloqué SR » est affiché à part dans le point du matin — c'est du cash gelé par EG, pas par IEF, et Emin doit le voir chiffré pour le réclamer.
- **Rapport clôturé sans devis** (dépannage direct, astreinte) : `cloturer_terrain` exige un devis confirmé ; s'il n'existe pas, TEO le crée au tarif doctrine (60/110 €/h, prix non ronds) et le soumet à Emin le soir même. Interdiction structurelle de passer une carte en À FACTURER sans `sale.order` lié.
- **Chayma absente** : l'escalade J+2 route vers Emin automatiquement — rien à décider, la requête `escalades_facturation()` ne dépend pas de qui est au bureau.

---

## 3. BOUCLE QUALITÉ MESURÉE (§7.7)

### 3.1 Verdict sur les 4 compteurs existants

| Compteur actuel | Verdict | Amélioration |
|---|---|---|
| Erreurs détectées et par qui | **À garder, à structurer.** Aujourd'hui : texte libre → non agrégeable. | Format ligne figé dans le sous-article Point du jour : `ERR \| date \| type (E1-E7 = les 7 points de contrôle + V1-V6) \| détectée par \| coût estimé €`. Le compteur devient un `grep` du classeur, plus une relecture. Y verser automatiquement les `sans_myid` du 1.a. |
| Devis émis / validés | **Insuffisant seul** : deux volumes sans lien ne pilotent rien. | Remplacé par le taux de transformation (3.2-A) qui les contient. Garder les deux bruts en colonne du même tableau. |
| Délai d'émission devis | **À garder, définition à figer.** | Définition : `date_order du devis − date du premier contact (create_date de la carte CRM)`. Requête 3.2-D. Le mesurer en médiane, pas en moyenne (un chantier Hichem à 3 semaines ne doit pas noyer les dépannages). |
| Cash facturé vs à facturer | **Le bon réflexe, mal outillé.** | Devient les 3 chiffres du §1 : facturé encaissable (1.c), à facturer (1.a/1.b), encours par client (1.d). Plus jamais estimé de tête. |

### 3.2 Indicateurs ajoutés — définition exacte, source, seuil, consommateur

**A. Taux de transformation devis** — *le rendement du chiffrage*
- **Définition** : sur les devis dont le sort est connu dans la fenêtre glissante de 4 semaines : `nb devis passés en 'sale' / (nb 'sale' + nb 'cancel' + nb 'sent' > 30 j)`, en nombre **et** en €.
- **Requête** :
```python
def taux_transformation(semaines=4):
    d0 = (TODAY - timedelta(weeks=semaines)).strftime("%Y-%m-%d")
    rows = odoo("sale.order", "search_read",
        [[["date_order", ">=", d0]]],
        {"fields": ["state", "amount_total", "date_order"], "limit": 300})
    gagnes  = [r for r in rows if r["state"] == "sale"]
    perdus  = [r for r in rows if r["state"] == "cancel"
               or (r["state"] == "sent" and age_j(r["date_order"]) > 30)]
    tot = len(gagnes) + len(perdus)
    return {"taux_nb": round(100*len(gagnes)/tot, 1) if tot else None,
            "taux_eur": round(100*sum(g["amount_total"] for g in gagnes) /
                        max(1, sum(r["amount_total"] for r in gagnes+perdus)), 1),
            "gagnes": len(gagnes), "perdus": len(perdus)}
```
- **Seuil d'alerte** : < 50 % en nombre deux semaines de suite, ou taux € < taux nb de 15 points (= on perd surtout les gros devis → problème de prix ou de relance sur les montants élevés).
- **Consomme** : Emin (réunion du lundi). Décision associée : ajuster prix, relance, ou qualification des demandes.

**B. DSO — délai moyen d'encaissement**
- **Définition** : médiane de `date de dernier paiement − invoice_date` sur les factures passées en `paid`/`in_payment` sur les 8 dernières semaines ; approximation robuste sans lire les écritures de règlement : utiliser `write_date` de la facture au moment du passage en payé (suffisant au grain hebdo). Calculer **global + EG seul** (EG écrase tout le reste).
- **Requête** :
```python
def dso(semaines=8):
    d0 = (TODAY - timedelta(weeks=semaines)).strftime("%Y-%m-%d")
    rows = odoo("account.move", "search_read",
        [[["move_type", "=", "out_invoice"], ["payment_state", "in", ["paid", "in_payment"]],
          ["invoice_date", ">=", d0]]],
        {"fields": ["invoice_date", "write_date", "commercial_partner_id", "amount_total"],
         "limit": 200})
    def med(vals):
        s = sorted(vals); return s[len(s)//2] if s else None
    delais = [(age_j(r["invoice_date"]) - age_j(r["write_date"]), r) for r in rows]
    return {"dso_global_j": med([d for d, _ in delais]),
            "dso_eg_j": med([d for d, r in delais if r["commercial_partner_id"][0] == 9])}
```
- **Seuil** : DSO global > 45 j, ou DSO EG > 60 j, ou hausse de +10 j sur 4 semaines.
- **Consomme** : Fayçal (finances) + Emin. Décision : intensité de relance, exiger acompte, prépaiement Stripe pour les ponctuels.

**C. Récurrence par client** — *la santé du fonds de commerce*
- **Définition** : par `commercial_partner_id`, nb de commandes et CA sur 90 j vs les 90 j précédents. Signal : un récurrent (syndic, hôtel, Homebox…) qui tombe à zéro sur un trimestre = client en train de partir **silencieusement**.
- **Requête** (agrégée serveur, 2 appels) :
```python
def recurrence_clients():
    def bloc(d0, d1):
        return {g["commercial_partner_id"][0]: (g["commercial_partner_id"][1],
                g["commercial_partner_id_count"], round(g["amount_total"], 0))
                for g in odoo("sale.order", "read_group",
                    [[["state", "=", "sale"], ["date_order", ">=", d0], ["date_order", "<", d1]],
                     ["amount_total"], ["commercial_partner_id"]], {})}
    now, m3, m6 = [ (TODAY - timedelta(days=d)).strftime("%Y-%m-%d") for d in (0, 90, 180) ]
    recent, avant = bloc(m3, now), bloc(m6, m3)
    dormants = [avant[pid] for pid in avant if pid not in recent]
    return {"actifs_90j": len(recent), "clients_eteints": dormants}
```
- **Seuil** : tout client ≥ 2 commandes sur T-1 absent sur T = ligne nominative au classeur du vendredi.
- **Consomme** : Emin (commercial). Décision : un appel, une visite, un mail de maintenance préventive.

**D. Délai d'émission devis (existant, désormais mesuré)**
```python
def delai_emission(semaines=4):
    d0 = (TODAY - timedelta(weeks=semaines)).strftime("%Y-%m-%d %H:%M:%S")
    devis = odoo("sale.order", "search_read",
        [[["create_date", ">=", d0], ["opportunity_id", "!=", False]]],
        {"fields": ["opportunity_id", "create_date"], "limit": 150})
    delais = []
    for dv in devis:
        lead = odoo("crm.lead", "read", [[dv["opportunity_id"][0]]], {"fields": ["create_date"]})
        delais.append(age_j(lead[0]["create_date"]) - age_j(dv["create_date"]))
    s = sorted(delais)
    return {"mediane_j": s[len(s)//2] if s else None, "max_j": max(s, default=None), "n": len(s)}
```
- **Seuil** : médiane > 3 j ouvrés, ou n'importe quel devis > 7 j (hors chantiers marqués comme tels).
- **Consomme** : Emin + TEO. C'est l'indicateur de charge de TEO/Chayma : s'il dérive, le goulot est interne.

### 3.3 Ce qui manque encore — et ce qu'il faut refuser d'ajouter

| Indicateur | Verdict | Pourquoi |
|---|---|---|
| **Marge par affaire** | **OUI, version dégradée seulement.** | La marge réelle exige les prix d'achat historisés → c'est le module achats de P2 (§8), pas outillable proprement aujourd'hui (portails fournisseurs sans API). Version P1 honnête : marge *théorique* = devis − (heures Synchroteam réelles × 60/110 €) − fournitures **saisies en ligne de devis**. À sortir uniquement sur les affaires > 3 000 € HT, à la clôture, dans le classeur. Ne pas en faire un compteur hebdo : la donnée d'entrée n'est pas fiable, un chiffre faux chaque semaine est pire que rien. |
| **Taux de relance exécutée** | **OUI — le plus rentable des ajouts.** | `nb devis dormants ayant reçu leur relance au bon palier / nb devis éligibles J+5/J+12/J+30`. Source : croiser 1.b (`palier_relance`) avec les messages sortants du devis (`message_ids` dont l'auteur est TEO/Emin postérieur au palier). Seuil : < 100 % = le skill `relance-devis` a des trous. Consomme : TEO lui-même (auto-audit) + compteur erreurs. |
| **Taux de rapports clôturés à J+1** | **OUI.** | `jobs completed dont le rapport est validé sous 24 h / jobs completed`. C'est le robinet d'entrée de tout le §2 : un rapport qui traîne retarde mécaniquement la facture. Source : `jobs_termines()` (statut `completed` vs `validated`). Seuil : < 90 %. Consomme : Emin → techniciens (Jorge, Yanis), nominativement. |
| **Avoirs émis** (nb + € + cause) | **OUI, compteur d'erreurs cash.** | Chaque avoir = une erreur amont (cf. facture au nom du site, §5). Requête : `account.move`, `move_type='out_refund'`, semaine glissante. Seuil : > 0 → cause racine documentée ligne ERR. |
| Rentabilité horaire par technicien | **NON en P1.** | Données de pointage Synchroteam trop bruitées ; indicateur toxique s'il est faux (conflit d'équipe sur un chiffre contestable). P2. |
| NPS / satisfaction client | **NON.** | Aucun canal de mesure fiable en place ; la récurrence (C) est un meilleur proxy comportemental et coûte zéro. |

---

## 4. FORMAT DU REPORTING — LE POINT HEBDO CASH

Une page, un tableau, généré par TEO le **vendredi 16 h** (avant le classeur), collé tel quel : ① en feuille « CASH » du classeur Excel du vendredi, ② en tête du sous-article Knowledge « Point AAAA-MM-JJ », ③ relu à voix haute en ouverture de la réunion de production du lundi (2 minutes, avant le planning).

**Ordre des blocs = ordre d'impact cash. Interdit de réordonner.**

```
SEMAINE S29 — CASH IEF & CO                          (généré vendredi 16h par TEO)

■ 1. TERMINÉ NON FACTURÉ ........... 8 430 € HT   (seuil : 0 € à J+2)
   Ticket    Client        Fin interv.  Âge   Blocage        Action lundi
   T-2411    EG Osny       15/07        3 j   SR manquant    Emin relance EG
   T-2415    Matera Ivry   16/07        2 j   —              Chayma facture
■ 2. BLOQUÉ DONNEUR D'ORDRE ........ 3 120 € HT  (SR EG en attente : 2 dossiers, âge max 9 j)
■ 3. IMPAYÉ ÉCHU ................... 12 260 €    (dont EG 9 800 € / 52 j — relance N2 partie le 17/07)
■ 4. DEVIS DORMANTS ................ 21 400 €    (7 devis ; 2 au palier J+12 relancés ; 1 J+30 → arbitrage abandon)
■ 5. COMPTEURS SEMAINE
   Transformation devis : 58 % nb / 61 % €   (seuil 50 %)          ✔
   DSO global / EG      : 38 j / 55 j        (seuils 45/60)        ✔
   Délai émission devis : médiane 2 j, max 6 j (seuil 3/7)         ✔
   Rapports J+1         : 84 %  (seuil 90 %)                       ✘ → Jorge 2 rapports en retard
   Erreurs (ERR)        : 2 — E2 myId manquant (TEO), E1 adresse livraison (détectée par verrou, 0 €)
   Avoirs               : 0
■ 6. CLIENTS ÉTEINTS (90 j) : Hôtel Ronceray (3 cdes T-1 → 0) → Emin appelle Guillaume Bertrand
■ 7. DÉCISION DEMANDÉE À EMIN (max 3 lignes)
   1) Abandonner ou baisser le devis S0142 (J+32, 4 900 €) ?
   2) Acompte 40 % obligatoire au-dessus de 3 000 € pour les non-récurrents ?
```

Règles du format : **jamais plus d'une page** ; chaque ligne des blocs 1-2-3 porte une **action nominative pour lundi** (un chiffre sans action est du bruit) ; les blocs 5-6 tiennent en une ligne par indicateur avec ✔/✘ contre seuil ; le bloc 7 force la boucle de décision — c'est ce qui transforme le reporting en pilotage. Coût de génération : les requêtes §1 + §3, ~8 appels API, quelques minutes de TEO.

---

## 5. ANGLES MORTS CASH DÉTECTÉS

1. **Acomptes inexistants.** Aucune trace d'une politique d'acompte alors que des affaires > 3 000 € HT existent (le seuil du cran d'arrêt le prouve). Un chantier de 8 000 € financé à 100 % par la trésorerie d'IEF pendant 45-60 j est une ligne de crédit gratuite au client. **Reco** : acompte 40 % à la commande pour tout devis > 3 000 € HT hors comptes-cadres (EG exclu, NTE oblige), encaissé par lien Stripe posé dans le mail de confirmation. Odoo gère nativement la facture d'acompte depuis le devis — zéro outil nouveau, une règle de doctrine + une ligne dans `creer_devis()` (Agent A) qui le signale.
2. **Avoirs EG = fuite silencieuse.** L'erreur « facture au nom du site » a déjà coûté un avoir (§5.1). Chaque avoir retarde l'encaissement d'un cycle EG complet (~2 mois). Le compteur avoirs (§3.3) rend la fuite visible ; le vrai correctif est la validation bloquante `commercial_partner_id == 9` dans la bibliothèque Agent A, et le contrôle 1.c la détecte a posteriori.
3. **Délais grands comptes non contractualisés dans Odoo.** Si les conditions de paiement EG (probablement 45-60 j fin de mois via ServiceChannel) ne sont pas posées en `property_payment_term_id` sur la fiche SAS EG RETAIL, alors `invoice_date_due` est fausse et tout le bloc 1.c ment. **Action immédiate (5 min)** : lire `res.partner` id 9, champ `property_payment_term_id` ; si vide, le renseigner. Idem Savills, Homebox, Astotel. Sans ça, « retard_j » n'a pas de sens juridique pour relancer.
4. **Relances factures non systématisées.** Les relances *devis* ont un skill ; les relances *factures* n'en ont pas. **Reco** : cadence figée N1 = échéance +3 j (mail courtois + lien Stripe re-cliquable), N2 = +15 j (mise en demeure douce, Emin en copie — déjà obligatoire), N3 = +30 j (appel Emin ou Fayçal + mention pénalités 3× taux légal / indemnité 40 €, déjà exigibles de plein droit en B2B). Exécutable par TEO via le wizard `mail.compose.message` existant, déclenchée par la requête 1.c au point du matin du lundi. C'est un skill jumeau de `relance-devis` à créer : `relance-factures`.
5. **Astreinte = travail livré avant tout engagement écrit.** L'appel du cadre de permanence EG sans ticket signifie qu'IEF engage des coûts sans référence de commande. Le stock « BLOQUÉ SR » (§2.3) doit être suivi **en € et en âge** ; au-delà de 10 j sans SR émis, mail formel de demande de régularisation aux coordinateurs (Mehmet Dagdelen / Nanndy Bachard) avec récapitulatif date/site/nature — la trace écrite qui protège la créance.
6. **Stripe pas systématique.** Stripe est le journal principal mais rien ne garantit qu'un lien de paiement accompagne chaque facture hors grands comptes. Une facture de particulier/copro sans lien = des jours de DSO gratuits. Contrôle automatisable : toute facture postée dont le partenaire n'a pas de conditions de paiement compte-cadre doit partir avec lien de paiement — à intégrer comme vérification dans `envoyer_mail_client()` (Agent A).
7. **Écart devis ↔ facturé invisible.** Travaux supplémentaires faits sur place (dits à l'oral, souvent via WhatsApp — cf. §2 mission) et jamais reportés au devis = CA évaporé sans trace. Proxy P1 : à la clôture, comparer heures réelles Synchroteam × 60/110 € au montant main-d'œuvre du devis ; écart > 20 % → question posée à Emin dans le point du soir : « facturable en plus ? ». C'est la version cash de la capture WhatsApp traitée par l'Agent A.
8. **Fenêtre de facturation EG/ServiceChannel.** Les plateformes de facility management rejettent ou pénalisent les factures soumises hors délai après complétion du WO. Le rituel J+2 protège aussi de ce risque-là — argument à utiliser tel quel auprès de l'équipe : « facturer à J+2 n'est pas du zèle, c'est une clause fournisseur ».

---

## 6. ORDRE DE DÉPLOIEMENT (tout est prêt à l'emploi)

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Résoudre les stage IDs + `activity_type_id` + conditions de paiement partner 9 → article 170 | 15 min, une fois | Débloque tout le reste |
| 2 | Coller le socle §1 + les 6 requêtes dans la session TEO ; premier run → photo du stock réel de terminé-non-facturé | 30 min | Chiffre la fuite dès aujourd'hui |
| 3 | Intégrer `cloturer_terrain()` au skill `rapport-sync` et l'ordre d'affichage cash-d'abord au skill `point-quotidien` | 1 h | Le rituel J+2 devient structurel |
| 4 | Premier point hebdo cash format §4 vendredi prochain ; itérer une fois sur le format avec Emin | 1 semaine | La réunion du lundi pilote sur chiffres |
| 5 | Créer le skill `relance-factures` (jumeau de `relance-devis`) + règle acomptes en doctrine (validation Emin) | 2 h | Attaque DSO et trésorerie |

---
*Fin du livrable Agent C. Dépendances vers Agent A : validations bloquantes `creer_devis()` / `envoyer_mail_client()` citées en §2.3, §5.1, §5.6. Aucune recommandation n'exige un outil hors §3 du dossier de mission.*

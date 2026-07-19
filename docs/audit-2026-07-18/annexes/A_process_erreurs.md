# AGENT A — PROCESS & ERREURS
## Audit IEF & CO — Périmètre §4, §5, §7.1, §7.3, §7.4, §7.5, §7.8
*Livrable du 18/07/2026 — actionnable immédiatement par TEO en conversation, sans nouvel outil.*

---

## 0. THÈSE CENTRALE

Le dossier a correctement identifié le pattern racine : **l'exécution précède le contrôle, et la mémoire repose sur des textes que l'IA doit décider de relire**. Les 7 points de contrôle et les verrous V1-V6 sont aujourd'hui des *checklists post-hoc* : elles supposent que TEO se souvienne de les appliquer après avoir écrit. C'est exactement la structure qui a produit les erreurs 1 à 4 du §5.

La parade n'est pas plus de discipline, c'est **un péage** : une bibliothèque Python (`ief_lib`, §2 ci-dessous) qui est le SEUL chemin d'écriture vers Odoo et Synchroteam, et qui **refuse d'écrire** (raise) tant que les invariants doctrine ne sont pas satisfaits. La checklist cesse d'être une relecture, elle devient une précondition. Le même principe est décliné sur le rattachement SR (§4 : convention de nommage déterministe → matching sans jugement), sur WhatsApp (§3 : convention d'objet → triage automatique) et sur la délégation (§5 : seuils par catégorie codés dans la lib, pas dans la tête d'Emin).

**Amendement doctrine à soumettre à Emin (article 140)** — une seule phrase, mais c'est la clé de voûte :
> « Toute écriture Odoo ou Synchroteam passe exclusivement par les fonctions de `ief_lib`. Un `execute_kw` ou un POST Synchroteam brut en écriture est une erreur auditable, comptée au compteur hebdo, même si le résultat est correct. »

---

## 1. DIAGNOSTIC §4-§5 — chaque erreur historique mappée sur son verrou structurel

| # | Erreur historique (§5) | Cause racine | Verrou structurel proposé (impossible à sauter) |
|---|---|---|---|
| 1 | Livraison = Suresnes (contact par défaut du parent) ; SR absent de la référence ; facture au nom du site → avoir | Valeurs par défaut Odoo non contrôlées, écriture sans relecture | `creer_devis()` : raise si `partner_shipping_id == partner_invoice_id`, si le site n'est pas enfant du partner 9, si `client_order_ref` ne contient ni SR ni AST. Relecture post-écriture automatique (`_relecture`) qui raise en cas d'écart. `audit_flash()` détecte les factures postées au nom d'un site ≠ 9. |
| 2 | myId Synchroteam absent à la création, irrécupérable après clôture | Règle connue mais hors du geste de création | `creer_job()` : `my_id` est le **premier argument positionnel obligatoire**, format validé par regex. Pas de myId = pas de job, physiquement. |
| 3 | Erreur factuelle dans un mail parti (« les deux portes ouvrent ») | Reformulation de mémoire au lieu de vérification contre la source | `envoyer_mail_client()` exige `source_verifiee=True` + le champ `source_citee` (référence du compte rendu contre lequel le corps a été vérifié). Sans cela : raise. La machine ne peut pas vérifier les faits, mais elle peut **refuser d'envoyer tant que TEO n'a pas déclaré explicitement l'avoir fait**, en citant quoi — ce qui transforme un oubli silencieux en mensonge explicite, catégoriellement différent pour un LLM. |
| 4 | Planification non demandée sur inférence d'un vocal ambigu | Déduction critique non signalée | `planifier_job(..., source=...)` : `source="inference"` → raise avec message imposant le rituel V2 (« j'ai compris X = Y »). Seul `source="ordre_explicite"` écrit. |
| 5 | Perte de contexte inter-conversations | Registre 169 mis à jour *à la clôture* (si la conversation meurt avant, l'état est perdu) | Règle **write-ahead** : le registre 169 se met à jour AVANT chaque action longue, pas après (voir angle mort AM-3, §6). Périmètre détaillé : Agent B. |
| 6 | Sujets écrasés (changement de sujet en vocal) | Pile de sujets implicite | Convention conversationnelle : à chaque changement de sujet, TEO répond d'abord une ligne « ⏸ Sujet précédent mis en attente : *X* — repris après ». Le sujet suspendu entre au registre 169 immédiatement (write-ahead). Coût : 1 ligne. |
| 7 | Consommation de tokens | Doctrine monolithique relue | Périmètre Agent B ; ma contribution : la lib **remplace** ~40 % de la doctrine procédurale (les règles d'écriture n'ont plus besoin d'être relues, elles sont dans le code). |

**Point d'appui important** : le « bricolage » du §4 est en réalité une architecture saine (doctrine figée, signatures verbatim, registre, rituels, mot-code CHIFFRE). Ce qui manque n'est pas la conception, c'est le **caractère exécutoire**. Tout mon livrable consiste à rendre exécutoire ce qui est aujourd'hui déclaratif.

---

## 2. §7.1 — BIBLIOTHÈQUE ANTI-ERREUR `ief_lib`

### 2.1 Mode d'emploi (protocole exact)

1. **Au lancement de session**, Emin injecte les secrets (jamais en clair dans la conversation) : `ODOO_API_KEY`, `SYNCHROTEAM_KEY`, et une fois pour toutes `ODOO_PARTNER_EMIN` (id partner d'Emin pour la copie systématique). La lib raise `ErreurConfiguration` si une variable manque — elle ne peut pas fonctionner en mode dégradé.
2. TEO colle le bloc ci-dessous dans son environnement d'exécution Python (stdlib uniquement : `xmlrpc.client`, `urllib`, `json`, `uuid`, `re` — aucune dépendance à installer).
3. **Toute écriture passe par la lib.** Les lectures libres (`odoo(model, "search_read", ...)`) restent permises : le péage ne porte que sur ce qui engage l'entreprise.
4. Deux issues seulement pour chaque fonction d'écriture : succès **avec relecture vérifiée**, ou `ErreurValidation` listant TOUTES les violations (pas seulement la première — pour corriger en un aller-retour).
5. Le texte canonique de la lib vit dans un article Odoo Knowledge dédié (proposition : **article 171 « ief_lib — code canonique »**, figé, amendé comme le 140). TEO le recharge en début de session par un read chirurgical — c'est le seul « gros » chargement, et il remplace la relecture de toutes les règles d'écriture de la doctrine.

### 2.2 Le code complet

```python
# =============================================================================
#  ief_lib.py — Bibliothèque anti-erreur IEF & CO
#  v1.0 — 18/07/2026 — Agent A, audit process & erreurs
#
#  PRINCIPE : ces fonctions sont le SEUL chemin d'écriture vers Odoo et
#  Synchroteam. Chaque fonction REFUSE d'écrire (ErreurValidation) si un
#  invariant doctrine est violé, et VÉRIFIE par relecture après écriture.
#  La checklist des 7 points n'est plus une discipline : c'est une précondition.
#
#  SECRETS : jamais en clair. Injectés par Emin au lancement :
#    ODOO_API_KEY        (clé API Odoo du compte de service)
#    SYNCHROTEAM_KEY     (clé API du domaine iefandco)
#    ODOO_PARTNER_EMIN   (id res.partner d'Emin — copie systématique des mails)
#  Optionnelles (valeurs par défaut sinon) :
#    ODOO_URL, ODOO_DB, ODOO_UID, SYNCHROTEAM_DOMAIN, SEUIL_MAIL_SENSIBLE_HT
#
#  Dépendances : stdlib Python uniquement. Rien à installer.
# =============================================================================

import os
import re
import json
import uuid
import base64
import datetime
import xmlrpc.client
from urllib import request as _urlreq, parse as _urlparse, error as _urlerr

# ----------------------------------------------------------------------------
# CONSTANTES MÉTIER (doctrine IEF — ne modifier que sur amendement validé Emin)
# ----------------------------------------------------------------------------
ODOO_URL = os.environ.get("ODOO_URL", "https://iefandco.odoo.com")
ODOO_DB  = os.environ.get("ODOO_DB", "iefandco")
ODOO_UID = int(os.environ.get("ODOO_UID", "6"))

ST_BASE   = "https://ws.synchroteam.com/api/v3"
ST_DOMAIN = os.environ.get("SYNCHROTEAM_DOMAIN", "iefandco")

EG_PARENT_ID = 9        # SAS EG RETAIL (FRANCE) — SEULE entité de facturation EG
TVA_20_ID    = 36       # TVA 20 % — la seule TVA autorisée (règle Emin, ferme)
CENTIMES_OK  = {30, 40, 70, 80}   # décimales autorisées sur tout prix client
COULEUR_LIEN = "#E30613"          # liens mails : rouge, gras, souligné

TECHNICIENS = {   # ids Synchroteam — seule liste d'assignation autorisée
    "emin":   179815,   # TECH099
    "jorge":  207155,   # IEF 007
    "yanis":  224511,
    "tampon": 182995,   # TEC031 — file d'attente, jamais une assignation finale
}

STAGES_CRM = {   # ids crm.stage connus (§3 du dossier de mission)
    "a_planifier":            7,
    "intervention_planifiee": 5,
    "commande_a_faire":       6,
    "cloture":                9,
    # "nouveau" et "a_facturer" : ids non documentés — les résoudre UNE fois
    # par odoo("crm.stage","search_read",[[]],{"fields":["id","name"]})
    # puis les figer ici. INTERDIT de deviner un id de stage.
}

# Seuils du cran d'arrêt mails sensibles, en € HT, par catégorie client.
# Voir §5.3 du livrable Agent A pour la justification du barème.
SEUILS_MAIL_HT = {
    "eg":          5000.0,   # coordinateurs EG : flux routinier, cadré par SR + NTE
    "defaut":      3000.0,   # seuil historique conservé par défaut
    "copro":       1500.0,   # syndics/copros : sensibilité juridique et de ton
    "particulier": 1500.0,
    "hotel":       3000.0,
}
MOTS_SINISTRE = ("sinistre", "assurance", "expert d'assurance", "dégât des eaux",
                 "degat des eaux", "incendie", "effraction", "vandalisme",
                 "cambriolage", "responsabilité", "responsabilite")

RE_SR      = re.compile(r"\b\d{6,10}\b")                    # n° SR/WO ServiceChannel
RE_AST     = re.compile(r"\bAST-\d{8}-P\d+(?:-[B-Z])?\b")   # ticket astreinte provisoire
RE_MONTANT = re.compile(
    r"(?:\d[\d\s  .,]*\s*(?:€|eur(?:os)?\b))"     # 1 200,30 € / 90 euros
    r"|(?:€\s*\d)"                                          # €1200
    r"|(?:\b\d+[.,]\d{2}\s*(?:HT|TTC)\b)",                  # 1200,30 HT
    re.IGNORECASE)

# ----------------------------------------------------------------------------
# EXCEPTIONS
# ----------------------------------------------------------------------------
class ErreurValidation(Exception):
    """Écriture REFUSÉE : au moins un garde-fou doctrine est violé.
    .violations contient la liste COMPLÈTE des violations (corriger en un tour)."""
    def __init__(self, violations):
        self.violations = list(violations) if isinstance(violations, (list, tuple)) else [violations]
        super().__init__("ÉCRITURE REFUSÉE — " + " | ".join(self.violations))

class ErreurConfiguration(Exception):
    pass

def _secret(nom):
    val = os.environ.get(nom, "").strip()
    if not val:
        raise ErreurConfiguration(
            f"Variable d'environnement {nom} absente. Emin doit l'injecter au "
            f"lancement de session — les secrets ne sont JAMAIS écrits en clair.")
    return val

# ----------------------------------------------------------------------------
# TRANSPORT ODOO (XML-RPC)
# ----------------------------------------------------------------------------
_ODOO_PROXY = None

def _odoo_proxy():
    global _ODOO_PROXY
    if _ODOO_PROXY is None:
        _ODOO_PROXY = xmlrpc.client.ServerProxy(
            f"{ODOO_URL}/xmlrpc/2/object", allow_none=True)
    return _ODOO_PROXY

def odoo(model, method, args=None, kw=None):
    """Appel Odoo générique. AUTORISÉ en lecture libre.
    En ÉCRITURE (create/write/unlink), passer par les fonctions métier
    ci-dessous — un appel brut en écriture est une erreur auditable."""
    return _odoo_proxy().execute_kw(
        ODOO_DB, ODOO_UID, _secret("ODOO_API_KEY"),
        model, method, args or [], kw or {})

def odoo_create(model, vals):
    """PIÈGE §6 : en Odoo 19, create renvoie une LISTE d'ids.
    On déballe systématiquement ici — plus jamais de so au lieu de so[0]."""
    res = odoo(model, "create", [[vals]])
    return res[0] if isinstance(res, list) else res

def _m2o(val):
    """Normalise un many2one lu ((id, 'label') / [id, 'label'] / id / False)."""
    if isinstance(val, (list, tuple)):
        return val[0] if val else None
    return val if val else None

def _relecture(model, rec_id, attentes):
    """Relecture POST-ÉCRITURE structurelle : lit l'enregistrement et raise si
    un champ ne contient pas ce qui devait y être écrit. C'est le verrou de
    l'erreur historique n°1 (écriture sans relecture)."""
    rec = odoo(model, "read", [[rec_id]], {"fields": list(attentes.keys())})[0]
    ecarts = []
    for champ, attendu in attentes.items():
        lu = rec.get(champ)
        lu_n  = _m2o(lu) if isinstance(lu, (list, tuple)) else lu
        att_n = _m2o(attendu) if isinstance(attendu, (list, tuple)) else attendu
        if isinstance(att_n, str):
            if att_n not in str(lu if not isinstance(lu, (list, tuple)) else lu[1]):
                ecarts.append(f"{champ} : attendu contenant {att_n!r}, lu {lu!r}")
        elif lu_n != att_n:
            ecarts.append(f"{champ} : attendu {att_n!r}, lu {lu!r}")
    if ecarts:
        raise ErreurValidation(
            [f"RELECTURE POST-ÉCRITURE EN ÉCHEC sur {model} id {rec_id}"] + ecarts)
    return rec

# ----------------------------------------------------------------------------
# TRANSPORT SYNCHROTEAM (v3, Basic Auth domaine:clé)
# ----------------------------------------------------------------------------
def _st_call(http_method, path, params=None, payload=None):
    url = f"{ST_BASE}/{path}"
    if params:
        # PIÈGE §6 : urlencode OBLIGATOIRE sur tous les GET
        # (les espaces des datetimes cassent les requêtes sinon).
        url += "?" + _urlparse.urlencode(params)
    auth = base64.b64encode(
        f"{ST_DOMAIN}:{_secret('SYNCHROTEAM_KEY')}".encode()).decode()
    req = _urlreq.Request(url, method=http_method, headers={
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/json",
        "Accept": "application/json"})
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    try:
        with _urlreq.urlopen(req, data=data, timeout=60) as r:
            raw = r.read().decode("utf-8", "replace")
    except _urlerr.HTTPError as e:
        raise ErreurValidation(
            [f"Synchroteam {http_method} {path} → HTTP {e.code} : "
             f"{e.read().decode('utf-8','replace')[:500]}"])
    return json.loads(raw) if raw.strip() else {}

def st_get(path, **params):
    return _st_call("GET", path, params=params)

def st_post(path, payload):
    return _st_call("POST", path, payload=payload)

def chercher_site_st(terme, page_size=100, max_pages=30):
    """PIÈGE §6 : sur site/list, le paramètre `search` NE FILTRE PAS.
    On pagine tout et on filtre LOCALEMENT (nom + adresse), point final."""
    terme_l = terme.lower()
    trouves, page = [], 1
    while page <= max_pages:
        lot = st_get("site/list", pageSize=page_size, page=page)
        data = lot.get("data") or []
        for s in data:
            blob = " ".join(str(s.get(k, "")) for k in
                            ("name", "myId", "address", "zipCode", "city")).lower()
            if terme_l in blob:
                trouves.append(s)
        if len(data) < page_size:
            break
        page += 1
    return trouves

def _trouver_job_st_par_myid(my_id, jours=60):
    """Retrouve un job par myId : pagination + filtre local (même prudence
    que site/list — on ne fait pas confiance aux filtres serveur)."""
    depuis = (datetime.date.today() - datetime.timedelta(days=jours)).strftime("%Y-%m-%d 00:00:00")
    page = 1
    while page <= 50:
        lot = st_get("job/list", pageSize=100, page=page, dateFrom=depuis)
        data = lot.get("data") or []
        for j in data:
            if str(j.get("myId", "")).strip() == str(my_id).strip():
                return j
        if len(data) < 100:
            return None
        page += 1
    return None

# ----------------------------------------------------------------------------
# VALIDATEURS DOCTRINE (réutilisés par toutes les fonctions d'écriture)
# ----------------------------------------------------------------------------
def _v_prix_non_rond(montant, contexte=""):
    try:
        cents = round(round(float(montant), 2) * 100) % 100
    except (TypeError, ValueError):
        return [f"Prix illisible {montant!r} {contexte}"]
    if cents not in CENTIMES_OK:
        return [f"Prix {montant} {contexte} : décimales ,{cents:02d} interdites — "
                f"doctrine Emin : uniquement ,30 ,40 ,70 ,80 (jamais de prix rond)."]
    return []

def _v_reference_ticket(ref):
    if not ref or not (RE_SR.search(str(ref)) or RE_AST.search(str(ref))):
        return [f"Référence {ref!r} sans n° SR ni ticket provisoire "
                f"AST-AAAAMMJJ-P<id_site>. Bloquant (erreur historique n°1)."]
    return []

def _v_description_sans_montant(texte, contexte="description"):
    if texte:
        m = RE_MONTANT.search(texte)
        if m:
            return [f"La {contexte} contient un montant (« {m.group(0)} ») — "
                    f"interdit : jamais de montants dans les descriptions Synchroteam."]
    return []

def _v_site_eg(site_partner_id):
    """Le site doit être un ENFANT de SAS EG RETAIL (9), avec une vraie adresse,
    et ne doit PAS être l'entité de facturation elle-même (piège Suresnes)."""
    violations = []
    if not site_partner_id:
        return ["site_partner_id manquant : l'adresse de livraison = le SITE, toujours."], None
    if int(site_partner_id) == EG_PARENT_ID:
        return [f"site_partner_id = {EG_PARENT_ID} (SAS EG RETAIL) : c'est l'entité de "
                f"facturation, PAS un site. La livraison sur le siège (Suresnes) est "
                f"l'erreur historique n°1 — refusé."], None
    site = odoo("res.partner", "read", [[int(site_partner_id)]],
                {"fields": ["name", "parent_id", "street", "zip", "city",
                            "commercial_partner_id"]})
    if not site:
        return [f"Partner {site_partner_id} introuvable dans Odoo."], None
    site = site[0]
    racine = _m2o(site.get("commercial_partner_id")) or _m2o(site.get("parent_id"))
    if racine != EG_PARENT_ID:
        violations.append(
            f"Le site « {site['name']} » (id {site_partner_id}) n'est pas rattaché à "
            f"SAS EG RETAIL (parent id {EG_PARENT_ID}) — rattachement lu : {racine}.")
    if not site.get("street") or not site.get("city"):
        violations.append(
            f"Le site « {site['name']} » n'a pas d'adresse complète "
            f"(street={site.get('street')!r}, city={site.get('city')!r}) : "
            f"impossible de garantir livraison = site.")
    return violations, site

# ----------------------------------------------------------------------------
# TICKET ASTREINTE PROVISOIRE (convention §7.4 — matching déterministe)
# ----------------------------------------------------------------------------
def nouveau_ticket_astreinte(site_partner_id, date=None, suffixe=""):
    """AST-AAAAMMJJ-P<id partner Odoo du site>[-B].
    L'id partner rend le code déterministe et unique (aucune ambiguïté de
    nommage de site) ; le suffixe -B/-C couvre 2 appels même site même jour."""
    d = (date or datetime.date.today()).strftime("%Y%m%d")
    code = f"AST-{d}-P{int(site_partner_id)}"
    if suffixe:
        code += f"-{suffixe.upper()}"
    if not RE_AST.match(code):
        raise ErreurValidation([f"Ticket astreinte mal formé : {code}"])
    return code

# ============================================================================
# 1) CRÉER UNE CARTE EG (crm.lead)
# ============================================================================
def creer_carte_eg(titre, site_partner_id, ticket=None, astreinte=False,
                   description="", stage="a_planifier"):
    """Carte pipeline EG. REFUSE d'écrire si :
    - pas de ticket (SR réel ou AST provisoire) — sauf astreinte=True qui en génère un ;
    - site absent, sans adresse, ou non rattaché au parent 9 ;
    - la description contient un montant ;
    - stage inconnu (interdit de deviner un id de stage).
    Le ticket est posé DANS LE TITRE : c'est lui qui rend le rattachement
    différé (§7.4) déterministe."""
    violations = []

    if astreinte and not ticket:
        ticket = nouveau_ticket_astreinte(site_partner_id)
    violations += _v_reference_ticket(ticket)

    v_site, site = _v_site_eg(site_partner_id)
    violations += v_site

    violations += _v_description_sans_montant(description)

    stage_id = STAGES_CRM.get(stage)
    if stage_id is None:
        violations.append(
            f"Stage {stage!r} sans id connu dans STAGES_CRM — résoudre l'id via "
            f"crm.stage search_read et le figer, ne jamais deviner.")

    if violations:
        raise ErreurValidation(violations)

    nom_carte = f"[{ticket}] {titre}"
    desc = (f"Ticket : {ticket}\n"
            f"Site : {site['name']} — {site.get('street','')}, "
            f"{site.get('zip','')} {site.get('city','')}\n"
            f"Facturation : SAS EG RETAIL (FRANCE) (partner {EG_PARENT_ID})\n"
            + ("ASTREINTE SANS SR — rattachement différé attendu (§7.4)\n" if astreinte else "")
            + (description or ""))

    lead_id = odoo_create("crm.lead", {
        "name": nom_carte,
        "partner_id": int(site_partner_id),
        "type": "opportunity",
        "stage_id": stage_id,
        "description": desc,
    })
    _relecture("crm.lead", lead_id, {
        "name": str(ticket),          # le ticket doit être DANS le nom
        "partner_id": int(site_partner_id),
        "stage_id": stage_id,
    })
    return {"lead_id": lead_id, "ticket": ticket, "nom": nom_carte,
            "astreinte": bool(astreinte)}

# ============================================================================
# 2) CRÉER UN DEVIS (sale.order)
# ============================================================================
def creer_devis(lignes, reference_client, site_partner_id=None, eg=True,
                partner_facturation_id=None):
    """Devis Odoo. REFUSE d'écrire si :
    - EG : facturation ≠ partner 9, ou site absent / = 9 / hors parent 9 ;
    - référence client sans n° SR ni ticket AST ;
    - un prix a des décimales hors ,30/,40/,70/,80 ;
    - une ligne est sans product_id (le chiffrage passe par le catalogue
      IEF-F-XXX, workflow CHIFFRE) ou libellée en m² pour EG ;
    - quantité ≤ 0.
    La TVA 20 % (id 36) est IMPOSÉE sur chaque ligne — pas un paramètre.
    Relecture post-écriture : entité, livraison, référence, taxes, lignes.

    lignes = [{"product_id": int, "libelle": str, "qte": float, "prix_ht": float}, ...]
    """
    violations = []
    violations += _v_reference_ticket(reference_client)

    if eg:
        if partner_facturation_id not in (None, EG_PARENT_ID):
            violations.append(
                f"Devis EG : l'entité de facturation est SAS EG RETAIL "
                f"(partner {EG_PARENT_ID}), pas {partner_facturation_id}.")
        fact_id = EG_PARENT_ID
        v_site, _site = _v_site_eg(site_partner_id)
        violations += v_site
        ship_id = int(site_partner_id) if site_partner_id else None
    else:
        if not partner_facturation_id:
            violations.append("Devis non-EG : partner_facturation_id obligatoire.")
        fact_id = partner_facturation_id and int(partner_facturation_id)
        ship_id = int(site_partner_id) if site_partner_id else fact_id
        if ship_id and fact_id and ship_id == fact_id and site_partner_id is None:
            pass  # non-EG : livraison = client est admis si aucun site distinct

    if not lignes:
        violations.append("Devis sans ligne : refusé.")
    for i, l in enumerate(lignes or [], start=1):
        if not l.get("product_id"):
            violations.append(
                f"Ligne {i} sans product_id : passer par le catalogue IEF-F-XXX "
                f"(créer la variante manquante d'abord — workflow CHIFFRE).")
        if float(l.get("qte", 0)) <= 0:
            violations.append(f"Ligne {i} : quantité {l.get('qte')!r} invalide.")
        violations += _v_prix_non_rond(l.get("prix_ht"), f"(ligne {i})")
        lib = (l.get("libelle") or "")
        if eg and re.search(r"\bm(?:²|2)\b", lib, re.IGNORECASE):
            violations.append(
                f"Ligne {i} : libellé en m² — EG exige « Unité/Forfait », "
                f"jamais de détail m².")

    if violations:
        raise ErreurValidation(violations)

    order_line = [[0, 0, {
        "product_id": int(l["product_id"]),
        "name": l.get("libelle") or None,
        "product_uom_qty": float(l["qte"]),
        "price_unit": round(float(l["prix_ht"]), 2),
        "tax_id": [[6, 0, [TVA_20_ID]]],     # TVA 20 % imposée, jamais 10 %
    }] for l in lignes]

    so_id = odoo_create("sale.order", {          # create renvoie une liste → odoo_create déballe
        "partner_id": fact_id,
        "partner_invoice_id": fact_id,
        "partner_shipping_id": ship_id,
        "client_order_ref": str(reference_client),
        "order_line": order_line,
    })

    _relecture("sale.order", so_id, {
        "partner_invoice_id": fact_id,
        "partner_shipping_id": ship_id,
        "client_order_ref": str(reference_client),
    })
    # Relecture des taxes ligne à ligne
    so = odoo("sale.order", "read", [[so_id]], {"fields": ["order_line", "name", "amount_untaxed"]})[0]
    for ol in odoo("sale.order.line", "read", [so["order_line"]], {"fields": ["tax_id", "price_unit", "name"]}):
        if ol["tax_id"] != [TVA_20_ID]:
            raise ErreurValidation(
                [f"Devis {so['name']} : ligne « {ol['name']} » avec taxes {ol['tax_id']} "
                 f"au lieu de [{TVA_20_ID}] — corriger avant tout envoi."])
    return {"so_id": so_id, "name": so["name"], "montant_ht": so["amount_untaxed"],
            "reference_client": str(reference_client)}

def portail_lien(so_id, texte="Consulter votre devis"):
    """Lien portail du devis. PIÈGE §6 : access_token à écrire SOI-MÊME (uuid4)
    s'il est vide. Retourne le <a> déjà stylé doctrine (rouge gras souligné)."""
    so = odoo("sale.order", "read", [[int(so_id)]], {"fields": ["access_token"]})[0]
    token = so.get("access_token")
    if not token:
        token = str(uuid.uuid4())
        odoo("sale.order", "write", [[int(so_id)], {"access_token": token}])
        _relecture("sale.order", int(so_id), {"access_token": token})
    url = f"{ODOO_URL}/my/orders/{int(so_id)}?access_token={token}"
    return lien(url, texte)

# ============================================================================
# 3) CRÉER / PLANIFIER UN JOB SYNCHROTEAM
# ============================================================================
def creer_job(my_id, description="", site_st_id=None, customer_st_id=None,
              adresse=None):
    """Job Synchroteam. REFUSE d'écrire si :
    - my_id absent ou mal formé (SR ou AST) — myId est IRRÉCUPÉRABLE après
      clôture du rapport (erreur historique n°2) : il est donc posé À LA
      CRÉATION, premier argument, obligatoire ;
    - ni site ni adresse (l'adresse de livraison est obligatoire) ;
    - la description contient un montant.
    Relecture par job/details après création."""
    violations = []
    if not my_id or not (RE_SR.search(str(my_id)) or RE_AST.search(str(my_id))):
        violations.append(
            f"myId {my_id!r} absent ou hors format (SR 6-10 chiffres ou "
            f"AST-AAAAMMJJ-P<id>). myId se pose À LA CRÉATION, jamais après "
            f"(verrouillé dès clôture du rapport — erreur historique n°2).")
    if not site_st_id and not adresse:
        violations.append(
            "Ni site_st_id ni adresse : l'adresse de livraison (= le site) "
            "est obligatoire sur tout job.")
    violations += _v_description_sans_montant(description)
    if violations:
        raise ErreurValidation(violations)

    payload = {"myId": str(my_id), "description": description or ""}
    if site_st_id:
        payload["site"] = {"id": int(site_st_id)}
    if customer_st_id:
        payload["customer"] = {"id": int(customer_st_id)}
    if adresse:
        payload["address"] = adresse

    res = st_post("job/send", payload)   # sans "id" = création ; avec "id" = MàJ PARTIELLE
    job_id = res.get("id") or (res.get("data") or {}).get("id")
    if not job_id:
        raise ErreurValidation(
            [f"job/send n'a pas renvoyé d'id — réponse : {json.dumps(res)[:400]}"])

    details = st_get("job/details", id=job_id)
    if str(details.get("myId", "")).strip() != str(my_id):
        raise ErreurValidation(
            [f"RELECTURE : job {job_id} créé mais myId lu = "
             f"{details.get('myId')!r} au lieu de {my_id!r}."])
    return {"job_id": job_id, "myId": str(my_id), "num": details.get("num")}

def planifier_job(job_id, technicien, debut, fin, source="ordre_explicite"):
    """job/schedule — SEUL endpoint fiable d'assignation. REFUSE si :
    - source == "inference" : une planification déduite d'un vocal ambigu
      NE S'ÉCRIT PAS (erreur historique n°4). Rituel V2 obligatoire :
      afficher « j'ai compris X = Y », attendre la confirmation d'Emin,
      puis rappeler avec source="ordre_explicite" ;
    - scheduledStart/scheduledEnd absents, mal formés ou inversés
      (l'API les EXIGE tous les deux) ;
    - technicien hors de la liste TECHNICIENS.
    debut/fin : "AAAA-MM-JJ HH:MM:SS"."""
    violations = []
    if source != "ordre_explicite":
        violations.append(
            "Planification sur inférence REFUSÉE (erreur historique n°4). "
            "Afficher « j'ai compris <vocal> = <date/heure> », obtenir la "
            "confirmation d'Emin, puis rappeler avec source='ordre_explicite'.")
    tech_id = TECHNICIENS.get(str(technicien).lower()) if not str(technicien).isdigit() else int(technicien)
    if tech_id not in TECHNICIENS.values():
        violations.append(
            f"Technicien {technicien!r} hors liste autorisée {sorted(TECHNICIENS)}.")
    dt_debut = dt_fin = None
    for label, val in (("debut", debut), ("fin", fin)):
        try:
            parsed = datetime.datetime.strptime(str(val), "%Y-%m-%d %H:%M:%S")
            if label == "debut":
                dt_debut = parsed
            else:
                dt_fin = parsed
        except (TypeError, ValueError):
            violations.append(
                f"{label}={val!r} : format exigé 'AAAA-MM-JJ HH:MM:SS' "
                f"(job/schedule exige scheduledStart ET scheduledEnd).")
    if dt_debut and dt_fin and dt_fin <= dt_debut:
        violations.append(f"fin ({fin}) ≤ début ({debut}).")
    if violations:
        raise ErreurValidation(violations)

    st_post("job/schedule", {
        "id": int(job_id),
        "technician": {"id": tech_id},
        "scheduledStart": str(debut),
        "scheduledEnd": str(fin),
    })
    details = st_get("job/details", id=int(job_id))
    if not details.get("scheduledStart"):
        raise ErreurValidation(
            [f"RELECTURE : job {job_id} non planifié après job/schedule "
             f"(scheduledStart vide)."])
    return {"job_id": int(job_id), "technicien_id": tech_id,
            "debut": str(debut), "fin": str(fin)}

def remettre_au_panier(job_id):
    """job/unschedule {"id"} — le seul geste fiable pour déprogrammer."""
    st_post("job/unschedule", {"id": int(job_id)})
    return {"job_id": int(job_id), "statut": "au_panier"}

# ============================================================================
# 4) ENVOYER UN MAIL CLIENT (wizard mail.compose.message — jamais message_post)
# ============================================================================
def lien(url, texte):
    """Le seul format de lien autorisé dans les mails : rouge #E30613, gras,
    souligné (les background CSS sont strippés par les clients mail)."""
    return (f'<a href="{url}" style="color:{COULEUR_LIEN};'
            f'font-weight:bold;text-decoration:underline;">{texte}</a>')

def _detecter_sensibilite(sujet, corps, montant_ht, categorie_client,
                          sinistre, premier_contact, destinataires_pids):
    """Cran d'arrêt mails sensibles. Retourne la liste des motifs de blocage."""
    motifs = []
    blob = f"{sujet}\n{corps}".lower()
    if sinistre or any(m in blob for m in MOTS_SINISTRE):
        motifs.append("Contexte SINISTRE / assurance / responsabilité détecté.")
    seuil = SEUILS_MAIL_HT.get(categorie_client, SEUILS_MAIL_HT["defaut"])
    seuil = float(os.environ.get("SEUIL_MAIL_SENSIBLE_HT", seuil))
    if montant_ht is not None and float(montant_ht) > seuil:
        motifs.append(f"Montant {montant_ht} € HT > seuil {seuil} € HT "
                      f"(catégorie {categorie_client}).")
    if premier_contact is None:
        # Auto-détection : aucun message historique ne référence ce partner
        premier_contact = True
        for pid in destinataires_pids:
            if odoo("mail.message", "search_count",
                    [[["partner_ids", "in", int(pid)]]]):
                premier_contact = False
                break
    if premier_contact:
        motifs.append("PREMIER CONTACT avec ce destinataire.")
    if re.search(r"\bremise\b|\bgeste commercial\b", blob):
        motifs.append("Le mail évoque une remise/geste commercial "
                      "(remises max 3-4 %, jamais 5 %+ sans ordre).")
    return motifs

def _dernier_message(model, res_id):
    ids = odoo("mail.message", "search",
               [[["model", "=", model], ["res_id", "=", int(res_id)]]],
               {"order": "id desc", "limit": 1})
    if not ids:
        return None
    return odoo("mail.message", "read", [ids],
                {"fields": ["id", "subject", "body", "partner_ids", "date"]})[0]

def envoyer_mail_client(model, res_id, sujet, corps_html, destinataires_pids,
                        signature_html, source_verifiee=False, source_citee="",
                        montant_ht=None, categorie_client="defaut",
                        sinistre=None, premier_contact=None,
                        piece_jointe_ids=None, valide_par_emin=False):
    """Envoi mail via le wizard mail.compose.message.
    POURQUOI LE WIZARD : en Odoo 19, message_post ÉCHAPPE le HTML — le wizard
    est le seul canal propre. PIÈGES §6 intégrés : res_ids = liste d'entiers
    Python ; pièces jointes [[6,0,[ids]]] ; le send() peut lever une exception
    de marshalling CÔTÉ CLIENT alors que le mail PART → la preuve d'envoi est
    la RELECTURE (mail.message), jamais l'absence d'exception. Ne JAMAIS
    réémettre après une exception sans avoir relu (risque de doublon client).

    REFUS (raise) si :
    - source_verifiee est False ou source_citee vide : verrou de l'erreur
      historique n°3 — TEO doit déclarer contre QUELLE source (compte rendu,
      rapport Synchroteam, mail) chaque fait du corps a été vérifié ;
    - signature absente (article 160, verbatim, jamais régénérée) ;
    - un <a> du corps n'est pas au format lien() (rouge gras souligné) ;
    - un destinataire a un mail en plus-addressing (IONOS rejette en 554) ;
    - ODOO_PARTNER_EMIN non résoluble (Emin TOUJOURS en copie).

    CRAN D'ARRÊT (retour brouillon, PAS d'envoi, PAS d'exception) si
    sinistre / montant > seuil catégorie / premier contact / remise, et
    valide_par_emin=False. Après validation explicite d'Emin dans la
    conversation, rappeler à l'identique avec valide_par_emin=True."""
    violations = []

    if not source_verifiee or not str(source_citee).strip():
        violations.append(
            "Vérification factuelle non déclarée : relire le corps CONTRE la "
            "source (rapport/compte rendu/mail), puis rappeler avec "
            "source_verifiee=True et source_citee='<référence de la source>'. "
            "Verrou de l'erreur historique n°3 (mail factuellement faux parti).")
    if not signature_html or not signature_html.strip():
        violations.append("Signature canonique (article 160) manquante — "
                          "toujours copiée verbatim, jamais régénérée.")
    for a in re.finditer(r"<a\s[^>]*>", corps_html or "", re.IGNORECASE):
        tag = a.group(0)
        if COULEUR_LIEN.lower() not in tag.lower() or "underline" not in tag.lower():
            violations.append(
                f"Lien non conforme : {tag[:90]}… — utiliser lien(url, texte) "
                f"(rouge {COULEUR_LIEN}, gras, souligné ; les background CSS "
                f"sont strippés).")
    if re.search(r"background\s*[:=]", corps_html or "", re.IGNORECASE):
        violations.append("CSS background détecté : strippé par les clients "
                          "mail — retirer.")

    emin_pid = int(_secret("ODOO_PARTNER_EMIN"))
    dest = sorted({int(p) for p in destinataires_pids} | {emin_pid})  # Emin TOUJOURS en copie
    for p in odoo("res.partner", "read", [dest], {"fields": ["name", "email"]}):
        email = (p.get("email") or "").strip()
        if not email:
            violations.append(f"Partner {p['name']} (id {p['id']}) sans email.")
        elif "+" in email.split("@")[0]:
            violations.append(
                f"{p['name']} : adresse en plus-addressing ({email}) — "
                f"IONOS rejette en 554. Utiliser l'adresse canonique.")
    if violations:
        raise ErreurValidation(violations)

    corps_final = (corps_html or "") + signature_html

    motifs = _detecter_sensibilite(sujet, corps_final, montant_ht,
                                   categorie_client, sinistre,
                                   premier_contact, dest)
    if motifs and not valide_par_emin:
        return {
            "statut": "BROUILLON_A_VALIDER",   # PAS d'envoi.
            "motifs": motifs,
            "consigne": ("Présenter ce brouillon à Emin dans la conversation. "
                         "Après son OK explicite, rappeler la fonction à "
                         "l'identique avec valide_par_emin=True."),
            "apercu": {"model": model, "res_id": int(res_id), "sujet": sujet,
                       "destinataires": dest, "corps_html": corps_final,
                       "pieces_jointes": piece_jointe_ids or []},
        }

    wiz_vals = {
        "composition_mode": "comment",
        "model": model,
        "res_ids": [int(res_id)],                 # PIÈGE : liste d'ENTIERS Python
        "subject": sujet,
        "body": corps_final,                      # wizard = HTML non échappé
        "partner_ids": [[6, 0, dest]],
    }
    if piece_jointe_ids:
        wiz_vals["attachment_ids"] = [[6, 0, [int(i) for i in piece_jointe_ids]]]

    wiz_id = odoo_create("mail.compose.message", wiz_vals)
    exception_marshalling = None
    try:
        odoo("mail.compose.message", "action_send_mail", [[wiz_id]])
    except Exception as e:                        # noqa: BLE001
        exception_marshalling = repr(e)[:300]     # le mail est PROBABLEMENT parti quand même

    controle = verifier_rendu_mail(model, res_id, sujet_attendu=sujet,
                                   signature_html=signature_html)
    if not controle["message_trouve"]:
        raise ErreurValidation(
            [f"Envoi NON confirmé par relecture (mail.message absent). "
             f"Exception éventuelle : {exception_marshalling}. NE PAS "
             f"réémettre en aveugle : diagnostiquer d'abord (mail.mail state)."])
    return {"statut": "ENVOYE_ET_VERIFIE",
            "message_id": controle["message_id"],
            "exception_marshalling_ignoree": exception_marshalling,
            "controles": controle["controles"],
            "rappel": ("Afficher le corps envoyé à Emin (copie reçue) et le "
                       "comparer une dernière fois à la source citée : "
                       f"{source_citee}")}

def verifier_rendu_mail(model, res_id, sujet_attendu=None, signature_html=None):
    """Relecture du DERNIER message du dossier : preuve d'envoi + contrôle de
    rendu (liens stylés, pas de background, signature présente). À appeler
    aussi seul, après tout envoi douteux (exception de marshalling)."""
    msg = _dernier_message(model, res_id)
    if not msg:
        return {"message_trouve": False, "message_id": None, "controles": []}
    body = msg.get("body") or ""
    controles = []
    if sujet_attendu and sujet_attendu not in (msg.get("subject") or ""):
        controles.append(f"ALERTE sujet : attendu {sujet_attendu!r}, "
                         f"lu {msg.get('subject')!r}")
    for a in re.finditer(r"<a\s[^>]*>", body, re.IGNORECASE):
        if COULEUR_LIEN.lower() not in a.group(0).lower():
            controles.append(f"ALERTE lien non stylé dans le rendu : "
                             f"{a.group(0)[:90]}")
    if signature_html:
        marqueur = re.sub(r"<[^>]+>", "", signature_html).strip()[:40]
        if marqueur and marqueur not in re.sub(r"<[^>]+>", "", body):
            controles.append("ALERTE : signature canonique absente du rendu.")
    if not controles:
        controles.append("OK — rendu conforme (liens, signature).")
    return {"message_trouve": True, "message_id": msg["id"],
            "date": msg.get("date"), "controles": controles,
            "body_pour_relecture_factuelle": body}

# ============================================================================
# 5) RATTACHEMENT DIFFÉRÉ DU SR (§7.4) — cascade carte + devis + job
# ============================================================================
def rattacher_sr(sr, ast_id):
    """Quand EG émet le n° SR (en semaine, a posteriori) pour une intervention
    d'astreinte tracée sous ticket provisoire AST : cascade de mise à jour.
    - REFUSE si sr/ast mal formés, ou si PLUSIEURS cartes ou devis matchent
      l'AST (on ne devine JAMAIS — on demande à Emin).
    - Le job Synchroteam : myId mis à jour par job/send PARTIEL si le rapport
      n'est pas clos ; si myId est VERROUILLÉ (rapport clos), le mapping est
      consigné en note sur la carte et signalé — c'est le seul cas dégradé.
    Retourne un rapport leg par leg, chaque écriture relue."""
    violations = []
    if not RE_SR.fullmatch(str(sr).strip()):
        violations.append(f"SR {sr!r} hors format (6-10 chiffres).")
    if not RE_AST.fullmatch(str(ast_id).strip()):
        violations.append(f"Ticket provisoire {ast_id!r} hors format "
                          f"AST-AAAAMMJJ-P<id>[-B].")
    if violations:
        raise ErreurValidation(violations)
    sr, ast_id = str(sr).strip(), str(ast_id).strip()
    marque = f"SR {sr} (ex {ast_id})"
    rapport = {"sr": sr, "ast": ast_id, "carte": None, "devis": None, "job": None}

    # --- Carte CRM ---
    leads = odoo("crm.lead", "search_read", [[["name", "ilike", ast_id]]],
                 {"fields": ["id", "name", "description"]})
    if len(leads) > 1:
        raise ErreurValidation(
            [f"{len(leads)} cartes matchent {ast_id} — ambiguïté interdite, "
             f"arbitrage Emin requis : "
             + ", ".join(f"#{l['id']} {l['name']}" for l in leads)])
    if leads:
        l = leads[0]
        odoo("crm.lead", "write", [[l["id"]], {
            "name": l["name"].replace(ast_id, marque),
            "description": (l.get("description") or "") +
                           f"\n[{datetime.date.today()}] SR {sr} rattaché "
                           f"(ex {ast_id}).",
        }])
        _relecture("crm.lead", l["id"], {"name": sr})
        rapport["carte"] = {"lead_id": l["id"], "statut": "OK"}
    else:
        rapport["carte"] = {"statut": "INTROUVABLE — vérifier le registre 169"}

    # --- Devis ---
    sos = odoo("sale.order", "search_read",
               [[["client_order_ref", "ilike", ast_id]]],
               {"fields": ["id", "name", "client_order_ref"]})
    if len(sos) > 1:
        raise ErreurValidation(
            [f"{len(sos)} devis matchent {ast_id} — arbitrage Emin requis : "
             + ", ".join(s["name"] for s in sos)])
    if sos:
        s = sos[0]
        odoo("sale.order", "write", [[s["id"]],
             {"client_order_ref": marque}])
        _relecture("sale.order", s["id"], {"client_order_ref": marque})
        rapport["devis"] = {"so_id": s["id"], "name": s["name"], "statut": "OK"}
    else:
        rapport["devis"] = {"statut": "AUCUN DEVIS (normal si visite non chiffrée)"}

    # --- Job Synchroteam ---
    job = _trouver_job_st_par_myid(ast_id)
    if not job:
        rapport["job"] = {"statut": "INTROUVABLE — vérifier création du job"}
    elif str(job.get("status", "")).lower() in ("completed", "validated", "closed"):
        # myId VERROUILLÉ après clôture du rapport : cas dégradé documenté.
        if rapport["carte"] and rapport["carte"].get("lead_id"):
            odoo("crm.lead", "write", [[rapport["carte"]["lead_id"]], {
                "description": odoo("crm.lead", "read",
                                    [[rapport["carte"]["lead_id"]]],
                                    {"fields": ["description"]})[0]["description"]
                + f"\n⚠ Job Synchroteam {job.get('num')} clos : myId reste "
                  f"{ast_id}, SR réel = {sr} (mapping consigné ici).",
            }])
        rapport["job"] = {"job_id": job.get("id"), "statut":
                          f"MYID_VERROUILLE (rapport clos) — mapping {ast_id}→SR {sr} "
                          f"consigné sur la carte ; le reporter aussi au registre 169."}
    else:
        st_post("job/send", {"id": int(job["id"]), "myId": sr})  # MàJ PARTIELLE
        det = st_get("job/details", id=int(job["id"]))
        if str(det.get("myId", "")).strip() != sr:
            raise ErreurValidation(
                [f"RELECTURE : job {job['id']} — myId lu {det.get('myId')!r} "
                 f"au lieu de {sr!r}."])
        rapport["job"] = {"job_id": job["id"], "statut": "OK"}

    rapport["rappel_manuel"] = ("Accept ServiceChannel = geste MANUEL "
                                "(Emin ou délégataire §7.5) — TEO n'a aucun "
                                "accès. Le signaler tant que non fait.")
    return rapport

# ============================================================================
# 6) AUDIT FLASH — balayage anti-erreur (à lancer au point du matin)
# ============================================================================
def audit_flash(jours_ast=7):
    """Détecte en un appel les états interdits par la doctrine :
    1. devis EG (facturation partner 9) en brouillon/envoyé SANS SR/AST en réf ;
    2. tickets AST ouverts depuis > jours_ast jours (SR jamais rattaché) ;
    3. factures POSTÉES au nom d'un SITE au lieu de SAS EG RETAIL
       (l'erreur historique n°1 côté facture — celle qui a coûté un avoir) ;
    4. jobs assignés au technicien tampon TEC031 (file d'attente qui pourrit).
    Retourne la liste des alertes ; liste vide = rien à signaler."""
    alertes = []

    for s in odoo("sale.order", "search_read",
                  [[["partner_invoice_id", "=", EG_PARENT_ID],
                    ["state", "in", ["draft", "sent"]]]],
                  {"fields": ["name", "client_order_ref"]}):
        if _v_reference_ticket(s.get("client_order_ref")):
            alertes.append(f"DEVIS {s['name']} : référence client "
                           f"{s.get('client_order_ref')!r} sans SR/AST.")

    limite = datetime.date.today() - datetime.timedelta(days=jours_ast)
    for l in odoo("crm.lead", "search_read",
                  [[["name", "like", "AST-"], ["active", "=", True]]],
                  {"fields": ["id", "name"]}):
        m = re.search(r"AST-(\d{8})-P\d+", l["name"])
        if m and "SR " not in l["name"]:
            d = datetime.datetime.strptime(m.group(1), "%Y%m%d").date()
            if d < limite:
                alertes.append(f"CARTE #{l['id']} « {l['name']} » : astreinte "
                               f"du {d} toujours sans SR ({(datetime.date.today()-d).days} j) "
                               f"— relancer EG / vérifier le hub Gmail.")

    for f in odoo("account.move", "search_read",
                  [[["move_type", "=", "out_invoice"], ["state", "=", "posted"],
                    ["partner_id", "child_of", EG_PARENT_ID],
                    ["partner_id", "!=", EG_PARENT_ID]]],
                  {"fields": ["name", "partner_id"]}):
        alertes.append(f"FACTURE {f['name']} postée au nom du SITE "
                       f"{f['partner_id']} au lieu de SAS EG RETAIL ({EG_PARENT_ID}) "
                       f"— avoir + refacturation nécessaires.")

    depuis = (datetime.date.today() - datetime.timedelta(days=30)).strftime("%Y-%m-%d 00:00:00")
    page = 1
    while page <= 20:
        lot = st_get("job/list", pageSize=100, page=page, dateFrom=depuis)
        data = lot.get("data") or []
        for j in data:
            tech = (j.get("technician") or {})
            if tech.get("id") == TECHNICIENS["tampon"]:
                alertes.append(f"JOB {j.get('num')} (myId {j.get('myId')!r}) "
                               f"toujours sur le technicien tampon TEC031.")
        if len(data) < 100:
            break
        page += 1

    return alertes
# ============================== fin ief_lib =================================
```

### 2.3 Ce que la lib rend structurellement impossible (traçabilité des 7 points + V1-V6)

| Contrôle doctrine | Où il est devenu une précondition |
|---|---|
| Entité de facturation = SAS EG RETAIL (9) | `creer_devis(eg=True)` impose `partner_invoice_id=9`, raise sinon |
| Livraison = site (jamais Suresnes) | `_v_site_eg` : raise si site=9, hors parent 9, ou sans adresse |
| N° ticket sur carte ET devis | `_v_reference_ticket` dans `creer_carte_eg` + `creer_devis` |
| Prix non ronds ,30/,40/,70/,80 | `_v_prix_non_rond` sur chaque ligne |
| TVA 20 % (id 36) | Imposée dans le code, pas un paramètre ; relecture ligne à ligne |
| myId à la création | 1er argument obligatoire de `creer_job`, regex validée |
| Vérification factuelle des mails | `source_verifiee` + `source_citee` obligatoires, sinon raise |
| Relecture affichée (V1) | `_relecture` post-écriture automatique, raise en cas d'écart |
| Inférences marquées (V2) | `planifier_job(source=...)` raise sur inférence |
| Cran d'arrêt mails sensibles (V3) | `_detecter_sensibilite` → retour `BROUILLON_A_VALIDER`, jamais d'envoi |
| Emin toujours en copie | Union forcée avec `ODOO_PARTNER_EMIN`, raise si non configuré |
| Liens rouge gras souligné, pas de background | Raise avant envoi + contrôle du rendu après |
| Plus-addressing IONOS (554) | Raise avant envoi |
| Marshalling send() | Preuve d'envoi = relecture `mail.message`, jamais l'absence d'exception |

**Limite assumée** : la lib ne peut pas empêcher TEO d'appeler `execute_kw` brut. C'est pourquoi l'amendement doctrine (§0) compte tout contournement au compteur hebdo d'erreurs — le péage est technique ET normatif. En P2, le péage deviendra un vrai serveur (périmètre Agent D).

---

## 3. §7.3 — CAPTURE DU CANAL WHATSAPP

### 3.1 Options réalistes à l'instant t (sans nouvel outil)

| Option | Description | Coût de mise en œuvre | Couverture | Charge Emin/techs | Risque |
|---|---|---|---|---|---|
| **A. Transfert au fil de l'eau vers le hub Gmail** | Depuis WhatsApp, « Partager → Gmail » (feuille de partage Android/iOS) vers ief.maintenance@gmail.com, pour chaque élément ENGAGEANT : photo avant/après, accord client, consigne, compte rendu vocal. Objet imposé : `[WA] <ticket> — <site>` | 0 € — geste natif du téléphone, 10 s/élément | Sélective (ce qui engage) | Faible mais récurrente | Oubli sur le terrain |
| **B. Synthèse dictée aux points quotidiens** | Aux points matin/soir, Emin dicte : « WhatsApp : Jorge a envoyé les photos du rideau H2O-1234, le client Ronceray a validé oralement le remplacement ». TEO consigne sur les cartes concernées | 0 € — s'insère dans un rituel existant | Totale mais en différé et avec perte de fidélité (résumé de mémoire) | 2 min/jour | C'est de la mémoire humaine — même cause racine que l'erreur n°3 |
| **C. Export hebdomadaire de discussion** | WhatsApp « Exporter la discussion » (.txt + médias) → mail au hub, le vendredi avec le classeur Excel | 0 € | Archivage exhaustif | 5 min/semaine | Inexploitable en temps réel ; volumineux en tokens si TEO doit le lire — usage archive/litige uniquement |
| **D. Groupe WhatsApp unique « IEF Ops » + règle de répétition** | Toute décision opérationnelle prise en conversation privée est répétée dans un groupe unique ; le groupe est exporté (option C) | 0 € | Bonne si la règle tient | Discipline collective — le maillon faible | Même faiblesse disciplinaire que l'existant |
| **E. WhatsApp Business API (Twilio/Meta)** | Webhook → mail/API | Nouvel outil, abonnement, dev | Totale, temps réel | Nulle | **HORS PÉRIMÈTRE P1** (interdit par la mission) — à réévaluer en P2 comme entrée de l'OS IEF |

### 3.2 Recommandation ferme

**A + B en tandem, C en filet d'archive. Décision à faire prendre à Emin telle quelle :**

1. **Règle A (l'engageant transite, ou n'existe pas)** : *« Une photo, un accord ou une consigne qui n'est pas transféré au hub avec l'objet `[WA] <ticket> — <site>` n'existe pas pour l'entreprise : pas de devis, pas de facture, pas de garantie sur cette base. »* C'est la seule formulation qui tienne sur le terrain : elle ne demande pas de la discipline pour l'entreprise, elle conditionne le paiement du travail à la trace. Le ticket dans l'objet (SR ou AST — le même que partout, §7.4) rend le rattachement automatique par la skill `triage-mails` existante : label Gmail `WA/<ticket>`, lien vers la carte, zéro token de recherche.
2. **Règle B (filet quotidien)** : au point du soir, TEO pose UNE question fermée : « Y a-t-il eu aujourd'hui sur WhatsApp une décision, un accord client ou une photo engageante non transférés ? » Réponse d'Emin en une phrase, consignée sur les cartes. Le filet attrape ce que A a laissé passer, au moment où la mémoire est encore fraîche.
3. **Règle C (archive)** : export mensuel (pas hebdo — le vendredi est déjà chargé) des discussions techniciens vers le hub, label `WA/ARCHIVE`, jamais lu par TEO sauf litige. Coût token nul en régime normal.
4. **À écarter explicitement** : D (déplace le problème de discipline sans le résoudre) et E (interdit en P1 ; à inscrire au cahier des charges P2 — l'OS IEF devra ingérer WhatsApp Business API nativement).

---

## 4. §7.4 — RATTACHEMENT DIFFÉRÉ DES TICKETS EG (SR a posteriori)

### 4.1 La convention qui rend tout déterministe

**`AST-AAAAMMJJ-P<id_partner_Odoo_du_site>[-B]`** — exemples : `AST-20260718-P1432`, `AST-20260718-P1432-B` (2e appel même site même jour).

Pourquoi l'**id partner Odoo** et pas un nom de site ou un code station : les 492 sites EG ont des noms proches (« ESSO RELAIS … ») et des codes internes que le mail SR n'orthographie pas toujours pareil. L'id Odoo est unique, stable, déjà présent dans toutes les fiches, et il transforme le matching en égalité stricte de chaîne — zéro jugement, zéro token de désambiguïsation. La date dans le code donne gratuitement l'ancienneté (exploitée par `audit_flash`).

Le code AST est posé **aux trois endroits en même temps, par les fonctions de la lib** (c'est structurel, pas discipliné) : titre de la carte (`creer_carte_eg`), référence client du devis (`creer_devis`), myId du job (`creer_job`). Plus la ligne au registre 169 et l'objet des transferts WhatsApp (§3).

### 4.2 Micro-process pas-à-pas

**Phase 1 — Nuit/week-end : l'appel d'astreinte (T0)**
1. Appel du cadre de permanence EG (ex. Pascal Baudel) → Emin dicte à TEO (ou au point du matin suivant si hors session) : site, symptôme, urgence, nom de l'appelant, heure de l'appel.
2. TEO : `chercher_site_st()` / recherche partner Odoo → **si ≠ 1 candidat, question à Emin, jamais de choix silencieux**.
3. TEO enchaîne : `creer_carte_eg(titre, site_pid, astreinte=True)` (génère l'AST), `creer_job(ast, ...)`, `planifier_job(..., source="ordre_explicite")` si l'ordre est explicite. La description de la carte porte : appelant, heure d'appel, consigne — c'est le **registre d'astreinte** (angle mort AM-1, §6).
4. Ligne au registre 169 : `AST-…-P… | <site> | attente SR | prochaine action : guetter mail SC`.

**Phase 2 — Semaine : le SR tombe sur le hub Gmail (T+1 à T+5 jours)**
5. La skill `triage-mails` détecte le mail ServiceChannel (expéditeur `@servicechannel.com` / gabarit SR-WO). Extraction : n° SR, nom/adresse du site, date de création du ticket.
6. **Matching déterministe** : résoudre le site du mail → id partner Odoo (table des 492 sites ; en cas de doute d'orthographe, matcher sur l'adresse/code postal) → chercher les cartes `AST-*-P<cet id>` sans SR, fenêtre J-10.
   - **1 candidat** → rattachement automatique (étape 7).
   - **0 candidat** → ce n'est pas une astreinte : circuit SR normal (Accept → carte via `creer_carte_eg(ticket=SR)`).
   - **>1 candidat** (deux AST ouverts sur le même site) → question fermée à Emin : « SR 4408112 = intervention du 16/07 (AST-…) ou du 18/07 (AST-…-B) ? ». **Jamais de guess** — c'est le verrou de l'erreur historique n°4 appliqué au matching.
7. `rattacher_sr(sr, ast_id)` (§2.2) : cascade carte → devis → job, chaque écriture relue, ambiguïtés bloquantes, cas myId verrouillé géré (mapping consigné sur la carte + registre 169).
8. **Rappel Accept** : TEO ne touche pas ServiceChannel. Le rapport de `rattacher_sr` se termine par le rappel « Accept manuel à faire » ; la ligne 169 ne se ferme qu'après confirmation d'Emin (ou du délégataire ServiceChannel, §5). Point de vigilance : le délai d'Accept pèse sur le scoring fournisseur EG (angle mort AM-8).
9. Clôture de la ligne 169 : `AST-… → SR … | rattaché le … | Accept fait`.

**Phase 3 — Filet de sécurité**
10. `audit_flash()` au point du matin : tout AST > 7 jours sans SR remonte en alerte → relance des coordinateurs EG (Mehmet Dagdelen / Nanndy Bachard) par mail type, via `envoyer_mail_client` (catégorie `eg`).

### 4.3 Cas dégradés couverts

| Cas | Traitement |
|---|---|
| SR arrive avant que la carte AST soit créée (dictée oubliée) | Étape 6 → 0 candidat → circuit SR normal ; la question du point du soir (§3.2, règle B) attrape l'intervention orpheline |
| Rapport Synchroteam déjà clos quand le SR tombe | `rattacher_sr` : myId verrouillé → mapping consigné sur la carte + registre 169 ; carte et devis portent quand même le SR (facturable) |
| Deux appels même site même jour | Suffixe `-B` généré via `nouveau_ticket_astreinte(..., suffixe="B")` |
| SR jamais émis par EG | Alerte `audit_flash` à J+7 → relance coordinateurs ; à J+14, arbitrage Emin : facturer sous référence AST avec mention explicite |

---

## 5. §7.5 — RÉDUCTION DU BUS FACTOR EMIN

### 5.1 Constat

Emin est aujourd'hui : (1) l'unique filtre qualité des mails, (2) l'unique détenteur ServiceChannel, (3) l'unique canal astreinte, (4) l'unique source de doctrine, (5) l'unique interlocuteur de TEO. Un arrêt d'Emin de 72 h stoppe : les Accept SR (pénalités de scoring EG), toutes les validations de mails sensibles, l'astreinte. C'est le risque n°1 de l'entreprise, avant tout risque technique.

### 5.2 Matrice de délégation (garde-fous précis, activables cette semaine)

| Tâche / décision | Aujourd'hui | Délégataire | Garde-fous exacts | Prérequis |
|---|---|---|---|---|
| Validation des brouillons `BROUILLON_A_VALIDER` **hors sinistre**, client CONNU, ≤ seuil catégorie | Emin | **Chayma** | (1) Emin reste en copie de TOUT envoi (forcé par la lib, non désactivable) ; (2) Chayma valide par « OK + son prénom » écrit (traçable) ; (3) sinistre et premier contact restent EXCLUSIVEMENT Emin ; (4) revue au point hebdo des mails validés par Chayma (échantillon 3) | Ajouter `ODOO_PARTNER_CHAYMA` ; amendement 140 |
| Relances devis J+5/J+12/J+30 (skill `relance-devis`) | Emin valide | **Automatique sous seuil**, Chayma au-dessus | Texte = gabarit figé (article Knowledge), zéro reformulation libre ; tout écart de texte → circuit brouillon | Gabarits à figer (1 h de travail) |
| **Accept ServiceChannel** | Emin SEUL — le point le plus critique | **Chayma (2e détenteur du login)** | (1) Accept autorisé seul si SR ≤ plafond NTE du site ; (2) au-delà : appel Emin avant Accept ; (3) toute saisie ServiceChannel autre qu'Accept reste Emin ; (4) registre : chaque Accept délégué noté sur la carte | Créer/partager l'accès SC ; fiche réflexe 1 page dans Knowledge |
| Clôture GMAO / rapprochement rapports (skill `rapport-sync`) | Chayma + Emin | **Chayma seule** | Rapport sans photo ou sans signature client → blocage, escalade Emin | Déjà quasi en place |
| Avoirs | Emin | **Chayma ≤ 500 € HT** | > 500 € ou 2e avoir même client même mois → Emin ; motif obligatoire sur l'avoir | Amendement 140 |
| Achats fournisseurs / engagements | Emin | **Fayçal ≤ 5 000 € HT par commande** | (1) Rapprochement devis fournisseur ↔ ligne de devis client obligatoire (marge visée documentée) ; (2) > 5 000 € : double validation Emin ; (3) nouveaux fournisseurs : Emin | Fayçal n'a PAS d'Odoo : circuit par mail au hub avec objet `[ACHAT] <ticket>` — même mécanique de rattachement que §3/§4 |
| Planification chantiers (hors astreinte, hors EG) | Emin | **Hichem** (user Odoo 11) | (1) Jamais de replanification d'un job EG/astreinte sans Emin ; (2) toute planification passe par `planifier_job` (donc source explicite, techniciens whitelistés) | Hichem doit apprendre 2 fonctions de la lib via TEO, ou dicter à TEO |
| **Astreinte — backup du canal** | Emin seul | **Rotation Emin/Hichem** (week-ends alternés à terme ; immédiatement : Hichem = backup si Emin injoignable) | (1) Fiche réflexe astreinte dans Knowledge (qui appeler, quoi noter : site, symptôme, appelant, heure — les champs exacts de `creer_carte_eg`) ; (2) le lundi, TEO reconstitue les cartes AST depuis la dictée du preneur d'appel | Transfert d'appel conditionnel sur le mobile ; fiche réflexe (30 min) |
| Doctrine / amendements 140 | Emin | **Non délégable** (choix assumé) | — | — |

**Ce qui reste non délégable et doit le rester** : sinistres, premiers contacts, remises, engagements > 5 000 €, doctrine. La délégation ne vise pas à sortir Emin de la boucle qualité, mais à le sortir du **chemin critique temporel** : Emin contrôle a posteriori (il est en copie de tout), il ne bloque plus a priori.

### 5.3 Évaluation du seuil de 3 000 € HT du cran d'arrêt

**Verdict : bon ordre de grandeur comme défaut, mais un seuil unique est mal calibré — le risque d'un mail n'est pas proportionnel à son montant, il dépend du couple (destinataire, contexte).**

- **EG (coordinateurs Dagdelen/Bachard)** : flux le plus routinier et le plus cadré de l'entreprise (SR en référence, plafonds NTE, gabarit stable, interlocuteurs connus). Un devis EG de 3 200 € n'est pas plus risqué qu'un de 2 800 €. Le seuil à 3 000 € y génère du **faux positif en série**, c'est-à-dire de la charge de validation pour Emin — l'inverse de l'objectif §7.5. → **Relever à 5 000 € HT**, en gardant les autres déclencheurs (sinistre, premier contact, remise) intacts. Les NTE restent le vrai plafond métier côté EG.
- **Copropriétés / particuliers** : le risque dominant est juridique et de ton (TVA, responsabilité, copropriétaire en copie), pas financier. Un mail à 1 800 € mal formulé à un syndic coûte plus cher qu'un devis EG à 4 000 €. → **Abaisser à 1 500 € HT.**
- **Hôtellerie** : sites occupés, sensibilité d'image → **3 000 € conservé.**
- **Déclencheurs non monétaires à AJOUTER** (déjà codés dans `_detecter_sensibilite`) : mention d'une **remise/geste commercial** (la règle 3-4 % max est une règle Emin, donc son exception doit remonter à Emin) ; et je recommande d'ajouter à terme : engagement de délai ferme, admission de responsabilité.
- Le barème vit dans `SEUILS_MAIL_HT` (lib) **et** dans l'article 170 (référentiel) — même valeurs, la lib fait foi. Modification = amendement validé Emin.

---

## 6. §7.8 — ANGLES MORTS (mitraille)

**AM-1 — L'astreinte n'est pas tracée.** Les appels de permanence (qui a appelé, quand, quelle consigne, quel engagement oral) ne vivent nulle part avant la création éventuelle d'une carte. En cas de litige EG (« vous deviez intervenir sous 4 h »), IEF n'a rien. *Parade (incluse §4.2)* : la description de la carte AST porte systématiquement appelant + heure + consigne = registre d'astreinte de fait, requêtable (`crm.lead name like "AST-"`).

**AM-2 — Compétence contrôle d'accès : bus factor technicien.** Jorge est « moins à l'aise contrôle d'accès » et rien n'indique que Yanis le soit davantage : le savoir contrôle d'accès semble reposer sur Emin seul — bus factor = 1 aussi sur le TERRAIN, pas seulement au bureau. *Parades* : (1) fiches d'intervention type par famille d'équipement (ventouse, gâche, centrale, lecteur) en articles Knowledge, dictées par Emin à TEO en 4 sessions de 20 min ; (2) exploiter la **visio-assistance Kolus déjà disponible pendant le trial** (jusqu'à sept. 2026) : Emin assiste Jorge à distance au lieu de se déplacer — c'est un test grandeur nature de la fonctionnalité préférée d'Emin, gratuit ; (3) binômage systématique Jorge+Emin sur les jobs contrôle d'accès pendant 90 jours (objectif mesurable : Jorge autonome sur 80 % des cas).

**AM-3 — Le registre 169 est écrit au mauvais moment.** « Mis à jour à chaque clôture » = si la conversation meurt en cours de journée (limite de contexte, incident, mobile), tout l'état intermédiaire est perdu — c'est l'erreur n°5 qui peut se REPRODUIRE malgré le registre. *Parade* : inverser en **write-ahead** : la ligne 169 est écrite/mise à jour AVANT d'entamer chaque dossier (« je vais faire X ») et amendée après. Coût : un write Odoo de plus par dossier, négligeable. (Architecture détaillée : Agent B.)

**AM-4 — Continuité TEO sans Emin.** Si Emin est indisponible, personne ne sait ouvrir une session TEO, injecter les secrets, ni quoi lui demander. *Parade* : fiche « Démarrer TEO » dans Knowledge (sans secrets ; les clés dans le gestionnaire de mots de passe de l'entreprise, accès Chayma) + Chayma fait UN point du matin par mois en autonomie, supervisé, pour valider la procédure.

**AM-5 — Le hub est un Gmail gratuit.** ief.maintenance@gmail.com concentre les SR EG, le triage, les futurs transferts WhatsApp… sur un compte grand public : récupération de compte liée à qui ?, pas de contrat, délivrabilité moyenne, image. *Parades immédiates* : 2FA + codes de récupération imprimés au coffre + numéro/mail de secours = contact@iefandco.com + transfert copie vers une boîte IONOS du domaine. *Cible P2* : hub sur le domaine.

**AM-6 — IONOS = SPOF d'envoi, pannes silencieuses.** Un blocage SMTP (554, réputation) laisse des mails en `exception` dans la file Odoo sans que personne ne les voie. *Parade* : ajouter au point du matin (une requête) : `mail.mail search_count [state = "exception"]` > 0 → alerte. À intégrer dans `audit_flash` v1.1.

**AM-7 — La clé API Odoo est celle du compte d'Emin (s.benhalima, uid 6).** TEO écrit avec les pleins pouvoirs du dirigeant : pas de cloisonnement, audit trail trompeur (tout est « fait par Emin »), rayon d'explosion maximal en cas de fuite. *Parade* : créer un utilisateur Odoo dédié « TEO API » avec droits Ventes/CRM/Mail (pas Comptabilité-écriture, pas Paramètres), nouvelle clé, et ODOO_UID ajusté. Une heure de travail, gain de sécurité majeur. (Coût : une licence utilisateur — à arbitrer par Emin.)

**AM-8 — Le délai d'Accept ServiceChannel n'est piloté par personne.** Le scoring fournisseur EG dépend des délais Accept/intervention ; les mails SR attendent le prochain point quotidien, et Emin seul peut accepter (→ délégation §5.2). *Parade complémentaire* : passage triage-mails de midi = obligatoire, et tout mail SC non traité depuis > 4 h ouvre une alerte en tête du point suivant.

**AM-9 — Le technicien tampon TEC031 est un trou noir.** Les jobs « parqués » n'ont ni propriétaire ni échéance. *Parade* : codée dans `audit_flash` (alerte sur tout job au tampon depuis le balayage) ; règle : rien ne dort au tampon plus de 48 h.

**AM-10 — La doctrine n'est pas versionnée.** L'article 140 est amendé sur validation Emin, mais rien ne dit quand/quoi/pourquoi a changé — impossible d'auditer une erreur ancienne contre la règle en vigueur à l'époque. *Parade* : tableau d'amendements daté en tête du 140 (date, règle, motif, « validé Emin ») — 3 lignes par amendement.

**AM-11 — Emil (plans) est hors système.** Les plans transitent vraisemblablement par WhatsApp/mail perso — mêmes pertes que §3. *Parade* : les plans suivent la règle A du §3.2 (objet `[WA] <ticket>` ou `[PLAN] <ticket>` vers le hub) et sont attachés à la carte.

**AM-12 — Aucune échéance décisionnelle au registre.** Le trial Kolus se décide avant sept. 2026 ; ce type d'échéance ne vit que dans la tête d'Emin. *Parade* : section « Échéances » de 5 lignes max dans le registre 169, relue à chaque ouverture (elle y est déjà lue — coût marginal nul).

**AM-13 — Le cran d'arrêt ne couvre pas les pièces jointes.** Un mail « anodin » peut embarquer un devis PDF > seuil ou un document sensible. *Parade v1.1* : si `piece_jointe_ids` contient un devis dont `amount_untaxed` > seuil, le brouillon se déclenche même si `montant_ht` n'a pas été passé (lecture du sale.order lié). À ajouter à la lib après validation du principe.

**AM-14 — Personne ne teste les parades.** Les verrous V1-V6, puis la lib, ne sont jamais éprouvés volontairement. *Parade* : au rituel d'audit hebdo existant, ajouter UN test d'injection par semaine (ex. tenter un devis EG sans SR via la lib, vérifier le raise ; tenter un mail avec lien non stylé). 5 minutes, et le compteur « erreurs détectées » gagne une colonne « détectées par la machine ».

---

## 7. PRIORISATION DE MON PÉRIMÈTRE (impact / effort)

| # | Action | Impact | Effort | Délai |
|---|---|---|---|---|
| 1 | Déployer `ief_lib` (article 171 + amendement 140 « toute écriture passe par la lib ») | Majeur — supprime structurellement les erreurs 1-4 | 1 session | J+1 |
| 2 | Convention AST + micro-process §4 + `rattacher_sr` en service | Majeur — fiabilise le compte structurant EG | Inclus dans la lib | J+2 |
| 3 | Délégation Accept ServiceChannel à Chayma (garde-fou NTE) | Majeur — casse le SPOF le plus dangereux | 1 h + fiche réflexe | J+7 |
| 4 | Règles WhatsApp A+B (objet `[WA] <ticket>`, question du soir) | Fort | 0 outil, 1 annonce d'Emin à l'équipe | J+2 |
| 5 | Seuils différenciés du cran d'arrêt (5000/3000/1500) + délégation brouillons standard à Chayma | Fort — décharge Emin sans perte de contrôle | Amendement 140 | J+7 |
| 6 | `audit_flash` au point du matin (+ v1.1 : mail.mail exception, PJ sensibles) | Fort — détection J+0 des états interdits | Inclus dans la lib | J+2 |
| 7 | Backup astreinte Hichem + fiche réflexe | Fort | 30 min | J+14 |
| 8 | Utilisateur API Odoo dédié (AM-7), durcissement Gmail (AM-5), versionnage doctrine (AM-10) | Moyen mais assurantiel | 2 h au total | J+30 |

---
*Fin du livrable Agent A. Points de jonction : Agent B (architecture mémoire/write-ahead du registre 169, coût token du chargement de la lib), Agent C (les compteurs alimentés par `audit_flash`), Agent D (le péage devient un vrai serveur en P2 ; WhatsApp Business API au cahier des charges), Agent E (contradiction bienvenue en particulier sur les ids de stage non documentés et le format exact des payloads job/schedule — à vérifier en réel avec les clés avant de figer l'article 171).*

# =============================================================================
#  ief_lib.py — Bibliothèque anti-erreur unifiée IEF & CO
#  v1.1 — 18/07/2026 — Synthèse post-contre-expertise (Agent E, §8)
#  Base : Agent A v1.0, corrigée et étendue par les livrables B (mémoire),
#  C (cash) et E (contre-expertise). FICHIER UNIQUE ET CANONIQUE.
#
#  PRINCIPE : ces fonctions sont le SEUL chemin d'écriture vers Odoo et
#  Synchroteam. Chaque fonction REFUSE d'écrire (ErreurValidation) si un
#  invariant doctrine est violé, et VÉRIFIE par relecture après écriture.
#  La checklist des 7 points n'est plus une discipline : c'est une précondition.
#
#  Stdlib Python 3.10+ uniquement. Rien à installer. AUCUN import requests (C-4).
#
# -----------------------------------------------------------------------------
#  PROTOCOLE SECRETS (A-9 / R-1) — À RESPECTER À LA LETTRE
#  1. Les clés ne sont JAMAIS écrites dans un livrable, un article Odoo, ni
#     recitées dans la conversation. Emin les injecte au lancement de session
#     dans UN SEUL message dédié qui exécute :
#         import os
#         os.environ["ODOO_API_KEY"] = "..."
#         os.environ["SYNCHROTEAM_KEY"] = "..."
#         os.environ["ODOO_PARTNER_EMIN"] = "<id res.partner d'Emin>"
#     Ce message n'est plus JAMAIS cité, résumé ni recopié ensuite.
#  2. Rotation MENSUELLE des deux clés (Odoo + Synchroteam).
#  3. PRIORITÉ 1 (AM-7 requalifié par E) : créer un utilisateur Odoo dédié
#     « TEO API » (droits Ventes/CRM/Mail, pas Comptabilité-écriture, pas
#     Paramètres), générer sa clé, ajuster ODOO_UID. Tant que la clé est celle
#     du compte d'Emin (uid 6), TEO écrit avec les pleins pouvoirs du dirigeant.
#  Variables optionnelles (défauts sinon) : ODOO_URL, ODOO_DB, ODOO_UID,
#  SYNCHROTEAM_DOMAIN. AUCUNE variable d'environnement de seuil (A-4) : le
#  barème des mails sensibles est EN DUR dans SEUILS_MAIL_HT, amendable
#  uniquement via l'article 140 validé par Emin.
# =============================================================================

CAMPAGNE_DE_VERIFICATION = """
CAMPAGNE « À VÉRIFIER EN RÉEL » — 1 session avec les clés, AVANT de figer
l'article 171 (contre-expertise E §8.2). Chaque point ci-dessous est aussi
marqué « # A VERIFIER EN REEL: » à l'endroit exact du code concerné.

 1. Enveloppe des listes Synchroteam ('data' vs 'records') :
      st_get("job/list", pageSize=1)  -> noter les clés de la réponse.
 2. Statuts de clôture des jobs (casse comprise), pour ST_STATUTS_TERMINES :
      sorted({j.get("status") for j in st_list("job/list", pageSize=100)})
 3. Payloads job/send (site {id} / customer {id} / address) et job/schedule
    (technician {id}) : créer UN job de test via creer_job() + planifier_job().
 4. Paramètre dateFrom de job/list :
      st_get("job/list", pageSize=1, dateFrom="2026-07-01 00:00:00")
 5. Timezone des datetimes Synchroteam (UTC ou Europe/Paris ?) :
      st_get("job/details", id=<id connu>)  -> comparer scheduledStart à la
      réalité terrain. La lib travaille en Europe/Paris (R-4).
 6. Champ taxes des lignes de devis en Odoo 19 ('tax_id' vs 'tax_ids') :
      odoo("sale.order.line", "fields_get", [["tax_id", "tax_ids"]],
           {"attributes": ["string"]})
 7. Rattachement des sites EG (fiches is_company après import ?) :
      odoo("res.partner", "search_count",
           [[["id", "=", <id site>], ["id", "child_of", 9]]])  sur 2-3 sites.
 8. Stages CRM manquants (NOUVEAU, À FACTURER) :
      odoo("crm.stage", "search_read", [[]], {"fields": ["id", "name"]})
      -> figer les ids dans STAGES_CRM (interdit de deviner).
 9. Type d'activité « À faire » :
      odoo("mail.activity.type", "search_read", [[]], {"fields": ["id", "name"]})
10. Conditions de paiement du partner 9 (sinon 1.c ment) :
      odoo("res.partner", "read", [[9]], {"fields": ["property_payment_term_id"]})
11. Coût/tolérance du search_count mail.message (détection premier contact,
    A-3) : chronométrer un appel sur un partner à fort historique.
12. Structure de l'article 160 (une signature unique ? plusieurs ?) — si
    plusieurs, passer signature_html explicitement à envoyer_mail_client().
13. Champs disponibles sur mail.mail pour le diagnostic d'envoi (A-2) :
      odoo("mail.mail", "fields_get", [["state", "failure_reason"]],
           {"attributes": ["string"]})
"""

import os
import re
import json
import uuid
import base64
import hashlib
import datetime
import html as _html
import xmlrpc.client
from urllib import request as _urlreq, parse as _urlparse, error as _urlerr
from zoneinfo import ZoneInfo

VERSION = "1.1"

# ----------------------------------------------------------------------------
# TEMPS — R-4 : Europe/Paris EXPLICITE partout, jamais de datetime.now() naïf
# ----------------------------------------------------------------------------
TZ_PARIS = ZoneInfo("Europe/Paris")

def maintenant():
    """Datetime AWARE Europe/Paris. Seule source d'heure autorisée dans la lib."""
    return datetime.datetime.now(TZ_PARIS)

def aujourdhui():
    """Date du jour en Europe/Paris (un job d'astreinte à 23 h ne doit pas
    changer de jour selon le fuseau du serveur — R-4)."""
    return maintenant().date()

def age_j(date_str):
    """Âge en jours d'une date Odoo 'YYYY-MM-DD' ou 'YYYY-MM-DD HH:MM:SS'."""
    if not date_str:
        return None
    return (aujourdhui() - datetime.datetime.strptime(
        str(date_str)[:10], "%Y-%m-%d").date()).days

# ----------------------------------------------------------------------------
# CONSTANTES MÉTIER (doctrine IEF — ne modifier que sur amendement validé Emin)
# ----------------------------------------------------------------------------
ODOO_URL = os.environ.get("ODOO_URL", "https://iefandco.odoo.com")
ODOO_DB  = os.environ.get("ODOO_DB", "iefandco")
ODOO_UID = int(os.environ.get("ODOO_UID", "6"))   # cible : uid du user « TEO API » (AM-7)

ST_BASE   = "https://ws.synchroteam.com/api/v3"
ST_DOMAIN = os.environ.get("SYNCHROTEAM_DOMAIN", "iefandco")

EG_PARENT_ID = 9        # SAS EG RETAIL (FRANCE) — SEULE entité de facturation EG
TVA_20_ID    = 36       # TVA 20 % — la seule TVA autorisée (règle Emin, ferme)
USER_CHAYMA  = 20       # user Odoo de Chayma (activités FACTURER, C-1)
CENTIMES_OK  = {30, 40, 70, 80}   # décimales autorisées sur tout prix client
COULEUR_LIEN = "#E30613"          # liens mails : rouge, gras, souligné

ARTICLE_SIGNATURES = 160   # signatures canoniques (lues par la lib, X-4)
ARTICLE_REGISTRE   = 169   # registre des dossiers ouverts (format Agent B)
ARTICLE_LIB        = 171   # code canonique de cette lib (hash R-7)

TECHNICIENS = {   # ids Synchroteam — seule liste d'assignation autorisée
    "emin":   179815,   # TECH099
    "jorge":  207155,   # IEF 007
    "yanis":  224511,
    "tampon": 182995,   # TEC031 — file d'attente, JAMAIS une assignation finale
}
# A-7 / X-10 : le tampon TEC031 est EXCLU de la planification (refus en amont) ;
# audit_flash() le surveille en aval (rien ne dort au tampon > 48 h).
TECHNICIENS_PLANIFIABLES = {k: v for k, v in TECHNICIENS.items() if k != "tampon"}

STAGES_CRM = {   # ids crm.stage connus (§3 du dossier de mission)
    "a_planifier":            7,
    "intervention_planifiee": 5,
    "commande_a_faire":       6,
    "cloture":                9,
    # "nouveau" et "a_facturer" : ids NON documentés — résolus par
    # resoudre_stage() (recherche stricte, jamais devinés), puis figés ici.
    "nouveau":                None,
    "a_facturer":             None,
}

# A-4 : barème différencié EN DUR — AUCUN override par variable d'environnement
# (l'ancien SEUIL_MAIL_SENSIBLE_HT aplatissait silencieusement le barème §5.3).
# Modification = amendement article 140 validé Emin, puis nouvelle version lib.
SEUILS_MAIL_HT = {
    "eg":          5000.0,   # coordinateurs EG : flux routinier, cadré SR + NTE
    "hotel":       3000.0,   # sites occupés, sensibilité d'image
    "copro":       1500.0,   # syndics/copros : sensibilité juridique et de ton
    "particulier": 1500.0,
    "defaut":      3000.0,   # seuil historique conservé par défaut
}
MOTS_SINISTRE = ("sinistre", "assurance", "expert d'assurance", "dégât des eaux",
                 "degat des eaux", "incendie", "effraction", "vandalisme",
                 "cambriolage", "responsabilité", "responsabilite")

# A-7 (documenté) : RE_SR est une validation FAIBLE — toute suite de 6 à 10
# chiffres passe, y compris une date AAAAMMJJ (8 chiffres), y compris celle
# contenue dans un code AST/IEF. Acceptable car le SR ServiceChannel n'a pas
# de format public plus strict ; les regex AST/IEF sont, elles, strictes.
RE_SR  = re.compile(r"\b\d{6,10}\b")                     # n° SR/WO ServiceChannel
RE_AST = re.compile(r"\bAST-\d{8}-P\d+(?:-[B-Z])?\b")    # ticket astreinte provisoire
RE_IEF = re.compile(r"\bIEF-\d{8}-P\d+(?:-[B-Z])?\b")    # A-1 : ticket interne universel
RE_MONTANT = re.compile(
    r"(?:\d[\d\s  .,]*\s*(?:€|eur(?:os)?\b))"      # 1 200,30 € / 90 euros
    r"|(?:€\s*\d)"                                           # €1200
    r"|(?:\b\d+[.,]\d{2}\s*(?:HT|TTC)\b)",                   # 1200,30 HT
    re.IGNORECASE)

# A-5 / X-6 : statuts de clôture Synchroteam CENTRALISÉS — une seule constante
# pour toute la lib (audit_flash, rattacher_sr, jobs_termines, filet A).
# A VERIFIER EN REEL: liste exacte et casse des statuts (campagne, point 2) —
# A testait ("completed","validated","closed"), C ("completed","validated").
ST_STATUTS_TERMINES = ("completed", "validated", "closed")

ETATS_REGISTRE = ("NOUVEAU", "A_CHIFFRER", "DEVIS_ENVOYE", "ATTENTE_CLIENT",
                  "A_PLANIFIER", "PLANIFIE", "A_FACTURER", "BLOQUE")
REGLES_REGISTRE = [
    "ETATS: " + " ".join(ETATS_REGISTRE),
    "Ligne <= 110 chars. >25 actifs -> archiver clos vers 169-ARCH-AAAA-MM. "
    "Dossier sans action >7j -> remonter au point du matin.",
]

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
            f"lancement de session (message unique, jamais recité — protocole "
            f"secrets en tête de fichier). Les secrets ne sont JAMAIS en clair.")
    return val

# ----------------------------------------------------------------------------
# JOURNAL DE SESSION & PILE DE SUJETS (X-8 / Agent B §4-5)
# ----------------------------------------------------------------------------
JOURNAL = []   # auto-rempli par CHAQUE fonction d'écriture — TEO n'a plus à se
               # souvenir de ce qu'il a fait : le code qui l'a fait s'en souvient.
PILE = []      # sujets parkés (anti-écrasement, erreur historique n°6)

def _log(action, **refs):
    JOURNAL.append({"ts": maintenant().isoformat(timespec="minutes"),
                    "action": action, **refs})

def parker(sujet, etat_1_ligne=""):
    """Quand Emin change de sujet avant qu'une décision/action soit posée :
    TEO répond D'ABORD « PARKÉ : <sujet> — <état> », appelle parker(), PUIS
    traite le nouveau sujet. checkpoint() persiste la pile au registre 169."""
    PILE.append({"sujet": str(sujet), "etat": str(etat_1_ligne),
                 "ts": maintenant().isoformat(timespec="minutes")})
    return f"PARKÉ : {sujet} — {etat_1_ligne}"

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

def resoudre_stage(cle):
    """Résout un id de stage CRM MANQUANT par recherche stricte (jamais deviné,
    jamais inventé). Résultat figé dans STAGES_CRM pour la session — à reporter
    ensuite dans ce fichier et l'article 170.
    A VERIFIER EN REEL: noms exacts des colonnes NOUVEAU / À FACTURER (point 8)."""
    if STAGES_CRM.get(cle):
        return STAGES_CRM[cle]
    motifs = {"a_facturer": "facturer", "nouveau": "nouveau"}
    motif = motifs.get(cle)
    if not motif:
        raise ErreurValidation([f"Stage {cle!r} inconnu de STAGES_CRM et sans "
                                f"motif de résolution — interdit de deviner."])
    rows = odoo("crm.stage", "search_read", [[["name", "ilike", motif]]],
                {"fields": ["id", "name"]})
    if len(rows) != 1:
        raise ErreurValidation(
            [f"Résolution du stage {cle!r} ambiguë ({len(rows)} colonnes "
             f"matchent {motif!r} : {[(r['id'], r['name']) for r in rows]}) — "
             f"lister crm.stage et figer l'id à la main dans STAGES_CRM."])
    STAGES_CRM[cle] = rows[0]["id"]
    return STAGES_CRM[cle]

# ----------------------------------------------------------------------------
# TRANSPORT SYNCHROTEAM (v3, Basic Auth domaine:clé — urllib stdlib, C-4 :
# AUCUN import requests dans ce fichier)
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
             f"{e.read().decode('utf-8', 'replace')[:500]}"])
    return json.loads(raw) if raw.strip() else {}

def st_get(path, **params):
    return _st_call("GET", path, params=params)

def st_post(path, payload):
    return _st_call("POST", path, payload=payload)

def st_list(path, **params):
    """A-5 / C-2 / X-6 : fonction de liste Synchroteam UNIQUE pour toute la lib.
    L'enveloppe de réponse était lue 'data' par A et 'records' par C — une des
    deux clés est fausse et retournait une LISTE VIDE SILENCIEUSE (la pire
    classe de bug pour un système anti-erreur). Ici : on tente 'data' puis
    'records', et on RAISE si AUCUNE des deux n'est présente. Jamais de
    .get(..., []) par défaut sur une enveloppe.
    A VERIFIER EN REEL: clé d'enveloppe réelle — st_get("job/list", pageSize=1)
    (campagne, point 1), puis simplifier cette fonction à la clé confirmée."""
    rep = st_get(path, **params)
    for cle in ("data", "records"):
        if cle in rep:
            return rep[cle] or []
    raise ErreurValidation(
        [f"Réponse Synchroteam {path} sans clé 'data' ni 'records' — clés "
         f"reçues : {sorted(rep)[:10]}. Enveloppe inconnue : NE PAS conclure "
         f"« rien à signaler », vérifier en réel (campagne, point 1)."])

def st_pages(path, page_size=100, max_pages=50, **params):
    """Générateur de pages via st_list (pagination + filtrage LOCAL,
    car on ne fait pas confiance aux filtres serveur — piège §6 site/list)."""
    page = 1
    while page <= max_pages:
        lot = st_list(path, pageSize=page_size, page=page, **params)
        yield lot
        if len(lot) < page_size:
            return
        page += 1

def chercher_site_st(terme, page_size=100, max_pages=30):
    """PIÈGE §6 : sur site/list, le paramètre `search` NE FILTRE PAS.
    On pagine tout et on filtre LOCALEMENT (nom + adresse), point final."""
    terme_l = str(terme).lower()
    trouves = []
    for lot in st_pages("site/list", page_size=page_size, max_pages=max_pages):
        for s in lot:
            blob = " ".join(str(s.get(k, "")) for k in
                            ("name", "myId", "address", "zipCode", "city")).lower()
            if terme_l in blob:
                trouves.append(s)
    return trouves

def _trouver_job_st_par_myid(my_id, jours=60):
    """Retrouve un job par myId : pagination + filtre local.
    A VERIFIER EN REEL: paramètre dateFrom de job/list (campagne, point 4)."""
    depuis = (aujourdhui() - datetime.timedelta(days=jours)).strftime("%Y-%m-%d 00:00:00")
    for lot in st_pages("job/list", dateFrom=depuis):
        for j in lot:
            if str(j.get("myId", "")).strip() == str(my_id).strip():
                return j
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

def _v_reference_ticket(ref, eg=True):
    """A-1 : JAMAIS de devis ni de job sans ticket — pour TOUS les clients.
    - Mode EG (eg=True) : BLOQUANT si la référence ne contient ni n° SR ni
      ticket AST (les tickets IEF- internes ne suffisent pas côté EG).
    - Mode non-EG : le ticket interne universel IEF-AAAAMMJJ-P<id> (généré par
      nouveau_ticket_interne) est accepté, en plus de SR/AST. Un dossier
      Matera/Ronceray/Homebox/particulier a donc TOUJOURS un ticket, sans
      jamais forcer un contournement de la lib."""
    s = str(ref or "")
    if eg:
        if not (RE_SR.search(s) or RE_AST.search(s)):
            return [f"Référence {ref!r} sans n° SR ni ticket provisoire "
                    f"AST-AAAAMMJJ-P<id_site>. Bloquant en mode EG "
                    f"(erreur historique n°1)."]
    else:
        if not (RE_SR.search(s) or RE_AST.search(s) or RE_IEF.search(s)):
            return [f"Référence {ref!r} sans ticket. Générer le ticket interne "
                    f"universel via nouveau_ticket_interne(partner_id) "
                    f"(format IEF-AAAAMMJJ-P<id>) — jamais de devis/job sans "
                    f"ticket, pour aucun client (A-1)."]
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
    et ne doit PAS être l'entité de facturation elle-même (piège Suresnes).
    A-6 : le rattachement est testé par search_count(child_of 9) et non plus
    par commercial_partner_id — robuste aux fiches sites marquées is_company
    après import en masse (qui sont leur propre commercial_partner_id).
    A VERIFIER EN REEL: comportement child_of sur 2-3 sites réels (point 7)."""
    if not site_partner_id:
        return ["site_partner_id manquant : l'adresse de livraison = le SITE, toujours."], None
    sid = int(site_partner_id)
    if sid == EG_PARENT_ID:
        return [f"site_partner_id = {EG_PARENT_ID} (SAS EG RETAIL) : c'est l'entité de "
                f"facturation, PAS un site. La livraison sur le siège (Suresnes) est "
                f"l'erreur historique n°1 — refusé."], None
    rows = odoo("res.partner", "read", [[sid]],
                {"fields": ["name", "street", "zip", "city"]})
    if not rows:
        return [f"Partner {sid} introuvable dans Odoo."], None
    site = rows[0]
    violations = []
    if not odoo("res.partner", "search_count",
                [[["id", "=", sid], ["id", "child_of", EG_PARENT_ID]]]):
        violations.append(
            f"Le site « {site['name']} » (id {sid}) n'est pas rattaché à "
            f"SAS EG RETAIL (child_of {EG_PARENT_ID}) — rattacher la fiche d'abord.")
    if not site.get("street") or not site.get("city"):
        violations.append(
            f"Le site « {site['name']} » n'a pas d'adresse complète "
            f"(street={site.get('street')!r}, city={site.get('city')!r}) : "
            f"impossible de garantir livraison = site.")
    return violations, site

# ----------------------------------------------------------------------------
# TICKETS — astreinte EG (AST) et interne universel (IEF, A-1)
# ----------------------------------------------------------------------------
def nouveau_ticket_astreinte(site_partner_id, date=None, suffixe=""):
    """AST-AAAAMMJJ-P<id partner Odoo du site>[-B].
    L'id partner rend le code déterministe et unique (aucune ambiguïté de
    nommage de site) ; le suffixe -B/-C couvre 2 appels même site même jour."""
    d = (date or aujourdhui()).strftime("%Y%m%d")
    code = f"AST-{d}-P{int(site_partner_id)}"
    if suffixe:
        code += f"-{suffixe.upper()}"
    if not RE_AST.fullmatch(code):
        raise ErreurValidation([f"Ticket astreinte mal formé : {code}"])
    return code

def nouveau_ticket_interne(partner_id, date=None, suffixe=""):
    """A-1 : ticket interne UNIVERSEL pour les dossiers non-EG (copros, hôtels,
    Homebox, particuliers…) : IEF-AAAAMMJJ-P<id partner Odoo du client/site>.
    Même logique déterministe que l'AST. C'est le myId Synchroteam, la
    référence client du devis et la clé du registre 169 pour ces dossiers —
    « myId = n° de ticket universel » (doctrine §4 mission), enfin outillé."""
    d = (date or aujourdhui()).strftime("%Y%m%d")
    code = f"IEF-{d}-P{int(partner_id)}"
    if suffixe:
        code += f"-{suffixe.upper()}"
    if not RE_IEF.fullmatch(code):
        raise ErreurValidation([f"Ticket interne mal formé : {code}"])
    return code

# ============================================================================
# 1) CRÉER UNE CARTE EG (crm.lead)
# ============================================================================
def creer_carte_eg(titre, site_partner_id, ticket=None, astreinte=False,
                   description="", stage="a_planifier"):
    """Carte pipeline EG. REFUSE d'écrire si :
    - pas de ticket (SR réel ou AST provisoire) — sauf astreinte=True qui en génère un ;
    - site absent, sans adresse, ou non rattaché au parent 9 (child_of, A-6) ;
    - la description contient un montant ;
    - stage inconnu (interdit de deviner un id de stage).
    Le ticket est posé DANS LE TITRE : c'est lui qui rend le rattachement
    différé (§7.4) déterministe."""
    violations = []

    if astreinte and not ticket:
        ticket = nouveau_ticket_astreinte(site_partner_id)
    violations += _v_reference_ticket(ticket, eg=True)

    v_site, site = _v_site_eg(site_partner_id)
    violations += v_site

    violations += _v_description_sans_montant(description)

    stage_id = STAGES_CRM.get(stage)
    if stage_id is None:
        violations.append(
            f"Stage {stage!r} sans id connu dans STAGES_CRM — le résoudre via "
            f"resoudre_stage() ou crm.stage search_read, ne jamais deviner.")

    if violations:
        raise ErreurValidation(violations)

    nom_carte = f"[{ticket}] {titre}"
    desc = (f"Ticket : {ticket}\n"
            f"Site : {site['name']} — {site.get('street', '')}, "
            f"{site.get('zip', '')} {site.get('city', '')}\n"
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
    _log("creer_carte_eg", lead_id=lead_id, ticket=str(ticket),
         astreinte=bool(astreinte))
    return {"lead_id": lead_id, "ticket": ticket, "nom": nom_carte,
            "astreinte": bool(astreinte)}

# ============================================================================
# 2) CRÉER UN DEVIS (sale.order)
# ============================================================================
def creer_devis(lignes, reference_client, site_partner_id=None, eg=True,
                partner_facturation_id=None, opportunity_id=None):
    """Devis Odoo. REFUSE d'écrire si :
    - EG : facturation ≠ partner 9, site absent / = 9 / hors parent 9,
      ou opportunity_id absent (C-3 : le lien carte↔devis est OBLIGATOIRE en
      EG — il alimente delai_emission, rattacher_sr et le filet A du cash) ;
    - référence client sans ticket : SR/AST en EG, SR/AST/IEF sinon (A-1 :
      jamais de devis sans ticket, pour AUCUN client) ;
    - un prix a des décimales hors ,30/,40/,70/,80 ;
    - une ligne est sans product_id (le chiffrage passe par le catalogue
      IEF-F-XXX — variante manquante : creer_variante_catalogue(), A-8)
      ou libellée en m² pour EG ;
    - quantité ≤ 0.
    La TVA 20 % (id 36) est IMPOSÉE sur chaque ligne — pas un paramètre.
    Relecture post-écriture : entité, livraison, référence, taxes, lignes.

    lignes = [{"product_id": int, "libelle": str, "qte": float, "prix_ht": float}, ...]
    """
    violations = []
    violations += _v_reference_ticket(reference_client, eg=eg)

    if eg:
        if partner_facturation_id not in (None, EG_PARENT_ID):
            violations.append(
                f"Devis EG : l'entité de facturation est SAS EG RETAIL "
                f"(partner {EG_PARENT_ID}), pas {partner_facturation_id}.")
        fact_id = EG_PARENT_ID
        v_site, _site = _v_site_eg(site_partner_id)
        violations += v_site
        ship_id = int(site_partner_id) if site_partner_id else None
        if not opportunity_id:
            violations.append(
                "Devis EG sans opportunity_id : le lien carte↔devis est "
                "obligatoire (C-3) — créer/retrouver la carte d'abord "
                "(creer_carte_eg) et passer son lead_id.")
    else:
        if not partner_facturation_id:
            violations.append("Devis non-EG : partner_facturation_id obligatoire.")
        fact_id = partner_facturation_id and int(partner_facturation_id)
        ship_id = int(site_partner_id) if site_partner_id else fact_id
        # non-EG : livraison = client est admis si aucun site distinct.

    if not lignes:
        violations.append("Devis sans ligne : refusé.")
    for i, l in enumerate(lignes or [], start=1):
        if not l.get("product_id"):
            violations.append(
                f"Ligne {i} sans product_id : passer par le catalogue IEF-F-XXX "
                f"(variante manquante : creer_variante_catalogue() — workflow CHIFFRE).")
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

    order_line = []
    for l in lignes:
        ol = {
            "product_id": int(l["product_id"]),
            "product_uom_qty": float(l["qte"]),
            "price_unit": round(float(l["prix_ht"]), 2),
            # A VERIFIER EN REEL: 'tax_id' vs 'tax_ids' en Odoo 19 (point 6) —
            # l'échec serait bruyant (champ inconnu), pas silencieux.
            "tax_id": [[6, 0, [TVA_20_ID]]],     # TVA 20 % imposée, jamais 10 %
        }
        # A-7 : ne JAMAIS envoyer None en XML-RPC — clé omise si libellé vide,
        # Odoo calcule alors la description depuis le produit.
        if l.get("libelle"):
            ol["name"] = l["libelle"]
        order_line.append([0, 0, ol])

    so_vals = {                                  # create renvoie une liste → odoo_create déballe
        "partner_id": fact_id,
        "partner_invoice_id": fact_id,
        "partner_shipping_id": ship_id,
        "client_order_ref": str(reference_client),
        "order_line": order_line,
    }
    if opportunity_id:                           # C-3 : lien carte↔devis
        so_vals["opportunity_id"] = int(opportunity_id)
    so_id = odoo_create("sale.order", so_vals)

    attentes = {
        "partner_invoice_id": fact_id,
        "partner_shipping_id": ship_id,
        "client_order_ref": str(reference_client),
    }
    if opportunity_id:
        attentes["opportunity_id"] = int(opportunity_id)
    _relecture("sale.order", so_id, attentes)
    # Relecture des taxes ligne à ligne
    so = odoo("sale.order", "read", [[so_id]],
              {"fields": ["order_line", "name", "amount_untaxed"]})[0]
    for ol in odoo("sale.order.line", "read", [so["order_line"]],
                   {"fields": ["tax_id", "price_unit", "name"]}):
        if ol["tax_id"] != [TVA_20_ID]:
            raise ErreurValidation(
                [f"Devis {so['name']} : ligne « {ol['name']} » avec taxes {ol['tax_id']} "
                 f"au lieu de [{TVA_20_ID}] — corriger avant tout envoi."])
    _log("creer_devis", so_id=so_id, name=so["name"],
         reference=str(reference_client), eg=bool(eg),
         opportunity_id=opportunity_id)
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
        _log("portail_lien_token", so_id=int(so_id))
    url = f"{ODOO_URL}/my/orders/{int(so_id)}?access_token={token}"
    return lien(url, texte)

# ============================================================================
# 3) ENRICHIR LE CATALOGUE — VARIANTES (A-8 : le trou du péage, comblé)
# ============================================================================
def creer_variante_catalogue(template_id, attribut_id, valeur):
    """Ajoute la valeur d'attribut `valeur` au modèle d'article `template_id`
    (workflow CHIFFRE : créer la variante manquante AVANT le devis).
    Encapsule le PIÈGE §6 : write sur product.template.attribute.line =
    syntaxe [[4, value_id, 0]] (lier SANS écraser les valeurs existantes).
    Sans cette fonction, le workflow CHIFFRE devait faire des writes bruts —
    en violation du péage (A-8). Relecture après écriture."""
    violations = []
    if not template_id:
        violations.append("template_id manquant (product.template du IEF-F-XXX).")
    if not attribut_id:
        violations.append("attribut_id manquant (product.attribute).")
    if not str(valeur or "").strip():
        violations.append("valeur d'attribut vide.")
    if violations:
        raise ErreurValidation(violations)
    template_id, attribut_id, valeur = int(template_id), int(attribut_id), str(valeur).strip()

    # 1. La valeur d'attribut (créée si absente)
    val_ids = odoo("product.attribute.value", "search",
                   [[["attribute_id", "=", attribut_id], ["name", "=ilike", valeur]]])
    if val_ids:
        value_id = val_ids[0]
    else:
        value_id = odoo_create("product.attribute.value",
                               {"attribute_id": attribut_id, "name": valeur})

    # 2. La ligne d'attribut du template
    line_ids = odoo("product.template.attribute.line", "search",
                    [[["product_tmpl_id", "=", template_id],
                      ["attribute_id", "=", attribut_id]]])
    if line_ids:
        line_id = line_ids[0]
        # PIÈGE §6 encapsulé : [[4, id, 0]] — et rien d'autre.
        odoo("product.template.attribute.line", "write",
             [[line_id], {"value_ids": [[4, value_id, 0]]}])
    else:
        line_id = odoo_create("product.template.attribute.line", {
            "product_tmpl_id": template_id,
            "attribute_id": attribut_id,
            "value_ids": [[6, 0, [value_id]]],
        })

    # 3. Relecture : la valeur doit être liée
    lu = odoo("product.template.attribute.line", "read", [[line_id]],
              {"fields": ["value_ids"]})[0]
    if value_id not in (lu.get("value_ids") or []):
        raise ErreurValidation(
            [f"RELECTURE : valeur {value_id} absente de la ligne d'attribut "
             f"{line_id} après écriture (lu : {lu.get('value_ids')!r})."])
    variantes = odoo("product.product", "search",
                     [[["product_tmpl_id", "=", template_id]]])
    _log("creer_variante_catalogue", template_id=template_id,
         value_id=value_id, line_id=line_id)
    return {"value_id": value_id, "line_id": line_id, "variant_ids": variantes}

# ============================================================================
# 4) CRÉER / PLANIFIER UN JOB SYNCHROTEAM
# ============================================================================
def creer_job(my_id, description="", site_st_id=None, customer_st_id=None,
              adresse=None):
    """Job Synchroteam. REFUSE d'écrire si :
    - my_id absent ou hors format (SR, AST ou IEF — A-1 : le ticket interne
      universel couvre les dossiers non-EG ; jamais de job sans ticket).
      myId est IRRÉCUPÉRABLE après clôture du rapport (erreur historique
      n°2) : il est donc posé À LA CRÉATION, premier argument, obligatoire ;
    - ni site ni adresse (l'adresse de livraison est obligatoire) ;
    - la description contient un montant.
    Relecture par job/details après création.
    A VERIFIER EN REEL: format des payloads site/customer/address (point 3)."""
    violations = []
    if not my_id or not (RE_SR.search(str(my_id)) or RE_AST.search(str(my_id))
                         or RE_IEF.search(str(my_id))):
        violations.append(
            f"myId {my_id!r} absent ou hors format (SR 6-10 chiffres, "
            f"AST-AAAAMMJJ-P<id> ou IEF-AAAAMMJJ-P<id>). myId se pose À LA "
            f"CRÉATION, jamais après (verrouillé dès clôture du rapport — "
            f"erreur historique n°2).")
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
    _log("creer_job", job_id=job_id, my_id=str(my_id))
    return {"job_id": job_id, "myId": str(my_id), "num": details.get("num")}

def planifier_job(job_id, technicien, debut, fin, source="ordre_explicite"):
    """job/schedule — SEUL endpoint fiable d'assignation. REFUSE si :
    - source == "inference" : une planification déduite d'un vocal ambigu
      NE S'ÉCRIT PAS (erreur historique n°4). Rituel V2 obligatoire :
      afficher « j'ai compris X = Y », attendre la confirmation d'Emin,
      puis rappeler avec source="ordre_explicite" ;
    - scheduledStart/scheduledEnd absents, mal formés ou inversés
      (l'API les EXIGE tous les deux) ;
    - technicien hors de TECHNICIENS_PLANIFIABLES — le tampon TEC031 est
      REFUSÉ ici (A-7 / X-10 : « jamais une assignation finale » ; il reste
      utilisable en création de job et surveillé par audit_flash).
    debut/fin : "AAAA-MM-JJ HH:MM:SS" (heure Europe/Paris —
    A VERIFIER EN REEL: fuseau attendu par l'API Synchroteam, point 5)."""
    violations = []
    if source != "ordre_explicite":
        violations.append(
            "Planification sur inférence REFUSÉE (erreur historique n°4). "
            "Afficher « j'ai compris <vocal> = <date/heure> », obtenir la "
            "confirmation d'Emin, puis rappeler avec source='ordre_explicite'.")
    tech_id = (TECHNICIENS_PLANIFIABLES.get(str(technicien).lower())
               if not str(technicien).isdigit() else int(technicien))
    if tech_id not in TECHNICIENS_PLANIFIABLES.values():
        violations.append(
            f"Technicien {technicien!r} hors liste planifiable "
            f"{sorted(TECHNICIENS_PLANIFIABLES)} — le tampon TEC031 est "
            f"exclu de la planification (X-10).")
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
    _log("planifier_job", job_id=int(job_id), technicien_id=tech_id,
         debut=str(debut), fin=str(fin))
    return {"job_id": int(job_id), "technicien_id": tech_id,
            "debut": str(debut), "fin": str(fin)}

def remettre_au_panier(job_id):
    """job/unschedule {"id"} — le seul geste fiable pour déprogrammer."""
    st_post("job/unschedule", {"id": int(job_id)})
    _log("remettre_au_panier", job_id=int(job_id))
    return {"job_id": int(job_id), "statut": "au_panier"}

# ============================================================================
# 5) ENVOYER UN MAIL CLIENT (wizard mail.compose.message — jamais message_post)
# ============================================================================
def lien(url, texte):
    """Le seul format de lien autorisé dans les mails : rouge #E30613, gras,
    souligné (les background CSS sont strippés par les clients mail)."""
    return (f'<a href="{url}" style="color:{COULEUR_LIEN};'
            f'font-weight:bold;text-decoration:underline;">{texte}</a>')

_CACHE_SIGNATURE = None

def signature_canonique():
    """X-4 : la signature canonique (article 160) est LUE PAR LA LIB, pas
    passée en paramètre par TEO — read chirurgical, UNE fois par session
    (cache module), jamais régénérée, jamais retapée.
    A VERIFIER EN REEL: structure de l'article 160 (point 12) — s'il contient
    PLUSIEURS signatures, extraire le bon bloc ici ou passer signature_html
    explicitement à envoyer_mail_client()."""
    global _CACHE_SIGNATURE
    if _CACHE_SIGNATURE is None:
        art = odoo("knowledge.article", "read", [[ARTICLE_SIGNATURES]],
                   {"fields": ["body"]})
        body = (art[0].get("body") or "").strip() if art else ""
        if not body:
            raise ErreurValidation(
                [f"Article {ARTICLE_SIGNATURES} (signatures canoniques) vide ou "
                 f"introuvable — impossible d'envoyer sans signature verbatim."])
        _CACHE_SIGNATURE = body
    return _CACHE_SIGNATURE

def _detecter_sensibilite(sujet, corps, montant_ht, categorie_client,
                          sinistre, premier_contact, destinataires_pids,
                          emin_pid):
    """Cran d'arrêt mails sensibles. Retourne la liste des motifs de blocage.
    A-4 : le seuil vient EXCLUSIVEMENT du barème en dur SEUILS_MAIL_HT.
    A-3 : premier contact = il EXISTE un destinataire EXTERNE (Emin exclu)
    sans AUCUN historique mail.message — logique any(search_count == 0)."""
    motifs = []
    blob = f"{sujet}\n{corps}".lower()
    if sinistre or any(m in blob for m in MOTS_SINISTRE):
        motifs.append("Contexte SINISTRE / assurance / responsabilité détecté.")
    seuil = SEUILS_MAIL_HT.get(categorie_client, SEUILS_MAIL_HT["defaut"])
    if montant_ht is not None and float(montant_ht) > seuil:
        motifs.append(f"Montant {montant_ht} € HT > seuil {seuil} € HT "
                      f"(catégorie {categorie_client}).")
    if premier_contact is None:
        # A-3 : Emin (toujours en copie) est EXCLU du test, sinon son
        # historique masquait tout premier contact ; et la logique est
        # « un externe sans historique → premier contact », pas l'inverse.
        externes = [int(p) for p in destinataires_pids if int(p) != emin_pid]
        # A VERIFIER EN REEL: coût du search_count mail.message (point 11).
        premier_contact = any(
            odoo("mail.message", "search_count",
                 [[["partner_ids", "in", [int(pid)]]]]) == 0   # A-3 : liste, pas scalaire
            for pid in externes)
    if premier_contact:
        motifs.append("PREMIER CONTACT avec au moins un destinataire externe.")
    if re.search(r"\bremise\b|\bgeste commercial\b", blob):
        motifs.append("Le mail évoque une remise/geste commercial "
                      "(remises max 3-4 %, jamais 5 %+ sans ordre).")
    return motifs

def _dernier_message_id(model, res_id):
    """Dernier id de mail.message du dossier — capturé AVANT l'envoi (A-2)."""
    ids = odoo("mail.message", "search",
               [[["model", "=", model], ["res_id", "=", int(res_id)]]],
               {"order": "id desc", "limit": 1})
    return ids[0] if ids else 0

def envoyer_mail_client(model, res_id, sujet, corps_html, destinataires_pids,
                        signature_html=None, source_verifiee=False, source_citee="",
                        montant_ht=None, categorie_client="defaut",
                        sinistre=None, premier_contact=None,
                        piece_jointe_ids=None, valide_par_emin=False):
    """Envoi mail via le wizard mail.compose.message.
    POURQUOI LE WIZARD : en Odoo 19, message_post ÉCHAPPE le HTML — le wizard
    est le seul canal propre. PIÈGES §6 intégrés : res_ids = liste d'entiers
    Python ; pièces jointes [[6,0,[ids]]] ; le send() peut lever une exception
    de marshalling CÔTÉ CLIENT alors que le mail PART.

    PREUVE D'ENVOI (A-2, corrigée) : le dernier message id du dossier est
    capturé AVANT l'envoi ; la preuve est un mail.message POSTÉRIEUR dont le
    sujet correspond — sinon raise, avec le diagnostic de la file mail.mail
    (state outgoing/exception). Plus jamais de faux « ENVOYE_ET_VERIFIE »
    fabriqué par un message antérieur du dossier. Ne JAMAIS réémettre après
    une exception sans avoir relu (risque de doublon client).

    SIGNATURE (X-4) : signature_html=None → la lib lit elle-même l'article 160
    (une fois par session, cache module). Verbatim garanti, zéro retape.

    REFUS (raise) si :
    - source_verifiee est False ou source_citee vide : verrou de l'erreur
      historique n°3 — TEO doit déclarer contre QUELLE source (compte rendu,
      rapport Synchroteam, mail) chaque fait du corps a été vérifié ;
    - un <a> du corps n'est pas au format lien() (rouge gras souligné) ;
    - un destinataire a un mail en plus-addressing (IONOS rejette en 554) ;
    - ODOO_PARTNER_EMIN non résoluble (Emin TOUJOURS en copie).

    CRAN D'ARRÊT (retour brouillon, PAS d'envoi, PAS d'exception) si
    sinistre / montant > seuil catégorie (barème en dur, A-4) / premier
    contact (détection A-3) / remise, et valide_par_emin=False. Après
    validation explicite d'Emin, rappeler à l'identique avec valide_par_emin=True."""
    violations = []

    if not source_verifiee or not str(source_citee).strip():
        violations.append(
            "Vérification factuelle non déclarée : relire le corps CONTRE la "
            "source (rapport/compte rendu/mail), puis rappeler avec "
            "source_verifiee=True et source_citee='<référence de la source>'. "
            "Verrou de l'erreur historique n°3 (mail factuellement faux parti).")
    if signature_html is None:
        signature_html = signature_canonique()          # X-4
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
                                   premier_contact, dest, emin_pid)
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

    # A-2 : borne de preuve capturée AVANT l'envoi.
    avant_id = _dernier_message_id(model, res_id)

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
        exception_marshalling = repr(e)[:300]     # le mail est PEUT-ÊTRE parti quand même

    controle = verifier_rendu_mail(model, res_id, apres_message_id=avant_id,
                                   sujet_attendu=sujet,
                                   signature_html=signature_html)
    if not controle["message_trouve"]:
        # A-2 : diagnostic par la file d'envoi mail.mail (outgoing/exception).
        # A VERIFIER EN REEL: champs mail.mail disponibles (point 13).
        try:
            file_mail = odoo("mail.mail", "search_read",
                             [[["state", "in", ["outgoing", "exception"]]]],
                             {"fields": ["id", "state", "subject"],
                              "order": "id desc", "limit": 5})
        except Exception as e:                    # noqa: BLE001
            file_mail = f"lecture mail.mail impossible : {repr(e)[:200]}"
        raise ErreurValidation(
            [f"Envoi NON confirmé : aucun mail.message POSTÉRIEUR à l'id "
             f"{avant_id} avec le sujet attendu (A-2 — un message antérieur du "
             f"dossier ne vaut PAS preuve). Exception éventuelle : "
             f"{exception_marshalling}. File mail.mail (outgoing/exception) : "
             f"{file_mail}. NE PAS réémettre en aveugle : diagnostiquer d'abord."])
    _log("envoyer_mail_client", model=model, res_id=int(res_id), sujet=sujet,
         message_id=controle["message_id"], destinataires=dest)
    return {"statut": "ENVOYE_ET_VERIFIE",
            "message_id": controle["message_id"],
            "exception_marshalling_ignoree": exception_marshalling,
            "controles": controle["controles"],
            "rappel": ("Afficher le corps envoyé à Emin (copie reçue) et le "
                       "comparer une dernière fois à la source citée : "
                       f"{source_citee}")}

def verifier_rendu_mail(model, res_id, apres_message_id=None, sujet_attendu=None,
                        signature_html=None):
    """Preuve d'envoi + contrôle de rendu (A-2, corrigée) :
    - ne considère que les mail.message d'id STRICTEMENT POSTÉRIEUR à
      apres_message_id (borne capturée avant l'envoi) ;
    - si sujet_attendu est fourni, seul un message dont le sujet correspond
      vaut preuve (message_trouve=False sinon — plus une simple « ALERTE ») ;
    - contrôles de rendu : liens stylés, signature présente. Les liens de la
      SIGNATURE sont exclus du scan (A-7 : sinon fausse alerte à chaque envoi
      si la signature canonique contient des liens non rouges).
    À appeler aussi seul après tout envoi douteux (exception de marshalling)."""
    dom = [["model", "=", model], ["res_id", "=", int(res_id)]]
    if apres_message_id:
        dom.append(["id", ">", int(apres_message_id)])
    ids = odoo("mail.message", "search", [dom], {"order": "id desc", "limit": 5})
    if not ids:
        return {"message_trouve": False, "message_id": None, "controles": []}
    msgs = odoo("mail.message", "read", [ids],
                {"fields": ["id", "subject", "body", "partner_ids", "date"]})
    msg = None
    for m in msgs:
        if sujet_attendu is None or sujet_attendu in (m.get("subject") or ""):
            msg = m
            break
    if msg is None:
        return {"message_trouve": False, "message_id": None,
                "controles": [f"Aucun message postérieur avec le sujet "
                              f"{sujet_attendu!r} (sujets lus : "
                              f"{[m.get('subject') for m in msgs]!r})"]}
    body = msg.get("body") or ""
    controles = []
    # A-7 : liens de la signature exclus du scan (comparaison par href).
    sig_hrefs = set(re.findall(r'href="([^"]+)"', signature_html or "",
                               re.IGNORECASE))
    for a in re.finditer(r"<a\s[^>]*>", body, re.IGNORECASE):
        tag = a.group(0)
        m_href = re.search(r'href="([^"]+)"', tag, re.IGNORECASE)
        if m_href and m_href.group(1) in sig_hrefs:
            continue
        if COULEUR_LIEN.lower() not in tag.lower():
            controles.append(f"ALERTE lien non stylé dans le rendu : {tag[:90]}")
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
# 6) RATTACHEMENT DIFFÉRÉ DU SR (§7.4) — cascade carte + devis + job
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
                           f"\n[{aujourdhui()}] SR {sr} rattaché "
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
    elif str(job.get("status", "")).lower() in ST_STATUTS_TERMINES:
        # myId VERROUILLÉ après clôture du rapport : cas dégradé documenté.
        if rapport["carte"] and rapport["carte"].get("lead_id"):
            odoo("crm.lead", "write", [[rapport["carte"]["lead_id"]], {
                "description": odoo("crm.lead", "read",
                                    [[rapport["carte"]["lead_id"]]],
                                    {"fields": ["description"]})[0]["description"]
                + f"\nATTENTION Job Synchroteam {job.get('num')} clos : myId reste "
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
    _log("rattacher_sr", sr=sr, ast=ast_id,
         carte=rapport["carte"], devis=rapport["devis"], job=rapport["job"])
    return rapport

# ============================================================================
# 7) CLÔTURE TERRAIN → FACTURATION (C-1 : DANS la lib, ordre sûr, relectures)
# ============================================================================
_ACTIVITY_TYPE_TODO = None

def _activity_type_todo():
    """C-5 : activity_type_id résolu DYNAMIQUEMENT (plus jamais 4 en dur).
    Résultat mis en cache session ; à figer ensuite dans l'article 170.
    A VERIFIER EN REEL: noms des types d'activité (campagne, point 9)."""
    global _ACTIVITY_TYPE_TODO
    if _ACTIVITY_TYPE_TODO is None:
        rows = odoo("mail.activity.type", "search_read",
                    [[["name", "in", ["To-Do", "À faire", "A faire", "Todo", "To Do"]]]],
                    {"fields": ["id", "name"], "limit": 1})
        if not rows:
            raise ErreurValidation(
                ["Type d'activité « À faire » introuvable — lister "
                 "mail.activity.type (campagne, point 9) et figer l'id."])
        _ACTIVITY_TYPE_TODO = rows[0]["id"]
    return _ACTIVITY_TYPE_TODO

def cloturer_terrain(ticket, carte_id=None):
    """Geste unique post-rapport (rituel « zéro terminé-non-facturé à J+2 »).
    C-1 (corrigée) — la version hors-lib de C violait le péage et son propre
    cahier des charges. Ici :
    1. Le sale.order CONFIRMÉ (state='sale') lié au ticket est EXIGÉ — raise
       sinon : interdiction structurelle de passer une carte en À FACTURER
       sans devis confirmé (le créer d'abord via creer_devis).
    2. L'activité Odoo datée J+2 sur Chayma (user 20) est créée EN PREMIER,
       la carte passe en À FACTURER ENSUITE : si la 2e écriture échoue,
       le porteur de délai existe déjà (l'ordre inverse laissait une carte
       À FACTURER sans porteur — précisément la fuite à fermer).
    3. Relecture des deux écritures."""
    violations = []
    ticket = str(ticket or "").strip()
    if not ticket:
        violations.append("ticket manquant.")

    # --- Carte ---
    if carte_id is None and ticket:
        leads = odoo("crm.lead", "search_read", [[["name", "ilike", ticket]]],
                     {"fields": ["id", "name", "stage_id"], "limit": 3})
        if len(leads) != 1:
            violations.append(
                f"{len(leads)} carte(s) matchent le ticket {ticket!r} — passer "
                f"carte_id explicitement (jamais de choix silencieux).")
        else:
            carte_id = leads[0]["id"]

    # --- (1) Devis confirmé lié au ticket : OBLIGATOIRE ---
    so = None
    if ticket:
        dom = ["|", ["client_order_ref", "ilike", ticket]]
        dom.append(["opportunity_id", "=", int(carte_id)] if carte_id
                   else ["client_order_ref", "ilike", ticket])
        sos = odoo("sale.order", "search_read",
                   [dom + [["state", "=", "sale"]]],
                   {"fields": ["id", "name", "amount_untaxed"], "limit": 3})
        if not sos:
            violations.append(
                f"Aucun sale.order CONFIRMÉ (state='sale') lié au ticket "
                f"{ticket!r} — créer/confirmer le devis d'abord (creer_devis, "
                f"tarif doctrine 60/110 €/h, prix non ronds), puis rappeler. "
                f"INTERDIT de passer une carte en À FACTURER sans devis.")
        else:
            so = sos[0]

    if violations:
        raise ErreurValidation(violations)

    stage_a_facturer = resoudre_stage("a_facturer")

    # --- (2) L'activité D'ABORD (porteur du délai J+2) ---
    res_model_id = odoo("ir.model", "search", [[["model", "=", "crm.lead"]]])[0]
    act_id = odoo_create("mail.activity", {
        "res_model_id": res_model_id,
        "res_id": int(carte_id),
        "activity_type_id": _activity_type_todo(),   # C-5 : résolu, pas 4 en dur
        "user_id": USER_CHAYMA,
        "date_deadline": (aujourdhui() + datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
        "summary": f"FACTURER — ticket {ticket}",
    })
    # --- (3a) Relecture de l'activité ---
    _relecture("mail.activity", act_id, {
        "res_id": int(carte_id),
        "user_id": USER_CHAYMA,
        "summary": ticket,
    })

    # --- La carte ENSUITE ---
    odoo("crm.lead", "write", [[int(carte_id)], {"stage_id": stage_a_facturer}])
    # --- (3b) Relecture de la carte ---
    _relecture("crm.lead", int(carte_id), {"stage_id": stage_a_facturer})

    _log("cloturer_terrain", ticket=ticket, carte_id=int(carte_id),
         activite_id=act_id, devis=so["name"])
    return {"carte_id": int(carte_id), "activite_id": act_id,
            "devis": so["name"], "montant_ht": so["amount_untaxed"],
            "statut": "A_FACTURER + activité J+2 Chayma (relues)"}

def escalades_facturation():
    """Activités FACTURER échues et non faites (une activité faite est
    supprimée en Odoo : la requête ne remonte bien que l'en-cours). Escalade
    nominative au point du matin."""
    return odoo("mail.activity", "search_read",
                [[["summary", "like", "FACTURER"],
                  ["date_deadline", "<", aujourdhui().strftime("%Y-%m-%d")]]],
                {"fields": ["res_id", "summary", "date_deadline", "user_id"],
                 "limit": 30})

# ============================================================================
# 8) AUDIT FLASH — balayage anti-erreur (à lancer au point du matin)
# ============================================================================
def audit_flash(jours_ast=7):
    """Détecte en un appel les états interdits par la doctrine :
    1. devis EG (facturation partner 9) en brouillon/envoyé SANS SR/AST en réf ;
    2. tickets AST ouverts depuis > jours_ast jours (SR jamais rattaché) ;
    3. factures POSTÉES au nom d'un SITE au lieu de SAS EG RETAIL
       (l'erreur historique n°1 côté facture — celle qui a coûté un avoir) ;
    4. jobs assignés au technicien tampon TEC031 (rien n'y dort > 48 h) ;
    5. mails en exception dans la file d'envoi (AM-6 : panne IONOS silencieuse).
    Retourne la liste des alertes ; liste vide = rien à signaler
    (et grâce à st_list, une enveloppe inattendue RAISE au lieu de se taire)."""
    alertes = []

    for s in odoo("sale.order", "search_read",
                  [[["partner_invoice_id", "=", EG_PARENT_ID],
                    ["state", "in", ["draft", "sent"]]]],
                  {"fields": ["name", "client_order_ref"]}):
        if _v_reference_ticket(s.get("client_order_ref"), eg=True):
            alertes.append(f"DEVIS {s['name']} : référence client "
                           f"{s.get('client_order_ref')!r} sans SR/AST.")

    limite = aujourdhui() - datetime.timedelta(days=jours_ast)
    for l in odoo("crm.lead", "search_read",
                  [[["name", "like", "AST-"], ["active", "=", True]]],
                  {"fields": ["id", "name"]}):
        m = re.search(r"AST-(\d{8})-P\d+", l["name"])
        if m and "SR " not in l["name"]:
            d = datetime.datetime.strptime(m.group(1), "%Y%m%d").date()
            if d < limite:
                alertes.append(f"CARTE #{l['id']} « {l['name']} » : astreinte "
                               f"du {d} toujours sans SR ({(aujourdhui()-d).days} j) "
                               f"— relancer EG / vérifier le hub Gmail.")

    for f in odoo("account.move", "search_read",
                  [[["move_type", "=", "out_invoice"], ["state", "=", "posted"],
                    ["partner_id", "child_of", EG_PARENT_ID],
                    ["partner_id", "!=", EG_PARENT_ID]]],
                  {"fields": ["name", "partner_id"]}):
        alertes.append(f"FACTURE {f['name']} postée au nom du SITE "
                       f"{f['partner_id']} au lieu de SAS EG RETAIL ({EG_PARENT_ID}) "
                       f"— avoir + refacturation nécessaires.")

    depuis = (aujourdhui() - datetime.timedelta(days=30)).strftime("%Y-%m-%d 00:00:00")
    for lot in st_pages("job/list", max_pages=20, dateFrom=depuis):
        for j in lot:
            tech = (j.get("technician") or {})
            if tech.get("id") == TECHNICIENS["tampon"]:
                alertes.append(f"JOB {j.get('num')} (myId {j.get('myId')!r}) "
                               f"toujours sur le technicien tampon TEC031.")

    # AM-6 : pannes d'envoi silencieuses (file IONOS)
    nb_exception = odoo("mail.mail", "search_count",
                        [[["state", "=", "exception"]]])
    if nb_exception:
        alertes.append(f"FILE MAIL : {nb_exception} mail(s) en exception "
                       f"(panne IONOS possible) — diagnostiquer mail.mail.")

    return alertes

# ============================================================================
# 9) REGISTRE 169 — MÉMOIRE STRUCTURELLE (X-8 / Agent B §2.2, §4)
#    Format : bloc <pre>, 1 ligne = 1 dossier, 8 colonnes fixes, états fermés.
# ============================================================================
def _lire_registre():
    """Lit l'article 169 et parse le bloc <pre> au format Agent B.
    Registre pas encore migré (pas de <pre>) → squelette vide."""
    art = odoo("knowledge.article", "read", [[ARTICLE_REGISTRE]],
               {"fields": ["body"]})
    body = (art[0].get("body") or "") if art else ""
    m = re.search(r"<pre[^>]*>(.*?)</pre>", body, re.S | re.I)
    texte = _html.unescape(re.sub(r"<[^>]+>", "", m.group(1))) if m else ""
    actifs, parking, regles = [], [], []
    section = None
    for ln in texte.splitlines():
        l = ln.strip()
        if not l or l.startswith("===") or l.startswith("FORMAT:"):
            continue
        if l.startswith("--- ACTIFS"):
            section = "a"
            continue
        if l.startswith("--- PARKING"):
            section = "p"
            continue
        if l.startswith("--- REGLES"):
            section = "r"
            continue
        if section == "a":
            actifs.append(l)
        elif section == "p":
            parking.append(l)
        elif section == "r":
            regles.append(l)
    return {"actifs": actifs, "parking": parking,
            "regles": regles or list(REGLES_REGISTRE)}

def _ecrire_registre(reg):
    """Réécrit l'article 169 : UN bloc <pre>, horodatage Europe/Paris en tête,
    puis relecture (l'horodatage doit être présent dans le body relu)."""
    horodatage = maintenant().strftime("%Y-%m-%d %H:%M")
    lignes = ([f"=== REGISTRE DOSSIERS OUVERTS — MAJ {horodatage} (TEO) ===",
               "FORMAT: ID|CLIENT|OBJET|ETAT|PROCHAINE_ACTION|QUI|ECHEANCE|REFS",
               "--- ACTIFS (max 25 lignes) ---"]
              + reg["actifs"]
              + ["--- PARKING (sujets non tranchés, max 10) ---"]
              + reg["parking"]
              + ["--- REGLES DU REGISTRE ---"]
              + reg["regles"])
    body = "<pre>" + _html.escape("\n".join(lignes)) + "</pre>"
    odoo("knowledge.article", "write", [[ARTICLE_REGISTRE], {"body": body}])
    relu = odoo("knowledge.article", "read", [[ARTICLE_REGISTRE]],
                {"fields": ["body"]})[0].get("body") or ""
    if horodatage not in relu:
        raise ErreurValidation(
            [f"RELECTURE : registre {ARTICLE_REGISTRE} — horodatage "
             f"{horodatage} absent du body relu."])
    return horodatage

def maj_registre(dossier_id, client, objet, etat, prochaine_action, qui,
                 echeance, refs=""):
    """WRITE-AHEAD (X-8 / AM-3) : la ligne du registre 169 s'écrit À L'OUVERTURE
    d'un dossier (« je vais faire X »), PAS à la clôture — si la conversation
    meurt en cours de journée, l'état intermédiaire survit. Remplace la ligne
    existante de même ID, sinon l'ajoute. État ∈ ETATS_REGISTRE (fermé)."""
    violations = []
    etat = str(etat).upper().strip()
    if etat not in ETATS_REGISTRE:
        violations.append(f"État {etat!r} hors vocabulaire fermé "
                          f"{ETATS_REGISTRE} — pas d'état libre au registre.")
    ligne = "|".join(str(x).strip().replace("|", "/") for x in
                     (dossier_id, client, objet, etat, prochaine_action,
                      qui, echeance, refs))
    if len(ligne) > 110:
        violations.append(f"Ligne registre de {len(ligne)} chars (> 110) — "
                          f"raccourcir OBJET/PROCHAINE_ACTION (budget dur B).")
    if violations:
        raise ErreurValidation(violations)

    reg = _lire_registre()
    prefixe = f"{str(dossier_id).strip()}|"
    remplacee = False
    for i, l in enumerate(reg["actifs"]):
        if l.startswith(prefixe):
            reg["actifs"][i] = ligne
            remplacee = True
            break
    if not remplacee:
        reg["actifs"].append(ligne)
    if len(reg["actifs"]) > 25:
        raise ErreurValidation(
            [f"Registre : {len(reg['actifs'])} lignes actives (> 25) — archiver "
             f"les dossiers clos vers 169-ARCH-AAAA-MM avant d'ajouter."])
    horodatage = _ecrire_registre(reg)
    _log("maj_registre", dossier=str(dossier_id), etat=etat,
         remplacee=remplacee)
    return {"ligne": ligne, "maj": horodatage,
            "actifs": len(reg["actifs"])}

def checkpoint(lignes=None):
    """Clôture de session (skill checkpoint / fin du point du soir) :
    1. affiche le JOURNAL (tout ce que la lib a écrit cette session — TEO n'a
       rien à se rappeler, le code s'en souvient) et la PILE de sujets parkés ;
    2. applique les lignes de registre fournies (liste de dicts aux arguments
       de maj_registre) — consolidation dérivée du journal par TEO ;
    3. persiste la PILE en section PARKING du registre 169 (P-nn|sujet|état|date)
       — rien ne meurt avec la conversation ;
    4. réécrit l'article 169 horodaté (le point du matin compare cet horodatage
       à la date du jour : un checkpoint manquant devient VISIBLE, jamais
       silencieux)."""
    for lg in (lignes or []):
        maj_registre(**lg)

    reg = _lire_registre()
    if PILE:
        deja = len(reg["parking"])
        for i, p in enumerate(PILE, start=1):
            num = deja + i
            reg["parking"].append(
                "|".join([f"P-{num:02d}", p["sujet"].replace("|", "/"),
                          (p["etat"] or "-").replace("|", "/"),
                          p["ts"][:10]]))
        if len(reg["parking"]) > 10:
            raise ErreurValidation(
                [f"PARKING : {len(reg['parking'])} sujets (> 10) — promouvoir "
                 f"en dossier D-xxxx ou faire tuer par Emin (règle B §5)."])
    horodatage = _ecrire_registre(reg)

    resume = (f"Registre à jour ({horodatage}) — {len(reg['actifs'])} actifs, "
              f"{len(reg['parking'])} parkés, {len(JOURNAL)} écritures au "
              f"journal de session.")
    resultat = {"journal": list(JOURNAL), "parkes_persistes": list(PILE),
                "resume": resume}
    PILE.clear()
    return resultat

# ============================================================================
# 10) CASH & PILOTAGE (Agent C, corrigé : st_list, stdlib, batch, renommages)
# ============================================================================
def jobs_termines(depuis_jours=21):
    """Jobs terminés récents (statuts ST_STATUTS_TERMINES centralisés, X-6).
    Pagination + re-filtrage LOCAL du statut (on ne fait pas confiance au
    filtre serveur). Enveloppe via st_list : jamais de vide silencieux.
    A VERIFIER EN REEL: timezone des datetimes renvoyés (point 5) et existence
    d'un champ dateCompleted (la date affichée ici est scheduledEnd)."""
    date_from = (maintenant() - datetime.timedelta(days=depuis_jours)
                 ).strftime("%Y-%m-%d %H:%M:%S")
    jobs = []
    for lot in st_pages("job/list", dateFrom=date_from):
        jobs += [j for j in lot
                 if str(j.get("status", "")).lower() in ST_STATUTS_TERMINES]
    return [{"myId": j.get("myId"), "num": j.get("num"), "status": j["status"],
             "site": (j.get("site") or {}).get("name"),
             "fin": j.get("scheduledEnd")} for j in jobs]

def termines_non_factures_filet_A():
    """Filet A (terrain → CRM) : jobs terminés dont la carte n'est pas en
    À FACTURER ni CLÔTURÉ. Les jobs SANS myId remontent séparément (anomalie
    de process en soi — compteur d'erreurs du point du soir)."""
    stage_a_facturer = resoudre_stage("a_facturer")
    stage_cloture = STAGES_CRM["cloture"]
    alertes, sans_myid = [], []
    for j in jobs_termines():
        if not j["myId"]:
            sans_myid.append(j)
            continue
        cartes = odoo("crm.lead", "search_read",
                      [[["name", "ilike", j["myId"]],
                        ["stage_id", "not in", [stage_a_facturer, stage_cloture]]]],
                      {"fields": ["id", "name", "stage_id", "partner_id",
                                  "expected_revenue"], "limit": 3})
        for c in cartes:
            alertes.append({"ticket": j["myId"], "carte": c["name"],
                            "stage": c["stage_id"] and c["stage_id"][1],
                            "client": c["partner_id"] and c["partner_id"][1],
                            "montant_attendu": c["expected_revenue"],
                            "fin_job": j["fin"], "age_j": age_j(j["fin"])})
    return alertes, sans_myid

def termines_non_factures_filet_B():
    """Filet B (CRM → compta) : devis confirmés jamais facturés.
    Marque BLOQUÉ SR (cash gelé par EG, pas par IEF : l'action est « relancer
    EG pour le SR », pas « facturer vite »)."""
    rows = odoo("sale.order", "search_read",
                [[["state", "=", "sale"], ["invoice_status", "=", "to invoice"]]],
                {"fields": ["name", "partner_id", "commercial_partner_id",
                            "client_order_ref", "amount_total", "date_order",
                            "invoice_ids"],
                 "order": "date_order asc", "limit": 80})
    out = []
    for r in rows:
        ref = r.get("client_order_ref") or ""
        est_eg = _m2o(r.get("commercial_partner_id")) == EG_PARENT_ID
        out.append({"devis": r["name"], "client": r["partner_id"][1],
                    "ref": ref,
                    "ht_ttc": r["amount_total"],
                    "age_j": age_j(r["date_order"]),
                    "deja_facture_partiel": bool(r["invoice_ids"]),
                    "bloque_sr": bool(est_eg and not RE_SR.search(ref))})
    return out

def devis_en_attente():
    """Devis draft (jamais envoyé = défaillance interne) / sent (dormant
    client) avec palier de relance pré-calculé pour le skill relance-devis."""
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

def factures_impayees():
    """Factures postées non payées. commercial_partner_id (pas partner_id)
    pour que les factures posées sur un site EG remontent sur SAS EG RETAIL."""
    rows = odoo("account.move", "search_read",
                [[["move_type", "=", "out_invoice"], ["state", "=", "posted"],
                  ["payment_state", "in", ["not_paid", "partial"]]]],
                {"fields": ["name", "partner_id", "commercial_partner_id",
                            "amount_residual", "invoice_date",
                            "invoice_date_due", "payment_state", "ref"],
                 "order": "invoice_date_due asc", "limit": 150})
    out = []
    for r in rows:
        retard = age_j(r["invoice_date_due"])   # >0 = en retard, <=0 = pas échue
        out.append({"facture": r["name"], "client": r["commercial_partner_id"][1],
                    "reste_du": r["amount_residual"],
                    "age_j": age_j(r["invoice_date"]),
                    "retard_j": retard,
                    "statut": ("RETARD" if retard and retard > 0 else "à échoir"),
                    "partiel": r["payment_state"] == "partial"})
    return out

def factures_brouillon():
    """Factures créées puis jamais validées (invisibles dans tous les états).
    Toute facture brouillon > 24 h = anomalie du point du soir."""
    return odoo("account.move", "search_read",
                [[["move_type", "=", "out_invoice"], ["state", "=", "draft"]]],
                {"fields": ["name", "partner_id", "amount_total", "invoice_date"],
                 "limit": 40})

def encours_par_client():
    """read_group : agrégation côté Odoo, on ne rapatrie que les totaux."""
    groups = odoo("account.move", "read_group",
                  [[["move_type", "=", "out_invoice"], ["state", "=", "posted"],
                    ["payment_state", "in", ["not_paid", "partial"]]],
                   ["amount_residual"], ["commercial_partner_id"]],
                  {"orderby": "amount_residual desc"})
    return [{"client": g["commercial_partner_id"][1],
             "encours": round(g["amount_residual"], 2),
             "nb_factures": g["commercial_partner_id_count"]} for g in groups]

def taux_transformation(semaines=4):
    """Rendement du chiffrage : gagnés / (gagnés + perdus), en nb et en €."""
    d0 = (aujourdhui() - datetime.timedelta(weeks=semaines)).strftime("%Y-%m-%d")
    rows = odoo("sale.order", "search_read",
                [[["date_order", ">=", d0]]],
                {"fields": ["state", "amount_total", "date_order"], "limit": 300})
    gagnes = [r for r in rows if r["state"] == "sale"]
    perdus = [r for r in rows if r["state"] == "cancel"
              or (r["state"] == "sent" and age_j(r["date_order"]) > 30)]
    tot = len(gagnes) + len(perdus)
    return {"taux_nb": round(100 * len(gagnes) / tot, 1) if tot else None,
            "taux_eur": round(100 * sum(g["amount_total"] for g in gagnes) /
                              max(1, sum(r["amount_total"] for r in gagnes + perdus)), 1),
            "gagnes": len(gagnes), "perdus": len(perdus)}

def dso(semaines=8):
    """DSO médian global + EG. CAVEAT ASSUMÉ (C-5) : approximation par
    write_date (qui bouge à chaque write) — surestime ; suffisant au grain
    hebdo, l'afficher AVEC ce caveat dans le reporting."""
    d0 = (aujourdhui() - datetime.timedelta(weeks=semaines)).strftime("%Y-%m-%d")
    rows = odoo("account.move", "search_read",
                [[["move_type", "=", "out_invoice"],
                  ["payment_state", "in", ["paid", "in_payment"]],
                  ["invoice_date", ">=", d0]]],
                {"fields": ["invoice_date", "write_date",
                            "commercial_partner_id", "amount_total"],
                 "limit": 200})
    def med(vals):
        s = sorted(vals)
        return s[len(s) // 2] if s else None
    delais = [(age_j(r["invoice_date"]) - age_j(r["write_date"]), r) for r in rows]
    return {"dso_global_j": med([d for d, _ in delais]),
            "dso_eg_j": med([d for d, r in delais
                             if _m2o(r["commercial_partner_id"]) == EG_PARENT_ID])}

def recurrence_clients():
    """Clients récurrents éteints : ≥ commandes sur T-1 (90 j) et zéro sur T."""
    def bloc(d0, d1):
        return {g["commercial_partner_id"][0]: (g["commercial_partner_id"][1],
                g["commercial_partner_id_count"], round(g["amount_total"], 0))
                for g in odoo("sale.order", "read_group",
                              [[["state", "=", "sale"], ["date_order", ">=", d0],
                                ["date_order", "<", d1]],
                               ["amount_total"], ["commercial_partner_id"]], {})}
    now, m3, m6 = [(aujourdhui() - datetime.timedelta(days=d)).strftime("%Y-%m-%d")
                   for d in (0, 90, 180)]
    recent, avant = bloc(m3, now), bloc(m6, m3)
    dormants = [avant[pid] for pid in avant if pid not in recent]
    return {"actifs_90j": len(recent), "clients_eteints": dormants}

def delai_emission(semaines=4):
    """Délai carte → devis (médiane). Repose sur opportunity_id — désormais
    ALIMENTÉ par creer_devis (C-3), l'indicateur n'est plus structurellement
    vide. C-5 : lectures de cartes BATCHÉES (un seul read), plus de N+1."""
    d0 = (aujourdhui() - datetime.timedelta(weeks=semaines)
          ).strftime("%Y-%m-%d %H:%M:%S")
    devis = odoo("sale.order", "search_read",
                 [[["create_date", ">=", d0], ["opportunity_id", "!=", False]]],
                 {"fields": ["opportunity_id", "create_date"], "limit": 150})
    lead_ids = sorted({_m2o(dv["opportunity_id"]) for dv in devis})
    leads = ({l["id"]: l["create_date"]
              for l in odoo("crm.lead", "read", [lead_ids],
                            {"fields": ["create_date"]})}
             if lead_ids else {})
    delais = []
    for dv in devis:
        lid = _m2o(dv["opportunity_id"])
        if lid in leads:
            delais.append(age_j(leads[lid]) - age_j(dv["create_date"]))
    s = sorted(delais)
    return {"mediane_j": s[len(s) // 2] if s else None,
            "max_j": max(s, default=None), "n": len(s)}

def ecart_valorisation_mo(montant_mo_devis_ht, heures_reelles,
                          deux_techniciens=False):
    """X-7 / C-5 : ex-« marge théorique » de C, RENOMMÉE — 60/110 €/h sont des
    prix de VENTE, pas des coûts : ce chiffre est un ÉCART AU BARÈME MO, PAS
    une marge. Ne jamais l'afficher sous le mot « marge » à Emin. La marge
    réelle attend le coût horaire chargé calibré par Fayçal (P2, module achats)."""
    taux = 110.0 if deux_techniciens else 60.0
    return round(float(montant_mo_devis_ht) - float(heures_reelles) * taux, 2)

def dashboard_cash():
    """Les requêtes cash du point du matin, en un appel. Ordre = ordre d'impact
    (terminé non facturé d'abord — priorité n°1 d'Emin). Lecture croisée :
    un ticket présent en filet A ET filet B avec age_j >= 2 = ligne rouge."""
    filet_a, sans_myid = termines_non_factures_filet_A()
    return {
        "1_termine_non_facture_filet_A": filet_a,
        "1_jobs_sans_myid": sans_myid,           # anomalies de process (compteur ERR)
        "1_termine_non_facture_filet_B": termines_non_factures_filet_B(),
        "2_escalades_facturation_J2": escalades_facturation(),
        "3_factures_impayees": factures_impayees(),
        "3_factures_brouillon": factures_brouillon(),
        "4_devis_en_attente": devis_en_attente(),
        "5_encours_par_client": encours_par_client(),
    }

# ============================================================================
# 11) INTÉGRITÉ DU SOURCE (R-7) — l'article 171 est du rich-text Odoo : un
#     collage peut être altéré silencieusement (guillemets typographiques,
#     espaces insécables). Le hash affiché au chargement se compare au hash
#     de référence noté en tête de l'article 171 à chaque nouvelle version.
# ============================================================================
def empreinte_texte(texte):
    """SHA-256 d'un texte (pour vérifier un code collé depuis l'article 171)."""
    return hashlib.sha256(texte.encode("utf-8")).hexdigest()

def _empreinte_source():
    try:
        chemin = __file__
    except NameError:
        return None            # exécution par collage (exec) : pas de fichier
    try:
        with open(chemin, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()
    except OSError:
        return None

EMPREINTE_SHA256 = _empreinte_source()
print(f"ief_lib v{VERSION} chargée — SHA-256 du source : "
      + (EMPREINTE_SHA256 or
         "indisponible (exécution par collage) — comparer "
         "empreinte_texte(<texte collé>) au hash de référence de l'article 171."))
# ============================== fin ief_lib v1.1 =============================

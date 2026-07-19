#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extraction_synchroteam.py — Extraction complète Synchroteam pour IEF & CO.
Ordre de mission n°2, Chantier 3, point 4 — archive légale + future migration.

Extrait, par fenêtres annuelles (dateFrom/dateTo) et pagination complète sur
l'enveloppe `data` (racine : page, pageSize, records, recordsTotal, data) :
  - job/list        → puis job/details pour CHAQUE job (actualStart/actualEnd,
                      rapport, champs custom, myId…), avec throttle, retry
                      (backoff, max 4) et reprise via .state.json ;
  - site/list, customer/list, technician/list (pagination identique).

Sorties (dossier --out, défaut ./extraction_synchroteam_AAAAMMJJ/) :
  jobs.json, sites.json, customers.json, technicians.json, manifest.json
  (+ import.sql si --pg ; + pieces_jointes/ si --with-attachments).

Contrôles : la clé `data` est EXIGÉE (raise si absente — jamais de liste vide
silencieuse) ; le nombre extrait est comparé à recordsTotal (écart = erreur).
Datetimes : conservés bruts (heure locale Europe/Paris `AAAA-MM-JJ HH:MM`,
sans suffixe TZ — ground truth campagne 18/07) ET doublés en ISO 8601
Europe/Paris dans des champs `*_iso` ajoutés, sans écraser l'original.

Secrets : SYNCHROTEAM_DOMAIN et SYNCHROTEAM_KEY via os.environ, échec
explicite si absents. Aucun secret en clair nulle part.

Exemples d'invocation :
  export SYNCHROTEAM_DOMAIN="iefandco"
  export SYNCHROTEAM_KEY="********"          # jamais en clair dans un fichier

  # Reconnaissance : une page de chaque collection, compteurs + structure,
  # n'écrit RIEN :
  python3 extraction_synchroteam.py --dry-run

  # Extraction complète 2020 → année courante :
  python3 extraction_synchroteam.py

  # Fenêtre historique validée en campagne (1 245 jobs attendus sur 2020-2024) :
  python3 extraction_synchroteam.py --annee-debut 2020 --annee-fin 2024 \\
      --out ./extraction_synchroteam_20260719

  # Avec script de rechargement Postgres (tables archive_* en JSONB) :
  python3 extraction_synchroteam.py --pg

  # Avec téléchargement des photos/pièces jointes référencées :
  python3 extraction_synchroteam.py --with-attachments

  # Reprise après interruption : relancer la MÊME commande avec le MÊME --out ;
  # le fichier .state.json et le journal _travail/jobs_details.jsonl font
  # reprendre là où l'extraction s'était arrêtée (rien n'est re-téléchargé).

Stdlib Python 3.10+ uniquement (urllib, json, argparse, pathlib, zoneinfo).
Aucun import requests. Conventions de transport identiques à ief_lib.py.
"""

import argparse
import base64
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

VERSION = "1.0"
TZ_PARIS = ZoneInfo("Europe/Paris")
BASE_DEFAUT = "https://ws.synchroteam.com/api/v3"

# Datetimes Synchroteam observés en campagne : heure locale Europe/Paris,
# format "AAAA-MM-JJ HH:MM" (parfois avec secondes), SANS suffixe TZ.
RE_DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$")
RE_URL_HTTP = re.compile(r"^https?://", re.IGNORECASE)

ANNEE_DEBUT_DEFAUT = 2020   # historique profond validé (1 245 jobs 2020-2024)


# ----------------------------------------------------------------------------
# Exceptions
# ----------------------------------------------------------------------------
class ErreurConfiguration(Exception):
    """Secrets/paramètres absents : on refuse de démarrer, explicitement."""


class ErreurExtraction(Exception):
    """Réponse API inexploitable ou contrôle d'exhaustivité en échec.
    JAMAIS de silence : une enveloppe sans `data` ou un écart recordsTotal
    lèvent cette exception (l'état est persisté, la reprise est possible)."""


# ----------------------------------------------------------------------------
# Configuration (secrets via os.environ — échec explicite si absents)
# ----------------------------------------------------------------------------
def config_env():
    domaine = os.environ.get("SYNCHROTEAM_DOMAIN", "").strip()
    cle = os.environ.get("SYNCHROTEAM_KEY", "").strip()
    manquantes = [nom for nom, val in (("SYNCHROTEAM_DOMAIN", domaine),
                                       ("SYNCHROTEAM_KEY", cle)) if not val]
    if manquantes:
        raise ErreurConfiguration(
            "Variable(s) d'environnement absente(s) : " + ", ".join(manquantes)
            + ". Les injecter avant lancement (export SYNCHROTEAM_DOMAIN=… ; "
              "export SYNCHROTEAM_KEY=…). Les secrets ne sont JAMAIS en clair "
              "dans un fichier ni un argument de ligne de commande.")
    return domaine, cle


def maintenant_paris():
    return datetime.datetime.now(TZ_PARIS)


# ----------------------------------------------------------------------------
# Client HTTP Synchroteam (urllib stdlib, Basic Auth domaine:clé — mêmes
# conventions que ief_lib._st_call : urlencode OBLIGATOIRE sur les GET)
# ----------------------------------------------------------------------------
class ClientSynchroteam:
    def __init__(self, base, domaine, cle, throttle=0.3, max_retries=4,
                 page_size=100):
        self.base = base.rstrip("/")
        self.throttle = float(throttle)
        self.max_retries = int(max_retries)
        self.page_size = int(page_size)
        self._auth = base64.b64encode(f"{domaine}:{cle}".encode()).decode()

    def _entetes(self):
        return {"Authorization": f"Basic {self._auth}",
                "Content-Type": "application/json",
                "Accept": "application/json"}

    def get(self, chemin, **params):
        """GET JSON avec throttle poli et retry/backoff (réseau, 5xx, 429).
        4xx (hors 429) = erreur immédiate, pas de retry."""
        url = f"{self.base}/{chemin}"
        if params:
            # urlencode OBLIGATOIRE (les espaces des datetimes cassent sinon).
            url += "?" + urllib.parse.urlencode(params)
        derniere_erreur = None
        for tentative in range(self.max_retries + 1):
            if tentative:
                attente = min(2 ** tentative, 30)   # 2, 4, 8, 16 s
                print(f"    retry {tentative}/{self.max_retries} dans "
                      f"{attente}s ({derniere_erreur})", file=sys.stderr)
                time.sleep(attente)
            if self.throttle:
                time.sleep(self.throttle)
            req = urllib.request.Request(url, headers=self._entetes())
            try:
                with urllib.request.urlopen(req, timeout=120) as rep:
                    brut = rep.read().decode("utf-8", "replace")
                return json.loads(brut) if brut.strip() else {}
            except urllib.error.HTTPError as e:
                corps = e.read().decode("utf-8", "replace")[:300]
                if e.code >= 500 or e.code == 429:
                    derniere_erreur = f"HTTP {e.code} sur {chemin}"
                    continue
                raise ErreurExtraction(
                    f"GET {chemin} → HTTP {e.code} (non réessayable) : {corps}")
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                derniere_erreur = f"erreur réseau sur {chemin} : {e}"
                continue
            except json.JSONDecodeError as e:
                derniere_erreur = f"réponse non-JSON sur {chemin} : {e}"
                continue
        raise ErreurExtraction(
            f"GET {chemin} : échec après {self.max_retries + 1} tentatives — "
            f"dernière erreur : {derniere_erreur}")

    def telecharger(self, url, cible):
        """Téléchargement binaire d'une pièce jointe (mêmes retries)."""
        derniere_erreur = None
        for tentative in range(self.max_retries + 1):
            if tentative:
                time.sleep(min(2 ** tentative, 30))
            if self.throttle:
                time.sleep(self.throttle)
            req = urllib.request.Request(url, headers=self._entetes())
            try:
                with urllib.request.urlopen(req, timeout=300) as rep:
                    cible.write_bytes(rep.read())
                return True
            except urllib.error.HTTPError as e:
                if e.code >= 500 or e.code == 429:
                    derniere_erreur = f"HTTP {e.code}"
                    continue
                print(f"    pièce jointe HTTP {e.code} (ignorée) : {url}",
                      file=sys.stderr)
                return False
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                derniere_erreur = str(e)
                continue
        print(f"    pièce jointe en échec après retries ({derniere_erreur}) : "
              f"{url}", file=sys.stderr)
        return False

    # -- pagination sur l'enveloppe `data` (ground truth campagne 18/07) -----
    def paginer(self, chemin, etiquette=None, **params):
        """Pagine intégralement `chemin`. Retourne (enregistrements,
        recordsTotal). RAISE si la clé `data` est absente d'une page, ou si
        le nombre extrait diffère du recordsTotal annoncé (exhaustivité)."""
        etiquette = etiquette or chemin
        tout, records_total, page = [], None, 1
        while True:
            rep = self.get(chemin, page=page, pageSize=self.page_size, **params)
            if not isinstance(rep, dict) or "data" not in rep:
                cles = sorted(rep) if isinstance(rep, dict) else type(rep).__name__
                raise ErreurExtraction(
                    f"{etiquette} page {page} : enveloppe SANS clé 'data' "
                    f"(clés reçues : {cles}). Enveloppe attendue : page, "
                    f"pageSize, records, recordsTotal, data. On ne conclut "
                    f"JAMAIS « liste vide » sur une enveloppe inconnue.")
            lot = rep["data"] or []
            if rep.get("recordsTotal") is not None:
                records_total = int(rep["recordsTotal"])
            tout.extend(lot)
            if len(lot) < self.page_size:
                break
            if records_total is not None and len(tout) >= records_total:
                break
            page += 1
            if page > 100000:
                raise ErreurExtraction(f"{etiquette} : pagination sans fin "
                                       f"(>100000 pages) — abandon.")
        if records_total is not None and len(tout) != records_total:
            raise ErreurExtraction(
                f"{etiquette} : contrôle d'exhaustivité EN ÉCHEC — "
                f"{len(tout)} enregistrements extraits pour un recordsTotal "
                f"annoncé de {records_total}. Écart = erreur (relancer, ou "
                f"vérifier si la base a bougé pendant l'extraction).")
        return tout, records_total


# ----------------------------------------------------------------------------
# Normalisation datetimes : brut conservé + champ `*_iso` ISO 8601 Europe/Paris
# ----------------------------------------------------------------------------
def iso_paris(valeur):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
                "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return (datetime.datetime.strptime(valeur, fmt)
                    .replace(tzinfo=TZ_PARIS).isoformat())
        except ValueError:
            continue
    return None


def normaliser_datetimes(obj):
    """Parcours récursif : pour chaque chaîne au format datetime Synchroteam
    (heure locale Europe/Paris sans TZ), ajoute un champ frère `<cle>_iso`
    en ISO 8601 Europe/Paris. L'original n'est JAMAIS écrasé."""
    if isinstance(obj, dict):
        ajouts = {}
        for cle, val in obj.items():
            if isinstance(val, (dict, list)):
                normaliser_datetimes(val)
            elif (isinstance(val, str) and not cle.endswith("_iso")
                  and RE_DATETIME.match(val.strip())):
                iso = iso_paris(val.strip())
                if iso and f"{cle}_iso" not in obj:
                    ajouts[f"{cle}_iso"] = iso
        obj.update(ajouts)
    elif isinstance(obj, list):
        for element in obj:
            normaliser_datetimes(element)
    return obj


def collecter_urls(obj, acc):
    """Collecte récursive des URLs http(s) exposées par job/details
    (photos, documents, rapport…) → référencées dans `_urls_pieces_jointes`."""
    if isinstance(obj, dict):
        for val in obj.values():
            collecter_urls(val, acc)
    elif isinstance(obj, list):
        for element in obj:
            collecter_urls(element, acc)
    elif isinstance(obj, str) and RE_URL_HTTP.match(obj.strip()):
        acc.add(obj.strip())


# ----------------------------------------------------------------------------
# Persistance : écriture atomique + état de reprise (.state.json)
# ----------------------------------------------------------------------------
def ecrire_json(chemin, donnees):
    tmp = chemin.with_suffix(chemin.suffix + ".tmp")
    tmp.write_text(json.dumps(donnees, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    tmp.replace(chemin)


class Etat:
    """État d'avancement persisté (<out>/.state.json) : fenêtres de job/list
    terminées (avec recordsTotal), collections annexes terminées, compteur de
    détails. Les détails déjà récupérés sont journalisés dans
    _travail/jobs_details.jsonl (append-only) : la reprise relit ce journal
    et ne re-télécharge RIEN de déjà acquis."""

    def __init__(self, chemin):
        self.chemin = chemin
        if chemin.exists():
            self.d = json.loads(chemin.read_text(encoding="utf-8"))
        else:
            self.d = {"version": VERSION, "fenetres": {}, "collections": {},
                      "details_faits": 0}

    def sauver(self):
        self.d["maj_le"] = maintenant_paris().isoformat(timespec="seconds")
        ecrire_json(self.chemin, self.d)


# ----------------------------------------------------------------------------
# Phases d'extraction
# ----------------------------------------------------------------------------
COLLECTIONS_ANNEXES = (("sites", "site/list"),
                       ("customers", "customer/list"),
                       ("technicians", "technician/list"))


def extraire_collection_annexe(client, etat, travail, nom, chemin_api):
    info = etat.d["collections"].get(nom)
    fichier = travail / f"{nom}.json"
    if info and info.get("terminee") and fichier.exists():
        print(f"[{nom}] déjà extrait ({info['extraits']} enregistrements) — "
              f"repris de l'état.")
        return json.loads(fichier.read_text(encoding="utf-8")), info.get("recordsTotal")
    print(f"[{nom}] extraction {chemin_api}…")
    enregistrements, records_total = client.paginer(chemin_api, etiquette=nom)
    ecrire_json(fichier, enregistrements)
    etat.d["collections"][nom] = {"terminee": True,
                                  "extraits": len(enregistrements),
                                  "recordsTotal": records_total}
    etat.sauver()
    print(f"[{nom}] {len(enregistrements)} extraits "
          f"(recordsTotal={records_total}) — OK.")
    return enregistrements, records_total


def fenetre_annee(annee):
    return f"{annee}-01-01 00:00:00", f"{annee}-12-31 23:59:59"


def extraire_listes_jobs(client, etat, travail, annees):
    """job/list par fenêtres annuelles dateFrom/dateTo (fonctionnels —
    campagne 18/07). Chaque fenêtre terminée est figée dans l'état."""
    liste_totale, par_fenetre = [], {}
    for annee in annees:
        cle = str(annee)
        fichier = travail / f"jobs_liste_{annee}.json"
        info = etat.d["fenetres"].get(cle)
        if info and info.get("terminee") and fichier.exists():
            lot = json.loads(fichier.read_text(encoding="utf-8"))
            print(f"[jobs {annee}] fenêtre déjà extraite ({len(lot)}) — reprise.")
        else:
            date_from, date_to = fenetre_annee(annee)
            print(f"[jobs {annee}] job/list dateFrom={date_from} "
                  f"dateTo={date_to}…")
            lot, records_total = client.paginer(
                "job/list", etiquette=f"job/list {annee}",
                dateFrom=date_from, dateTo=date_to)
            for job in lot:
                job["_fenetre_extraction"] = cle
            ecrire_json(fichier, lot)
            etat.d["fenetres"][cle] = {"terminee": True, "extraits": len(lot),
                                       "recordsTotal": records_total}
            etat.sauver()
            print(f"[jobs {annee}] {len(lot)} jobs "
                  f"(recordsTotal={records_total}) — OK.")
        par_fenetre[cle] = etat.d["fenetres"][cle]
        liste_totale.extend(lot)
    # Déduplication par id (un job ne doit compter qu'une fois)
    vus, dedup = set(), []
    for job in liste_totale:
        jid = job.get("id")
        if jid is None:
            raise ErreurExtraction(f"Entrée job/list sans champ 'id' : "
                                   f"{json.dumps(job, ensure_ascii=False)[:200]}")
        if jid not in vus:
            vus.add(jid)
            dedup.append(job)
    return dedup, par_fenetre


def charger_details_acquis(jsonl):
    acquis = {}
    if jsonl.exists():
        with jsonl.open(encoding="utf-8") as f:
            for ligne in f:
                ligne = ligne.strip()
                if ligne:
                    obj = json.loads(ligne)
                    acquis[obj["_job_id"]] = obj["details"]
    return acquis


def extraire_details_jobs(client, etat, travail, jobs_liste):
    """job/details pour chaque job, avec reprise : le journal append-only
    _travail/jobs_details.jsonl fait foi — un id déjà présent n'est jamais
    re-téléchargé."""
    jsonl = travail / "jobs_details.jsonl"
    acquis = charger_details_acquis(jsonl)
    restants = [j for j in jobs_liste if j["id"] not in acquis]
    if acquis:
        print(f"[details] reprise : {len(acquis)} déjà acquis, "
              f"{len(restants)} restants.")
    else:
        print(f"[details] {len(restants)} appels job/details à faire.")
    with jsonl.open("a", encoding="utf-8") as f:
        for i, job in enumerate(restants, start=1):
            jid = job["id"]
            rep = client.get("job/details", id=jid)
            details = rep["data"] if isinstance(rep.get("data"), dict) else rep
            if not isinstance(details, dict) or not details:
                raise ErreurExtraction(
                    f"job/details id={jid} : réponse vide ou inexploitable "
                    f"({json.dumps(rep, ensure_ascii=False)[:200]}).")
            f.write(json.dumps({"_job_id": jid, "details": details},
                               ensure_ascii=False) + "\n")
            f.flush()
            acquis[jid] = details
            if i % 25 == 0 or i == len(restants):
                etat.d["details_faits"] = len(acquis)
                etat.sauver()
                print(f"[details] {len(acquis)}/{len(jobs_liste)}…")
    etat.d["details_faits"] = len(acquis)
    etat.sauver()
    return acquis


def assembler_jobs(jobs_liste, details_par_id):
    """Fusion liste + détails (les détails priment), URLs de pièces jointes
    référencées, datetimes normalisés (*_iso)."""
    finaux = []
    for entree in jobs_liste:
        rec = dict(entree)
        details = details_par_id.get(entree["id"])
        if details:
            rec.update(details)
            rec["_fenetre_extraction"] = entree.get("_fenetre_extraction")
        urls = set()
        collecter_urls(details or entree, urls)
        if urls:
            rec["_urls_pieces_jointes"] = sorted(urls)
        normaliser_datetimes(rec)
        finaux.append(rec)
    return finaux


def statut_de(job):
    statut = job.get("status")
    if isinstance(statut, dict):
        statut = statut.get("name") or statut.get("id")
    return str(statut) if statut not in (None, "") else "(sans statut)"


def telecharger_pieces_jointes(client, jobs, dossier):
    total, ok = 0, 0
    for job in jobs:
        urls = job.get("_urls_pieces_jointes") or []
        if not urls:
            continue
        cible_dir = dossier / str(job.get("id"))
        cible_dir.mkdir(parents=True, exist_ok=True)
        locaux = []
        for url in urls:
            total += 1
            nom = Path(urllib.parse.urlparse(url).path).name or f"pj_{total}"
            nom = re.sub(r"[^A-Za-z0-9._-]", "_", nom)[:120]
            cible = cible_dir / nom
            if cible.exists() or client.telecharger(url, cible):
                ok += 1
                locaux.append(str(cible.relative_to(dossier.parent)))
        if locaux:
            job["_pieces_jointes_locales"] = locaux
    print(f"[pièces jointes] {ok}/{total} téléchargées → {dossier}/")
    return {"referencees": total, "telechargees": ok}


# ----------------------------------------------------------------------------
# Manifest et export Postgres
# ----------------------------------------------------------------------------
def construire_manifest(domaine, annees, par_fenetre, jobs, details_par_id,
                        annexes, pj_stats):
    par_statut = {}
    avec_myid = 0
    for job in jobs:
        par_statut[statut_de(job)] = par_statut.get(statut_de(job), 0) + 1
        if str(job.get("myId") or "").strip():
            avec_myid += 1
    total_rt = sum(f["recordsTotal"] or 0 for f in par_fenetre.values())
    manifest = {
        "genere_le": maintenant_paris().isoformat(timespec="seconds"),
        "fuseau": "Europe/Paris",
        "script": {"nom": "extraction_synchroteam.py", "version": VERSION},
        "domaine": domaine,
        "fenetres_annees": {"de": annees[0], "a": annees[-1]},
        "controle_exhaustivite": {
            "regle": "extraits == recordsTotal par fenêtre et par collection "
                     "(tout écart lève ErreurExtraction avant ce manifest)",
            "jobs_par_fenetre": par_fenetre,
            "jobs_recordsTotal_cumule": total_rt,
            "jobs_extraits_dedupliques": len(jobs),
        },
        "collections": {
            "jobs": {
                "extraits": len(jobs),
                "details_recuperes": len(details_par_id),
                "par_statut": dict(sorted(par_statut.items())),
                "myId": {
                    "presents": avec_myid,
                    "absents": len(jobs) - avec_myid,
                    "note": "myId = ticket universel (réconciliation "
                            "Odoo/registre) — statistique de couverture",
                },
                "pieces_jointes": pj_stats,
            },
        },
        "datetimes": {
            "brut": "heure locale Europe/Paris, format AAAA-MM-JJ HH:MM, "
                    "sans suffixe TZ (ground truth campagne 18/07/2026)",
            "normalise": "champs *_iso ajoutés en ISO 8601 Europe/Paris, "
                         "originaux conservés tels quels",
        },
    }
    for nom, (enregistrements, records_total) in annexes.items():
        manifest["collections"][nom] = {
            "extraits": len(enregistrements),
            "recordsTotal": records_total,
        }
    return manifest


def _sql_txt(val):
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def generer_import_sql(chemin, collections):
    """import.sql : tables archive_* (id + payload JSONB intégral) + INSERT.
    Rechargement : psql -f import.sql (tables créées si absentes ; vider les
    tables avant un ré-import pour éviter les doublons)."""
    lignes = [
        "-- import.sql — rechargement Postgres de l'archive Synchroteam IEF & CO",
        f"-- Généré le {maintenant_paris().isoformat(timespec='seconds')} "
        f"par extraction_synchroteam.py v{VERSION}",
        "-- Ré-import : TRUNCATE les tables archive_* d'abord (INSERT simples).",
        "BEGIN;",
    ]
    for nom, enregistrements in collections.items():
        table = f"archive_{nom}"
        lignes += [
            "",
            f"CREATE TABLE IF NOT EXISTS {table} (",
            "    id       BIGINT,",
            "    my_id    TEXT,",
            "    statut   TEXT,",
            "    data     JSONB NOT NULL",
            ");",
            f"CREATE INDEX IF NOT EXISTS idx_{table}_id ON {table} (id);",
        ]
        for rec in enregistrements:
            rid = rec.get("id")
            rid_sql = str(int(rid)) if isinstance(rid, int) or (
                isinstance(rid, str) and rid.isdigit()) else "NULL"
            my_id = str(rec.get("myId") or "").strip() or None
            statut = statut_de(rec) if nom == "jobs" else None
            payload = json.dumps(rec, ensure_ascii=False)
            lignes.append(
                f"INSERT INTO {table} (id, my_id, statut, data) VALUES "
                f"({rid_sql}, {_sql_txt(my_id)}, {_sql_txt(statut)}, "
                f"{_sql_txt(payload)}::jsonb);")
    lignes += ["", "COMMIT;", ""]
    chemin.write_text("\n".join(lignes), encoding="utf-8")


# ----------------------------------------------------------------------------
# Mode --dry-run : une page par collection, compteurs + structure, zéro écriture
# ----------------------------------------------------------------------------
def dry_run(client, annee_fin):
    date_from, date_to = fenetre_annee(annee_fin)
    essais = [("jobs", "job/list", {"dateFrom": date_from, "dateTo": date_to}),
              ("sites", "site/list", {}),
              ("customers", "customer/list", {}),
              ("technicians", "technician/list", {})]
    for nom, chemin, params in essais:
        rep = client.get(chemin, page=1, pageSize=25, **params)
        if not isinstance(rep, dict) or "data" not in rep:
            raise ErreurExtraction(
                f"--dry-run {nom} : enveloppe sans clé 'data' "
                f"(clés : {sorted(rep) if isinstance(rep, dict) else rep}).")
        lot = rep["data"] or []
        print(f"[{nom}] enveloppe={sorted(rep)} "
              f"recordsTotal={rep.get('recordsTotal')} page1={len(lot)}")
        if lot:
            print(f"    structure 1er enregistrement : {sorted(lot[0])}")
    print("--dry-run terminé : RIEN n'a été écrit.")


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------
def construire_parseur():
    p = argparse.ArgumentParser(
        description="Extraction complète Synchroteam (archive légale + "
                    "migration) — IEF & CO, stdlib pur.")
    p.add_argument("--out", default=None,
                   help="Dossier de sortie (défaut : "
                        "./extraction_synchroteam_AAAAMMJJ/)")
    p.add_argument("--annee-debut", type=int, default=ANNEE_DEBUT_DEFAUT,
                   help=f"Première fenêtre annuelle (défaut {ANNEE_DEBUT_DEFAUT})")
    p.add_argument("--annee-fin", type=int, default=None,
                   help="Dernière fenêtre annuelle (défaut : année courante "
                        "Europe/Paris)")
    p.add_argument("--sleep", type=float, default=0.3,
                   help="Throttle poli entre appels API, en secondes (défaut 0.3)")
    p.add_argument("--page-size", type=int, default=100,
                   help="Taille de page de pagination (défaut 100)")
    p.add_argument("--max-retries", type=int, default=4,
                   help="Retries max avec backoff sur réseau/5xx (défaut 4)")
    p.add_argument("--pg", action="store_true",
                   help="Génère en plus import.sql (tables archive_* JSONB)")
    p.add_argument("--dry-run", action="store_true",
                   help="Une page par collection, compteurs + structure, "
                        "n'écrit rien")
    p.add_argument("--with-attachments", action="store_true",
                   help="Télécharge les pièces jointes référencées "
                        "(désactivé par défaut)")
    p.add_argument("--base-url", default=BASE_DEFAUT,
                   help=argparse.SUPPRESS)   # surcharge pour tests locaux
    return p


def main(argv=None):
    args = construire_parseur().parse_args(argv)
    domaine, cle = config_env()
    annee_fin = args.annee_fin or maintenant_paris().year
    if args.annee_debut > annee_fin:
        raise ErreurConfiguration(
            f"--annee-debut {args.annee_debut} > --annee-fin {annee_fin}.")
    annees = list(range(args.annee_debut, annee_fin + 1))

    client = ClientSynchroteam(args.base_url, domaine, cle,
                               throttle=args.sleep,
                               max_retries=args.max_retries,
                               page_size=args.page_size)

    if args.dry_run:
        dry_run(client, annee_fin)
        return 0

    out = Path(args.out or
               f"./extraction_synchroteam_{maintenant_paris():%Y%m%d}")
    travail = out / "_travail"
    travail.mkdir(parents=True, exist_ok=True)
    etat = Etat(out / ".state.json")
    print(f"Extraction Synchroteam (domaine {domaine}) → {out}/ ; "
          f"fenêtres {annees[0]}-{annees[-1]} ; état : {etat.chemin}")

    try:
        # 1. Collections annexes
        annexes = {}
        for nom, chemin_api in COLLECTIONS_ANNEXES:
            annexes[nom] = extraire_collection_annexe(
                client, etat, travail, nom, chemin_api)

        # 2. job/list par fenêtres annuelles
        jobs_liste, par_fenetre = extraire_listes_jobs(
            client, etat, travail, annees)
        print(f"[jobs] {len(jobs_liste)} jobs uniques sur "
              f"{len(annees)} fenêtres.")

        # 3. job/details pour chaque job (reprise via jsonl)
        details_par_id = extraire_details_jobs(
            client, etat, travail, jobs_liste)

        # 4. Assemblage + normalisation
        jobs = assembler_jobs(jobs_liste, details_par_id)

        # 5. Pièces jointes (option)
        pj_stats = {"referencees": sum(
            len(j.get("_urls_pieces_jointes") or []) for j in jobs),
            "telechargees": 0}
        if args.with_attachments:
            pj_stats = telecharger_pieces_jointes(
                client, jobs, out / "pieces_jointes")

        # 6. Sorties finales
        collections_finales = {"jobs": jobs}
        for nom, (enregistrements, _rt) in annexes.items():
            collections_finales[nom] = [
                normaliser_datetimes(dict(r)) for r in enregistrements]
        for nom, enregistrements in collections_finales.items():
            ecrire_json(out / f"{nom}.json", enregistrements)

        manifest = construire_manifest(domaine, annees, par_fenetre, jobs,
                                       details_par_id,
                                       {n: (collections_finales[n], rt)
                                        for n, (_e, rt) in annexes.items()},
                                       pj_stats)
        ecrire_json(out / "manifest.json", manifest)

        if args.pg:
            generer_import_sql(out / "import.sql", collections_finales)
            print(f"[pg] import.sql généré ({out / 'import.sql'}).")

        etat.sauver()
        print(f"TERMINÉ : {len(jobs)} jobs "
              f"({len(details_par_id)} détails), "
              + ", ".join(f"{len(v[0])} {n}" for n, v in annexes.items())
              + f". Manifest : {out / 'manifest.json'}")
        return 0
    except ErreurExtraction:
        etat.sauver()
        print(f"\nINTERROMPU SUR ERREUR — état persisté dans {etat.chemin}. "
              f"Relancer la même commande pour reprendre sans re-télécharger.",
              file=sys.stderr)
        raise


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ErreurConfiguration, ErreurExtraction) as exc:
        print(f"ERREUR : {exc}", file=sys.stderr)
        sys.exit(1)

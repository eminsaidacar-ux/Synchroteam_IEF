# scripts/ — Extraction complète Synchroteam (IEF & CO)

Ordre de mission n°2, Chantier 3, point 4. Archive légale + future migration :
ce script servira quoi qu'il arrive.

## extraction_synchroteam.py

Stdlib Python 3.10+ pur (urllib, json, argparse, pathlib, zoneinfo). Aucun
secret en clair : `SYNCHROTEAM_DOMAIN` et `SYNCHROTEAM_KEY` obligatoires via
l'environnement (échec explicite sinon).

```bash
export SYNCHROTEAM_DOMAIN="iefandco"
export SYNCHROTEAM_KEY="********"

python3 extraction_synchroteam.py --dry-run          # reconnaissance, n'écrit rien
python3 extraction_synchroteam.py                    # extraction 2020 → année courante
python3 extraction_synchroteam.py --annee-debut 2020 --annee-fin 2024 --pg
```

Ce qu'il fait :

- **job/list par fenêtres annuelles** (`dateFrom`/`dateTo`, validés en
  campagne — 1 245 jobs sur 2020-2024), pagination complète sur l'enveloppe
  `data` (raise si absente), **contrôle d'exhaustivité** : extraits vs
  `recordsTotal`, tout écart = erreur signalée.
- **job/details pour chaque job** (actualStart/actualEnd, rapport, champs
  custom, myId) avec throttle (`--sleep`, défaut 0,3 s) et retry/backoff sur
  réseau et 5xx (`--max-retries`, défaut 4).
- **Reprise** : `.state.json` + journal `_travail/jobs_details.jsonl` dans le
  dossier de sortie — relancer la même commande avec le même `--out` reprend
  sans rien re-télécharger.
- **site/list, customer/list, technician/list** : pagination identique.
- **Datetimes** : bruts conservés (heure locale Europe/Paris `AAAA-MM-JJ HH:MM`
  sans TZ) + champs `*_iso` ajoutés en ISO 8601 Europe/Paris.
- **Pièces jointes** : URLs exposées par job/details référencées dans
  `_urls_pieces_jointes` ; téléchargement seulement avec `--with-attachments`.

Sorties (`--out`, défaut `./extraction_synchroteam_AAAAMMJJ/`) :
`jobs.json`, `sites.json`, `customers.json`, `technicians.json`,
`manifest.json` (horodatage Europe/Paris, compteurs par collection et par
statut, recordsTotal vs extraits, couverture myId), et avec `--pg` un
`import.sql` (tables `archive_*` en JSONB — vider les tables avant ré-import).

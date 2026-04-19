# IEF Audit — Plateforme SaaS multi-équipements

Plateforme d'audit menuiseries & équipements pour IEF & CO (serrurerie,
métallerie, maintenance multi-technique en Île-de-France). Transformation
industrialisée d'un outil HTML autonome validé terrain (audit de 29 portes,
mosquée Boulogne-Billancourt) en produit SaaS multi-clients.

## Stack

- **Frontend** : React 18 + Vite + TailwindCSS + React Router + TanStack Query
- **Backend / DB / Auth / Storage** : Supabase (Postgres + RLS + Storage)
- **PDF** : Puppeteer (Supabase Edge Function) ou `@react-pdf/renderer` côté client
- **Hébergement** : Vercel (frontend) + Supabase (backend)
- **CI/CD** : GitHub Actions → déploiement auto Vercel

## Arborescence

```
ief-audit/
├── frontend/          # Application React (Vite)
├── supabase/          # Migrations SQL + seed
│   └── migrations/
├── .github/workflows/ # CI/CD
└── README.md
```

## Démarrage rapide

### 1. Prérequis

- Node.js 20+
- Un projet Supabase (https://supabase.com) avec ses clés

### 2. Setup frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # remplir VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

### 3. Setup base de données

Dans l'éditeur SQL Supabase, exécuter dans l'ordre les fichiers de
`supabase/migrations/`. Le schéma inclut les tables `organisations`, `users`,
`sites`, `equipements`, `photos`, `rapports` avec Row Level Security activée.

Créer ensuite le bucket Supabase Storage `photos` en mode privé.

### 4. Déploiement

Frontend → Vercel (connecter le repo, renseigner `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`).

## Phases de développement

- **Phase 1 (MVP)** — Parité avec l'outil HTML : auth, sites, audit portes,
  photos, PDF, import JSON legacy.
- **Phase 2** — Multi-familles : fenêtres, rideaux métalliques, portails,
  volets roulants, contrôle d'accès.
- **Phase 3** — Industrialisation : PWA offline, multi-users, QR codes,
  partage de rapports, historique.
- **Phase 4** — SaaS : multi-organisations, Stripe, API publique.

## Design system

- Background `#0f1117`, accent `#ff6b00`, cards `#161b27`
- DM Mono (refs/techniques), Inter (texte courant)
- Mobile-first strict (80% de l'usage est terrain)
- Badges d'état : Bon (vert), Moyen (orange), Mauvais (rouge), Hors service (violet)

## Migration depuis l'outil HTML

La route `/import` accepte le JSON exporté par l'outil HTML legacy et crée
automatiquement le site + les équipements de famille `porte`. Voir
`frontend/src/lib/importLegacy.js`.

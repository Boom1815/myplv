# MYPLV — Prospection & plateforme privée

Dépôt dédié au projet MYPLV : site public (existant, Wix, inchangé pour l'instant) +
plateforme privée de prospection automatisée et d'emailing (`app.myplv.be`).

## Statut

**Phases 1 et 2 en cours.** Architecture validée le 25/08/2026 (voir le
rapport d'audit). Ce qui existe et fonctionne, testé de bout en bout :

- Schéma de base de données complet (29 tables, Drizzle ORM/Postgres).
- API (Hono, déployable sur Cloudflare Workers) : authentification par
  session (PBKDF2, cookies httpOnly, rate limiting), rôles ADMIN/READER,
  liste des prospects filtrable/paginée, écrans Scoring, Dashboard, Liste
  noire, Secteurs/NACE, Zones géographiques.
- Frontend (React/Vite, déployable sur Cloudflare Pages) : connexion,
  Dashboard, Prospects (avec tags), Scoring, Liste noire, Secteurs,
  Géographie, Offres, Templates email — édition réservée ADMIN, lecture
  seule READER partout où c'est pertinent.
- Import KBO/BCE Open Data : filtrage géographique, dédoublonnage par
  numéro BCE, résolution automatique du secteur (NACE → secteur), exclusion
  automatique par liste noire, journalisation.
- Moteur de scoring configurable (`@myplv/scoring`, 29 tests unitaires) :
  8 règles de départ reprenant l'exemple du brief, recalcul via CLI
  (`npm run score:run`) ou depuis l'écran Scoring (bouton « Recalculer »).
- Fondations emailing (`@myplv/email`, 17 tests unitaires) : abstraction
  `EmailProvider` (Brevo / simulation), rendu de templates, désinscription
  publique (`/api/unsubscribe`) fonctionnelle de bout en bout. La création
  de campagnes et le déclenchement d'envoi ne sont pas encore construits —
  volontairement, voir « Prochaines étapes ».
- Seeds : secteurs métier + règles NACE de départ, règles de scoring de
  départ, utilisateur admin initial.

Rapport d'audit et de faisabilité : [`docs/audit/2026-08-25-audit-faisabilite.html`](docs/audit/2026-08-25-audit-faisabilite.html).
Comptes externes à créer avant déploiement réel : [`docs/DEPLOY.md`](docs/DEPLOY.md).

Aperçu en ligne (Cloudflare Workers + Neon) :
- Frontend : https://myplv-web.green-moon-15e1.workers.dev
- API : https://myplv.green-moon-15e1.workers.dev

## Structure du dépôt

```
apps/
  api/        API Hono — déployée sur Cloudflare Workers (prod), tsx en local (dev)
  web/        Frontend React/Vite — déployé sur Cloudflare Pages
packages/
  auth/       Hachage de mot de passe (Web Crypto PBKDF2), portable Workers/Node
  db/         Schéma Drizzle + migrations, clients Postgres (HTTP Neon pour Workers, pg pour Node)
  scoring/    Moteur de scoring pur (testable, portable Workers/Node) — brief section 27
  importer/   Scripts d'import (KBO Open Data), de seed et de scoring, exécutés en Node/GitHub Actions
docs/
  audit/      Rapport d'audit et de faisabilité
  DEPLOY.md   Comptes externes à créer (Neon, Cloudflare, Brevo) et étapes de déploiement
```

## Développement local

Prérequis : Node 20+, un Postgres accessible (local, Docker, ou un projet
Neon gratuit — voir `docs/DEPLOY.md`).

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL au minimum

npm run db:generate    # si le schéma a changé
npm run db:migrate     # applique les migrations sur DATABASE_URL

npm run seed:sectors -w @myplv/importer
npm run seed:scoring -w @myplv/importer
npm run seed:admin -w @myplv/importer -- --email info@myplv.be --name "Pierre Bataille" --password "..."

npm run api:dev        # http://localhost:8787
npm run web:dev         # http://localhost:5173 (proxy /api vers l'API locale)

npm run test            # tests unitaires (moteur de scoring)
```

L'API locale (`dev-server.ts`) parle à Postgres en TCP standard (driver
`pg`) pour ne pas dépendre d'un compte Neon en développement ; en
production (Cloudflare Workers), elle utilise le driver HTTP de Neon — seul
compatible avec un runtime sans sockets TCP. Le schéma et les requêtes
Drizzle sont identiques des deux côtés (voir `apps/api/src/db.ts`).

### Import KBO Open Data

```bash
npm run import:kbo -- --dir ./data/kbo-raw
npm run score:run -w @myplv/importer   # recalcule les scores après import
```

Voir [`packages/importer/README.md`](packages/importer/README.md) pour le
détail (fichiers attendus, hypothèses à valider sur un export réel).

## Principes du projet

- **0 € / mois de coûts logiciels récurrents** tant qu'une solution gratuite
  raisonnable suffit ; jamais de dépendance payante choisie par simple confort.
- **Données publiques et légales uniquement** — aucune API inventée, aucun
  contournement de protection, aucune donnée achetée si l'équivalent gratuit
  existe.
- **Le site public (`myplv.be`, Wix) reste inchangé** dans cette phase — la
  plateforme de prospection est un projet séparé, sur un sous-domaine, sans
  aucun risque SEO.
- **RGPD par construction** : suppression list, désinscription,
  journalisation — mais la conformité juridique finale reste à valider par
  un professionnel du droit. Contact RGPD désigné : Pierre Bataille
  (info@myplv.be).

## Prochaines étapes

Création de campagnes (segment, séquence, mode dry_run/production) et
déclenchement d'envoi réel via Brevo — la pièce la plus sensible (RGPD,
réputation, limite quotidienne), pas encore construite. Nécessite une clé
API Brevo valide pour le premier test réel (voir `docs/DEPLOY.md`).

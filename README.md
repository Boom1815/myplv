# MYPLV — Prospection & plateforme privée

Dépôt dédié au projet MYPLV : site public (existant, Wix, inchangé pour l'instant) +
plateforme privée de prospection automatisée et d'emailing (`app.myplv.be`).

## Statut

**Phase 1 (fondations) en cours.** Architecture validée le 25/08/2026 (voir
le rapport d'audit). Ce qui existe et fonctionne, testé de bout en bout :

- Schéma de base de données complet (28 tables, Drizzle ORM/Postgres).
- API (Hono, déployable sur Cloudflare Workers) : authentification par
  session (PBKDF2, cookies httpOnly, rate limiting), rôles ADMIN/READER,
  liste des prospects filtrable/paginée.
- Frontend (React/Vite, déployable sur Cloudflare Pages) : écran de
  connexion + écran Prospects en lecture.
- Import KBO/BCE Open Data : filtrage géographique, dédoublonnage par
  numéro BCE, exclusion automatique par liste noire, journalisation.
- Seeds : secteurs métier + règles NACE de départ, utilisateur admin
  initial.

Rapport d'audit et de faisabilité : [`docs/audit/2026-08-25-audit-faisabilite.html`](docs/audit/2026-08-25-audit-faisabilite.html).
Comptes externes à créer avant déploiement réel : [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Structure du dépôt

```
apps/
  api/        API Hono — déployée sur Cloudflare Workers (prod), tsx en local (dev)
  web/        Frontend React/Vite — déployé sur Cloudflare Pages
packages/
  auth/       Hachage de mot de passe (Web Crypto PBKDF2), portable Workers/Node
  db/         Schéma Drizzle + migrations, clients Postgres (HTTP Neon pour Workers, pg pour Node)
  importer/   Scripts d'import (KBO Open Data) et de seed, exécutés en Node/GitHub Actions
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
npm run seed:admin -w @myplv/importer -- --email info@myplv.be --name "Pierre Bataille" --password "..."

npm run api:dev        # http://localhost:8787
npm run web:dev         # http://localhost:5173 (proxy /api vers l'API locale)
```

L'API locale (`dev-server.ts`) parle à Postgres en TCP standard (driver
`pg`) pour ne pas dépendre d'un compte Neon en développement ; en
production (Cloudflare Workers), elle utilise le driver HTTP de Neon — seul
compatible avec un runtime sans sockets TCP. Le schéma et les requêtes
Drizzle sont identiques des deux côtés (voir `apps/api/src/db.ts`).

### Import KBO Open Data

```bash
npm run import:kbo -- --dir ./data/kbo-raw
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

## Prochaines étapes (Phase 2)

Moteur de scoring (brief section 27), écran Secteurs/NACE/Géographie
éditable, mode validation avant campagne, désinscription/suppression list
côté public. Voir le plan de développement dans le rapport d'audit.

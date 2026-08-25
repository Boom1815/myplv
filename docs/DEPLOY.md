# Déploiement — comptes externes à créer

Ces comptes sont gratuits mais doivent être créés par toi (je n'ai pas accès
pour les créer à ta place). Une fois faits, donne-moi les identifiants/clés
via des secrets (jamais en clair dans le repo) et je branche le déploiement.

## 1. Neon (base de données Postgres)

1. Crée un compte sur [neon.tech](https://neon.tech) (gratuit, sans carte).
2. Crée un projet, région Europe (Frankfurt ou proche).
3. Copie la `DATABASE_URL` (format `postgresql://...`).
4. Garde-la de côté — elle sert de secret `DATABASE_URL` partout
   (Cloudflare, GitHub Actions).

## 2. Cloudflare (hébergement `app.myplv.be`)

1. Crée un compte sur [cloudflare.com](https://cloudflare.com) (gratuit).
2. Installe `wrangler` en local (`npm i -g wrangler`) et connecte-le
   (`wrangler login`) — ou donne-moi un jeton API Cloudflare (scope
   Workers + Pages) pour que je déploie depuis ici.
3. Une fois `DATABASE_URL` et `AUTH_SECRET` prêts :
   ```bash
   cd apps/api
   wrangler secret put DATABASE_URL
   wrangler secret put AUTH_SECRET
   wrangler secret put BREVO_API_KEY   # une fois le compte Brevo créé
   wrangler secret put CRON_SECRET
   wrangler deploy
   ```
4. Pour le frontend (`apps/web`), déploiement Cloudflare Pages — soit via
   `wrangler pages deploy dist` après `npm run build`, soit en connectant le
   dépôt GitHub directement dans le dashboard Cloudflare Pages (build auto
   à chaque push).

## 3. DNS — sous-domaine `app.myplv.be`

Une fois l'API et le frontend déployés sur Cloudflare, ajoute dans le
panneau DNS du registrar de myplv.be (confirmé accessible — voir rapport
d'audit section 4) :

- Un enregistrement `CNAME` pour `app` pointant vers l'URL fournie par
  Cloudflare Pages.
- Le binding Workers sur `app.myplv.be/api/*` (voir la route commentée dans
  `apps/api/wrangler.toml`).

## 4. Brevo (email, plan gratuit)

1. Crée un compte sur [brevo.com](https://www.brevo.com) (gratuit, 300
   emails/jour).
2. Vérifie un sous-domaine dédié à l'envoi de campagnes (ex.
   `campagnes.myplv.be`) — ajoute les enregistrements SPF/DKIM que Brevo
   fournit dans le panneau DNS du registrar.
3. Génère une clé API, à poser comme secret `BREVO_API_KEY`.

*(Ce fournisseur ne sera réellement branché qu'en Phase 3 du plan de
développement — pas nécessaire pour les fondations actuelles.)*

## 5. Utilisateur admin initial

Une fois `DATABASE_URL` de production disponible :

```bash
DATABASE_URL="postgresql://..." npm run seed:sectors
DATABASE_URL="postgresql://..." npm run seed:admin -- \
  --email info@myplv.be --name "Pierre Bataille" --password "<mot de passe fort généré>"
```

Génère le mot de passe avec `openssl rand -base64 24`, transmis à part
(jamais par email en clair).

# MYPLV — Prospection & plateforme privée

Dépôt dédié au projet MYPLV : site public (existant, Wix, inchangé pour l'instant) +
plateforme privée de prospection automatisée et d'emailing (`app.myplv.be`).

## Statut

**Architecture validée (25/08/2026), Phase 1 à démarrer.** Aucun code applicatif n'a
encore été écrit — la phase d'audit et de validation d'architecture précède le
développement, conformément au brief du projet. Sous-domaine cible : `app.myplv.be`.

Rapport d'audit et de faisabilité : [`docs/audit/2026-08-25-audit-faisabilite.html`](docs/audit/2026-08-25-audit-faisabilite.html)
(ouvrir dans un navigateur, ou publié en artifact partageable).

Ce rapport couvre : audit du site myPLV.be actuel, options de migration, sources de
données gratuites (KBO/BCE Open Data), solution d'emailing gratuite (Brevo), architecture
technique recommandée (Cloudflare Pages/Workers + Neon + GitHub Actions), schéma de base
de données, coûts (objectif 0 €/mois), risques, et questions ouvertes à valider avant le
développement.

## Principes du projet

- **0 € / mois de coûts logiciels récurrents** tant qu'une solution gratuite raisonnable
  suffit ; jamais de dépendance payante choisie par simple confort.
- **Données publiques et légales uniquement** — aucune API inventée, aucun contournement
  de protection, aucune donnée achetée si l'équivalent gratuit existe.
- **Le site public (`myplv.be`, Wix) reste inchangé** dans cette phase — la plateforme de
  prospection est un projet séparé, sur un sous-domaine, sans aucun risque SEO.
- **RGPD par construction** : suppression list, désinscription, journalisation — mais la
  conformité juridique finale reste à valider par un professionnel du droit.

## Prochaines étapes

Voir la section « Questions ouvertes » et « Plan de développement » du rapport d'audit.

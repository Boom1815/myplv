# @myplv/importer

Scripts d'import et de seed, exécutés en Node (localement ou via GitHub
Actions) — jamais dans l'API Cloudflare Workers.

## Import KBO/BCE Open Data

```bash
npm run import:kbo -- --dir ./data/kbo-raw
```

`--dir` doit contenir les fichiers officiels tels que téléchargés depuis
[kbopub.economie.fgov.be/kbo-open-data](https://kbopub.economie.fgov.be/kbo-open-data/)
(compte gratuit requis — voir le rapport d'audit, section 8) :
`enterprise.csv`, `address.csv`, `activity.csv`, `denomination.csv`.

### Ce que fait l'import

1. Lit `address.csv` et ne garde que les entités dont le code postal tombe
   dans le périmètre de lancement confirmé (Bruxelles-Capitale, Brabant
   wallon, Hainaut, Namur) — voir `src/geo/province-from-postal-code.ts`.
   C'est aussi une optimisation mémoire : inutile de charger les autres
   fichiers (bien plus lourds à l'échelle du pays) au-delà de ce périmètre.
2. Résout le nom (`denomination.csv`), le code NACE principal
   (`activity.csv`) et la forme juridique / date de début (`enterprise.csv`)
   pour chaque entité retenue.
3. Vérifie chaque entité contre les listes noires actives (`blacklists`) —
   une entité qui matche n'est jamais transformée en prospect (mais reste
   en base dans `companies`, pour audit).
4. Upsert dans `companies` par numéro BCE (dédoublonnage prioritaire — brief
   section 25), puis crée la ligne `prospects` correspondante si elle
   n'existe pas déjà.
5. Journalise l'exécution dans `data_imports`.

### ⚠️ Hypothèses à valider sur un export réel

Je n'ai pas pu télécharger un export KBO Open Data réel depuis cet
environnement (accès réseau restreint + inscription gratuite requise côté
SPF Économie). La structure des fichiers a été confirmée par recoupement
avec un projet tiers open source construit dessus, mais deux points précis
restent des **heuristiques à vérifier** au premier import réel (voir aussi
`src/kbo/types.ts`) :

- **Nom retenu** : préférence donnée à `TypeOfDenomination = "001"` (nom
  social), sinon la première dénomination trouvée. La bonne valeur de code
  est documentée dans `code.csv` (catégorie `TypeOfDenomination`) — à
  confirmer.
- **Code NACE principal** : la première activité trouvée dans
  `activity.csv` pour l'entité, sans filtrer sur `Classification`
  (activité principale vs secondaire) faute de valeur de code confirmée. À
  affiner une fois `code.csv` inspecté.

Le résultat d'un import écrit ces avertissements dans
`data_imports.summary` — consultable depuis l'écran Sources/Logs à venir.
Import testé de bout en bout avec un jeu de données synthétique (4
entreprises, dont une hors périmètre et une blacklistée) : dédoublonnage,
filtrage géographique et exclusion par liste noire fonctionnent comme
attendu.

## Seeds

```bash
npm run seed:sectors   # secteurs métier + règles NACE de départ (brief section 23)
npm run seed:admin -- --email info@myplv.be --name "Pierre Bataille" --password "..."
```

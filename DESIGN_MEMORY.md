# Design Memory — myPLV

Issu du Design Lab (skill `design-lab`) tenu le 2026-08-28 sur le Dashboard.
Variante gagnante : **E — Expressif**, confirmée sans retouche par l'utilisateur
("Magnifique !"). Ce fichier est la référence canonique pour généraliser
cette direction à toutes les pages avec le skill `impeccable`.

## Brand Tone

- **Adjectifs :** clair, moderne, aligné, coloré-mais-sobre, digne de confiance,
  un peu animé (jamais gratuit).
- **Éviter :** froid/impersonnel (verdict sur le pass minimaliste précédent),
  hiérarchie floue, interface statique sans aucun retour visuel, couleur en
  aplats (« arc-en-ciel »).
- **Inspiration :** Linear — dense mais lisible, accents colorés ponctuels,
  micro-animations discrètes.

## Couleur

Palette dérivée du logo (`apps/web/public/logo-myplv.png`, caméléon
géométrique) — **1 accent primaire + 2 secondaires, jamais toute la surface** :

| Rôle | Couleur | Usage |
|---|---|---|
| Primaire | `#E05010` (orange) → `#E02020` en dégradé | stat héros, CTA, palier priorité le plus haut, liseré des cartes "priorité" |
| Secondaire | `#1090D0` (bleu) → `#2070B0` | infos secondaires, liseré des cartes "statuts" |
| Tertiaire | `#901080` (magenta) → `#E00070` | accents spéciaux, pastille de marque, liseré des cartes "import"/méta, `role-pill` |
| Neutre | inchangé (`--paper #fafaf8`, `--surface #fff`, `--ink #14151a`, `--ink-soft #55565f`, `--ink-faint #8d8e95`, `--line #e3e3df`) | base — reste très majoritaire à l'écran |

Règle : la couleur marque un **rôle sémantique** (priorité = orange, info =
bleu, méta/spécial = magenta), jamais décorative au hasard.

## Layout & Spacing

- **Densité :** confortable (inchangée).
- **Coins :** 12px sur les cartes/tuiles (monté de 6px → 12px pour ce pass,
  plus doux) ; boutons/pills gardent un rayon plus petit (4-6px, inchangé).
- **Ombres :** réintroduites, mais discrètes et seulement au survol —
  `0 14px 32px -12px rgba(20,21,26,0.16)` sur les cartes, avec une légère
  élévation (`translateY(-2px)` à `-3px`). Pas d'ombre à l'état statique
  (repos = toujours un simple liseré, comme avant).

## Typographie

- Arial partout (inchangé — décision déjà actée dans une session précédente).
- Un chiffre "héros" par écran peut utiliser un dégradé texte
  (`background: linear-gradient(90deg, #E05010, #901080)` +
  `background-clip: text` + `color: transparent`) — réservé au chiffre le
  plus actionnable de l'écran, jamais plusieurs à la fois.

## Motifs de marque

- **Pastille "caméléon"** : petit carré à coins arrondis (10px radius),
  `conic-gradient(from 200deg, #E05010, #E00070, #901080, #1090D0, #E05010)`,
  à côté des titres de page (`<h1>`) — clin d'œil discret au logo sans le
  reprendre littéralement.
- **Halo d'en-tête** : `radial-gradient` très doux (orange/magenta/bleu à
  8-14% d'opacité, flouté), positionné derrière le titre de page, jamais
  sur tout le fond.
- **Nav active** : soulignement en dégradé (`border-image` orange→magenta)
  plutôt qu'un aplat.
- **`role-pill`** : fond dégradé léger (orange clair → magenta clair), texte
  magenta gras.

## Interaction / Motion

- Cartes et tuiles : transition `0.15-0.18s ease` sur `transform`,
  `box-shadow`, `border-color` au survol (translateY + ombre qui apparaît).
- Barres de répartition (priorité, etc.) : segments en dégradé
  (`linear-gradient(90deg, ...)`), `filter: brightness(1.08)` au survol.
- Respecter `prefers-reduced-motion` partout où une animation est ajoutée
  (déjà fait dans le Design Lab pour le compte-à-rebours des chiffres —
  motif à reprendre si des chiffres animés sont généralisés ailleurs).

## Repo Conventions

- CSS via custom properties dans `apps/web/src/styles/global.css` — pas de
  Tailwind, pas de CSS-in-JS. Nouveaux tokens à ajouter dans `:root` (et son
  bloc `@media (prefers-color-scheme: dark)` — dark mode non retouché dans
  ce pass, mais ne doit pas casser).
- Composants partagés existants à réutiliser : `.btn`/`.btn-primary`,
  `.card-block`, `.stat-tile`, `.pill`/`.score-tier`, `.table-wrap`,
  `.page-head`, `.topbar`/`.nav-tabs`.
- Vite + React SPA, pas de routeur (App.tsx bascule les vues par état).

---

*Généré par le skill design-lab, à partir du Dashboard (page représentative
du système partagé). Référence pour l'implémentation avec `impeccable`.*

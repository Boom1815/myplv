# Design Implementation Plan : plateforme myPLV (refonte visuelle)

## Summary

- **Scope :** système de design partagé + toutes les pages de l'app
  (`apps/web`).
- **Cible représentative testée :** `apps/web/src/pages/Dashboard.tsx`.
- **Variante gagnante :** E — Expressif (voir `DESIGN_MEMORY.md` pour les
  tokens exacts).
- **Amélioration clé :** palette dérivée du logo (orange/bleu/magenta) posée
  comme accents sémantiques (rôle, pas décoration), cartes avec liseré coloré
  + légère élévation au survol, halo dégradé discret en en-tête, pastille de
  marque en dégradé, mouvement dosé (transitions courtes, respect de
  `prefers-reduced-motion`).

## Files to Change — état réel après implémentation

- [x] `apps/web/src/styles/global.css` — tokens (`--accent` devient l'orange
      primaire, `--accent-2` bleu, `--accent-3` magenta, avec variantes
      `-ink`/`-soft` calibrées ≥4.5:1), `--radius-lg` 6px→12px, hover-lift
      sur `.stat-tile`/`.campaign-card`/`.card-block--lift` (bordure+
      déplacement, jamais d'ombre ajoutée — voir note "ghost card"
      ci-dessous), modificateurs `.card-block--tier/--info/--meta` (liseré
      1px, pas 3px comme envisagé dans le lab), nav active en dégradé,
      `role-pill` en dégradé, halo `.page-head--hero`/`.login-screen::before`
      + pastille `.brand-mark`, `.stat-value--accent` (texte dégradé, un
      seul chiffre par écran).
- [x] `apps/web/src/pages/Dashboard.tsx` — halo + pastille, 3 cartes avec
      liseré par rôle + hover-lift, chiffre héros (éligibles email) en
      dégradé.
- [x] `apps/web/src/pages/Login.tsx` — halo + pastille sur l'écran de
      connexion.
- [x] `apps/web/src/App.tsx` — **aucune modif nécessaire** : nav/role-pill
      consomment déjà les classes globales, le changement de token suffit.
- [x] `apps/web/src/pages/Prospects.tsx`, `Scoring.tsx`, `Blacklist.tsx`,
      `Sectors.tsx`, `GeographicZones.tsx`, `Offers.tsx`,
      `EmailTemplates.tsx`, `Campaigns.tsx` — **aucune modif nécessaire**,
      vérifié : zéro couleur en dur dans ces fichiers (audité par grep),
      tout passe par les primitives partagées (`.card-block`, `.pill`,
      `.score-tier`, `.btn`, `.filters`, `.table-wrap`) qui héritent
      automatiquement du nouveau système de tokens. Confirmé visuellement
      (captures Prospects + Campagnes) : cohérent, rien de cassé.

### Écart assumé avec le Design Lab (jugement de craft, pas un oubli)

- **Liseré coloré des cartes : 1px, pas 3px.** Le lab utilisait 3px ; la
  charte qualité `impeccable` bannit les bordures colorées au-delà de 1px
  (`craft-floor.md`, "Refuse"). L'esprit (une couleur de rôle sur l'arête)
  est conservé, l'épaisseur resserrée.
- **Aucune ombre ajoutée au survol.** Le mock du lab empilait une ombre
  large sur la bordure existante ("ghost card", banni). L'élévation au
  survol passe uniquement par un déplacement (`translateY`) + un
  assombrissement de la bordure — cohérent avec `--shadow: none` déjà
  posé dans le pass précédent.
- **Barre de répartition par priorité inchangée** (dégradé à deux teintes
  du lab non repris) : le code existant encode le score comme une
  magnitude ordonnée (une seule teinte, opacité dégressive), pas des
  catégories indépendantes — passer à deux familles de teintes aurait
  réintroduit une lecture catégorielle trompeuse. Le changement de ton
  (bleu → orange) s'applique automatiquement via le token, le principe
  reste intact.
- **Halo + pastille de marque réservés à Dashboard et Connexion**, pas
  répétés sur chaque écran — un geste délibéré vaut mieux qu'un tampon
  identique partout (`craft-floor.md`).

## Implementation Steps

1. **Tokens d'abord** : étendre `global.css` (`:root` + bloc dark) avec les
   accents secondaire/tertiaire, sans casser `--accent` existant (garder un
   fallback cohérent pour tout ce qui n'est pas retouché dans ce pass).
2. **Primitives partagées** : `.card-block`, `.stat-tile`, `.campaign-card`
   → coins 12px, hover avec élévation, liseré coloré paramétrable par rôle
   (classe modificateur, ex. `.card-block--tier`, `.card-block--info`,
   `.card-block--meta`).
3. **Nav + topbar** (`App.tsx`) : soulignement actif en dégradé, `role-pill`
   en dégradé léger.
4. **Dashboard** : halo + pastille de marque en en-tête, chiffre héros en
   dégradé texte (le plus actionnable — éligibles email), barres de
   répartition en dégradé.
5. **Autres pages**, une par une, en réutilisant les primitives déjà posées
   à l'étape 2-3 (peu ou pas de CSS nouveau attendu au-delà de ce point).
6. **Vérification** : build + typecheck après chaque page, captures avant/
   après pour les 2-3 pages les plus visitées (Dashboard, Prospects,
   Campagnes), vérifier le mode sombre ne casse pas (non prioritaire mais
   ne doit pas être cassé).

## Required UI States

- **Hover** : élévation + liseré/ombre sur cartes et tuiles (nouveau).
- **Focus** : inchangé (déjà géré par le pass minimaliste précédent).
- **Empty/Loading/Error** : inchangés dans leur logique, juste l'habillage
  visuel des conteneurs qui les entourent.

## Accessibility Checklist

- [ ] Contraste texte sur fond dégradé texte (héros) reste ≥ 4.5:1 sur son
      point le plus clair.
- [ ] Le halo décoratif reste `pointer-events: none` et ne gêne jamais le
      clavier/lecteur d'écran (purement visuel).
- [ ] Animations respectent `prefers-reduced-motion: reduce`.
- [ ] Focus visible inchangé/vérifié sur les nouveaux éléments interactifs
      (cartes hover ne doivent pas remplacer le focus clavier).

## Design Tokens (nouveaux, dans `global.css`)

```css
--accent-2: #1090d0;      /* bleu — info/secondaire */
--accent-2-ink: #0a5a86;
--accent-3: #901080;      /* magenta — méta/spécial */
--accent-3-ink: #6a0c5f;
--radius-card: 12px;       /* remplace --radius-lg pour les cartes */
```

---

*Généré par le skill design-lab, à partir du feedback validé sur la
Variante E. Implémentation confiée au skill `impeccable`.*

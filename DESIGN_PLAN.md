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

## Files to Change

- [ ] `apps/web/src/styles/global.css` — tokens (`--accent-2`, `--accent-3`
      pour bleu/magenta), coins de carte 12px, styles de survol/élévation,
      halo/pastille génériques, dégradés de barres/pills.
- [ ] `apps/web/src/App.tsx` — nav active en dégradé, `role-pill` en dégradé.
- [ ] `apps/web/src/pages/Dashboard.tsx` — halo + pastille en en-tête, cartes
      avec liseré par rôle, chiffre héros en dégradé texte.
- [ ] `apps/web/src/pages/Prospects.tsx` — cartes/filtres, badges de score.
- [ ] `apps/web/src/pages/Scoring.tsx`
- [ ] `apps/web/src/pages/Blacklist.tsx`
- [ ] `apps/web/src/pages/Sectors.tsx`
- [ ] `apps/web/src/pages/GeographicZones.tsx`
- [ ] `apps/web/src/pages/Offers.tsx`
- [ ] `apps/web/src/pages/EmailTemplates.tsx` — cohérence avec l'éditeur de
      blocs déjà en place (ne pas retoucher l'éditeur lui-même, juste
      l'habillage de la page).
- [ ] `apps/web/src/pages/Campaigns.tsx` — pills de statut en dégradé sobre.
- [ ] `apps/web/src/pages/Login.tsx` — halo + pastille sur l'écran de connexion.
- [ ] `apps/web/src/components/InfoTooltip.tsx` — vérifier cohérence visuelle
      (pas de changement de fond attendu).

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

# Consignes du projet

- Écrire les interfaces et les explications en français avec accents. Expliquer simplement, pour un débutant.
- Préserver les modifications existantes : commencer par `git status --short`, ne pas rétablir des fichiers sans raison.
- Économiser le contexte : chercher avec `rg -n` dans le dossier concerné, puis lire seulement les passages utiles. Élargir si nécessaire. Ne pas charger tout le dépôt ou tout le README par défaut.
- Ne pas lire par défaut `artifacts/`, `dist/`, `assets/`, `visual_codex/`, `codex_visual_overhaul_pack_v2/`, les ZIP, les anciens `GUIDE_*`, `JALON_*` et `VALIDATION_*`. Les ouvrir uniquement si la tâche le nécessite. `.rgignore` filtre les recherches courantes ; `rg --no-ignore chemin` permet une recherche explicite.
- Ne pas lire les bibliothèques `src/vendor/*.js` ni tout `visual-manifest.js` pour une modification sans rapport. Chercher un symbole précis au besoin.
- Pas de reformatage global, de dépendance ou de refonte hors sujet. Garder le code lisible.

## Où chercher

| Besoin | Point d'entrée |
|---|---|
| Démarrage, boucle du jeu | `src/main.js` |
| Menus, affichage, tactile, styles | `src/presentation/`, `src/style.css`, `index.html` |
| Règles, IA, combat, économie, élections | `src/simulation/` |
| Multijoueur, QR | `src/network/`, `src/presentation/multiplayer.js`, `src/presentation/qr-pairing.js`, `scripts/multiplayer-server.mjs` |
| Équilibrage, carte, bâtiments, événements | les cinq JSON chargés par `src/config.js` dans `Présidentielles 2027/` |
| Visuels | `src/presentation/visual-manifest.js`, registre `visual_codex/generated_asset_registry.json` ; instructions de production seulement pour créer des visuels |
| Export web / futur mobile | `scripts/build-pages.mjs`, `test/pages.test.js` |

## Vérifier et livrer

- Node >= 24, modules JavaScript natifs, sans installation nécessaire actuellement. `npm start` lance le jeu.
- Lancer d'abord le test concerné : `node --test test/<nom>.test.js`. Pour une modification transversale : `npm test`. Les validations de parcours sont dans `package.json`.
- Pour l'export : `npm run build`. Seul `dist/` est destiné à être embarqué ; ne jamais y corriger les sources. Conserver les licences tierces.
- Résumer le résultat, les vérifications et les limites en quelques phrases. Ne pas recopier les logs réussis ni les fichiers entiers.
- Détails sur le contexte et le paquet mobile : `docs/optimisation-projet.md`, seulement pour ce sujet.

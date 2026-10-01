# Consignes du projet

- Écrire les interfaces et les explications en français avec accents. Expliquer simplement, pour un débutant.
- Préserver les modifications existantes : commencer par `git status --short`, ne pas rétablir des fichiers sans raison.
- Économiser le contexte : chercher avec `rg -n` dans le dossier concerné, puis lire seulement les passages utiles. Élargir si nécessaire. Ne pas charger tout le dépôt ou tout le README par défaut.
- Ne pas lire par défaut `artifacts/`, `dist/`, `assets/`, `.cache/`, `android/app/build/`. Les ouvrir uniquement si la tâche le nécessite. `.rgignore` filtre les recherches courantes ; `rg --no-ignore chemin` permet une recherche explicite.
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
| Visuels | `src/presentation/visual-manifest.js` ; originaux dans `assets/generated/masters/` |
| Export web, application Android | `scripts/build-pages.mjs` (WebP sans perte), `scripts/android.mjs`, `android/LISEZMOI.md`, `test/pages.test.js` |

## Vérifier et livrer

- Node >= 24, modules JavaScript natifs, sans installation nécessaire actuellement. `npm start` lance le jeu.
- Lancer d'abord le test concerné : `node --test test/<nom>.test.js`. Pour une modification transversale : `npm test`. Les validations de parcours sont dans `package.json`.
- Pour l'export : `npm run build` (web) ou `npm run android` (application). Seul `dist/` est embarqué ; ne jamais y corriger les sources. Conserver les licences tierces. Une nouvelle image doit être référencée par un chemin littéral `assets/generated/…png`.
- Résumer le résultat, les vérifications et les limites en quelques phrases. Ne pas recopier les logs réussis ni les fichiers entiers.
- Détails sur le contexte et le paquet mobile : `docs/optimisation-projet.md`, seulement pour ce sujet.

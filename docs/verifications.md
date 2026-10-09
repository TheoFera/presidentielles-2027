# Vérifications et débogage

## Tests automatiques

```bash
npm test
```

`npm test` lance la suite principale (`test/*.test.js`, liste dans `package.json`). Elle tourne aussi sur GitHub avant chaque publication du site. Pour une modification ciblée, lancer d'abord le test concerné, par exemple :

```bash
node --test test/carte-plate.test.js
```

| Commande | Contenu |
|---|---|
| `npm run test:ia` | intelligence artificielle |
| `npm run test:multijoueur` | salons, invitations, synchronisation |
| `npm run test:comptes` | comptes PartageTonJeu |
| `npm run test:pubs` | règles des publicités |
| `npm run test:styles` | styles de campagne et ultimes |
| `npm run test:combat-mobile` | combat, commandes tactiles et clavier |
| `npm run test:campagne` | campagnes complètes jouées par l'ordinateur |
| `npm run test:performance-multi` | coût de préparation des messages multijoueur |

`test/carte-plate.test.js`, `test/npc-entry.test.js` et `test/player-titles.test.js` ne sont pas dans `npm test` : les lancer à part après une modification de la carte, de l'arrivée des habitants ou des titres.

## Contrôles dans un vrai navigateur

Les scripts de `scripts/verifications/` pilotent Chrome avec Playwright pour vérifier l'affichage réel (captures et rapports écrits dans `artifacts/`, dossier ignoré par Git). Ils n'ajoutent aucune dépendance au jeu :

1. Lancer le jeu (`npm start`).
2. Définir `CAMPAIGN_TEST_NODE_MODULES` vers un dossier `node_modules` qui contient Playwright, et au besoin `CAMPAIGN_TEST_URL` (adresse du jeu, par défaut <http://localhost:2027>).
3. Lancer le script voulu, par exemple `node scripts/verifications/validate-start-menu-browser.mjs`.

| Script | Ce qu'il vérifie |
|---|---|
| `validate-start-menu-browser.mjs`, `validate-illustrated-menus-browser.mjs` | menus, pause, aide, chargement, plein écran |
| `validate-candidate-selection-browser.mjs`, `validate-debate-selection-browser.mjs` | choix des candidats (Campagne, Débat) |
| `validate-arcade-browser.mjs` | menus sur petits écrans et parties à 2 puis 3 navigateurs |
| `validate-qr-browser.mjs` | invitations par QR lues par des caméras simulées |
| `validate-combat-actions-browser.mjs`, `validate-mobile-combat-browser.mjs` | combat, commandes tactiles et clavier |
| `validate-damage-feedback-browser.mjs` | bord rouge des dégâts reçus |
| `validate-styles-browser.mjs`, `validate-wave-browser.mjs` | cartes de styles et ultimes |
| `validate-debate-arenas-browser.mjs` | plateaux du Débat télé |
| `validate-election-browser.mjs` | soirée électorale et résultats |
| `validate-map-wheel-browser.mjs` | roue de la carte et HUD |
| `validate-meeting-depth-browser.mjs` | ordre d'affichage de la foule des meetings |
| `validate-npc-affiliation-browser.mjs` | apparence des habitants selon leur camp |
| `validate-sprite-loading-browser.mjs` | chargement complet des images et nouvelle tentative |
| `validate-performance-browser.mjs`, `validate-mobile-render.mjs`, `profile-mobile-render.mjs` | rendu identique et mesures de fluidité |
| `validate-simulation-performance.mjs` | vitesse du calcul des votes et de l'argent, hors navigateur (`node scripts/verifications/validate-simulation-performance.mjs`) |

Pour le multijoueur sur une seule machine : `ARCADE_LOOPBACK_ICE=1` (réservé aux tests, il ne change rien au jeu) et `ARCADE_ONLY_NETWORK=1`.

Ces contrôles émulent les écrans tactiles sur ordinateur : ils ne remplacent pas un essai sur un vrai téléphone.

## Débogage en jeu

**F3** ouvre le panneau de débogage (`src/presentation/debogage/debug.js`) : forcer le premier tour et le second tour, chrono à 10 secondes, égalité, 50 % de Neutres, ajout d'influence, construction de bâtiments électoraux, apparition d'unités, réglages des esquives et de l'ultime. Quand le panneau est ouvert : **K** remplit la jauge d'ultime, **F6** change la vitesse de la simulation.

Autres adresses utiles :

- `http://localhost:2027/?pub=simulation` : fausse publicité de 3 secondes à chaque fin de partie ([publicites.md](publicites.md)).
- `http://localhost:2027/?serveur-local` : multijoueur en ligne avec le serveur de salons lancé sur l'ordinateur ([multijoueur.md](multijoueur.md)).

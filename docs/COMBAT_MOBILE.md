# Jalon combat mobile — validation du 14 septembre 2026

Le combat existant et les neuf ultimes sont conservés. La simulation à 30 ticks/s valide les commandes ; la présentation affiche le résultat. Le temps du navigateur sert uniquement à reconnaître les doubles appuis.

| Réglage | Valeur |
|---|---|
| Dash | 3,6 unités ; durée configurée 0,24 s, arrondie à 8 ticks = 0,267 s |
| Invulnérabilité | 0,12 s configurée ; 4 ticks = 0,133 s, puis vulnérabilité pendant la fin du dash |
| Réserve cachée | 3 charges ; aucun indicateur hors débogage |
| Recharge | 1 charge toutes les 120 ticks = 4 s ; séquentielle, sans remettre la progression à zéro à chaque dash |
| Double appui | 300 ms ; relâchement obligatoire ; maintien et répétitions ignorés |
| Charge d’ultime | 1 / 1 / 2 unités sur les coups normaux 1 / 2 / 3 ; seuil conservé à 10 |
| Décharge | Stable 300 ticks = 10 s après un coup réussi ; diminution linéaire pendant 150 ticks = 5 s |
| Finisher conservé | 14 dégâts de résistance ; recul 4,8 u/s contre 2,2 u/s pour les coups légers ; hitstop 0,08 s configuré, soit 3 ticks |

Le bouton Ultime se trouve immédiatement à gauche de Frapper, avec la même forme et la même hauteur. Il est invisible à zéro, se remplit de gauche à droite, pulse lorsqu’il est plein et consomme la charge sur activation manuelle. Il se vide de droite à gauche pendant la décharge. Les neuf styles passent par cette commande explicite.

Bardella doit être armé avec Ultime : une charge pleine seule ne protège pas du KO. Une fois armé, sa protection reste disponible après 30 secondes et après la disparition de la jauge. Elle est consommée à la relève et annulée au changement de style ou lors des réinitialisations du combat. Un petit texte indique la protection. Les dégâts des pouvoirs, y compris les attaques sous forme Bardella, ne chargent pas l’ultime suivant.

## Contrôles

- Mobile : flèches gauche/droite ; double appui dans la même direction pour esquiver ; Frapper ; Ultime.
- Clavier : flèches ou A/Q/D pour marcher et esquiver ; Espace/J pour frapper ; R pour l’ultime. R est configurable dans `special_charge.ultimate_key` ; U conserve son raccourci de débogage existant.
- F3 ouvre le débogage ; K charge l’ultime lorsque ce panneau est ouvert. Les outils permettent de choisir 0/1/2/3 dashs, remplir les dashs, suspendre/reprendre leur recharge, vider l’ultime, forcer sa décharge, l’activer et armer/désarmer Bardella. La commande `DebugSetUltimateCharge` accepte également une valeur exacte.

## Vérifications

- `npm test` : 100 tests réussis.
- `npm run build` : version distribuable générée dans `dist/`.
- Chrome avec émulation tactile : les trois candidats et les neuf styles, activation réelle du bouton, remplissage à 60 %, état prêt, double appui tactile, maintien clavier, raccourcis K/R et décharge réelle après 10 à 15 secondes. Aucun événement d’erreur JavaScript.
- Captures inspectées en paysage 844 × 390 et portrait 390 × 844. Le jeu conserve sa recommandation d’orientation paysage.
- Simulation : recharge à la tick près, dégâts pendant/après l’invulnérabilité, limites de l’arène, restrictions, combo, interruptions de décharge, sauvegarde/reprise déterministe, cibles alliées/adverses, invocation configurable, feu persistant, traversée de Super Européiste et cas Bardella.
- Rapport navigateur : `artifacts/mobile-combat/report.json`. Captures dans le même dossier.
- Il s’agit de tests navigateur avec émulation tactile ; le ressenti sur un téléphone physique reste à tester personnellement.

## Fichiers modifiés par ce jalon

Les modifications qui étaient déjà présentes avant ce jalon ont été conservées.

- Configuration et intégration : `Présidentielles 2027/game_balance.json`, `src/config.js`, `package.json`, `index.html`, `src/main.js`.
- Simulation : `src/simulation/mobile-combat.js` (nouveau), `combat.js`, `combat-state.js`, `combat-snapshots.js`, `commands.js`, `controllers.js`, `game-simulation.js`, `arena-simulation.js`, `phases.js`, `sprint-ai.js`, `campaign-styles.js`, `style-ultimates.js`, `campaign-validation.js`, `match-lifecycle.js`.
- Présentation : `src/presentation/input.js`, `illustrated-ui.css`, `combat-effects.js`, `combat-report.js`, `debug.js`, `campaign-styles.js`.
- Validation : `test/mobile-combat.test.js` (nouveau), `test/browser-input.test.js`, `test/campaign-styles.test.js`, `scripts/validate-mobile-combat-browser.mjs` (nouveau), `scripts/validate-styles-browser.mjs`.
- Rapport : `docs/COMBAT_MOBILE.md` ; résultats et captures dans `artifacts/` ; sortie du build dans `dist/`.

Tous les réglages de ce jalon sont dans `game_balance.json`, sections `dash`, `special_charge` et `candidate_combat`.

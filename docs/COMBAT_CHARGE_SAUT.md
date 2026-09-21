# Combat : charge, saut et ultime — 21 septembre 2026

## Commandes

- Espace/J : appuyer puis relâcher pour le prochain coup du combo. Maintenir pour préparer une attaque chargée, puis relâcher pour la lancer.
- Flèche ↑ : sauter. Déplacement et coups normaux possibles en vol ; aucun dash aérien ni double saut.
- Double appui gauche/droite : dash, qui annule une charge s’il est disponible.
- R : ultime à pleine jauge, prioritaire sur attaque, charge, dash, recul et interaction ; seul l’étourdissement le bloque, en plus des restrictions propres au pouvoir et du KO. La trajectoire du saut continue.
- Sur écran tactile : Sauter à gauche de Frapper, Ultime au-dessus. Le bouton Ultime montre le remplissage. Les étoiles de disponibilité ont été supprimées.

## Réglages actuels

Les valeurs sont dans `Présidentielles 2027/game_balance.json`, section `candidate_combat`. Les deux ajustements de l’utilisateur sont conservés : charge en **1 seconde** et hauteur du saut de **1 personnage**.

| Réglage | Valeur |
|---|---:|
| Début de l’immobilisation et de la protection | 0,2 s de maintien |
| Charge prête, comptée depuis l’appui | 1 s |
| Dégâts chargés, campagne / arène | 21 / 1,65 |
| Étourdissement léger / chargé | 0,20 s / 0,30 s |
| Saut : hauteur / durée | 1 hauteur / 0,8 s |
| Recul initial du troisième coup | 18 unités/s |

Une charge prête se maintient sans limite. Les dégâts restent reçus pendant sa protection ; seuls un troisième coup adverse ou un KO l’interrompent. Le coup chargé ne repousse pas et rend deux points d’ultime lorsqu’il touche. Sa récupération est vulnérable.

Les collisions tiennent compte de la hauteur : sauter évite les coups bas et les bulles qui passent dessous. Avec la hauteur actuelle de 1, la vague de 1,65 hauteur reste dangereuse au sommet du saut. Une brûlure déjà appliquée continue en l’air.

Les durées et hauteurs sont calculées par la simulation, à 30 mises à jour par seconde. L’aide et les tests de seuil suivent les réglages, au lieu de dépendre des premières valeurs de 1,5 seconde et 1,8 hauteur.

## Validation

- Tests de charge, protection, interruption, dash, saut, collisions, brûlures, neuf ultimes, commandes clavier/tactiles, IA, sauvegarde et échanges réseau.
- Chrome avec émulation tactile : commandes en paysage et portrait, maintien clavier et tactile, dash annulant la charge, saut avec attaque, R pendant la charge, annulation tactile. Rapports dans `artifacts/combat-actions/` et `artifacts/mobile-combat/`.
- La suite historique `test/combat.test.js`, exclue de `npm test`, présente 13 échecs déjà présents avant cette évolution (anciens bâtiments et activation automatique des pouvoirs). Vérification comparative conservée dans `artifacts/combat-legacy-baseline.txt`.
- Sauvegardes au format 9. Comme auparavant, une sauvegarde créée avec des réglages différents est refusée ; après modification du fichier de réglages, démarrer une nouvelle partie.

Commandes de vérification : `npm test`, `npm run test:combat-mobile`, `npm run build`. Les scripts navigateur utilisent `CAMPAIGN_TEST_NODE_MODULES` pour Playwright et `CAMPAIGN_TEST_URL` pour le serveur local.

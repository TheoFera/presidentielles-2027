# Carte fixe, véhicules et rassemblements

Les 18 sous-zones ont maintenant chacune un bâtiment qui donne le contrôle à son propriétaire. Les votes continuent de déterminer le résultat électoral. Posséder le bâtiment protège les sympathisants et militants de son camp dans cette sous-zone : leur résistance équivaut à 50 % de points de vie supplémentaires. Convaincre un neutre y prend 60 % de temps supplémentaire pour les adversaires.

## Implantation retenue

Certaines cellules du tableau fourni étaient décalées. La croix indique la place de meeting au centre du biome ; les bâtiments indiqués à sa suite sont les bâtiments de contrôle. Voici l’implantation appliquée, de gauche à droite.

| Biome | Sous-zone A | Sous-zone B | Sous-zone C | Bâtiments secondaires |
| --- | --- | --- | --- | --- |
| Paris | Permanence | Garage à vélo | Permanence | Mécène dans B |
| Banlieue | Rédaction associative | Permanence | Local SO | Institut de sondage dans A |
| Périurbain | Permanence | Garage à scooter | Permanence | Financement russe dans B |
| Campagne | Garage à scooter agricole | Permanence | Local SO | Aucun |
| Retraités | Permanence | Rédaction conservatrice | Permanence | Mécène et institut dans B |
| Quartiers riches | Rédaction nationale | Permanence | Cabinet | Institut de sondage dans C |

Chaque biome possède aussi une place de meeting dans sa sous-zone B, exactement au centre. Les implantations ne changent plus avec la graine de la partie. Les noms des autres candidats du tableau sont conservés dans les métadonnées de la carte ; cette évolution ne crée pas de nouveaux candidats jouables.

## Permanences et déplacements

La permanence reçoit les dons des sympathisants de son camp. Le candidat récupère la cagnotte en passant. Elle distribue également les tracts, puisque le tableau ne prévoit plus d’imprimerie séparée. Une commande est effectuée par passage pour éviter les achats répétés lorsque l’on s’arrête au QG. Les trois financements privés secondaires restent des mécènes distincts : ils versent 500 € toutes les 30 secondes à leur bâtiment, sans détourner les dons des PNJ.

Une fois un garage acheté, rester immobile devant lui pendant 2,5 secondes fournit le véhicule. Le vélo multiplie la vitesse par 1,65 ; le scooter par 2,1. Un déplacement avant la fin de l’attente remet le compteur à zéro. Sauter, frapper, effectuer un dash, activer l’ultime, changer de style ou recevoir un coup fait disparaître le véhicule. Une nouvelle attente au garage permet d’en obtenir un autre.

## Marches

Le rassemblement est la seule famille d’événements disponible. Les six variantes reprennent les motifs du tableau. Environ 94 % des PNJ présents dans le biome rejoignent le centre d’une sous-zone extérieure, puis traversent ensemble jusqu’au centre de l’autre. Le sens varie. Les déplacements sont continus, sans téléportation, avec plusieurs rangs et de petits décalages entre les marcheurs.

Pendant le rassemblement et la marche, passer près d’un neutre ou d’un sympathisant adverse le convainc en environ 0,12 seconde. Une protection de deux secondes évite les changements de camp à chaque instant lorsque deux candidats se croisent. Les militants ne changent pas de camp par ce mécanisme. Après la marche, les participants reviennent près de leur point d’apparition initial, puis reprennent leurs activités.

## Décor et fichiers

Les six panoramas et les vélos, scooters et candidats montés sont dans `assets/generated/world-v2/`. Ils ont été produits avec l’outil ImageGen intégré, à partir du style des personnages existants. Les prompts initiaux sont conservés dans `docs/production/monde-fixe-prompts.json` et `docs/production/vehicules-prompts.json`. Le registre des visuels conserve les fichiers sources finaux. Les retouches ont notamment déplacé les boutiques utiles, distingué les rédactions des pharmacies et élargi les espaces transparents entre les poses.

Les bâtiments sont peints dans le décor. Le jeu ajoute leurs enseignes et leurs fanions. Les coordonnées des portes et enseignes sont dans `Présidentielles 2027/world_layout.json`. Les proportions et la ligne du sol de chaque panorama sont dans `src/presentation/fixed-world-data.js`.

Chaque image est dessinée avec une seule échelle pour ses deux dimensions. La hauteur de la fenêtre de jeu s’adapte au format réel de l’écran. Un recouvrement aux limites de biome conserve une image opaque sous le fondu ; la jonction Quartiers riches → Paris utilise exactement le même mécanisme. Il n’y a aucune coupure d’image entre les trois sous-zones d’un biome.

## Vérifications

`npm test` couvre les règles, les sauvegardes et les échanges de simulation. `npm run build` prépare l’export web. `scripts/validate-fixed-world-browser.mjs` contrôle le rendu réel dans Chrome : les 18 centres, les 18 raccords, la fermeture de la boucle, les 26 poses montées, le démarrage depuis le menu et plusieurs formats d’écran. Les captures et le rapport sont enregistrés dans `artifacts/world-v2/browser/`.

Pour lancer ce contrôle visuel, démarrer le jeu avec `npm start`, puis fournir `CAMPAIGN_TEST_NODE_MODULES` pointant vers un dossier `node_modules` contenant Playwright. Il n’ajoute pas de dépendance au jeu. Le navigateur vérifie aussi que les échelles horizontale et verticale sont identiques.

Les sauvegardes de l’ancienne carte sont incompatibles : commencer une nouvelle partie. La validation sur un navigateur mobile simulé ne remplace pas un essai sur téléphone physique.

Vérification du 28 septembre 2026 : 294 tests réussis, export construit, six campagnes automatiques terminées (trois avec rassemblements et trois témoins), 322 ressources visuelles chargées sans erreur dans Chrome. Les formats 844 × 390, 1920 × 720 et 390 × 844 conservent la même échelle sur les deux axes. Les rendus aux positions 0 et longueur totale de la carte sont identiques.

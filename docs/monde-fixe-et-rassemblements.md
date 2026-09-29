# Carte fixe, véhicules et rassemblements

Les 18 sous-zones ont maintenant chacune un bâtiment qui donne le contrôle à son propriétaire. Les votes continuent de déterminer le résultat électoral. Posséder le bâtiment protège les sympathisants et militants de son camp dans cette sous-zone : leur résistance équivaut à 50 % de points de vie supplémentaires. Convaincre un neutre y prend 60 % de temps supplémentaire pour les adversaires.

## Implantation retenue

Certaines cellules du tableau fourni étaient décalées. La croix indique la place de meeting au centre du biome ; les bâtiments indiqués à sa suite sont les bâtiments de contrôle. Voici l’implantation appliquée, de gauche à droite.

| Biome | Sous-zone A | Sous-zone B | Sous-zone C | Bâtiments secondaires |
| --- | --- | --- | --- | --- |
| Paris | Permanence | Garage à vélo | Permanence | Institut de sondage dans C (canal Saint-Martin) |
| Banlieue | Rédaction associative | Permanence | Local SO | Aucun |
| Périurbain | Permanence | Garage à scooter | Permanence | Aucun |
| Campagne | Garage à scooter agricole | Permanence | Local SO | Aucun |
| Retraités | Permanence | Rédaction conservatrice | Permanence | Institut de sondage dans B |
| Quartiers riches | Rédaction nationale | Permanence | Cabinet | Institut de sondage dans C |

Chaque biome possède aussi une place de meeting dans sa sous-zone B, exactement au centre. Les implantations ne changent plus avec la graine de la partie. Les noms des autres candidats du tableau sont conservés dans les métadonnées de la carte ; cette évolution ne crée pas de nouveaux candidats jouables.

## Permanences et déplacements

La permanence reçoit les dons des sympathisants de son camp. Le candidat récupère la cagnotte en passant. Elle distribue également les tracts, puisque le tableau ne prévoit plus d’imprimerie séparée. Une commande est effectuée par passage pour éviter les achats répétés lorsque l’on s’arrête au QG.

Une fois un garage acheté, rester immobile devant lui pendant 2,5 secondes fournit le véhicule. Le vélo multiplie la vitesse par 1,65 ; le scooter par 2,1. Un déplacement avant la fin de l’attente remet le compteur à zéro. Sauter, frapper, effectuer un dash, activer l’ultime, changer de style ou recevoir un coup fait disparaître le véhicule. Une nouvelle attente au garage permet d’en obtenir un autre.

## Marches

Le rassemblement est la seule famille d’événements disponible. Les six variantes reprennent les motifs du tableau. Environ 94 % des PNJ présents dans le biome rejoignent le centre d’une sous-zone extérieure, puis traversent ensemble jusqu’au centre de l’autre. Le sens varie. Les déplacements sont continus, sans téléportation, avec plusieurs rangs et de petits décalages entre les marcheurs.

Pendant le rassemblement et la marche, passer près d’un neutre ou d’un sympathisant adverse le convainc en environ 0,12 seconde. Une protection de deux secondes évite les changements de camp à chaque instant lorsque deux candidats se croisent. Les militants ne changent pas de camp par ce mécanisme. Après la marche, les participants reviennent près de leur point d’apparition initial, puis reprennent leurs activités.

## Financiers occultes

La colonne « Évènements » du tableau désigne trois personnages, et non des bâtiments : l’entrepreneur du numérique (Paris B), l’intermédiaire russe (Périurbain B) et le magnat des médias (Retraités B). Un financier apparaît seulement si le candidat :

- fait partie des candidats autorisés : Mélenchon ou Philippe pour le numérique, Mélenchon ou Le Pen pour l’intermédiaire russe, Le Pen ou Philippe pour les médias ;
- a moins de 1 000 € ;
- se trouve dans la sous-zone ;
- n’a aucun autre candidat à moins d’un écran.

Il n’est visible que pour ce candidat. Rester immobile 3 secondes devant lui signe le contrat : **20 000 €**. Chaque financier ne signe qu’**une seule fois par partie**, avec un seul candidat. Ensuite, il ne réapparaît plus pour personne. Il disparaît aussi dès qu’un témoin approche. Règles : `src/simulation/funding-encounters.js` ; affichage : `src/presentation/financiers.js` ; réglages : `funding_encounters` dans `game_balance.json`.

## Candidats mineurs

Six candidats mineurs sont présents dès le début :

| Candidat | Sous-zone et QG |
| --- | --- |
| Raphaël Glucksmann | Paris A |
| Fabien Roussel | Paris C |
| Nathalie Arthaud | Périurbain A |
| Nicolas Dupont-Aignan | Périurbain C |
| Bruno Retailleau | Retraités A |
| Gabriel Attal | Retraités C |

Leur QG est la permanence de leur sous-zone.

- **QG et zone** : le QG leur donne le contrôle de la zone. Il est imprenable tant qu’ils sont en campagne : aucun achat, raid ou fermeture n’est possible.
- **Déplacements** : ils restent dans leur sous-zone. Ils peuvent déborder de 3 unités chez les voisins.
- **Actions** : ils convainquent les neutres, jusqu’à 10 sympathisants à la fois. Ils combattent les candidats et les unités qui entrent chez eux, avec le même système de combat. Ils n’ont ni argent, ni dons, ni style de campagne, ni véhicule. Ils ne sont pas visés par les événements de campagne.
- **Défaite** : battus (K.-O.), ils ne reviennent pas. Leur QG redevient neutre et s’achète normalement. Leurs sympathisants restent les leurs jusqu’à être battus un par un. Frapper un mineur ne lui retire pas de voix.
- **Élection** : leurs voix comptent. Au premier tour, leurs scores sont affichés, et les pourcentages portent sur toutes les voix exprimées. Seuls les deux meilleurs candidats principaux se qualifient. Au second tour, les mineurs encore en course se retirent, et leurs électeurs redeviennent neutres (report libre).
- **IA des principaux** : elle ne cherche pas à conquérir le fief d’un mineur, mais s’y défend si elle y passe.
- **Réglages** : `minor_candidates` dans `game_balance.json`. Le réglage `enabled: false` sert aux tests de duels à trois.
- **Code** : règles dans `src/simulation/minor-candidates.js`, dessin provisoire dans `src/presentation/minor-characters.js`, planches ChatGPT à venir dans `docs/production/candidats-mineurs/PROMPTS.md`.

L’IA ne va voir un financier occulte que si un humain la distance nettement (réglage `ai_boost_threshold`).

## Décor

Le nouveau décor en couches est décrit dans `docs/production/decor-v3/LISEZMOI.md` : plans lointain, intermédiaire et rue, avant-plan, sol dessiné par le jeu, saisons. On y trouve aussi les maquettes, les prompts ChatGPT et le calage automatique. En attendant les images, les panoramas v2 restent affichés, coupés net à la limite de chaque biome, sans fondu. Les coordonnées de leurs enseignes sont dans `src/presentation/fixed-world-data.js`. La simulation ne contient plus aucune coordonnée de façade.

## Vérifications

`npm test` couvre les règles, les sauvegardes et les échanges de simulation. `npm run build` prépare l’export web. `scripts/validate-fixed-world-browser.mjs` contrôle le rendu réel dans Chrome : les 18 centres, les 18 raccords, la fermeture de la boucle, les 26 poses montées, le démarrage depuis le menu et plusieurs formats d’écran. Les captures et le rapport sont enregistrés dans `artifacts/world-v2/browser/`.

Pour lancer ce contrôle visuel, démarrer le jeu avec `npm start`, puis fournir `CAMPAIGN_TEST_NODE_MODULES` pointant vers un dossier `node_modules` contenant Playwright. Il n’ajoute pas de dépendance au jeu. Le navigateur vérifie aussi que les échelles horizontale et verticale sont identiques.

Les sauvegardes de l’ancienne carte sont incompatibles : commencer une nouvelle partie. La validation sur un navigateur mobile simulé ne remplace pas un essai sur téléphone physique.

Vérification du 28 septembre 2026 : 294 tests réussis, export construit, six campagnes automatiques terminées (trois avec rassemblements et trois témoins), 322 ressources visuelles chargées sans erreur dans Chrome. Les formats 844 × 390, 1920 × 720 et 390 × 844 conservent la même échelle sur les deux axes. Les rendus aux positions 0 et longueur totale de la carte sont identiques.

Mise à jour du 29 septembre 2026 : les bâtiments de financement ont été retirés au profit des financiers occultes. Le fondu entre panoramas a été supprimé. Le moteur de décor en couches v3 est en place, avec maquettes, prompts et calage automatique. Le zoom de la caméra est inchangé : 0,65, cadrage 1,15.

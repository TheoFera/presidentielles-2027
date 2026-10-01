# Reprise du décor complet

Le précédent assemblage d'éléments isolés n'est pas validé. Les tests de configuration ne prouvent pas la qualité du décor. La quatrième carte conserve son entrée dans le jeu, mais sa production est reprise suivant les chapitres 14 et 16 du cahier des charges.

## Production à réaliser

- 36 demi-rues peintes (deux par sous-zone), conçues comme des quartiers complets : les bâtiments interactifs sont intégrés à leur rue.
- Pour chaque biome : horizon, lointain, intermédiaire et fond proche séparés. Les six transitions sont composées avec les quartiers de leurs deux côtés, y compris le retour Riches C → Paris A.
- Vue depuis le trottoir ; même facture que world-v2 ; aucun étirement, fondu de panoramas, texte peint ou véhicule décoratif.
- Positions des portes imposées par la simulation ; panneaux crème vierges ; accès dégagés ; estrades du jeu sur les places B.
- Échelle de livraison : 80 px par unité ; porte de 184 px ; étage de 168 px ; rez-de-chaussée commerçant de 256 px. Une demi-rue représente 12 unités, soit 960 px de largeur de référence. Le moteur conserve le zoom et le cadrage actuels.
- Végétation saisonnière sur des plans séparés pour permettre de vrais arbres nus, neige, feuilles et fleurs.

## Critères de validation dans le jeu

1. Examiner chaque centre de sous-zone et chaque raccord, à pied et en mouvement ; aucune coupure, bande de remplissage uniforme ou fragment flottant.
2. Vérifier les quatre saisons et les formats ordinateur, téléphone et tablette ; la porte et le personnage gardent la même proportion.
3. Examiner les cinq plans séparément et mesurer leur déplacement ; vérifier que les monuments restent dans leur territoire.
4. Vérifier les 21 portes interactives et les six places de meeting dans une partie jouable ; aucun obstacle visuel devant une porte ou un panneau.
5. Contrôler les 18 lignes du storyboard et tous les détails français obligatoires. Les photos du cahier des charges servent de références architecturales, en particulier Saint-Denis.
6. Exécuter les tests pertinents et l'export seulement après les contrôles visuels. Conserver les captures et les mesures avec leur version d'assets.

## État

En production : Paris A/B/C, Banlieue A/B/C et Périurbain A/B/C, soit 18 demi-rues intégrées sur les 36 attendues. Le premier Paris avait été rejeté (fondations coupées, toit trop grand, Sacré-Cœur mal entouré, premier plan trop vide). Les six rues ont été repeintes et densifiées ; Montmartre, marché, canal, mobilier et les deux transitions ont été recomposés. Les captures réelles `pilote-v4` et `pilote-v5`, téléphone et tablette compris, montrent cette reprise. Le déplacement local des plans est mesuré dans `pilote-v5/mouvement.json` ; les vitesses sont limitées aux frontières pour garder les monuments dans leur territoire. Aucun accord artistique final de l'utilisateur n'est supposé.

La banlieue a ses deux tours au premier plan, ses trois types de quartiers, un marché dégagé devant Saint-Denis et une mosquée moderne pour le fond de C. Son plan a été déplacé vers le jardin et relevé pour dégager la façade derrière les pavillons et la transition ; `banlieue-v4/05.png` et `37.png` montrent la composition d'été et d'hiver. Six variantes de rues d'hiver et les fonds principaux ont été intégrés. Le bord inférieur de la tour Aillaud est calé sur le trottoir, en excluant les 32 pixels de chaussée déjà peints dans la version d'été. Les captures `banlieue-v3` comprennent un contrôle d'hiver du quartier B.

Le périurbain a six rues, un entrepôt logistique derrière le lotissement, le rond-point et ses bâtiments en briques, les pâtures et la ville industrielle sous le massif. Le massif a été repeint avec des extrémités qui redescendent et abaissé dans le cadrage pour rendre son sommet entier. Quatre variantes de rues d'hiver sont produites ; les deux rues C et les fonds d'hiver restent à peindre. `periurbain-v2` montre le contrôle d'été ; les contrôles des raccords, saisons et formats se poursuivent dans `controle-v6`.

Campagne, Retraités et Riches utilisent encore l'ancien assemblage rejeté : leur production complète reste à faire. Les six gabarits et prompts de rues de campagne sont préparés aux coordonnées de la simulation. Aucune validation finale ni carte complète conforme n'est déclarée.

Limite externe rencontrée le 1er octobre 2026 : ImageGen renvoie `usage_limit_reached` (HTTP 429). Le service annonce un rétablissement le 2 octobre 2026 à 01 h 27, heure de Paris. Les prompts déjà préparés sont sauvegardés dans `PROMPTS-REPRISE.json`. Cette limite empêche les peintures restantes ; les contrôles et l'intégration des images reçues continuent.

Les nouvelles images sont conservées dans `assets/generated/france-peinte-complete/`. Le script `scripts/france-peinte-calibrate.mjs` mesure leur base et leur enseigne ; il ne change ni les images ni les coordonnées des sites. Le moteur aligne l'image entière avec la porte du jeu, sans étirement. Les captures du pilote sont dans `artifacts/france-peinte/reprise/`. Les fonds rejetés ne sont plus référencés par le manifeste de la version en production.

## Contrôles du 1er octobre 2026

La suite complète a terminé avec 398 tests réussis, aucun échec et un test ignoré, avant les dernières corrections de cadrage. Après ces corrections, les 11 tests ciblés de décor passent, dont le maintien du sommet entier après le zoom dans les trois formats.

Les dossiers `controle-v6` puis `controle-v7`, avec leurs variantes `-telephone` et `-tablette`, contiennent chacun 90 captures : centres, raccords et trois états saisonniers supplémentaires des 18 sous-zones. Les rapports ne signalent aucune erreur JavaScript. Ces captures incluent les biomes encore issus de l'ancien assemblage ; leur existence ne constitue donc pas une validation artistique de la carte.

L'examen visuel de `controle-v7-telephone/08.png` confirme le sommet entier, auparavant coupé dans ce format. La réduction éventuelle du massif conserve ses proportions et ne modifie pas le zoom des personnages, des portes ou des rues. La transition banlieue–périurbain est déplacée vers le jardin de C pour dégager les caravanes ; son ajustement final est conservé dans `controle-v8`.

## Préparation de la fin de carte pendant l'indisponibilité d'ImageGen

Douze gabarits de rues Retraités/Riches sont préparés dans `artifacts/france-peinte/reprise/guides/`, avec huit portes interactives aux coordonnées actuelles de la simulation. `fin-carte-geometrie.json` consigne le panneau attendu et le déplacement de l'image entière : deux portes proches du bord d'une demi-rue (Riches A et Riches C) nécessitent un recouvrement de jardin avec l'image voisine, sans déplacer le site du jeu. Ces gabarits sont des références géométriques, pas des décors intégrés ni des peintures terminées.

Les 22 photos utiles de la fin de carte sont extraites du cahier des charges ; leurs chemins sont dans `references/fin-carte.json`. Les 12 prompts de rues et les 33 prompts de plans séparés Campagne/Retraités/Riches sont enregistrés dans `PROMPTS-REPRISE.json`. `fonds-fin-carte.json` décrit les fonds et leurs variantes d'hiver à produire ensuite. Tous leurs chemins de référence ont été vérifiés ; aucune nouvelle peinture n'est déclarée produite.

Le tableau fourni par l'utilisateur prime lorsqu'il diffère du document : Riches A inclura un parc soigné visible, en plus du bois de Boulogne à la transition. Le panorama world-v2 de Retraités reste une référence de facture peinte ; ses façades haussmanniennes seront remplacées par les véritables pavillons, villas et galerie balnéaire des photos. Le cadrage des rues B laisse libre le centre pour les estrades du jeu.

Après le déplacement du fond de Banlieue C, les 11 tests ciblés passent. Les trois dossiers `banlieue-v4`, `banlieue-v4-telephone` et `banlieue-v4-tablette` contiennent chacun 39 captures sans erreur JavaScript. La façade a été examinée dans la vue d'été sur téléphone et dans la vue d'hiver sur tablette ; les captures conservent aussi le raccord avec les caravanes. La génération des peintures restantes est toujours empêchée par le quota confirmé précédemment ; aucune attente active ni génération en cours n'est annoncée.

## Blocage confirmé après trois reprises

Le 1er octobre 2026, après 14 h 50 heure de Paris, une nouvelle demande réelle pour la demi-rue Campagne A gauche a été refusée : HTTP 429, `usage_limit_reached`, `resets_at: 1790897219`. Le rétablissement annoncé demeure le 2 octobre à 01 h 27 heure de Paris. Aucune image n'a été produite par cette demande. Le même blocage est constaté sur trois tours de l'objectif ; les corrections et préparations indépendantes du service ont été réalisées pendant les deux premiers.

L'objectif est bloqué par cette limite externe, et reste inachevé : neuf sous-zones ont leurs rues repeintes, les neuf autres et plusieurs variantes d'hiver restent à produire et à vérifier. Aucun processus ImageGen ou de capture n'est annoncé en cours. À la reprise, produire les rues manquantes avec les prompts et gabarits sauvegardés, puis les plans séparés, les raccords et les saisons ; procéder enfin aux contrôles complets en partie jouable et à l'export. Ne pas reprendre les générations avant le rétablissement du service et ne pas assimiler les préparations à des visuels terminés.

# Quatrième décor : France peinte

**Ancienne note de livraison, invalidée par le contrôle visuel et les retours du joueur.** Les tests ci-dessous prouvaient le fonctionnement de la configuration, pas la conformité du décor complet. La production est reprise dans [REPRISE-CARTE-COMPLETE.md](REPRISE-CARTE-COMPLETE.md). Cette page décrit le premier essai et ne doit plus être utilisée comme déclaration de fin de travail.

Le décor `france_peinte` se choisit dans **Mon profil**, avec le pseudonyme `betatest`, comme les deux autres décors expérimentaux. L'ancien décor en couches reste le choix par défaut.

Pour le visiter sans lancer une partie :
`http://localhost:2027/src/presentation/world-v3/balade.html?decor=france_peinte`
Flèches : vitesse ; Espace : pause ; S : saison ; 1 à 6 : début d'un biome.

## Organisation

Les 18 sous-zones, les symboles de la roue, les fonctions des 27 sites et les candidats existants restent ceux de `world_layout.json`. Le décor compose ses 21 devantures autour des véritables coordonnées de la simulation. Les six estrades de meeting en bois sont toujours affichées par le jeu. Les places B restent libres de façades interactives entre 35 % et 65 %.

Les cinq corrections de coordonnées prescrites au chapitre 17 sont appliquées dans la configuration commune : Banlieue B 22 %, Périurbain B 20 %, Campagne B 22 %, Riches B 22 %, institut de Retraités B 80 %. La composition de la fresque dessinée a été adaptée aux mêmes corrections.

Les nouveaux fichiers peints sont dans `assets/generated/france-peinte/`. Aucun ancien panorama n'a été découpé. Les planches servent de réserves d'éléments transparents, assemblés en cinq plans : horizon, lointain, intermédiaire, fond proche et rue. Le ciel, la chaussée continue et quelques détails de mobilier restent gérés par le moteur. L'avant-plan défile plus vite que la rue. Toutes les images gardent leurs proportions. Les bâtiments portent un panneau dynamique avec leur fonction et la couleur de leur propriétaire.

La parallaxe est limitée à proximité du territoire de chaque élément, pour éviter de voir les Alpes en banlieue. Les arbres isolés utilisent une variante nue en hiver ; les pins restent verts. Le moteur ajoute la neige et applique les couleurs saisonnières aux autres éléments.

## Production des images et consignes de génération

Outil utilisé : **ImageGen intégré**, sans clé API ni installation. Référence de style jointe : `assets/generated/world-v2/panorama-bobo.png`. Les images sont nouvelles ; la référence sert uniquement au style.

Consigne commune : peinture cartoon chaude et détaillée, contours fins à l'encre, lumière douce de gauche, vue depuis le trottoir, végétation généreuse, vrai fond transparent. Un élément complet par cellule, aucun texte, nom de marque, personnage ou véhicule. Les façades interactives ont une porte centrale de taille humaine et un panneau crème vierge. Les vitrines montrent la fonction avec des pictogrammes. Les planches ont quatre colonnes et trois rangées ; leur découpe est calibrée dans `france-peinte.js`.

| Fichier | Éléments demandés, dans l'ordre des cellules |
| --- | --- |
| paris.png | Café et concept store ; commerces de bouche ; permanence ; atelier vélo sans vélo stationné ; institut ; canal et passerelle ; escalier ; kiosque ; fontaine Wallace ; marché rayé ; Sacré-Cœur ; toits parisiens. |
| banlieue.png | Tour ; barre ; média associatif ; permanence ; local SO ; pavillon dégradé ; silhouette de basilique (remplacée par le fichier corrigé) ; marché ; boulangerie ; pelouse de cité ; périphérique et Grands Moulins ; portail et camp sans véhicule. |
| periurbain.png | Usine ; entrepôt ; pavillon modeste ; permanence ; garage à scooter ; permanence de village ; sculpture de rond-point ; maisons de brique ; commerce ; jardin avec barbecue ; pré et vaches ; montagne (remplacée par le fichier corrigé). |
| campagne.png | Ferme maraîchère ; grange-atelier ; permanence ; local SO ; mairie avec drapeaux français et européen ; maison de village ; église ; blés ; serre ; monument aux morts ; village et bocage au loin ; éoliennes. |
| retraites.png | Pavillon et nain de jardin ; garagiste ; permanence ; média ; institut ; villa bourgeoise ; pharmacie et boutique de plage ; cabines ; boulodrome ; jardin de villa ; villa à tourelle ; côte. Les deux locaux de la station balnéaire ont été corrigés en résidences blanches à volets bleus et toit de tuiles, sans architecture haussmannienne. |
| riches.png | Demeure ; rédaction nationale ; permanence ; cabinet ; institut ; boutiques ; parc ; avenue en perspective ; kiosque ; tour Eiffel ; La Défense ; toits et métro aérien. |
| nature.png | Platane ; chêne ; pin ; peuplier ; haie ; colline bleutée ; bocage ; usines lointaines ; talus ; colline boisée ; lampadaire et banc ; fleurs. |

Consignes complémentaires des images isolées :

- `basilique.png` : façade gothique de Saint-Denis, rosace et portails ogivaux, tours carrées asymétriques ; aucun dôme du Sacré-Cœur.
- `montblanc.png` : massif alpin large, sommet central rocheux et glaciers ; relief qui redescend vers la même ligne de base aux deux extrémités ; aucune montagne coupée verticalement.
- `mer.png` : horizon marin large, mer calme et côte lointaine basse ; aucun ciel peint ni bateau, rocher de premier plan ou rectangle de panorama.
- `tour.png` : tour d'habitation très élancée, quatorze étages, balcon orange, local radio à son pied ; porte de taille humaine, panneau vierge ; très peu de végétation au pied pour garder les bonnes proportions.
- `hiver.png` : quatre arbres isolés en une rangée : platane nu, chêne nu, pin persistant, peuplier nu. Même style et mêmes essences que la planche de végétation.

## Portée et contrôle

Cette version utilise une composition d'éléments peints, plutôt que les 36 demi-rues prépeintes décrites comme méthode de production dans le document. Les noms Tondelier, Asselineau et de Villepin présents dans le tableau restent des métadonnées du monde : seuls les candidats déjà simulés ont un personnage et un QG.

Les proportions et les raccords se contrôlent avec le vrai moteur, pas uniquement sur les planches. Les captures sont conservées dans `artifacts/france-peinte/` : parcours complet, hiver, téléphone et tablette. Les bâtiments anciens des panoramas world-v2 restent peints à leurs anciennes coordonnées ; leurs images n'ont pas été retouchées par cette livraison. Leurs enseignes ne constituent donc pas une référence pour valider les cinq nouvelles positions.

Tests spécifiques : `node --test test/france-peinte.test.js test/map-decor.test.js test/fresque.test.js`. Vérification générale : `npm test`. Export : `npm run build`.

Validation de livraison : 361 tests réussis, aucune erreur JavaScript pendant les captures du parcours et de l'hiver. Le contrôle couvre aussi les formats téléphone et tablette. L'export final contient 657 fichiers et inclut les douze nouvelles images sources. Les captures finales du parcours et de l'hiver intègrent les derniers ajustements de la mer, des arbres et du mobilier parisien.

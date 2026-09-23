# Optimisations de fluidité

Les règles, la fréquence de simulation, la résolution, les illustrations et les animations sont conservées.

- Le cache conserve une petite réserve pour les images demandées en cours de partie, même lorsque les images protégées dépassent sa capacité nominale. Cette réserve est bornée à 16 images dans le jeu ; les anciennes images non protégées restent évincées.
- Au maximum huit images sont chargées et préparées simultanément. Le décodage est demandé avant leur première utilisation. Les contours des décors, les emplacements des enseignes et les variantes saisonnières sont préparés entre des tâches du navigateur. Les chemins de secours restent disponibles.
- La première scène complète est dessinée pendant le chargement, avant d’activer le bouton de démarrage.
- Les vues de présentation réutilisent une copie immuable de la géométrie du monde. Les personnages et autres données variables restent copiés indépendamment ; les sauvegardes complètes restent indépendantes et modifiables. Un import remplace automatiquement la géométrie mise en cache.
- Les cartes d’événements réutilisent leurs éléments. Les textes du HUD inchangés ne sont plus remplacés, et le formatage des revenus réutilise son formateur français.

## Vérifications

`npm test` couvre notamment la saturation du cache, les erreurs de chargement, l’attente du décodage, l’isolation des états, la réutilisation des cartes et la synchronisation multijoueur. `npm run build` prépare la version distribuable.

Le parcours `scripts/validate-mobile-combat-browser.mjs` vérifie les neuf styles, l’activation tactile, le dash, le clavier, la décharge des pouvoirs et l’écran de rotation. Ce sont des tests dans Chrome avec émulation tactile, pas des mesures sur téléphone physique.

Pour comparer les performances, lancer le serveur local sur le port 2037, renseigner `CAMPAIGN_TEST_NODE_MODULES` avec le dossier contenant Playwright et pngjs, puis exécuter successivement :

```powershell
node scripts/validate-performance-browser.mjs before
node scripts/validate-performance-browser.mjs after
```

Le mode `before` lit le code source du dernier commit avec Git et le sert uniquement au navigateur de test, sans modifier les fichiers de travail. `after` utilise les fichiers courants et vérifie que les pixels de la scène témoin sont identiques. `CAMPAIGN_TEST_URL` permet de choisir une autre adresse de serveur. Les rapports et captures sont enregistrés dans `artifacts/performance/`.

## Mesure locale du 22 septembre 2026

| Mesure du parcours | Avant | Après |
| --- | ---: | ---: |
| Créations d’images sur sept changements de zone | 123 | 113 |
| Appel au dessin, 95e percentile | 1,9 ms | 1,9 ms |
| Plus longue tâche après le démarrage, parcours synthétique | 129 ms | 56 ms |
| Temps jusqu’au démarrage | 2,66 s | 4,60 s |

La scène témoin présente **zéro différence de pixels**. La durée du chargement augmente dans cette mesure parce que le jeu attend désormais le décodage, la préparation et le premier affichage complet avant de démarrer. Le bénéfice observé concerne surtout les blocages et les allocations, pas le coût du dessin courant.

Un microbenchmark isolé sous Node, avec six séries alternées de 500 copies après échauffement, mesure 2,21 ms par copie avant et 1,49 ms après (environ 33 % de moins). Le partage de la géométrie évite de sérialiser 8 996 octets par vue. Les résultats détaillés figurent dans `artifacts/performance/snapshot-benchmark.json` ; ce chiffre ne mesure pas les FPS.

Ces durées dépendent de la machine, des caches et du navigateur. Les temps de copie relevés dans Chrome fluctuent entre les exécutions ; ils ne prouvent pas un gain de vitesse constant. Le parcours synthétique crée un second moteur de rendu et traverse des zones ; ses tâches longues ne constituent pas une mesure de FPS pendant une partie complète. Il sert à reproduire et comparer les mêmes opérations.

## Deuxième passe : multijoueur

En connexion directe, l’hôte encode désormais chaque champ de l’état une seule fois par diffusion. Les deux invités partagent également le paquet final lorsqu’ils ont reçu le même état précédent. Si un invité ralentit, sa propre base de comparaison est conservée : la mise à jour suivante reste calculée depuis ce qu’il a réellement reçu ou ce qui attend déjà dans sa file d’envoi fiable. Aucun travail d’encodage n’est effectué quand les deux canaux sont saturés.

Le JSON des états reste **identique octet par octet** au format précédent. La fragmentation, les seuils de saturation, les reprises d’envoi et l’interpolation sont conservés. Les états sont toujours proposés toutes les 100 ms et les commandes toutes les 50 ms, selon les mêmes conditions qu’avant.

Les commandes omettent uniquement l’identité que l’hôte impose déjà à partir du joueur authentifié et les deux indicateurs de présence que le traitement de réception ignorait déjà. Les mouvements, relâchements d’attaque, sauts, dashs, pouvoirs et choix de style conservent leur ordre. Le serveur local encode aussi une seule fois le même événement destiné aux deux invités, en conservant ses contrôles de droits et de saturation.

### Mesures reproductibles

`npm run test:performance-multi` compare l’ancien calcul différentiel et le diffuseur optimisé sur les mêmes 254 états de campagne, arène, second tour et résultats. Il vérifie les paquets ainsi que la reconstruction exacte de chaque état. Six passages alternés réduisent l’effet de l’échauffement ; le tableau présente leur médiane. Ce test mesure la préparation des messages, avant fragmentation et transport, **pas les FPS ni la latence du Wi-Fi**.

| Préparation des 254 états | Avant | Après | Réduction |
| --- | ---: | ---: | ---: |
| Un invité, deux joueurs au total | 133,56 ms | 97,09 ms | 27 % |
| Deux invités, trois joueurs au total | 273,56 ms | 94,05 ms | 66 % |

Le message courant de déplacement passe de **253 à 66 octets avant fragmentation**, soit environ 74 % de moins. Cette réduction concerne les commandes ; le contenu et la taille des états transmis ne changent pas. Rapport : `artifacts/performance/multiplayer-benchmark.json`.

Les tests couvrent également les invités ayant des états précédents différents, les suppressions de champs, les accents et caractères spéciaux, la conservation des anciens états, les commandes et les flux HTTP vers deux invités. Le parcours navigateur à deux puis trois joueurs valide le départ, les déplacements distants, la pause, la déconnexion et toutes les phases jusqu’au résultat. Rapport : `artifacts/performance/multiplayer-browser-report.json`.

Pour rejouer le parcours réseau avec le serveur local sur le port 2037 :

```powershell
$env:CAMPAIGN_TEST_URL = 'http://localhost:2037'
$env:ARCADE_ONLY_NETWORK = '1'
$env:ARCADE_LOOPBACK_ICE = '1'
node scripts/validate-arcade-browser.mjs
```

`CAMPAIGN_TEST_NODE_MODULES` doit pointer vers le dossier contenant Playwright. L’option `ARCADE_LOOPBACK_ICE` est réservée au test de plusieurs navigateurs sur la même machine ; elle ne modifie pas le jeu. Les téléphones physiques et leurs réseaux Wi-Fi restent à tester séparément.

## Troisième passe : navigateur mobile, 23 septembre 2026

Les calculs d’influence regroupent les unités, bâtiments et candidats une fois par appel, au lieu de rechercher les mêmes éléments pour chaque zone et chaque camp. Ces regroupements sont reconstruits à chaque appel : un déplacement, une conversion, un import ou une construction au même tick reste immédiatement pris en compte. L’ordre des additions et les deux actualisations par tick sont conservés. Le calcul des revenus évite de créer le tableau détaillé lorsque seul le total est nécessaire. Ces gains concernent aussi l’hôte multijoueur, sans modifier le protocole ou les fréquences de synchronisation.

Le dessin écarte les images de décor entièrement hors du cadrage, avec une marge de sécurité de deux pixels physiques. Les images, filtres de saison, animations et résolutions restent identiques. Les formateurs de nombres français sont réutilisés, et les textes inchangés des jauges d’arène ne sont plus remplacés.

### Vérifications et mesures

- `test/performance-invariants.test.js` compare l’algorithme précédent et le nouveau sur 36 états successivement modifiés au même tick : unités, bâtiments, meetings, contrôle des zones, styles, combat et élimination. Les états et revenus sont strictement identiques, arrondis compris. Ce test fait partie de la suite principale.
- `node scripts/validate-simulation-performance.mjs` : six séries alternées après échauffement, avec 201 unités et 3 000 calculs par série sous Node 24. Médiane de l’influence : **649,15 → 155,38 ms**, soit **76 % de temps en moins**. Revenus des trois camps : **20,18 → 14,12 ms**, soit **30 % de moins**. Ces résultats mesurent ces fonctions isolées, pas les FPS.
- `node scripts/validate-mobile-render.mjs artifacts/performance-mobile/reference-sources.json` : **48 scènes identiques pixel par pixel**, six biomes, quatre saisons, jonctions de décor, deux densités de pixels, écran 844 × 390. Le nombre d’appels au dessin d’images passe de **687 à 591** pour chaque série de 24 scènes, soit **14 % de moins**. Le fichier de référence contient les sources enregistrées avant cette passe ; les modifications de costumes déjà présentes sont conservées dans les deux versions. Sans argument, le script vérifie seulement le rendu courant et les chargements.
- `node scripts/validate-mobile-combat-browser.mjs` : parcours des neuf styles, commandes tactiles, dash, clavier, décharge du pouvoir et écran de rotation réussis, sans erreur JavaScript.
- Suite principale sous Node 24 : **221 tests réussis sur 225**. Les quatre échecs sont reproduits avec l’ancien calcul : trois concernent les costumes en cours de modification, le quatrième le chemin d’une image de costume dans le test d’export. Les anciens tests `economy` et `electoral`, hors suite principale, ont également les mêmes 34 échecs avant et après. Aucun de ces échecs n’est introduit par cette passe. La construction de `dist/` réussit.

Les rapports se trouvent dans `artifacts/performance-mobile/`. Le profil de marche de dix secondes (`scripts/profile-mobile-render.mjs`, Chrome avec processeur ralenti ×4) reste variable : le 95e percentile des intervalles d’affichage passe de 16,1 à 14,1 ms, mais cela ne démontre pas un gain constant de FPS. Les mesures ont été faites sur ordinateur avec émulation mobile, pas sur un téléphone physique. Les grosses images et le coût du dessin restent des postes importants ; cette passe ne réduit pas leur qualité.

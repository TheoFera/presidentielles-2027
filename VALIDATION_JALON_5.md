# Validation du cinquième jalon

Réglages du 3 septembre 2026. Jeu local : [localhost:2027](http://localhost:2027/). L’objectif est une partie complète jouable ; l’équilibrage reste provisoire.

## Vérifications automatisées

`npm test` : **109 tests réussis**, dont 23 consacrés à la partie complète. Les tests des quatre premiers jalons sont conservés ; l’ancien test exigeant un blocage à J-1 est remplacé par le passage naturel à J0.

Couverture de ce jalon :

- J0 au tick configuré, scores nationaux réels transformés en jauges ; aucune désignation prématurée d’un vainqueur.
- Gel du monde : PNJ, origines, candidats, positions, argent, RNG, bâtiments, timers, contrôles, sondages et pouvoirs actifs inchangés ; restitution exacte des finalistes.
- Interdiction des achats, Meetings et téléportations du monde dans l’arène ; maintien des commandes de déplacement et d’attaque.
- Dégâts distincts des deux légers, du fort et des trois pouvoirs ; véritables `Attack` déclenchant hologrammes, vague et CRS ; aucun dégât électoral du monde dans l’arène.
- Arrêt au premier zéro, pas de second KO dans le même pas ; cas initial à 0 % pris en charge.
- Bords solides, marche et recul sans boucle ni ring-out, projectile sortant détruit.
- Neutralisation S/M/SO, arrêt des tâches et raids, origines conservées, retour physique puis reconversion accessible aux deux finalistes ; aucun recrutement gratuit.
- Bâtiments libérés ; reconstruction avec seuil et paiement. Imprimerie neutre conservée et commandes des finalistes intactes.
- Support du troisième vers Neutres, aucun transfert automatique aux finalistes, camp éliminé impossible à réactiver.
- Influence ×10 appliquée une seule fois ; Tour atténuée ; Meeting ×10 payé, présence requise et cooldown raccourci. Test d’une Tour seule sans explosion en deux secondes.
- Sondages à 2,5 s ; Institut fermé figé ; victoire calculée sur l’état réel malgré un sondage périmé.
- Combats normaux, recul et pertes électorales pendant le sprint.
- 1 800 ticks pour 60 s à 30 Hz ; prolongations successives de 450 ticks ; règle alternative de départage.
- Résultat figé, télémétrie et nouvelle simulation entièrement propre, avec candidat conservé.
- Imports atomiques, états corrompus refusés, reprises d’arène et sprint déterministes ; même partie à 20, 60 et 144 FPS.
- IA indépendante de l’identité du joueur humain, changements de cible déterministes, fin d’arène assurée sur l’échantillon testé et survie possible du troisième au score ; IA du sprint payant un Meeting.

Le journal complet se trouve dans `artifacts/tests-jalon5.txt`.

## Campagnes complètes avec les réglages normaux

`npm run test:partie` fait jouer les trois contrôleurs IA pendant toute la campagne, l’arène et les 60 s de sprint. Aucun fonds, unité ou bâtiment n’est offert à ces parties de contrôle. Les snapshots intermédiaires sont exportés puis importés pour vérifier leur cohérence.

| Graine | Durée totale | Arène | Éliminé | Vainqueur | Zones ayant basculé au sprint | Anciens PNJ reconvertis | Meetings au sprint |
|---|---:|---:|---|---|---:|---:|---:|
| 2027 | 669,63 s | 9,63 s | Le Pen | Mélenchon | 3 | 19 sur 69 | 2 |
| 73 | 670,90 s | 10,90 s | Mélenchon | Philippe | 9 | 12 sur 52 | 1 |
| 31415 | 672,50 s | 12,50 s | Le Pen | Philippe | 6 | 18 sur 66 | 2 |

Les 18 sommes restent à 100 % à la précision des nombres flottants. La réserve du troisième n’est jamais entièrement recrutée automatiquement. Le résultat et les scores détaillés sont conservés dans `artifacts/validation-jalon5.json` ; la mesure de contrôle exclut la neutralisation initiale, et compte les sous-zones distinctes.

## Premier contrôle d’équilibrage

Sur **30 arènes** avec un départ **34 % / 30 % / 26 %**, les combats durent **9,33 à 19,67 secondes**, moyenne **14,17 secondes**. Le troisième initial, Philippe à 26 %, survit dans **18 parties sur 30**. Le classement électoral n’impose donc pas le troisième éliminé.

Répartition des éliminations : Mélenchon 1, Le Pen 17, Philippe 12. Cela révèle encore une asymétrie des pouvoirs et de cette IA : il ne s’agit pas d’un équilibre compétitif validé. Les dégâts et les paramètres de ciblage sont configurables. Un second échantillon exploratoire avec les scores permutés a confirmé que les trois camps peuvent être éliminés et que 34 % ne garantit pas la survie.

Les premiers essais, trop courts, ont conduit à réduire les dégâts de combo de l’arène. La vague a ensuite été ajustée pour mieux rivaliser avec les invocations. Les valeurs finales sont celles du README et du JSON. Aucun dégât du combat du monde n’a été changé.

La Tour niveau 3 seule reste sous +0,1 point local en deux secondes dans le test sans présence, à partir de 10 % pour son camp et 80 % de Neutres. Le Meeting reste une exception volontairement forte, avec déplacement et paiement obligatoires. Le sprint provoque des changements de contrôle mesurables dans les campagnes complètes.

## Vérification dans le navigateur

Parcours effectués dans le navigateur intégré, sur le véritable serveur local :

1. Campagne affichée, F3 puis J0 : passage au plateau télévisé et trois jauges visibles.
2. Chargement de l’arène préparée 34/30/26, Espace : apparition effective des cinq hologrammes, puis dégâts affichés.
3. Fin de l’arène avec Le Pen éliminée : retour au biome, emplacements sans affiliation, anciens PNJ gris marchant vers leur origine, chiffre de sprint visible.
4. Égalité forcée : annonce « +15 s · Égalité » et chrono de 15 secondes.
5. Fin de sprint : écran vainqueur, second, Neutres, troisième et boutons Rejouer / Retour à l’accueil.
6. Rejouer : nouvelle campagne ; élimination du joueur testée séparément, avec caméra de spectateur sur les finalistes.
7. Retour à l’accueil : J-30, 100 k €, ancienne partie effacée et bouton « Commencer la campagne » en pause. Aucun message d’erreur dans la console du navigateur ; les seuls journaux du parcours sont les résumés DEBUG attendus.

Les proportions du monde sont inchangées : sol à 93 %, silhouettes à 15 %, caméra du joueur et bâtiments existants. L’arène utilise sa propre vue fixe, lisible à trois, sans modifier ces proportions dans le monde.

## Fichiers de contrôle

- `jalon5-j0.json`, `jalon5-sprint.json`, `jalon5-resultat.json` : campagne complète, graine 2027.
- `jalon5-arene-visuelle.json` : pouvoirs chargés et camp Le Pen préparé près de la caméra du monde.
- `jalon5-effondrement.json` : douze anciens alliés de ce camp, origines conservées, emplacements libres.
- `validation-jalon5.json` et `validation-jalon5-log.txt` : scores, télémétrie et détails des simulations.

Les scénarios préparés servent aux contrôles visuels ; les trois campagnes du tableau utilisent les paramètres initiaux normaux. Les fichiers JSON antérieurs au format 5 ne sont pas des sauvegardes compatibles avec ce jalon.

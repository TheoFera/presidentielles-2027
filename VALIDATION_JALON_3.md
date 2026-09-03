# Validation du troisième jalon

3 septembre 2026 — version 0.3.0. Référence : JALON_3_SPEC.md et précision du message sur la vitesse des Militants.

## Résultats automatisés

**68 tests : 46 régressions du socle et 22 tests de combat, bâtiments factionnels et pouvoirs.** Commande : `npm.cmd test`.

Les tests vérifient notamment :

- Densité initiale conservée, spawns aléatoires bornés, origines, boucle du monde, persuasion et revenus.
- Constructions, améliorations, neutralité de l’Imprimerie, collecte de tracts et Militant autonome ; aucun changement nécessaire à ces règles.
- Combo 8 + 8 + 14 démobilisant S et M ; anticipation, hit-stop, recul, annulation du combo et absence de charge sur un coup manqué.
- Durabilité 90 du SO, protection des alliés, retour physique à l’origine et neutralité retrouvée sans décès.
- Attaques verbales, sélection d’une cible combattante et reprise de la prospection.
- Vitesse de marche du Militant réduite à 2,4 unités/s et plafond effectif de deux fois la vitesse du joueur.
- Perte électorale répartie proportionnellement dans les seules sous-zones contrôlées, vers la part neutre, en conservant un total de 100 %.
- Local SO et Cabinet débloqués par 5 S ; coûts, trois niveaux et distinction des zones de présence.
- Militant disponible le plus proche du biome affecté à l’équipement SO, collecte physique et conservation des origines.
- Défense territoriale, arrêt de poursuite après la sortie du biome, coût et direction du raid, délai de réutilisation, expiration puis retour.
- Ciblage administratif, exclusion des services neutres, perte des améliorations et des effets, reconstruction payante au niveau 1.
- Annulation et remboursement des équipements non livrés quand leur Local ferme.
- Même commande Attack pour les trois pouvoirs, consommation de charge, durée limitée, aucune unité permanente ajoutée.
- Hologrammes offensifs sans influence, vague infligeant 100 % / 85 % / 35 % aux S / M / SO et 0,3 point à un candidat contrôlant un territoire ; absence de charge physique de Le Pen.
- CRS suivant Philippe, bloquant l’approche et interceptant les projectiles ; augmentation de la pression lorsque plusieurs SO attaquent.
- Contrôleurs humain et IA passant par les mêmes commandes, appui bref non perdu, résultat identique à plusieurs fréquences d’affichage et jonction du monde.
- Reprise identique des sauvegardes pendant production SO, raid et pouvoirs ; rejet atomique d’états de combat incohérents.

## Parcours d’intégration

`npm.cmd run test:parcours` rejoue la boucle validée du deuxième jalon avec les valeurs normales, uniquement par marche et présence : Permanence vers 10,37 s, tract vers 15 s, Financement vers 73,67 s. Aucun argent ni PNJ ajouté. Les cinq sauvegardes jalon2 ont été régénérées au format actuel.

`npm.cmd run test:conflits` prépare et valide douze sauvegardes. Les scènes de ce troisième jalon utilisent explicitement des fonds et unités de test, ainsi que des placements préparés. Les réglages de jeu restent ceux livrés. Ce script vérifie :

1. Local construit → équipement payé → Militant qui se déplace et retire l’équipement → SO → raid payé → retour après expiration.
2. Cabinet construit → paiement de fermeture → Financement adverse fermé et niveaux perdus → retour du propriétaire → reconstruction au niveau 1.
3. Validité complète des états préparés pour les trois pouvoirs, le duel et les comparaisons face à 1, 2 et 3 SO.

## Vérifications dans le navigateur

Le jeu a été chargé et joué à **http://localhost:2027**. Les trois candidats ont été testés dans le navigateur, avec les contrôles publics du jeu et l’import de ses fichiers de test.

- Trois appuis sur J, espacés de 0,46 s : impacts 8, 8, 14 sur un S adverse ; au tick 683, combo 3, charge 4, adversaire démobilisé. Son origine Campagne est conservée, sa silhouette grisée et son départ sont visibles.
- Mélenchon : étoiles visibles avant activation, puis charge 0 et cinq hologrammes rouges translucides se dirigeant vers les adversaires. Impact intercepté par une unité temporaire visible dans l’état.
- Le Pen : vague bleu marine visible à droite, impacts et recul sur les adversaires, Le Pen restant à sa position.
- Philippe : deux CRS à ses côtés et attaque verbale interceptée ; aucune erreur relevée dans le journal du navigateur consulté.
- Cabinet : billet 120 k€ avec cible, paiement effectif, dépense de fermeture dans le débogage, Financement marqué FERMÉ, façade barrée et niveaux supprimés. Les façades du Cabinet et de l’Imprimerie restent distinctes.
- Équipement SO : au tick 308, le Militant npc:31 est à la porte, bâton visible pendant le retrait. Après reprise, il devient SO au tick 337 ; au tick 359, sa résistance vaut 90, ses origines sont inchangées et il patrouille dans le biome Banlieue.
- L’interface normale garde l’argent seul comme information permanente. Durabilité, charge chiffrée, hitboxes, scores et compteurs restent dans F3.

La défense et le retour de raid complets, ainsi que les cas limites économiques, sont surtout couverts par les tests de simulation. Les captures et états de navigateur ne constituent pas une validation humaine de la difficulté 1 contre 2 ou 3 SO.

## Changements apportés au socle validé

La vitesse de marche du Militant est la correction explicitement demandée. Les états d’attaque et d’étourdissement interrompent les actions concernées. Un troisième emplacement factionnel a été ajouté ; sa façade est plus étroite pour éviter de recouvrir les infrastructures existantes. Le prix et la cible contextuelle restent compacts.

Caméra, suivi, cadrage, sol, dimensions des silhouettes, vitesse normale du candidat, densité et règles de persuasion du deuxième jalon sont conservés. Le format des sauvegardes passe à 3 pour contenir le combat ; les anciens fichiers sont refusés proprement.

## Limites et arrêt

Le tactile est implémenté mais pas testé sur téléphone physique. Le plaisir du combat, le rythme de progression et la difficulté précise face à plusieurs SO restent à évaluer par le joueur. Les hypothèses et tous les réglages sont détaillés dans README.md.

Développement arrêté au troisième jalon. Aucun réseau, sondage, Meeting, arène J0, second tour, graphisme final ou son final n’a été ajouté.

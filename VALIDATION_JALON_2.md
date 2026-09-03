# Validation du deuxième jalon

Date : 3 septembre 2026. Version du projet : 0.2.0. Demande de référence : `JALON_2_SPEC.md`. Les résultats ci-dessous concernent les réglages livrés, graine 2027.

## Résultats automatisés

Commande : `node --test --test-reporter=spec` (également disponible avec `npm.cmd test`). **46 tests réussis, 0 échec**, dernier passage en environ 4,6 secondes sur Node.js 22.14.0.

| Domaine | Vérifications |
| --- | --- |
| Densité et origine | 25 Neutres, 4 ou 5 par biome, aucun S/M offert, IDs uniques, origines persistantes |
| Spawn | Délai en jours et aléatoire borné, renouvellement du tirage, capacité par point même avec plusieurs points, aucun rattrapage en rafale, fonctionnement hors caméra |
| Persuasion conservée | 50 ticks pour Mélenchon, 90 pour les autres, gratuité, annulation, cible unique, priorité stable, jonction de la boucle |
| Achats | Seuil local, S non consommés, fonds insuffisants, présence active obligatoire, sortie et reprise, niveaux maximaux, nouveau passage pour améliorer |
| Concurrence | Deux acheteurs simultanés donnent une seule propriété et un seul débit, quel que soit l’ordre des commandes |
| Permanence | Construction, deux améliorations, influence et multiplicateurs locaux |
| Financement | Seuil 4, coûts et revenus des trois niveaux, multiplicateur de Philippe sur l’ensemble des revenus |
| Imprimerie | Neutralité, trois camps, file partagée bornée, affectation exclusive, plus proche puis ID, commande attendant une disponibilité future |
| Militant | Déplacement physique vers l’Imprimerie, attente d’impression, retrait, changement de rôle, déplacement autonome et recrutement d’un Neutre ; 5 secondes sans bonus personnel de Mélenchon |
| Influence | Sources locales distinctes des PNJ électeurs, conservation de 100 % des parts abstraites |
| Sauvegardes | Reprise identique pendant persuasion, paiement et production ; refus atomique des propriétaires, doubles affectations, délais et états incohérents |
| Architecture | Contrôleurs interchangeables, trois candidats pilotables sans changer les règles, copie de l’état pour le rendu, commandes invalides refusées, hasard reproductible |
| Temps et présentation | Résultat identique à différents FPS et images irrégulières, appui court, perte de focus, ratios validés, maintien à J-1 |
| IA | Utilisation effective des infrastructures et création de Militants pendant 150 secondes simulées |
| Configuration | Paramètres effectivement utilisés, configurations invalides explicitement rejetées |

Les tests ciblés d’économie utilisent parfois des états préparés afin d’isoler les seuils et cas limites. Le parcours ci-dessous vérifie séparément que la progression est accessible sans préparation artificielle des ressources.

## Parcours complet avec les valeurs normales

Commande : `npm.cmd run test:parcours`.

Le script `scripts/validate-milestone2.mjs` utilise le contrôleur humain et des commandes de marche et présence. Il suspend les deux candidats IA pour isoler l’essai. **Aucun ajout d’argent, aucun ajout de PNJ, aucune téléportation.** Il convainc les deux Neutres initiaux de Banlieue centrale, construit, paie un tract, sort de portée, attend la collecte, puis recrute les apparitions jusqu’au seuil de Financement.

| Étape enregistrée | Temps simulé | Argent | Dépenses cumulées |
| --- | ---: | ---: | ---: |
| Paiement de Permanence en cours | 9,37 s | 101,12 k€ | 0 k€ |
| Permanence construite | 10,37 s | 66,24 k€ | 35 k€ |
| Collecte affectée et S en route | 15 s | 54,80 k€ | 47 k€ |
| Retrait du tract | 18,50 s | 55,22 k€ | 47 k€ |
| Financement construit et Militant autonome | 73,67 s | 6,84 k€ | 102 k€ |

Le script vérifie les dépenses réelles, le revenu de Financement, la neutralité de l’Imprimerie, la présence du Militant et la restauration identique de l’état final. Les cinq états correspondants sont dans `artifacts/jalon2-*.json`. Ils sont importables depuis F3. Les durées sont celles de ce parcours, sans engagement sur la vitesse d’un joueur débutant.

## Vérifications dans le navigateur

Projet servi sur **http://localhost:2027**, réponse HTTP 200. Vérifications effectuées sur le Canvas réel et le panneau de débogage :

- Nouvelle partie avec densité réduite, emplacements distincts et Imprimerie déjà présente ; proportions et composition du premier jalon conservées.
- F3, pause F4, accélération F6 et déplacement de test vers un Neutre fonctionnels.
- Import des sauvegardes par le sélecteur de fichiers de l’interface, sans modification cachée de l’état.
- Billet « 35 k€ » lisible au-dessus du candidat, progression discrète visible, argent non débité avant la fin du paiement.
- Permanence construite avec appartenance visible ; façade d’Imprimerie neutre.
- Au tick 450, `npc:8` est un S en déplacement vers le service ; la file affiche son affectation et une impression en cours.
- Au tick 555, le même S récupère le papier : bras et tract visibles, tâche « Récupère le tract », production à 4 / 4 secondes.
- Après reprise, au tick 739, le même PNJ est Militant et se dirige vers `banlieue_c`, cible `npc:26`. Ses origines sont inchangées ; la file est vide et le compteur de tracts récupérés vaut 1.
- Aucun avertissement ni erreur dans les journaux du navigateur consultés pendant ces vérifications.

La légende de lieu était masquée par la nouvelle Imprimerie : elle a été remontée au-dessus de la façade. Aucune modification du cadrage, du suivi de caméra, de l’échelle ou du déplacement validés n’a été nécessaire.

## Limites et essai humain attendu

La vérification automatisée couvre les règles ; l’observation dans le navigateur couvre les principaux états visuels. Elle ne remplace pas ton appréciation de la sensation de gestion, de la lisibilité en mouvement ou de l’équilibrage sur une longue partie. Le tactile n’a pas été retesté sur téléphone physique. La collecte et le départ autonome ont été observés à l’écran ; la conversion ultérieure effectuée par le Militant est vérifiée par les tests de simulation.

Les hypothèses détaillées, les réglages, les sauvegardes et le parcours manuel des six systèmes se trouvent dans `README.md`. Les états du premier jalon sont incompatibles avec ce schéma de sauvegarde version 2 ; l’import les refuse en conservant la partie actuelle.

Développement arrêté à ce jalon. Aucune fonctionnalité de combat, Service d’ordre, Cabinet, raid, pouvoir, Tour, sondage, Meeting, J0, second tour ou réseau n’a été ajoutée.

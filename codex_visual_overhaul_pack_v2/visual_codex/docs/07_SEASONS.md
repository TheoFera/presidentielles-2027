# 07 — Saisons sur J-365 → J0

## Cycle

- début : été ;
- automne ;
- hiver ;
- printemps ;
- retour début été / premier tour.

Le code existant reste la source du temps.

## Séparer le fixe du saisonnier

### Fixe
- architecture ;
- route ;
- sites ;
- mobilier principal.

### Saisonnier
- ciel ;
- arbres ;
- arbustes ;
- feuilles ;
- petite neige éventuelle ;
- lumière/tonalité.

Ainsi il n'est pas nécessaire de générer 18 × 4 backgrounds complets.

## Arbres

Créer plusieurs formes :
- arbre urbain ;
- arbre de rue ;
- arbre de parc ;
- arbre rural ;
- haie.

Pour chaque forme :
- summer ;
- autumn ;
- winter ;
- spring.

Même tronc/forme de base autant que possible.

## Ciel

Préférer un système qui peut interpoler :
- teinte ;
- luminosité ;
- saturation.

Des nuages transparents peuvent être partagés.

## Automne
- feuillage ocre/orange ;
- particules de feuilles très rares.

## Hiver
- branches nues ;
- lumière plus froide ;
- neige légère seulement si le gameplay reste lisible.

## Printemps
- vert clair ;
- quelques fleurs discrètes.

## Fin de campagne
- ciel plus lumineux ;
- affichage politique du monde peut être un peu plus dense via props, sans modifier le gameplay.

## Performance

Ne pas charger quatre versions de chaque scène entière.
Remplacer/teinter les overlays de végétation.

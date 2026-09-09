# 06 — Transitions entre biomes

## Objectif

Le joueur se déplace en continu. Les biomes ne doivent jamais donner l'impression de scènes collées bout à bout.

Chaque frontière est un **contrat visuel bilatéral**.

### Règle des 20 %

Pour chaque paire :
- les derniers ~20 % du biome A introduisent des motifs de B ;
- les premiers ~20 % de B conservent des motifs de A.

Le pourcentage est indicatif ; ajuster selon le layout réel.

## Contrat global

Toujours conserver :
- même hauteur de trottoir ;
- même ground Y ;
- horizon compatible ;
- continuité de route ;
- même échelle de perspective ;
- ciel saisonnier global partagé.

## T1 — Bobo → Banlieue

Sortie Bobo :
- cafés/vélos diminuent ;
- collectif plus récent ;
- tours au loin ;
- davantage de murs/graffitis.

Entrée Banlieue :
- conserve 1–2 indices du quartier précédent ;
- densité augmente vers cité ;
- mobilier change progressivement.

Palette :
- reste urbaine, donc transition douce.

## T2 — Banlieue → Périurbain

Sortie Banlieue :
- tours moins présentes ;
- pavillons ;
- garages ;
- commerces espacés.

Entrée Périurbain :
- zone artisanale ;
- parkings ;
- entrepôts bas ;
- circulation plus visible.

Élément pont :
- pavillons modestes + petite zone d'activité.

## T3 — Périurbain → Campagne

Sortie Périurbain :
- derniers entrepôts ;
- grillage ;
- terrain vague ;
- champs en profondeur.

Entrée Campagne :
- champs dominants ;
- hangar/ferme ;
- route ;
- un dernier pylône/entrepôt lointain.

Élément pont :
- frange industrielle/rurale.

## T4 — Campagne → Retraités

Sortie Campagne :
- village ;
- maisons individuelles ;
- jardins ;
- haies.

Entrée Retraités :
- lotissement ;
- pelouses ;
- haies très taillées ;
- mobilier de petite ville.

Élément pont :
- pavillons de bord de village.

## T5 — Retraités → Riches

Sortie Retraités :
- pavillons plus grands ;
- jardins soignés ;
- clôtures plus qualitatives.

Entrée Riches :
- grilles ;
- pierre ;
- façades plus imposantes ;
- avenue arborée.

Élément pont :
- résidence aisée.

## T6 — Riches → Bobo

C'est la couture de boucle et elle doit être invisible.

Sortie Riches :
- Haussmann ;
- boutiques ;
- densité urbaine ;
- transports/vélos réapparaissent.

Entrée Bobo :
- même densité ;
- canal/quai/café ;
- affiches culturelles ;
- architecture moins statutaire.

Élément pont :
- Paris dense / Haussmann mixte.

## Production d'assets

Ne pas générer 18 images isolées sans tenir compte des voisins.

Méthode recommandée :

1. produire le style/horizon global ;
2. générer les sous-zones par paires adjacentes ;
3. utiliser le rendu de droite de A comme référence de gauche de B ;
4. conserver une bande de raccord de 15–20 % ;
5. tester la couture en scrollant en temps réel.

Si le renderer utilise des tuiles :
- créer des `transition_tiles` dédiées.

Si le renderer utilise un panorama par sous-zone :
- créer un `overlap/crossfade strip` ou des éléments communs aux deux bords.

## Parallax

Chaque couche doit respecter la transition :
- skyline far ;
- architecture mid ;
- props near.

Il est interdit que seule la couche foreground change progressivement alors que le skyline saute brutalement.

## Saisons

La transition de biome et la transition saisonnière sont indépendantes.

Le ciel saisonnier est global.
Les arbres changent par saison dans toutes les zones.
La géographie du biome reste continue.

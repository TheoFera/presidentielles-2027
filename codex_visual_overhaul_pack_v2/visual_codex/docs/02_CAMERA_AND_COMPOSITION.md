# 02 — Caméra et composition

## Références

- `GREYBOX_01.png`
- `GREYBOX_02.png`

Le greybox définit la quantité d'information visible.

## Règles

- caméra latérale continue ;
- joueur maintenu autour du centre horizontal ;
- la ligne de sol doit rester vers 92–94 % de la hauteur de la vue ;
- quasi aucun "deuxième étage de jeu" sous le sol ;
- personnages : environ 13–17 % de la hauteur utile à l'écran ;
- bâtiments interactifs : visuellement importants mais ne doivent pas bloquer la lecture du ciel/horizon ;
- arrière-plan en plusieurs plans si le renderer le permet.

## Parallax recommandé

1. `far` : ciel + skyline lointaine ;
2. `mid` : bâtiments non interactifs + végétation de fond ;
3. `gameplay` : sites, arbres/props proches, personnages ;
4. `foreground` : très peu d'éléments, jamais devant les personnages au point de masquer le combat.

## Ligne de sol

Le trottoir/route doit être cohérent sur toute la boucle.
Les changements de biome se font dans :
- matériaux ;
- bordures ;
- végétation ;
- marquages ;
mais sans rupture de hauteur.

## Responsive

La zone logique de gameplay ne doit pas changer de proportions de manière agressive selon l'écran.

Test minimum :
- 1920×1080 ;
- 1600×900 ;
- 2340×1080 ou équivalent téléphone paysage ;
- 1280×720.

Éviter que l'UI verticale réduise la vue de terrain.

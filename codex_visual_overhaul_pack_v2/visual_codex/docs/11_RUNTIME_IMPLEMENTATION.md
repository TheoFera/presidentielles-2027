# 11 — Implémentation runtime

## Détecter le renderer

Ne pas supposer React, Canvas, Phaser, Pixi, DOM ou autre.
Inspecter le projet.

## Principe d'intégration

La simulation reste autoritaire.
La présentation lit les états.

Exemples :

`site.owner` → choisit owner overlay.
`site.level` → choisit level overlay.
`site.active` → active lights.
`site.closureProgress` → interpolation de désaturation.
`season` → vegetation variant.
`biome/subzone` → background layers.
`character.state` → animation.

## Sites préexistants

Au chargement :
- instancier/afficher tous les sites définis dans le layout ;
- même si owner = null ;
- mode neutre.

À la capture :
- ne pas créer un nouveau site ;
- mettre à jour son rendu.

## Layering

Ordre suggéré :
1. sky ;
2. far background ;
3. mid background ;
4. back vegetation ;
5. gameplay sites ;
6. characters/NPC ;
7. front props ;
8. FX ;
9. HUD.

## Preloading biome

Quand le joueur approche de la fin d'une sous-zone :
- preload next subzone ;
- preload first assets of next biome ;
- keep previous enough for backtracking.

Le monde boucle :
- Riches C preload Bobo A ;
- Bobo A preload Riches C si retour inverse possible.

## Parallax seams

Les layers de deux sous-zones peuvent overlap légèrement.
Ne pas montrer de bande vide.

## Responsive

La collision/logical coordinates ne doivent pas dépendre des pixels de l'image.
Utiliser les coordonnées monde existantes.
Les assets s'adaptent à ces coordonnées.

## Hitboxes

Ne jamais redéfinir une hitbox à partir du bord visuel de l'asset sans vérifier.
Les visuels peuvent dépasser légèrement mais la logique reste stable.

## Animations

Synchroniser avec les événements/timings existants.
Éviter que le rendu attende la fin d'une animation si la simulation a déjà changé d'état.

## Fallback

Si asset absent :
- fallback greybox local ;
- log debug ;
- pas de crash.

## Debug

Ajouter si simple :
- toggle "show asset ids" ;
- toggle "show biome/subzone" ;
- toggle "show anchors/hitboxes" ;
- toggle "show transition preload state".

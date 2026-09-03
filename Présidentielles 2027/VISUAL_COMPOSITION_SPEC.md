# VISUAL_COMPOSITION_SPEC — V0.3

Ce document décrit **la composition de la greybox**, pas la direction artistique finale.
La référence prioritaire est `references/GREYBOX_COMPOSITION_V0.3.png`.

# 1. Résultat recherché

Le jeu normal doit se lire comme une grande scène latérale continue :

- **Kingdom / Kingdom Two Crowns** : caméra centrée, quantité de monde visible, exploration horizontale,
  monde qui continue à fonctionner autour du joueur, interface très légère ;
- **Fiscal Combat** : échelle lisible des silhouettes humaines et affrontements au sol vus de côté ;
- **Super Mario Bros. 2D** : sol placé presque tout en bas et très peu d'espace visible sous les pieds ;
- **Super Smash Bros.** : lisibilité des coups, anticipation, knockback et impacts ; surtout pour l'arène de J0.

Ne pas transformer le monde normal en arène Smash : la caméra reste attachée au joueur contrôlé.

# 2. Format de référence

Référence de composition : 1920 × 1080, 16:9.
Les valeurs doivent être exprimées en ratios viewport pour s'adapter aux téléphones.

## 2.1 Ligne de sol

- pieds du personnage autour de `y = 91–94 %` de la hauteur d'écran ;
- épaisseur visible du sol : environ `2–3 %` de l'écran ;
- rien ou presque sous le sol : au maximum quelques pourcents de marge visuelle ;
- aucune eau, aucune grande route en premier plan, aucune bande décorative inférieure.

## 2.2 Personnages

- silhouette principale : environ `13–17 %` de la hauteur de l'écran ;
- personnages entièrement visibles de la tête aux pieds ;
- lisibilité suffisante pour plusieurs unités à gauche et à droite ;
- le candidat contrôlé est proche de `x = 50 %` en déplacement normal.

## 2.3 Bâtiments

- bâtiments au même plan de jeu, derrière les personnages ;
- hauteur indicative : `45–65 %` de l'écran selon bâtiment ;
- laisser des espaces de respiration pour que les combats ne se déroulent pas dans un mur d'objets ;
- bâtiments et points d'interaction doivent être reconnaissables sans panneau de menu.

# 3. Caméra

- side-view 2D ;
- joueur centré horizontalement en permanence, avec léger smoothing ;
- petit look-ahead autorisé dans la direction de marche ;
- caméra verticale presque fixe ;
- aucun zoom dynamique pour faire entrer tous les combattants dans le cadre en exploration ;
- les événements lointains peuvent donc être hors écran : le joueur doit physiquement se déplacer.

Exception : l'arène médiatique de J0 peut avoir une caméra plus proche d'un platform fighter,
avec léger zoom adaptatif pour garder les trois candidats visibles.

# 4. HUD normal

## 4.1 Aucun bandeau supérieur

Ne jamais créer de barre HUD horizontale pleine largeur.

## 4.2 Argent

Seul élément permanent en exploration :

- haut gauche ;
- très compact ;
- format `k €` ; exemples : `12 k €`, `12,5 k €`, `190 k €` ;
- pas de portrait, pas de jauge, pas de cadre massif.

## 4.3 Jours

Le compteur de jours n'est **pas un HUD permanent** dans la V0.3.
Il peut :
- apparaître brièvement au changement de jour (`J-12`) ;
- être intégré plus tard au centre du cercle de sondage lorsque l'Institut est débloqué.

En debug, il reste toujours visible.

## 4.4 Interdits en exploration

Ne pas afficher en permanence :
- PV / moral ;
- jauge spéciale ;
- compteur de Sympathisants ;
- compteur de Militants ;
- pourcentages nationaux avant l'Institut ;
- gros boutons d'action ;
- panneaux texte de bâtiments.

# 5. Interaction économique : billet + présence

Il n'y a **ni clic d'achat, ni bouton contextuel, ni pièces au-dessus du bâtiment**.

Quand le candidat entre dans la zone d'achat d'un bâtiment/service :

1. un petit **billet** apparaît au-dessus ou devant le point d'interaction ;
2. le billet porte uniquement le prix (`25 k €`) ;
3. si le joueur possède assez d'argent et reste dans la zone pendant la durée requise,
   une progression très discrète se remplit autour/dans le billet ;
4. à la fin du délai, la somme est débitée et l'action est exécutée automatiquement ;
5. quitter la zone avant la fin annule ou fait décroître la progression ;
6. si l'argent est insuffisant, le billet reste visible mais grisé/barré et aucune progression ne démarre.

Objectif : la logique doit être comprise visuellement comme dans Kingdom, mais avec **billets/prix**
plutôt qu'une distribution de pièces.

# 6. Greybox personnages

Même sans sprites finaux, ne pas utiliser de simples cercles/triangles.
Chaque personnage doit être une silhouette humaine pixelisée primitive :

- tête ronde/pixel ;
- torse ;
- deux bras ;
- deux jambes ;
- couleur de faction ;
- symbole minimal sur le torse pour le rôle.

Exemples de symboles :
- Neutre : aucun symbole ;
- Sympathisant : cœur ou `S` ;
- Militant : tract ou `M` ;
- Service d'ordre : bâton/bouclier ou `SO` ;
- candidat : symbole distinctif/initiale.

# 7. Lisibilité des combats

Le combat se déroule sur la même ligne de sol que l'exploration.

- anticipation minimale avant les coups ;
- recul visible ;
- troisième coup du combo nettement plus puissant ;
- aucune barre de vie au-dessus des personnages ;
- impacts lisibles par flash, squash/stretch simple, hit-stop et déplacement ;
- garder assez d'espace horizontal autour du candidat pour lire un 1v2 ou 1v3.

# 8. Références : usage exact

## Kingdom
À utiliser pour : caméra, scrolling, rythme, monde autonome, sobriété UI.

## Fiscal Combat
À utiliser pour : échelle des personnages, lecture d'un combat au sol, proportions d'une rue latérale.
Ne pas reprendre son gros HUD ni sa grande route sous la zone jouable.

## Mario 2D
À utiliser uniquement pour : position très basse du sol et peu de contenu sous la plateforme.

## Smash Bros.
À utiliser pour : lisibilité des impacts, knockback et arène J0.
Ne pas utiliser sa caméra dynamique dans le monde normal.

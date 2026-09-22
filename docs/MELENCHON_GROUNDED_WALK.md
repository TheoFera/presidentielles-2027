# Mélenchon — marche rasante et derniers réglages

Proposition à tester, sans validation artistique présumée.

- Marche en garde : huit dessins successifs, pieds au ras du sol, un dessin toutes les deux mises à jour (15 poses/s), boucle de 0,533 seconde. Remplace les jambes levées de la proposition précédente.
- Persuasion : retrait de l’agrandissement de 6 % ; retour à sa taille initiale.
- Déclenchement d’ultime : agrandissement supplémentaire de 6 %, soit un facteur total de 1,1236 par rapport à la première version.
- Coup léger reçu : première pose durant quatre ticks, puis retour en garde jusqu’à huit ticks (0,267 s). L’étourdissement reste de cinq ticks : déplacement, attaque, saut, dash ou interaction reprennent la priorité immédiatement.
- Recul : pose dédiée seulement tant que la vitesse dépasse 0,5 unité/s. Le très faible ralentissement final ne maintient plus l’animation de glissade. L’aperçu reproduit désormais la décroissance de vitesse au lieu de maintenir artificiellement la pose.
- KO : maintien au sol supplémentaire de 0,5 seconde, sans changer la chute de 0,7 s ni la réapparition à 3 s. Le délai de disparition fait partie de la sauvegarde existante.
- Coups normaux et chargés : toutes les cibles ennemies dans leur portée et leur hauteur peuvent être touchées, une seule fois chacune par attaque. La recharge d’ultime reste attribuée une fois par coup, comme auparavant. Les alliés, cibles derrière l’attaquant ou hors hauteur restent exclus par les collisions existantes.

## Marine Le Pen et Édouard Philippe

Les deux planches de combat existent et le contrôle navigateur affiche leurs treize poses. Le filtre existant les réserve au costume initial et aux styles Souverainiste / Gestionnaire. Les autres styles et transformations n’ont pas de planche de combat dédiée : ils gardent le rendu antérieur. Cette limite explique une absence après changement de style, mais ne prouve pas le style actif dans la partie de l’utilisateur.

Aperçus : `/src/presentation/combat-preview.html?candidate=le_pen` et `?candidate=philippe`.

## Asset généré et prompt

Outil : **ImageGen intégré**. PNG RGBA 1774 × 887, copié sans retouche bitmap vers `assets/generated/animations/melenchon-grounded-walk-v1.png`. Référence : `assets/generated/animations/melenchon-base-combat-v4.png`. Découpes dans `melenchon-extra-atlases.js`, hauteur anatomique de référence 445 pixels.

Use case: stylized-concept. Transparent RGBA sprite atlas, FOUR columns TWO rows, exactly EIGHT successive frames of a smooth low grounded fighting-game advancing shuffle. Reference is APPROVED Mélenchon identity and comic art style, match thin outlines grey swept hair, elderly face, glasses, black suit and red scarf exactly. All full-body facing RIGHT, raised guard, stable upright torso, head and hips centred identically in every cell. Eight incremental sequential drawings of ONE SAME continuous advance step, not random poses. HARD CONSTRAINT: NO high knees, NO marching, NO running, NO bouncing, NO hopping. Shoes skim the floor: maximum toe clearance is 1/10 shoe height, soles stay almost horizontal. The front foot glides forward ONE shoe length over frames 0 1 2 3, rear foot remains planted: legs widen progressively with clear but modest changes in ankle position. Frames 4 5 6 7 rear foot glides toward front foot ONE shoe length, narrowing stance back to starting width. Rear foot stays rear, never crosses front foot. Distinguish each intermediate pose through small incremental knee angles and shoe horizontal positions; moving shoes do not raise up. Front knee moderately flexed, back knee never lifted up in front of body. At most a tiny heel peel. Torso and head SAME size and height all eight frames, no lateral sway, do not move face around. First and last frames loop smoothly, no scale drift. Character anatomical scale same as reference. Each cell has an identical ground baseline and centred hip anchor, generous transparent gutters. No text labels, no floor, no shadow, no speed lines, no effects.

## Vérifications

Tests des quatre types de frappe sur deux adversaires simultanés en campagne et en arène, sans dégâts répétés ; sauvegarde du KO prolongé ; priorités de la réaction légère ; fin de pose de recul ; huit phases de marche et tailles spécifiques. Galerie des trois candidats et aperçu des mouvements dans Chrome.


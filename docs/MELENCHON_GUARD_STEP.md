# Mélenchon — cycle de garde lié au déplacement

Cette proposition remplace la marche rasante à huit poses, refusée après essai. Elle n’est pas considérée comme validée artistiquement.

## Changements

- Douze dessins indépendants : poussée arrière, avancée basse du pied avant, contact du talon, transfert du poids, retour du pied arrière et stabilisation.
- Le cycle avance selon la distance réellement parcourue, et non selon l’horloge globale. Deux unités du monde correspondent à un cycle ; à la vitesse de base de quatre unités/s, sa durée est 0,5 s.
- Un arrêt, une action prioritaire ou un demi-tour réinitialise le cycle. Un temps qui avance sans déplacement ne fait pas changer les appuis. Les téléportations, retours en arrière de la simulation et changements de phase réinitialisent également la mémoire visuelle.
- La simulation et les sauvegardes ne sont pas modifiées. Les positions circulaires utilisent la géométrie du combat existante.
- Nouvel aperçu `src/presentation/melenchon-guard-preview.html` : déplacement issu de GameSimulation, arrêts, demi-tours, interpolation de la position à l’affichage, repères au sol, touches fléchées et boutons maintenus. La galerie générale reste disponible et alimente elle aussi une distance parcourue pour son essai de garde.

## Asset et prompt

Outil **ImageGen intégré** ; planche RGBA de 1448 × 1086 copiée sans retouche bitmap dans `assets/generated/animations/melenchon-guard-step-v1.png`. Référence : `assets/generated/animations/melenchon-base-combat-v4.png`. Découpes et ancrages mesurés dans `melenchon-extra-atlases.js`, référence anatomique de 410 pixels.

Use case stylized-concept. A professional hand-drawn 2D fighting game locomotion sprite sheet. 4 columns by 3 rows, exactly 12 sequential animation frames of Jean-Luc Mélenchon advancing RIGHT in guard. Transparent RGBA, no backdrop, no grid text labels or shadow. Reference fixes EXACT face, grey hair, rectangular glasses, red scarf, black suit, fine comic ink, head/body proportions. Crucial: a coherent WALK CYCLE with WEIGHT TRANSFER and HEEL/TOE ARTICULATION, not twelve copies of a static pose with feet spread. All sprites full body, same scale, same head height, hips centred each cell. A grounded step-and-drag fighting advance, moderate knee flex, elbows naturally guarding ribs, fists near chin. Lead foot always remains ahead of rear foot. NO raised knee or marching. Swing foot clears floor only a few pixels, not a lifted leg. Frame progression row-major: 1 balanced compact guard, rear heel beginning push; 2 push through rear toes, front heel unweights; 3 front foot travels forward low with toes slightly raised, rear planted; 4 front foot reaches maximum forward distance and heel contacts, rear leg extends; 5 front sole rolls flat, weight starts transferring; 6 weight settles over front knee, rear heel peels off; 7 rear shoe leaves floor just enough to return low; 8 rear knee flexes slightly and shoe glides forward close to ground; 9 rear foot nearly catches up behind front, rear toes contact; 10 rear sole settles and weight rebalances; 11 settle into compact guard; 12 almost matches frame1 so loop is seamless. Visible yet anatomically modest changes in calf shape, knee angle, soles, heel contact and weight between each drawing. No foot crossing, no forward rear knee, no up-and-down body bounce. Preserve the face and torso instead of redrawing different faces. Each cell identical size, generous transparent margin around entire person. Professional animation inbetweens, no duplicates.

## Vérifications

Tests du cycle selon la distance, arrêt, reprise, demi-tour, téléportation et absence de mutation de la simulation. Contrôle Chrome par `scripts/validate-guard-walk-browser.mjs` et galerie générale par `scripts/validate-melenchon-actions-browser.mjs`. Captures dans `artifacts/melenchon-guard-*.png`.


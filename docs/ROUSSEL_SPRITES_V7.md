# Roussel — correction combo et garde v7

Les planches combat et déplacement reprennent les poses de Philippe comme références anatomiques. La pose du deuxième coup traverse le buste avec le bras opposé. Les huit pas glissés reprennent les positions de pieds de Philippe. L'identité est fournie par la planche v6 de Roussel. Une échelle uniforme par planche garde la taille stable ; la largeur au repos est calibrée en plus de la hauteur, sans étirement.

Outil : image_gen intégré. PNG transparents conservés sans retouche, découpes remesurées.

## combat

Fichier : assets/generated/minor-candidates/roussel-combat-v7.png

Instruction : Correct animation anatomy of image1 Fabien Roussel sheet. Preserve EXACT image1 face, head proportions, hair, expression, colors, outfit and visual identity in every sprite, user approved this identity. Image2 Philippe is ONLY exact skeletal pose and ordering template, not character identity. Copy image2 ALL16 full-body limb poses EXACTLY row-major,4columns x4rows, onto Roussel. Critical: first punch at row1col4 extends LEFT front/near arm. Second punch row2col2 MUST extend OPPOSITE RIGHT rear/far arm with shoulder and torso rotated, like Philippe image2 row2col2: rear-arm sleeve crosses horizontally IN FRONT OF CHEST, front/near left fist folds back by chin. Two punches visibly different arms, not same arm twice. Windups row1col3 and row2col1 use corresponding opposite arms. Row2col3 knee preparation and row2col4 kick. All other poses copy exact image2 body positions too. Anatomical size uniform across16 poses; crouched figures retain same head and limb lengths. Full bodies in isolated equalcells with30px margins around every silhouette, no touch overlap clipping or shadow. True transparent RGBA. No labels background extra props. Maintain approved Roussel face as if reusing same head, do not borrow Philippe glasses baldness beard or tie.

## movement

Fichier : assets/generated/minor-candidates/roussel-movement-v7.png

Instruction : Correct animation anatomy of image1 Fabien Roussel sheet. Preserve EXACT image1 face, head proportions, hair, expression, colors, outfit and visual identity in every sprite, user approved this identity. Image2 Philippe is ONLY exact skeletal pose and ordering template, not character identity. Copy image2 ALL16 full-body limb poses EXACTLY row-major,4columns x4rows, onto Roussel. Critical FIRST TWO ROWS are exactly the eight guard shuffle poses of image2, same leg identity and foot placement/angles each frame, stable head and hip height. Leading front foot slides forward then rear foot draws in, each frame corresponds precisely to its counterpart. Low planted grounded shuffle, no marching, no forward leaning/run, no high knees. Fists consistently at same heights. Last two rows copy dash/landing/hit/knockback image2 poses EXACTLY. Anatomical size uniform across16 poses; crouched figures retain same head and limb lengths. Full bodies in isolated equalcells with30px margins around every silhouette, no touch overlap clipping or shadow. True transparent RGBA. No labels background extra props. Maintain approved Roussel face as if reusing same head, do not borrow Philippe glasses baldness beard or tie.


## Échelle à l’affichage

Les planches ne dessinent pas Roussel à la même taille. `scripts/measure-minor-animations.mjs` applique un facteur par rangée (déplacement ×1,13 / ×1,09 / ×1,11 / ×1,11 ; actions ×1,15), calé sur la tête de la garde de combat, pour éviter qu’il rapetisse en marchant.

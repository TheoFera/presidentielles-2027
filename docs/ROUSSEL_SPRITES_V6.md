# Roussel — sprites v6

## Correction du dimensionnement

Le calibrage sur la seule première pose dilatait horizontalement la planche de combat de 27 %. Cet étirement est supprimé. La réduction variable par pose a également été retirée : elle faisait rétrécir le personnage lorsqu'il écartait les pieds. Toutes les poses d'une même planche utilisent maintenant le même facteur de 0,92, après calibrage sur Philippe. La pose debout et sa marche générale sont réduites de 6 % sur les deux axes.

Contrôles : six tests ciblés réussis, dont la constance de l'échelle sur les 44 poses ; dix animations vérifiées dans Chrome ; export web réussi. La silhouette peut naturellement s'élargir pendant un coup de pied ; cet écart ne change plus l'échelle de tout le corps.

Planches dérivées exclusivement des deux références validées : pose debout fournie par l’utilisateur et `artifacts/roussel-proposals/roussel-single-guard.png`. Les planches rejetées ne servent pas de références. Outil : image_gen intégré, fond transparent ; images copiées dans le projet sans retouche raster. Découpes remesurées et échelle calibrée sur Philippe.

## base

Fichier : assets/generated/minor-candidates/roussel-v6.png

Source : exec-ec6b77e2-ff73-4d31-b63a-32e206ebef8e.png

Instruction : Strict animation derivation of APPROVED character in images1 and2. Image1 guard and image2 standing are same chosen Fabien Roussel. Retain their EXACT face as if reusing master head: large softly rectangular face, precise wide rounded nose, softly rounded heavy chin, subtle closed half-smile, exact pale blue eyes, brows, cheek creases, natural wavy grey-brown hair and silver sides, same hair height and direction. Same LARGE head to compact body ratio, not shrink head or replace with thin grumpy older man. No generic caricature substitution, no added angular cheekbones. STRICT matching black outlines and celshading of these TWO references. Navy suit open white shirt black shoes. Generate12 isolated full-body base animation sprites in4columns x3rows using following EXACT row-major order: row1: idle standing arms down, walking left leg forward, walking right leg forward, running; row2: left punch extended, right punch extended, high kick, crouch charge; row3: received hit leaning back, knockback arms out, KO lying on side, persuasion open hands. All face right. Anatomical scale consistent, don't resize heads in crouches. Face and hair remain recognizable in each action; head angle mostly unchanged except falling. No extra references or old character designs. Uniform cells ample padding35px minimum between bodies, full heads feet hands inside frame, avoid touching other rows. True transparent RGBA, no ground shadow backdrop text or other elements. EXACTLY12 silhouettes.

## combat

Fichier : assets/generated/minor-candidates/roussel-combat-v6.png

Source : exec-5b03376b-4310-4641-8616-7112ec5be553.png

Instruction : Strict animation derivation of APPROVED character in images1 and2. Image1 guard and image2 standing are same chosen Fabien Roussel. Retain their EXACT face as if reusing master head: large softly rectangular face, precise wide rounded nose, softly rounded heavy chin, subtle closed half-smile, exact pale blue eyes, brows, cheek creases, natural wavy grey-brown hair and silver sides, same hair height and direction. Same LARGE head to compact body ratio, not shrink head or replace with thin grumpy older man. No generic caricature substitution, no added angular cheekbones. STRICT matching black outlines and celshading of these TWO references. Navy suit open white shirt black shoes. Generate16 isolated full-body combat animation sprites in4columns x4rows using following EXACT row-major order: row1: guard relaxed, guard slightly lower, left punch windup, left punch extension; row2: right punch windup, right punch extension, kick knee preparation, horizontal kick extension; row3: crouch charge, charged kick preparation, charged horizontal kick, charged recovery knee; row4: jump crouch launch, airborne tucked knees, airborne descending, airborne horizontal kick. All face right. Anatomical scale consistent, don't resize heads in crouches. Face and hair remain recognizable in each action; head angle mostly unchanged except falling. No extra references or old character designs. Uniform cells ample padding35px minimum between bodies, full heads feet hands inside frame, avoid touching other rows. True transparent RGBA, no ground shadow backdrop text or other elements. EXACTLY16 silhouettes.

## movement

Fichier : assets/generated/minor-candidates/roussel-movement-v6.png

Source : exec-71590b86-7870-450b-b865-ce186e4d31ce.png

Instruction : Strict animation derivation of APPROVED character in images1 and2. Image1 guard and image2 standing are same chosen Fabien Roussel. Retain their EXACT face as if reusing master head: large softly rectangular face, precise wide rounded nose, softly rounded heavy chin, subtle closed half-smile, exact pale blue eyes, brows, cheek creases, natural wavy grey-brown hair and silver sides, same hair height and direction. Same LARGE head to compact body ratio, not shrink head or replace with thin grumpy older man. No generic caricature substitution, no added angular cheekbones. STRICT matching black outlines and celshading of these TWO references. Navy suit open white shirt black shoes. Generate16 isolated full-body movement animation sprites in4columns x4rows using following EXACT row-major order: row1 and row2: eight consecutive low sliding boxer guard shuffle poses with fists raised, lead foot slides forward then rear foot catches up then return, alternating actual left and right feet movement, no high knee. row3: low dash preparation, long grounded dash, dash recovery, upright landing recovery. row4: guard hit-start, lean-back hit, knockback-start arms raised, backward falling seated. All face right. Anatomical scale consistent, don't resize heads in crouches. Face and hair remain recognizable in each action; head angle mostly unchanged except falling. No extra references or old character designs. Uniform cells ample padding35px minimum between bodies, full heads feet hands inside frame, avoid touching other rows. True transparent RGBA, no ground shadow backdrop text or other elements. EXACTLY16 silhouettes.

## actions

Fichier : assets/generated/minor-candidates/roussel-actions-v6.png

Source : exec-78fda526-8711-403b-ae81-04f6fa043cb0.png

Instruction : Strict animation derivation of APPROVED character in images1 and2. Image1 guard and image2 standing are same chosen Fabien Roussel. Retain their EXACT face as if reusing master head: large softly rectangular face, precise wide rounded nose, softly rounded heavy chin, subtle closed half-smile, exact pale blue eyes, brows, cheek creases, natural wavy grey-brown hair and silver sides, same hair height and direction. Same LARGE head to compact body ratio, not shrink head or replace with thin grumpy older man. No generic caricature substitution, no added angular cheekbones. STRICT matching black outlines and celshading of these TWO references. Navy suit open white shirt black shoes. Generate12 isolated full-body actions animation sprites in4columns x3rows using following EXACT row-major order: row1: idle standing arms down, hand behind head thoughtful, crouch hand touching ground, rising from crouch; row2: persuasion open hands A, persuasion open hands B, listening arms relaxed, listening hand at chest; row3: loss-of-balance arms out, falling sideways, on side propped on elbow, KO lying on side. All face right. Anatomical scale consistent, don't resize heads in crouches. Face and hair remain recognizable in each action; head angle mostly unchanged except falling. No extra references or old character designs. Uniform cells ample padding35px minimum between bodies, full heads feet hands inside frame, avoid touching other rows. True transparent RGBA, no ground shadow backdrop text or other elements. EXACTLY12 silhouettes.


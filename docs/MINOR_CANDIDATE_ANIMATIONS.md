# Animations secondaires alignées sur les candidats principaux

Cette version remplace la marche à quatre poses avec le genou haut et les anciennes poses de combat simplifiées.

Les six candidats secondaires utilisent désormais le même moteur de rendu que Mélenchon, Marine Le Pen et Édouard Philippe :
- garde selon la proximité d’un adversaire ;
- huit pas glissés de garde, synchronisés avec la distance parcourue, y compris la marche arrière ;
- préparation, impact et récupération des deux poings, du coup de pied et du coup chargé ;
- impulsion, montée, descente, coup aérien et réception ;
- esquive, coups reçus, étourdissement, projection ;
- persuasion, chute, K.-O. et relevé par lecture inverse des poses de chute.

Hors combat, le sprite de repos conserve le mouvement discret des principaux. Le dessin du torse et des deux jambes est partagé dans `standing-sprite-motion.js` : aucune pose avec le genou haut n’est utilisée pour marcher.

Chaque candidat dispose de 44 poses nouvelles : 16 de combat, 16 de déplacement/réaction, 12 d’actions. Les sprites de véhicules, les achats, les changements de tenue et les activations de pouvoirs ultimes ne sont pas produits. Le sprite de repos et le visage de chaque candidat restent issus des planches précédentes. Les lunettes d’Arthaud et de Retailleau sont conservées.

## Intégration

`minor-animation-sprites.js` enregistre les fichiers ; `minor-animation-data.js` contient leurs silhouettes mesurées. Le moteur partagé est `melenchon-combat.js`, avec les mêmes priorités, temporisations et mémoire de mouvement. `candidate-extra-poses.js` adapte uniquement les indices des poses de chute, car les planches des secondaires omettent les interactions inutiles.

Les PNG finaux sont conservés sans retouche. Les rectangles sont mesurés avec `node scripts/measure-minor-animations.mjs`. Chaque silhouette est isolée une fois au chargement pour éviter les fragments voisins. L’échelle tient compte de l’étirement déjà appliqué par le moteur des principaux.

Aperçu comparatif : `src/presentation/minor-sprite-preview.html`. Choisir un candidat et une action affiche la même animation pour Philippe et le candidat choisi, via le rendu du jeu. L’ancienne adresse `minor-walk-preview.html` redirige vers cet aperçu.

## Production

Outil : `image_gen.imagegen` intégré, en mode style-transfer, avec transparence. Image 1 : planche originale de Philippe pour le type d’animation ; image 2 : sprite de repos du candidat concerné. Les poses de combat et de déplacement copient l’ordre des principaux. Les actions sélectionnent seulement les poses nécessaires, avec deux poses d’écoute en complément.

## Vérification

Tests : `test/minor-animation.test.js`, `test/melenchon-animation.test.js`, `test/visual-assets.test.js`, `test/minor-candidates.test.js`, et test d’export `test/pages.test.js`.

Chrome : `scripts/validate-minor-animations-browser.mjs` vérifie les 44 poses de chacun, dix animations jouées par le moteur du jeu et le sens gauche. Les différences d’images vérifient l’animation ; la forme des pas et l’apparence sont également contrôlées visuellement.

## Prompts exacts et chemins

### glucksmann · combat

Fichier : `assets/generated/minor-candidates/glucksmann-combat-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-132fffd6-bb33-49e6-b061-5a0d08590384.png`.

Référence de poses : `assets/generated/animations/philippe-base-combat-v1.png`. Référence d’identité : `artifacts/minor-sprites/glucksmann-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY 16 full-body poses in 4 columns x4 rows. Transfer EVERY pose in image1 one-to-one at the same grid index, including fist preparation/extension, kicks and airborne phases. Keep identical movement, angle, planted feet, arm anatomy, head direction, and pose ordering. Change ONLY character identity and clothing to image2. No pose substitutions. Top row guard1 guard2 first punch windup first punch impact; row2 second punch windup second punch impact kick windup kick impact; row3 charge focus ready charged kick recovery; row4 jump takeoff jump rise jump descent aerial kick. Target: Raphaël Glucksmann, tousled dark hair, stubble, navy suit, open white shirt, tiny pink pin. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### roussel · combat

Fichier : `assets/generated/minor-candidates/roussel-combat-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-205ea7bf-cd74-4710-bb57-c89f537ece35.png`.

Référence de poses : `assets/generated/animations/philippe-base-combat-v1.png`. Référence d’identité : `artifacts/minor-sprites/roussel-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY 16 full-body poses in 4 columns x4 rows. Transfer EVERY pose in image1 one-to-one at the same grid index, including fist preparation/extension, kicks and airborne phases. Keep identical movement, angle, planted feet, arm anatomy, head direction, and pose ordering. Change ONLY character identity and clothing to image2. No pose substitutions. Top row guard1 guard2 first punch windup first punch impact; row2 second punch windup second punch impact kick windup kick impact; row3 charge focus ready charged kick recovery; row4 jump takeoff jump rise jump descent aerial kick. Target: Fabien Roussel, full wavy grey quiff, square jaw, open white shirt, blue grey suit, tiny red pin, no tie. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### arthaud · combat

Fichier : `assets/generated/minor-candidates/arthaud-combat-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-6f6e5130-4123-40a6-8daa-bc6f4b8e0760.png`.

Référence de poses : `assets/generated/animations/philippe-base-combat-v1.png`. Référence d’identité : `artifacts/minor-sprites/arthaud-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY 16 full-body poses in 4 columns x4 rows. Transfer EVERY pose in image1 one-to-one at the same grid index, including fist preparation/extension, kicks and airborne phases. Keep identical movement, angle, planted feet, arm anatomy, head direction, and pose ordering. Change ONLY character identity and clothing to image2. No pose substitutions. Top row guard1 guard2 first punch windup first punch impact; row2 second punch windup second punch impact kick windup kick impact; row3 charge focus ready charged kick recovery; row4 jump takeoff jump rise jump descent aerial kick. Target: Nathalie Arthaud, short dark pixie hair, burgundy rectangular glasses MUST stay in every frame, red blazer, black top, blue trousers and black low shoes. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### dupont_aignan · combat

Fichier : `assets/generated/minor-candidates/dupont_aignan-combat-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-b9dac943-38e3-4fdd-86b6-ef271cf36934.png`.

Référence de poses : `assets/generated/animations/philippe-base-combat-v1.png`. Référence d’identité : `artifacts/minor-sprites/dupont_aignan-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY 16 full-body poses in 4 columns x4 rows. Transfer EVERY pose in image1 one-to-one at the same grid index, including fist preparation/extension, kicks and airborne phases. Keep identical movement, angle, planted feet, arm anatomy, head direction, and pose ordering. Change ONLY character identity and clothing to image2. No pose substitutions. Top row guard1 guard2 first punch windup first punch impact; row2 second punch windup second punch impact kick windup kick impact; row3 charge focus ready charged kick recovery; row4 jump takeoff jump rise jump descent aerial kick. Target: Nicolas Dupont-Aignan, short brown greying side parted hair, broad mature face, dark navy suit, white shirt, blue tie, no glasses. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### retailleau · combat

Fichier : `assets/generated/minor-candidates/retailleau-combat-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-5c814f3d-29ab-4aff-b963-ad3ad73541b4.png`.

Référence de poses : `assets/generated/animations/philippe-base-combat-v1.png`. Référence d’identité : `artifacts/minor-sprites/retailleau-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY 16 full-body poses in 4 columns x4 rows. Transfer EVERY pose in image1 one-to-one at the same grid index, including fist preparation/extension, kicks and airborne phases. Keep identical movement, angle, planted feet, arm anatomy, head direction, and pose ordering. Change ONLY character identity and clothing to image2. No pose substitutions. Top row guard1 guard2 first punch windup first punch impact; row2 second punch windup second punch impact kick windup kick impact; row3 charge focus ready charged kick recovery; row4 jump takeoff jump rise jump descent aerial kick. Target: Bruno Retailleau, slender lined face, short dark greying hair, round black glasses MUST stay in every frame, navy suit, white shirt blue tie. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### attal · combat

Fichier : `assets/generated/minor-candidates/attal-combat-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-08318627-1a1d-4b5f-b18b-0de86b04071b.png`.

Référence de poses : `assets/generated/animations/philippe-base-combat-v1.png`. Référence d’identité : `artifacts/minor-sprites/attal-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY 16 full-body poses in 4 columns x4 rows. Transfer EVERY pose in image1 one-to-one at the same grid index, including fist preparation/extension, kicks and airborne phases. Keep identical movement, angle, planted feet, arm anatomy, head direction, and pose ordering. Change ONLY character identity and clothing to image2. No pose substitutions. Top row guard1 guard2 first punch windup first punch impact; row2 second punch windup second punch impact kick windup kick impact; row3 charge focus ready charged kick recovery; row4 jump takeoff jump rise jump descent aerial kick. Target: Gabriel Attal, youthful clean shaven face, short dark side parted hair, blue suit, white open collar shirt tiny orange pin. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### glucksmann · movement

Fichier : `assets/generated/minor-candidates/glucksmann-movement-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-ee28efb6-6dee-452c-9bb4-bc33e87afa22.png`.

Référence de poses : `assets/generated/animations/philippe-movement-v1.png`. Référence d’identité : `artifacts/minor-sprites/glucksmann-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY16 full-body poses in4 columns x4rows. Transfer EVERY pose in image1 one-to-one at same grid index. Preserve low grounded boxer shuffle: first TWO ROWS are an EIGHT frame seamless guard step with fists raised, same lead foot, SMALL foot slides close to ground, NO marching and NO raised high knee anywhere in shuffle. Row3 is dash preparation, dash extension, dash recovery, light hit1; row4 light hit2, heavy hit1, heavy hit2, knockback. Copy precise subtle foot positions and shapes from image1, change ONLY identity and clothing to image2. No walking arms down, no high marching knee. Target: Raphaël Glucksmann, tousled dark hair, stubble, navy suit, open white shirt, tiny pink pin. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### roussel · movement

Fichier : `assets/generated/minor-candidates/roussel-movement-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-50823b92-2d5a-40ea-9493-6675b9983b88.png`.

Référence de poses : `assets/generated/animations/philippe-movement-v1.png`. Référence d’identité : `artifacts/minor-sprites/roussel-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY16 full-body poses in4 columns x4rows. Transfer EVERY pose in image1 one-to-one at same grid index. Preserve low grounded boxer shuffle: first TWO ROWS are an EIGHT frame seamless guard step with fists raised, same lead foot, SMALL foot slides close to ground, NO marching and NO raised high knee anywhere in shuffle. Row3 is dash preparation, dash extension, dash recovery, light hit1; row4 light hit2, heavy hit1, heavy hit2, knockback. Copy precise subtle foot positions and shapes from image1, change ONLY identity and clothing to image2. No walking arms down, no high marching knee. Target: Fabien Roussel, full wavy grey quiff, square jaw, open white shirt, blue grey suit, tiny red pin, no tie. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### arthaud · movement

Fichier : `assets/generated/minor-candidates/arthaud-movement-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-76ea20e2-7d9e-40ec-ad21-171bb7bdce48.png`.

Référence de poses : `assets/generated/animations/philippe-movement-v1.png`. Référence d’identité : `artifacts/minor-sprites/arthaud-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY16 full-body poses in4 columns x4rows. Transfer EVERY pose in image1 one-to-one at same grid index. Preserve low grounded boxer shuffle: first TWO ROWS are an EIGHT frame seamless guard step with fists raised, same lead foot, SMALL foot slides close to ground, NO marching and NO raised high knee anywhere in shuffle. Row3 is dash preparation, dash extension, dash recovery, light hit1; row4 light hit2, heavy hit1, heavy hit2, knockback. Copy precise subtle foot positions and shapes from image1, change ONLY identity and clothing to image2. No walking arms down, no high marching knee. Target: Nathalie Arthaud, short dark pixie hair, burgundy rectangular glasses MUST stay in every frame, red blazer, black top, blue trousers and black low shoes. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### dupont_aignan · movement

Fichier : `assets/generated/minor-candidates/dupont_aignan-movement-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-7714dd71-3ccc-4b6f-95d0-66f1c5af7db2.png`.

Référence de poses : `assets/generated/animations/philippe-movement-v1.png`. Référence d’identité : `artifacts/minor-sprites/dupont_aignan-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY16 full-body poses in4 columns x4rows. Transfer EVERY pose in image1 one-to-one at same grid index. Preserve low grounded boxer shuffle: first TWO ROWS are an EIGHT frame seamless guard step with fists raised, same lead foot, SMALL foot slides close to ground, NO marching and NO raised high knee anywhere in shuffle. Row3 is dash preparation, dash extension, dash recovery, light hit1; row4 light hit2, heavy hit1, heavy hit2, knockback. Copy precise subtle foot positions and shapes from image1, change ONLY identity and clothing to image2. No walking arms down, no high marching knee. Target: Nicolas Dupont-Aignan, short brown greying side parted hair, broad mature face, dark navy suit, white shirt, blue tie, no glasses. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### retailleau · movement

Fichier : `assets/generated/minor-candidates/retailleau-movement-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-44185855-2d51-43c5-a2ce-1eb19d414dc8.png`.

Référence de poses : `assets/generated/animations/philippe-movement-v1.png`. Référence d’identité : `artifacts/minor-sprites/retailleau-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY16 full-body poses in4 columns x4rows. Transfer EVERY pose in image1 one-to-one at same grid index. Preserve low grounded boxer shuffle: first TWO ROWS are an EIGHT frame seamless guard step with fists raised, same lead foot, SMALL foot slides close to ground, NO marching and NO raised high knee anywhere in shuffle. Row3 is dash preparation, dash extension, dash recovery, light hit1; row4 light hit2, heavy hit1, heavy hit2, knockback. Copy precise subtle foot positions and shapes from image1, change ONLY identity and clothing to image2. No walking arms down, no high marching knee. Target: Bruno Retailleau, slender lined face, short dark greying hair, round black glasses MUST stay in every frame, navy suit, white shirt blue tie. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### attal · movement

Fichier : `assets/generated/minor-candidates/attal-movement-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-a9186446-613c-47b1-8834-1453e84f57fa.png`.

Référence de poses : `assets/generated/animations/philippe-movement-v1.png`. Référence d’identité : `artifacts/minor-sprites/attal-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY16 full-body poses in4 columns x4rows. Transfer EVERY pose in image1 one-to-one at same grid index. Preserve low grounded boxer shuffle: first TWO ROWS are an EIGHT frame seamless guard step with fists raised, same lead foot, SMALL foot slides close to ground, NO marching and NO raised high knee anywhere in shuffle. Row3 is dash preparation, dash extension, dash recovery, light hit1; row4 light hit2, heavy hit1, heavy hit2, knockback. Copy precise subtle foot positions and shapes from image1, change ONLY identity and clothing to image2. No walking arms down, no high marching knee. Target: Gabriel Attal, youthful clean shaven face, short dark side parted hair, blue suit, white open collar shirt tiny orange pin. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### glucksmann · actions

Fichier : `assets/generated/minor-candidates/glucksmann-actions-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-a64a5489-44ce-4b6b-b31e-294151eb0132.png`.

Référence de poses : `assets/generated/animations/philippe-actions-v1.png`. Référence d’identité : `artifacts/minor-sprites/glucksmann-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY12 full-body poses in4 columns x3rows. REARRANGE selected useful poses from image1 into this NEW explicit order: row1 cell1 dazed upright matching source0; cell2 hand behind head matching source1; cell3 landing crouch hand on ground matching source2; cell4 landing recovery matching source3. Row2 cell1 persuading open hand matching source4; cell2 second persuasion matching source5; cell3 relaxed listening arms down; cell4 listening hand near chest. Row3 FOUR consecutive KO fall phases matching source10 source11 source12 source13: lose balance, fall side, partly down, lying sideways fully KO. NO paper, NO pen, NO purchase interaction and NO ultimate activation. Change ONLY character identity/clothing to image2 and preserve source pose silhouettes of requested indices. KO bodies must fit full width within their cells with generous transparent gap. Target: Raphaël Glucksmann, tousled dark hair, stubble, navy suit, open white shirt, tiny pink pin. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### roussel · actions

Fichier : `assets/generated/minor-candidates/roussel-actions-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-551c93ff-6d7a-4059-ae49-4b3974d256df.png`.

Référence de poses : `assets/generated/animations/philippe-actions-v1.png`. Référence d’identité : `artifacts/minor-sprites/roussel-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY12 full-body poses in4 columns x3rows. REARRANGE selected useful poses from image1 into this NEW explicit order: row1 cell1 dazed upright matching source0; cell2 hand behind head matching source1; cell3 landing crouch hand on ground matching source2; cell4 landing recovery matching source3. Row2 cell1 persuading open hand matching source4; cell2 second persuasion matching source5; cell3 relaxed listening arms down; cell4 listening hand near chest. Row3 FOUR consecutive KO fall phases matching source10 source11 source12 source13: lose balance, fall side, partly down, lying sideways fully KO. NO paper, NO pen, NO purchase interaction and NO ultimate activation. Change ONLY character identity/clothing to image2 and preserve source pose silhouettes of requested indices. KO bodies must fit full width within their cells with generous transparent gap. Target: Fabien Roussel, full wavy grey quiff, square jaw, open white shirt, blue grey suit, tiny red pin, no tie. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### arthaud · actions

Fichier : `assets/generated/minor-candidates/arthaud-actions-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-a3bbe9df-ded7-4df2-bfc6-f76a8b9083f6.png`.

Référence de poses : `assets/generated/animations/philippe-actions-v1.png`. Référence d’identité : `artifacts/minor-sprites/arthaud-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY12 full-body poses in4 columns x3rows. REARRANGE selected useful poses from image1 into this NEW explicit order: row1 cell1 dazed upright matching source0; cell2 hand behind head matching source1; cell3 landing crouch hand on ground matching source2; cell4 landing recovery matching source3. Row2 cell1 persuading open hand matching source4; cell2 second persuasion matching source5; cell3 relaxed listening arms down; cell4 listening hand near chest. Row3 FOUR consecutive KO fall phases matching source10 source11 source12 source13: lose balance, fall side, partly down, lying sideways fully KO. NO paper, NO pen, NO purchase interaction and NO ultimate activation. Change ONLY character identity/clothing to image2 and preserve source pose silhouettes of requested indices. KO bodies must fit full width within their cells with generous transparent gap. Target: Nathalie Arthaud, short dark pixie hair, burgundy rectangular glasses MUST stay in every frame, red blazer, black top, blue trousers and black low shoes. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### dupont_aignan · actions

Fichier : `assets/generated/minor-candidates/dupont_aignan-actions-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-f822d010-09db-4ebf-8464-8f4a49acbdf0.png`.

Référence de poses : `assets/generated/animations/philippe-actions-v1.png`. Référence d’identité : `artifacts/minor-sprites/dupont_aignan-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY12 full-body poses in4 columns x3rows. REARRANGE selected useful poses from image1 into this NEW explicit order: row1 cell1 dazed upright matching source0; cell2 hand behind head matching source1; cell3 landing crouch hand on ground matching source2; cell4 landing recovery matching source3. Row2 cell1 persuading open hand matching source4; cell2 second persuasion matching source5; cell3 relaxed listening arms down; cell4 listening hand near chest. Row3 FOUR consecutive KO fall phases matching source10 source11 source12 source13: lose balance, fall side, partly down, lying sideways fully KO. NO paper, NO pen, NO purchase interaction and NO ultimate activation. Change ONLY character identity/clothing to image2 and preserve source pose silhouettes of requested indices. KO bodies must fit full width within their cells with generous transparent gap. Target: Nicolas Dupont-Aignan, short brown greying side parted hair, broad mature face, dark navy suit, white shirt, blue tie, no glasses. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### retailleau · actions

Fichier : `assets/generated/minor-candidates/retailleau-actions-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-556d619f-7edf-49b4-b6b4-a24dda1bf059.png`.

Référence de poses : `assets/generated/animations/philippe-actions-v1.png`. Référence d’identité : `artifacts/minor-sprites/retailleau-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY12 full-body poses in4 columns x3rows. REARRANGE selected useful poses from image1 into this NEW explicit order: row1 cell1 dazed upright matching source0; cell2 hand behind head matching source1; cell3 landing crouch hand on ground matching source2; cell4 landing recovery matching source3. Row2 cell1 persuading open hand matching source4; cell2 second persuasion matching source5; cell3 relaxed listening arms down; cell4 listening hand near chest. Row3 FOUR consecutive KO fall phases matching source10 source11 source12 source13: lose balance, fall side, partly down, lying sideways fully KO. NO paper, NO pen, NO purchase interaction and NO ultimate activation. Change ONLY character identity/clothing to image2 and preserve source pose silhouettes of requested indices. KO bodies must fit full width within their cells with generous transparent gap. Target: Bruno Retailleau, slender lined face, short dark greying hair, round black glasses MUST stay in every frame, navy suit, white shirt blue tie. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

### attal · actions

Fichier : `assets/generated/minor-candidates/attal-actions-v3.png`.

Original : `C:\Users\ferat\.codex\generated_images\01a0ef72-11f0-7583-acf3-1df90836c250\exec-b83d56e7-d66e-439e-ac91-a55cb3165c29.png`.

Référence de poses : `assets/generated/animations/philippe-actions-v1.png`. Référence d’identité : `artifacts/minor-sprites/attal-standing-reference.png`.

Prompt exact :

> Use case: style-transfer. Asset type: hand inked game animation sprite sheet. Image1 is the exact main-candidate animation pose template to COPY; image2 is target identity and outfit reference. EXACTLY12 full-body poses in4 columns x3rows. REARRANGE selected useful poses from image1 into this NEW explicit order: row1 cell1 dazed upright matching source0; cell2 hand behind head matching source1; cell3 landing crouch hand on ground matching source2; cell4 landing recovery matching source3. Row2 cell1 persuading open hand matching source4; cell2 second persuasion matching source5; cell3 relaxed listening arms down; cell4 listening hand near chest. Row3 FOUR consecutive KO fall phases matching source10 source11 source12 source13: lose balance, fall side, partly down, lying sideways fully KO. NO paper, NO pen, NO purchase interaction and NO ultimate activation. Change ONLY character identity/clothing to image2 and preserve source pose silhouettes of requested indices. KO bodies must fit full width within their cells with generous transparent gap. Target: Gabriel Attal, youthful clean shaven face, short dark side parted hair, blue suit, white open collar shirt tiny orange pin. Keep target face, age, hair and glasses consistent across every pose. No Philippe baldness or beard on other candidates. Match approved caricature ink outlines and shading. Stable head/body scale across frames, no stretching of bent poses. All faces oriented RIGHT. True transparent RGBA square sheet, no captions, labels, borders, ground shadows or backdrop. Full bodies and shoes must stay inside cells and be separated by ample transparent gaps. Camera/body proportions match image2. 

# Calibrage de taille — 30 septembre 2026

Les trois familles de poses sont désormais calibrées sur la pose correspondante de Philippe : même hauteur visible et même largeur initiale. `scripts/measure-minor-animations.mjs` produit `referenceHeight` et `widthScale`, appliqués par le rendu partagé. Les silhouettes debout utilisent également la largeur de Philippe (161/384 de la hauteur). Les autres poses conservent leurs écarts naturels, sans agrandir une posture accroupie pour remplir toute la hauteur.

La validation Chrome compare les dimensions visibles des six mineurs à Philippe en garde, avec une tolérance de trois pixels, puis contrôle leurs dix animations. Les tests vérifient aussi les dimensions normalisées des trois familles de poses.


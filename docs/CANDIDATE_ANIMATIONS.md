# Animations de combat — Marine Le Pen et Édouard Philippe

Deux planches de seize poses distinctes, intégrées au rendu du jeu : garde et variante, préparation et frappe des deux poings, préparation et frappe du pied, concentration, charge prête, frappe chargée, récupération, départ du saut, montée, descente et coup aérien.

## Ressources et affichage

- Marine Le Pen : `assets/generated/animations/le-pen-base-combat-v1.png`.
- Édouard Philippe : `assets/generated/animations/philippe-base-combat-v1.png`.
- Chaque planche est un PNG RGBA transparent de 1254 × 1254. Les images générées sont copiées sans transformation ; le moteur découpe les silhouettes grâce aux coordonnées de `src/presentation/candidate-combat-atlases.js`.
- Les deux candidats utilisent exactement les réglages d’affichage validés pour Mélenchon : référence 340, hauteur × 1,1236, largeur × 1,06 ; saut et coup aérien × 1,06 ; charge prête et frappe chargée × 1,06 ; deuxième garde rehaussée de 5,5 %. Les pieds servent de points d’ancrage.
- Application au costume de base et aux styles Souverainiste / Gestionnaire. Les autres costumes, Bardella et les transformations d’ultime conservent leur rendu existant.
- Aperçu : `/src/presentation/combat-preview.html?candidate=le_pen` ou `?candidate=philippe`. Un lien permet aussi de comparer avec Mélenchon.
- Les poses sont dessinées séparément, sans animation de membres découpés. Leur correspondance artistique reste issue d’une génération ; l’aperçu permet de comparer les proportions réelles.

## Génération — outil ImageGen intégré

Pour chaque candidat, l’image 1 est son sprite initial (`character-le_pen.png` ou `character-philippe.png`). L’image 2 est la planche de poses validée `melenchon-base-combat-v4.png`.

### Prompt commun

Use case: stylized-concept. Make a TRUE transparent RGBA 4x4 combat sprite atlas, 1254 square. Image1 is character identity and outfit reference. Image2 is the APPROVED combat pose and anatomical size template. Replace ONLY the character of image2 with image1, preserving every pose, position, same head/body relative proportions, same scale across cells, fine detailed French comic ink and subtle shading. No chunky/thick black outer contour. Match approved template's standing silhouette height about300 pixels; tucked poses shorter, no scaling crouches up. All face right. Exactly sixteen complete independent drawn sprites (not puppet/cutouts), no shadows, labels, effects, backdrop. Exact row-major poses: guard; slightly lower alternate guard (only subtle height difference); jab windup; extended jab; cross windup; extended cross; kick knee preparation; horizontal strong sidekick; deep focus crouch; ready high knee chamber; charged front kick; kick retract recovery; jump takeoff crouch; jumping knees tucked; descending legs lowered; airborne flying sidekick. Keep generous transparent gutters, whole figures and extended limbs within each cell; no clipping. Maintain consistent head size and identity. 

### Complément Marine Le Pen

Character: Marine Le Pen, blonde shoulder length swept hair, navy blue trouser suit and blazer, white V neck blouse, black low shoes exactly as image1. Preserve feminine face and physique. No glasses, no scarf, no tie.

### Complément Édouard Philippe

Character: Edouard Philippe, bald on top with dark side hair, round black glasses, distinctive dark beard with white chin patch, charcoal suit and trousers, white shirt and navy necktie, black leather shoes exactly as image1. Preserve face. No scarf. Ensure especially airborne kick has transparent margin at right border.

## Vérification

Les poses supplémentaires de Marine Le Pen et Édouard Philippe (marche en garde, réactions, interactions et KO) sont décrites dans [CANDIDATE_EXTRA_ANIMATIONS.md](CANDIDATE_EXTRA_ANIMATIONS.md), avec les chemins des quatre planches et leurs prompts.

Tests de sélection des sprites, des poses et des costumes, transparence et limites des découpes. Vérification navigateur des treize aperçus de chacun des trois candidats avec le rendu réel du jeu ; captures dans `artifacts/candidate-animations/`. Script : `scripts/validate-candidate-atlases-browser.mjs`.

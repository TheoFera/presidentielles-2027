# Vérification des candidats majeurs

Le 30 septembre 2026, vérification des trois tenues de base, des six tenues supplémentaires et des transformations Super européiste et Bardella.

## Défaut corrigé

Les deux transformations alternaient seulement deux poses selon le temps écoulé. Elles utilisent maintenant huit pas de garde synchronisés sur la distance parcourue, comme les tenues habituelles. Un arrêt ou un changement de direction remet le cycle au départ. Les attaques, sauts et autres actions conservent leurs poses existantes.

La vérification dans Chrome confirme huit pas, l'arrêt et le retour vers la gauche pour les onze apparences. Aucun défaut de sélection des poses n'a été reproduit pour les trois tenues habituelles de Marine Le Pen.

## Ressources

Images créées avec l'outil intégré `image_gen`, sur fond transparent, en prenant comme références la marche de Philippe et la planche existante de chaque transformation. Les références ont été inspectées avant génération.

- `assets/generated/animations/ultimates/europe-guard-v2.png`
- `assets/generated/animations/ultimates/bardella-guard-v2.png`

Les découpes sont mesurées par `node scripts/measure-ultimate-guard.mjs`. La hauteur est calibrée sur les transformations existantes pour éviter un changement de taille.

## Vérifications reproductibles

- `node --test test/ultimate-animation.test.js test/melenchon-animation.test.js test/visual-assets.test.js`
- `node scripts/validate-major-guard-browser.mjs` (Playwright ; définir `CAMPAIGN_TEST_NODE_MODULES` vers le dossier contenant Playwright).
- `npm run build`

Les captures de contrôle se trouvent dans `artifacts/major-guard-audit/`. Les contrôles automatiques couvrent le choix des poses et leur déroulement ; l'appréciation de la fluidité reste visuelle.

## Instructions de génération

### Europe

Use case: style-transfer. Create a dedicated guard shuffle game animation sprite sheet, EXACTLY8 full body poses in4columns x2rows. Image1 gives EXACT anatomy and pose ordering to copy: ONLY FIRST TWO ROWS of its16-pose sheet, in their unchanged left-to-right order. Do not include any of image1's bottom two rows. Transfer the same grounded low boxer steps with raised fists, precise foot slide positions and planted feet. Small shuffle, NO high marching knee, no running or kicks. Image2 is the EXACT character identity and costume to preserve in every pose. Edouard Philippe SUPER EUROPEAN form: bald grey side hair, round glasses, grey beard, blue superhero suit with yellow European stars, gold belt, gold boots and wrist guards and dark blue cape. Preserve his heroic muscular build and cape flowing subtly, never obscuring feet. Preserve image2 proportions, head scale, face, hair and costume. Stable head and pelvis position across frames. Full bodies fit eachcell with transparentgaps. True transparent RGBA landscape4x2 sheet. No captions, ground shadows, backdrop or cut off hair. Faces right in all frames.

### bardella

Use case: style-transfer. Create a dedicated guard shuffle game animation sprite sheet, EXACTLY8 full body poses in4columns x2rows. Image1 gives EXACT anatomy and pose ordering to copy: ONLY FIRST TWO ROWS of its16-pose sheet, in their unchanged left-to-right order. Do not include any of image1's bottom two rows. Transfer the same grounded low boxer steps with raised fists, precise foot slide positions and planted feet. Small shuffle, NO high marching knee, no running or kicks. Image2 is the EXACT character identity and costume to preserve in every pose. Jordan Bardella transformation: youthful clean-shaven face, slick short dark brown hair, navy blue suit, white shirt, blue tie, dark leather shoes. No beard or glasses. Preserve image2 proportions, head scale, face, hair and costume. Stable head and pelvis position across frames. Full bodies fit eachcell with transparentgaps. True transparent RGBA landscape4x2 sheet. No captions, ground shadows, backdrop or cut off hair. Faces right in all frames.

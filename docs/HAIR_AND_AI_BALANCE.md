# Contours de Mélenchon et équilibre de l’IA

## Marche en garde

Planche finale retenue pour l’essai : `assets/generated/animations/melenchon-guard-step-v4.png`, PNG RGBA 1774 × 887. Les cheveux ont été redessinés avec des traits plus fins et moins de volume brillant, en prenant `assets/generated/characters/melenchon.png` comme référence. Les poses, découpes, ancrages et tailles d’affichage sont conservés. Deux premières passes de nettoyage ne corrigeaient pas suffisamment le contour ; la dernière reprend le dessin de la chevelure. La correspondance artistique exacte reste à apprécier en jeu.

Outil : **ImageGen intégré**, copie de sortie sans retouche bitmap logicielle. Références finales : `melenchon-guard-step-v2.png` et le sprite de base. Aperçu : `/src/presentation/melenchon-guard-preview.html?v=hair-4`.

### Prompt final

Re-illustrate the HAIR on every character in image1 using the EXACT hairstyle drawing language of image2. Do not merely upscale or sharpen the existing hair. Replace and redraw the ENTIRE GREY HAIR MASS on each of eight heads: use the finer flatter hand-inked grey hair of the original base character image2, with a CLEAN SOLID THIN OUTLINE, much less puffy glossy volume and no messy outside hairs. The silhouette should be crisp and deliberate, clearly inked, with no fuzzy border or detached grey patch above it. Preserve every face, glasses, suit, scarf and all eight leg poses and locations from image1, including narrow and wide stances. Transparent RGBA sheet, 1774x887, same exact layout. Each hairstyle should read as a solid clean bounded shape, with natural hair lines confined inside it. Remove ALL debris and dots outside the character contour. Flat clean small-game-sprite outline, not a textured cutout edge. The changed hair MUST visibly match the original image2 instead of retaining image1's hair rendering.

## IA

| Difficulté | Intervalle demandé | Intervalle effectif à 30 Hz | Probabilité de saisir une occasion | Seuil de repli | Probabilité de profil prudent |
|---|---:|---:|---:|---:|---:|
| Facile | 0,72 s | 0,733 s | 80 % | 16 % de résistance | 22 % |
| Normal | 0,28 s | 0,300 s | 92 % | 20 % de résistance | 18 % |
| Difficile | 0,14 s | 0,167 s | 96 % | 24 % de résistance | 12 % |

En normal, le rythme se situe entre l’ancienne version très réactive (0,233 s effectif, chaque occasion saisie) et la version affaiblie (0,367 s, 85 %). Les dégâts, revenus et prix ne changent pas.

Le profil prudent est un tirage déterministe par candidat et par vie, à partir de la graine et du dernier KO. Il ne consomme pas le générateur aléatoire de la simulation et reste identique après sauvegarde. Les autres profils continuent le combat même à faible résistance.

Un repli dure au plus six secondes sous pression et son échéance ne se renouvelle pas à chaque décision. Si l’ennemi reste proche à l’échéance, l’IA reprend le combat. La récupération s’arrête à 55 % de résistance, contre 80 % auparavant. Un ennemi précédemment combattu et repoussé reste une cible pendant quatre secondes dans le rayon de détection.

Le déclenchement des attaques utilise la portée du coup plus la moitié du rayon de cible : le bot ne doit plus entrer inutilement trop près, tout en gardant une marge avant la limite exacte de collision. La même fonction sert à la détection stratégique du contact.

## Vérifications

209 tests réussis : difficultés, décisions répétables, majorité qui reste au contact sur 200 graines pour chaque difficulté, sauvegarde, échéance de repli non renouvelée et poursuite d’un candidat repoussé. L’aperçu est contrôlé dans Chrome. Ce sont des réglages initiaux à apprécier en partie, pas une garantie de difficulté subjective.


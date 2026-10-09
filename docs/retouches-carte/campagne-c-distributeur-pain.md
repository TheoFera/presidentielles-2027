# Distributeur de pain — Campagne C

Retouche du 9 octobre 2026 avec l’outil ImageGen intégré. La seconde stèle, son socle et ses bornes ont été remplacés par un petit distributeur de pain. La stèle de la place du village, en Campagne B, est conservée à l’identique. Une seconde passe restaure la maison devant l’arbre et rend le distributeur plus large et moins haut.

Fichier utilisé par le jeu : `assets/images/carte/tuile-12-campagne-c.png` (1 920 × 1 080, opaque).

Sources générées normalisées : `sources/campagne-c-distributeur-pain.png`, puis `sources/campagne-c-distributeur-pain-v2.png`. Aperçu final intégré : `campagne-c-distributeur-pain-apercu.png`.

Première passe : zone x = 0…439, y = 640…1 003 de Campagne C, remplacée par des pixels opaques, sans fondu. Seconde passe : sur un extrait de 952 × 800 commençant à x = 20 864, y = 280 dans la fresque, remplacement local des rectangles x = 220…384, y = 180…479 (maison devant l’arbre), et x = 380…509, y = 460…709 (distributeur). La première zone touche les 36 derniers pixels en largeur de Campagne B et le début de Campagne C. Les pixels extérieurs sont conservés exactement. La ligne de marche, la stèle conservée et le raccord droit ne sont pas modifiés. Le raccord B → C a été contrôlé sur l’aperçu intégré. Les deux tuiles du jeu et la fresque source archivée sont synchronisées.

## Consigne de génération

Quatrième passe : suppression de la tache jaune au pied de la maison et restauration des pavés et de leurs ombres. Source : `sources/campagne-c-sol-v4.png` ; consigne : `campagne-c-sol-consigne-v4.txt`. Retouche locale sur le même extrait : x = 175…614, y = 681…745, en préservant le pied du distributeur (x = 390…499, y = 681…687). Pixels opaques remplacés sans fondu. Tous les pixels extérieurs sont conservés exactement. Aperçu du sol contrôlé en gros plan ; tuiles et fresque source archivées synchronisées.

Troisième passe : volume rectangulaire de la maison et mur latéral plus profond. Le mur et son toit passent devant l’arbre et le champ de blé. Source : `sources/campagne-c-maison-v3.png` ; consigne : `campagne-c-maison-consigne-v3.txt`. Sur le même extrait de 952 × 800, remplacement des rectangles x = 190…409, y = 175…514 et x = 190…389, y = 515…684, sans fondu. Tous les pixels extérieurs à ces rectangles sont conservés exactement, notamment le distributeur. Les fichiers du jeu et les sources archivées sont synchronisés.

Use case: precise-object-edit. Edit image 1, a 952 by 540 crop of an existing flat game panorama. Image 2 is world-v2 STYLE ONLY, image 3 is the bread vending machine design and adult scale reference.
Remove the entire stone obelisk war memorial, pedestal, all four short stone posts and their black chains, and its gravel enclosure from image 1. Restore the low garden wall, wheat, pétanque court behind it and clean paved sidewalk naturally where these objects were.
Replace ONLY with ONE SMALL NARROW freestanding bread vending machine. In the 952x540 composition its entire silhouette must fit within x432..536, y242..438: width104, height196 pixels. It is a little taller than a 162 pixel adult, NOT a building, NOT a bakery shop, NOT a large kiosk. Dark navy front, cream slim sides, shallow curved top, small screen and payment reader mid-height, bread retrieval slot, and a clearly drawn large golden baguette pictogram on its lower front like reference photo. Absolutely no letters, logos or numbers.
Position its foot behind the foreground walking line, with clear pavement in front. Preserve most of the pétanque court visibly behind and to the right of the small machine.
Keep all existing buildings, tree canopy, tree trunk, other vegetation, perspective, crop framing, camera and summer morning light from left unchanged. Image 1 must remain exactly the same composition, not zoomed or resized. Only local object removal/restoration around x256..696 y100..464. Keep leftmost256 pixels, rightmost256 pixels and foreground y464..540 unchanged. Crisp hand-painted illustrated world-v2 style, opaque. No fades, no transparent pixels, no additional objects or people.

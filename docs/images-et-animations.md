# Images et animations

Toutes les images du jeu sont des PNG transparents, rangés par usage dans `assets/images/` (arborescence dans le [README](../README.md#les-images)). Les images sont créées avec un générateur d'images (ImageGen ou ChatGPT) puis copiées **sans retouche** : le jeu découpe lui-même chaque pose grâce à des coordonnées mesurées.

## Où chaque image est déclarée

| Images | Dossier | Déclarées dans | Découpe des poses |
|---|---|---|---|
| Tuiles de la carte | `carte/` | `src/presentation/carte/carte-plate.js` | une tuile = une sous-zone |
| Fonds des menus | `menus/` | `src/presentation/menus/game-menu.css`, `legal-notice.js`, `index.html` | — |
| Plateaux du Débat télé | `debat/` | `src/presentation/debat/debate-arenas.js`, `visual-manifest.js` | plateformes calées dans `debate-arenas.js` |
| Estrades de meeting | `meeting/` | `visual-manifest.js` | — |
| Véhicules | `vehicules/` | `src/presentation/rendu/fixed-world-assets.js` | `src/presentation/carte/vehicles.js` |
| Mélenchon, Le Pen, Philippe | `candidats/<nom>/` | `visual-manifest.js` | `candidate-combat-atlases.js`, `candidate-extra-atlases.js`, `melenchon-extra-atlases.js` |
| Styles de campagne | `candidats/<nom>/styles/` | `visual-manifest.js`, `campaign-style-art.js` | `skin-animation-atlases.js`, `skin-animation-data.js` |
| Glucksmann, Roussel, Arthaud, Dupont-Aignan, Retailleau, Attal | `candidats/<nom>/` | `minor-sprites.js`, `minor-animation-sprites.js` | `minor-sprite-atlases.js`, `minor-animation-data.js` |
| Ultimes | `pouvoirs/` | `visual-manifest.js`, `ultimate-guard-sprites.js` | `ultimate-sprite-data.js`, `ultimate-guard-data.js` |
| Électeurs et militants | `habitants/neutres/`, `habitants/militants/` | `visual-manifest.js` (par une boucle) | une image par habitant ; la teinte des tracts des militants est appliquée par `militant-sprites.js` |
| CRS, sécurité, journalistes | `secondaires/` | `visual-manifest.js` | — |

Les fichiers de `src/presentation/` cités sans dossier sont dans ce même dossier.

## Ajouter ou remplacer une image

1. Garder le même format : PNG RGBA à fond réellement transparent, mêmes dimensions et même disposition des poses si l'image en remplace une autre.
2. La ranger dans le bon dossier de `assets/images/`.
3. La déclarer avec un **chemin littéral complet** (par exemple `new URL('../../assets/images/meeting/building-meeting_stage-bobo.png', import.meta.url)`). L'export (`scripts/build-pages.mjs`) ne copie que les images écrites ainsi ; seuls les dossiers des habitants sont copiés en entier, car leurs chemins sont construits par une boucle.
4. Pour une nouvelle planche de poses, mesurer les silhouettes avec les outils de `scripts/outils-images/` (`measure-*.mjs`, `measure-*.py`), puis reporter les rectangles et points d'appui dans le fichier de découpe correspondant.
5. Vérifier : `node --test test/visual-assets.test.js test/pages.test.js`, puis regarder le rendu en jeu.

Une version corrigée d'un habitant peut porter le suffixe `-fixed` (par exemple `npc-banlieue-9-fixed.png`) : elle remplace l'originale dans le manifeste.

## La carte plate

- 18 tuiles de **1 920 × 1 080 pixels**, une par sous-zone, dans l'ordre de la carte (`tuile-01-paris-a.png` … `tuile-18-riches-c.png`).
- Une tuile couvre exactement la largeur de sa sous-zone. Les pieds des personnages et le bas des façades sont à **y = 1 004 pixels** dans chaque tuile.
- Les façades des bâtiments sont peintes dans les tuiles. Le jeu n'ajoute que le texte des enseignes (panneau crème au-dessus de chaque porte, ou emplacements particuliers listés dans `NATURAL_SIGNS` de `carte-plate.js`), le drapeau du propriétaire et l'estrade des meetings.
- La saison teinte les tuiles (une copie teintée par tuile visible, pour rester fluide sur téléphone).
- `test/carte-plate.test.js` vérifie le calage des enseignes.
- Retoucher une tuile : la chaîne de production complète (fresque maître, gabarits, scripts de découpe) est rangée dans le dossier voisin « Presidentielles 2027 - fichiers retirés/2026-10-09 carte plate seule/docs/production/decor-v3/carte-plate/ ». Les retouches ponctuelles en cours sont décrites dans `docs/retouches-carte/`. Après une retouche, remplacer la tuile dans `assets/images/carte/` en gardant son nom et ses dimensions.

## Candidats et animations

- Chaque candidat a un sprite debout et des **planches de poses** : combat (garde, coups, charge, saut), déplacement et actions (achat, persuasion).
- Les styles de campagne ont leurs propres costumes (`character-style-*.png`) et planches (`*-combat-v1.png`, `*-movement-v1.png`, `*-actions-v1.png`).
- Les tailles d'affichage communes sont réglées dans `src/presentation/personnages/melenchon-combat.js` ; les poses sont choisies par `illustrated-characters.js`.

## Prompts de génération

Les prompts des planches des styles et des ultimes sont dans `docs/prompts/` (`animations-styles.json`, `animations-ultimes.json`). Les prompts et notes de génération des anciennes planches (candidats, retouches de cheveux, candidats sans styles) sont archivés dans le dossier voisin « Presidentielles 2027 - fichiers retirés/2026-10-09 documentation historique ».

## Originaux

Les originaux haute définition ne sont pas utilisés par le jeu. Ils sont rangés dans le dossier voisin « Presidentielles 2027 - fichiers retirés/2026-10-09 carte plate seule/assets/generated/masters/ » (dont l'icône de l'application).

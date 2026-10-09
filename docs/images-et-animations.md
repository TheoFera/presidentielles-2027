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
- Raccords BOBO : les sept défauts signalés ont été repris localement avec ImageGen et la référence `world-v2/reference-style-carte-plate.png`, à partir des tuiles actuelles `paris-a`, `paris-b` et `paris-c`. Corrections : mur et pavés à gauche de la boutique turquoise, pot et ombre à droite, pots et sol de l’atelier de vélos, pot et sol de la fromagerie, bande de pavés devant le jardin, feuillage au raccord B → C et pot au pied du mur de C. Les masques sont opaques, à bord franc, sans fondu ; les pixels extérieurs sont conservés exactement. Le raccord du feuillage est traité sur les deux tuiles réunies. La bordure devant l’atelier et la fromagerie est contrôlée avec le sol voisin ; les dimensions et le calage de marche à y = 1 004 restent inchangés. La fresque maître archivée reçoit seulement les pixels modifiés, pour préserver ses autres corrections. Aperçus relus depuis les fichiers du jeu : [raccords BOBO](retouches-carte/bobo-raccords-apercu.png).

La sous-zone Banlieue B utilise désormais une place de marché ouverte inspirée de la référence de l’utilisateur, avec une grande basilique, une seule permanence rouge à gauche et un kebab à droite, sans texte et identifiable par ses broches peintes. Le rond en pierre et la seconde bordure surélevée sont retirés. La ligne de marche et les positions des sites restent inchangées ; les raccords conservent les tuiles voisines. Sources, masques et consignes : [retouche Banlieue B](retouches-carte/banlieue-b-place.md).

- Place centrale BOBO B : recomposée avec ImageGen intégré selon la disposition de la référence de l’utilisateur : façades de face, garage à vélos et boulangerie dans la rangée centrale, commerces latéraux et arbres entre les bâtiments, Montmartre et Sacré-Cœur en fond. Le centre contient les bâtiments ; seul le rond en pierre est retiré. Le sol devant les boutiques est plat, sans seconde bordure. Le garage reste le seul nouveau panneau à recaler : `NATURAL_SIGNS` suit son enseigne peinte sans déplacer le site de gameplay. Aucun nouveau bâtiment interactif. Les deux tuiles voisines et la bordure routière à partir de y = 1 030 sont conservées exactement ; les coupes opaques passent aux extrémités de B et le ciel reprend le bleu de la fresque. Source retenue : `retouches-carte/sources/bobo-b-recomposition-v2.png` ; consigne : `retouches-carte/bobo-b-recomposition-consigne.txt` ; masque : `retouches-carte/sources/bobo-b-recomposition-masque.png`. [Aperçu intégré avec les voisins](retouches-carte/bobo-b-place-apercu.png). Les fresques et tuiles de production archivées reçoivent uniquement les pixels modifiés depuis `bobo-b-avant-recomposition.png`, via `bobo-b-synchroniser.py`, pour préserver les autres retouches.

- Finitions de cette recomposition : les anciens sommets de cheminées sont retirés jusque dans le haut de B. Le pied de l’arbre au raccord A → B est masqué naturellement par le muret, avec une continuité du tronc vers le sol derrière lui ; masque opaque x = 172…259, y = 890…1 005 dans l’extrait réunissant les voisins (256 pixels de A, B, puis 256 pixels de C). Source : `retouches-carte/sources/bobo-b-arbre-raccord-v3.png` ; consigne : `retouches-carte/bobo-b-arbre-raccord-consigne.txt` ; [contrôle du pied de l’arbre](retouches-carte/bobo-b-arbre-raccord-apercu.png). Les pixels extérieurs sont conservés exactement et les archives reçoivent uniquement cette retouche, via `retouches-carte/sources/bobo-arbre-synchroniser.py`.

- Quartiers Riches A, B et C : remplacés à partir de la [proposition validée](retouches-carte/riches-abc-proposition-v4.png), adaptée au format des trois tuiles sans étirer les façades. A rapproche la Maison de la Radio et relie son entrée au portail et à son panneau achetable ; la demeure haussmannienne ajoutée reste résidentielle. B conserve la boutique et le kiosque, réduit la place et ouvre une rue courbe vers une seule tour Eiffel. C conserve le cabinet et l’institut, place la rue à droite et superpose La Défense derrière les toits. Le volume arrière du bâtiment au raccord B → C est reconstruit ; les lampadaires proches de la ligne de marche sont supprimés. Les raccords sont peints sur des extraits réunissant les deux côtés, puis intégrés avec des masques opaques et des coupes suivant les objets, sans fondu. Le ciel réemploie les couleurs par ligne de la fresque d’origine. Les tuiles voisines, la chaussée à partir de y = 1 030 et la ligne de marche y = 1 004 sont conservées. Les quatre panneaux Riches sont recalés dans `NATURAL_SIGNS`, sans déplacer les sites. Sources retenues, sauvegardes et masques : `retouches-carte/sources/riches-*` ; consignes : `retouches-carte/riches-*-consigne.txt`. Les étapes d’intégration sont conservées dans `riches-integrer.py`, `riches-raccorder.py`, `riches-harmoniser-ciel.py` et `riches-restaurer-faces.py` (les faces vitrées des tours restent distinctes du ciel) ; `riches-synchroniser.py` reporte uniquement les pixels modifiés dans les deux fresques et les tuiles de production archivées. [Aperçu intégré avec les voisins](retouches-carte/riches-abc-integre-apercu.png).

## Candidats et animations

- Chaque candidat a un sprite debout et des **planches de poses** : combat (garde, coups, charge, saut), déplacement et actions (achat, persuasion).
- Les styles de campagne ont leurs propres costumes (`character-style-*.png`) et planches (`*-combat-v1.png`, `*-movement-v1.png`, `*-actions-v1.png`).
- Les tailles d'affichage communes sont réglées dans `src/presentation/personnages/melenchon-combat.js` ; les poses sont choisies par `illustrated-characters.js`.

## Prompts de génération

Les prompts des planches des styles et des ultimes sont dans `docs/prompts/` (`animations-styles.json`, `animations-ultimes.json`). Les prompts et notes de génération des anciennes planches (candidats, retouches de cheveux, candidats sans styles) sont archivés dans le dossier voisin « Presidentielles 2027 - fichiers retirés/2026-10-09 documentation historique ».

## Originaux

Les originaux haute définition ne sont pas utilisés par le jeu. Ils sont rangés dans le dossier voisin « Presidentielles 2027 - fichiers retirés/2026-10-09 carte plate seule/assets/generated/masters/ » (dont l'icône de l'application).

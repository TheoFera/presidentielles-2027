# Corrections des dessins des candidats mineurs

Douze planches PNG ont été retouchées avec l’outil intégré `image_gen.imagegen` : repos, combat, déplacements et actions de Roussel, Attal et Arthaud. Les originales sont conservées. Les chemins des nouvelles versions sont enregistrés dans `minor-sprites.js` et `minor-animation-sprites.js`.

- Têtes réduites dans les dessins, sans réduction des corps. La retouche est plus discrète sur les planches de repos d’Arthaud et d’Attal pour harmoniser leurs proportions entre les situations.
- Roussel, déplacements, frame 12 : réaction défensive à un coup reçu, avec recul et grimace, au lieu du coup de poing incorrect.
- Rectangles et points d’appui remesurés dans les nouveaux PNG. Les échelles de référence des corps sont conservées.
- Après contrôle dans le jeu, recalibrage supplémentaire de Roussel : suppression de la réduction de 6 % au repos, garde et huit pas agrandis de 10 %, autres poses réglées individuellement. Les poses de combat 8, 12 et 15, et les poses d’actions 9 et 11, conservent leur taille précédente. Les huit pas restent à moins de 4 % de la hauteur de sa garde. La garde est à environ 96 % de la hauteur moyenne de Philippe et Le Pen.

## Vérifications

`minor-animation.test.js` vérifie le cadrage des douze PNG, la cohérence des points d’appui, la taille des 44 poses animées de chaque candidat contre Philippe et Le Pen, ainsi que la hauteur de garde de Roussel et la continuité des huit pas. La mesure de surface reste à ±8 % de la médiane propre à chaque candidat : elle complète le contrôle de hauteur, elle ne suffit pas à elle seule.

`browser-check.mjs` dessine les personnages avec les fonctions réellement utilisées par le jeu, dans Chrome : repos, marche, garde, pas de garde, persuasion, écoute, réaction à un coup léger et les quatre étapes du K.O. Les 33 situations des candidats retouchés sont aussi dessinées vers la gauche. Aucune image absente ni erreur JavaScript. Il s’agit de scènes de contrôle, pas d’une partie complète jouée à la main.

Les images `*-comparaison.png` montrent les poses avant et après, avec Philippe et Le Pen comme références. `rendu-jeu.png` montre le rendu réel des scènes de contrôle à une hauteur nominale de personnage de 90 px. Les consignes exactes envoyées à ImageGen sont conservées dans `generations.json` ; `audit.json` conserve les mesures.

## PNG livrés

Tous sont enregistrés dans `assets/generated/minor-candidates/` :

| Candidat | Repos | Combat | Déplacements | Actions |
| --- | --- | --- | --- | --- |
| Roussel | `roussel-v7.png` | `roussel-combat-v8.png` | `roussel-movement-v8.png` | `roussel-actions-v7.png` |
| Attal | `attal-v2.png` | `attal-combat-v4.png` | `attal-movement-v4.png` | `attal-actions-v4.png` |
| Arthaud | `arthaud-v3.png` | `arthaud-combat-v4.png` | `arthaud-movement-v4.png` | `arthaud-actions-v4.png` |

## Relancer les outils de production

Les outils de contrôle utilisent `sharp` et `playwright` fournis par le runtime de Codex, sans nouvelle dépendance du jeu. Indiquer leurs chemins via `MINOR_SHARP_PATH` et `MINOR_PLAYWRIGHT_PATH`. `browser-check.mjs` attend un serveur du projet à `http://localhost:2038`, modifiable avec `MINOR_TEST_URL`.

`integrate.mjs` remet les sorties ImageGen au format des canevas sources et remesure les découpes ; il ne redessine aucune partie des personnages.

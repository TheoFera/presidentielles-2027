# Candidats mineurs — planches à produire avec ChatGPT

En attendant ces images, le jeu dessine les six candidats mineurs par le code (`src/presentation/minor-characters.js`). Chaque planche déposée remplace automatiquement ce dessin provisoire.

## Mode d’emploi

1. Pour chaque candidat, ouvrir une nouvelle conversation ChatGPT (mode image).
2. Joindre :
   - la **maquette de poses** `docs/production/candidats-mineurs/maquettes/<id>-maquette.png` : elle donne la place exacte, l’échelle et l’ordre des 12 poses ;
   - la référence de style `assets/generated/characters/character-philippe.png` ;
   - une planche de combat existante comme exemple de poses : `assets/generated/animations/philippe-base-combat-v1.png`.
3. Coller le **prompt commun**, puis le **paragraphe du candidat**.
4. Enregistrer sous `assets/generated/minor-candidates/<id>.png`, avec l’identifiant indiqué ci-dessous.
5. Lancer `node scripts/world-v3-calibrate.mjs`. Le script :
   - retire le fond magenta éventuel ;
   - vérifie le format ;
   - déclare la planche dans `src/presentation/minor-sprites.js`.
6. Vérifier avec `http://localhost:2027/src/presentation/minor-preview.html` et en partie.

## Prompt commun (à coller en premier)

```text
Create ONE production sprite sheet for a 2D side-scrolling political satire fighting game, following EXACTLY the attached pose layout (same grid, same positions, same scale, same order). Replace the simple placeholder puppet with the fully illustrated caricature described below.
STYLE: exactly the style of the attached character reference: recognisable friendly caricature, big head (about one third of the body), short adult body, clean dark ink outlines, flat warm colours with subtle gouache texture, readable at small size. NOT pixel art, NOT photorealistic, NOT 3D.
CANVAS: exactly 1536 × 1024 px, TRANSPARENT background (if impossible: perfectly flat pure magenta #FF00FF, no gradient, no shadow). Grid of 4 columns × 3 rows, each cell 384 × 341 px, nothing crossing a cell border. In every cell the character faces RIGHT (three-quarter side view), feet on the horizontal line 320 px below the top of the cell, standing height about 280 px. Same character, same clothes, same scale in all 12 cells. No text, no captions, no ground, no cast shadow, no background.
POSES, left to right then top to bottom:
1 idle (relaxed guard) · 2 walk A (left leg forward) · 3 walk B (right leg forward) · 4 run (leaning forward, arms bent)
5 light punch 1 (front arm jab fully extended) · 6 light punch 2 (back arm hook) · 7 heavy strike (big forward swing, body lunging) · 8 charging a strong attack (arm pulled back, crouched, determined)
9 hurt (hit, recoiling, eyes squeezed) · 10 knocked back (thrown backwards, arms up) · 11 knocked out (lying flat on the back, horizontal, inside the cell) · 12 persuading (one hand raised explaining, mouth open, friendly)
```

## Paragraphes par candidat

| Fichier | Paragraphe à ajouter au prompt commun |
| --- | --- |
| `glucksmann.png` | CHARACTER: Raphaël Glucksmann caricature, slim and tall French MEP in his forties, thick dark tousled wavy hair falling on the forehead, clean-shaven, intense dark eyes, navy blazer over an open-collar white shirt (no tie), pink pocket square, slim dark trousers, brown leather shoes. Earnest, slightly dramatic intellectual expression. |
| `roussel.png` | CHARACTER: Fabien Roussel caricature, stocky jovial French communist leader in his fifties, bald top with short grey hair on the sides, round cheerful face with rosy cheeks and a big smile, grey suit, white shirt, red tie, black shoes. Bon-vivant, good-humoured attitude. |
| `arthaud.png` | CHARACTER: Nathalie Arthaud caricature, French far-left teacher and activist in her fifties, short brown bob haircut, simple red cardigan over a dark top, blue jeans, flat shoes. Firm, combative, no-nonsense expression. |
| `dupont_aignan.png` | CHARACTER: Nicolas Dupont-Aignan caricature, tall French sovereigntist politician in his sixties, grey hair neatly side-parted, long face, rectangular glasses, dark suit, white shirt, purple tie, black shoes. Stern, solemn expression. |
| `retailleau.png` | CHARACTER: Bruno Retailleau caricature, slim French conservative politician in his sixties, receding grey hair combed back, rimless glasses, thin serious face, dark navy suit, white shirt, sky-blue tie, black shoes. Austere, disciplined attitude. |
| `attal.png` | CHARACTER: Gabriel Attal caricature, young French politician in his mid-thirties, short neat dark hair, youthful smooth face, confident smile, slim-fit navy suit, crisp white shirt, no tie, a small orange lapel pin, polished black shoes. Energetic, media-savvy attitude. |

Rappel : ce sont des caricatures de personnalités publiques dans le même esprit que les candidats principaux du jeu. Pas de symbole de parti réel ni de texte sur la planche.

# Animations des ultimes

Huit planches transparentes créées avec l’outil **ImageGen intégré**, à partir des personnages existants. Les prompts et les références sont conservés dans `ultimate-animation-prompts.json`. Les PNG finaux se trouvent dans `assets/generated/animations/ultimates/`.

| Planche | Animations |
|---|---|
| `scarf-v1.png` | Geste d’Édouard Philippe, tissu déployé et retour de l’écharpe |
| `wave-v1.png` | Invocation de Marine Le Pen et quatre phases de vague |
| `fire-v1.png` | Lancer de Mélenchon, bouteille et flammes |
| `surge-v1.png` | Course et attaques des personnages encapuchonnés |
| `wall-v1.png` | Marche, garde et attaques des CRS |
| `zemmour-v1.png` | Prise de parole et bulles animées |
| `bardella-v1.png` | Transformation, déplacement, combo, charge et saut |
| `europe-v1.png` | Combat de Super-Europe et protection animée |

Les hologrammes conservent leurs animations existantes. Les activations des invocations utilisent les poses d’ultime déjà disponibles pour chaque tenue. La transformation Bardella n’est montrée qu’au déclenchement réel de sa protection.

Pour le déferlement, les sept silhouettes apparaissent derrière Mélenchon à une échelle réduite. Elles effectuent chacune trois ou quatre changements de direction déterministes, puis cessent d’attaquer et reviennent vers la position actuelle de Mélenchon. Le point de retour est recalculé à chaque tick : il reste donc correct lorsque le joueur se déplace pendant l’ultime. Mélenchon reprend sa pose bras écartés pendant la sortie et le rappel du groupe.

## Rendu et portée

`ultimate-sprites.js` choisit les poses selon les attaques, les pouvoirs et les unités réellement présents dans la simulation. Les animations utilisent ses ticks, sans ajouter d’état au format de sauvegarde ni modifier les règles du combat.

Le personnage garde son échelle anatomique. Seul le tissu séparé est déployé jusqu’à `attack.range`, dans la direction de l’attaque. L’écharpe suit la hauteur du saut ; son retour utilise encore la main tendue jusqu’au retrait du tissu. Une annulation retire immédiatement le rendu. Les zones de feu restent au sol ; une brûlure déjà appliquée suit sa cible.

Les silhouettes sont mesurées par `scripts/measure-ultimate-atlases.py`, sans modifier les PNG. Les contours de découpe isolent les poses dont les rectangles englobants croisent une voisine. `scripts/register-ultimate-atlases.mjs` enregistre les mesures, les points d’ancrage et les ressources du jeu.

## Vérification

- Galerie locale : `/src/presentation/ultimate-preview.html` (pause, reprise, inversion de direction).
- Tests ciblés : `node --test test/ultimate-animation.test.js`.
- Contrôle navigateur : `scripts/validate-ultimate-animations-browser.mjs`, avec Playwright fourni via `CAMPAIGN_TEST_NODE_MODULES`.
- Suite complète : `npm test`, puis export : `npm run build`.

La galerie déclenche les pouvoirs avec la simulation de combat. Elle permet de vérifier l’impact, le saut, les effets persistants et l’affichage portrait. Les captures de contrôle sont enregistrées dans `artifacts/ultimate-animations/`.

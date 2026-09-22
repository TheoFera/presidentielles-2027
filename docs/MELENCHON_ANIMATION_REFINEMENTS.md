# Mélenchon — révision des appuis et réactions

## État de la proposition

La première marche en petits pas a été refusée après essai. Cette nouvelle proposition reste à juger en jeu ; le choix de direction ne vaut pas validation du rendu.

- Nouvelle marche en garde : six poses distinctes à trois ticks par pose, soit un cycle de 0,6 seconde à 30 Hz. Pied avant levé, contact au sol, transfert d’appui, pied arrière levé puis reposé. Cycle inversé pour reculer.
- Coups légers de candidats : recul configuré à zéro ; étourdissement de 0,16 seconde, arrondi à cinq ticks (environ 0,167 s), au lieu de six ticks. Deux réactions ancrées remplacent les anciennes poses de recul. L’aperçu utilise désormais cette durée réelle au lieu de montrer 25 ticks de réaction.
- Le troisième coup du combo conserve son recul. Le coup chargé conserve zéro recul et son étourdissement propre de 0,30 seconde. Les pouvoirs et les attaques des autres unités gardent leurs règles.
- Atterrissage : dix ticks visuels à l’arrêt (0,333 s), six en mouvement (0,20 s). Les quatre premiers ticks montrent l’amorti puis le personnage se redresse. Attaque, saut, dash et interactions restent prioritaires ; aucune récupération ajoutée à la simulation.
- Agrandissement de 6 % dans les deux axes pour Mélenchon : troisième coup, déclenchement d’ultime, persuasion, signature d’achat/capture, chute et KO au sol. L’ancrage au sol est conservé.

## Asset et provenance

Image produite avec **ImageGen intégré**, copiée sans retouche bitmap dans `assets/generated/animations/melenchon-fighter-walk-hit-v1.png`, RGBA transparent de 1774 × 887 pixels. Référence : `assets/generated/animations/melenchon-base-combat-v4.png`. Les six premières cases servent à marcher en garde, les deux dernières à recevoir un coup léger. Découpes et ancrages dans `melenchon-extra-atlases.js`, référence anatomique de 480 pixels.

### Prompt exact

Use case: stylized-concept. Production transparent RGBA sprite sheet, exactly FOUR columns TWO rows, eight whole character poses with generous empty gutters, no shadow, no background or text. Reference image is APPROVED Jean-Luc Mélenchon combat character identity, linework and head/body proportions. Preserve exactly his elderly face, grey swept-back hair, glasses, black suit and red scarf, fine dark contours, detailed French comic drawing. All face RIGHT in three-quarter profile, consistent anatomical scale, head size, hip centre and ground baseline across frames. FIRST SIX frames in row-major order form a readable 2D FIGHTING GAME advance walk cycle with raised guard, not a near-static breathing loop. Clearly articulated and DISTINCT knees ankles heels and foot placements: 0 low stable guard feet shoulder-width apart; 1 lead foot visibly lifts heel and travels forward one shoe length, bent lead knee, rear foot planted; 2 lead heel lands farther forward, rear heel rises, stance now visibly wider; 3 weight transfers onto planted lead leg while rear foot visibly lifts and moves forward, rear knee bends; 4 rear foot closes distance behind front foot, narrow stance but never crossing, heel still visibly raised; 5 rear foot lands and knees absorb weight into ready stance matching frame0. Lead foot stays ahead; do not swap leading legs, do not cross, do not run, do not crouch deeply. Make leg silhouettes and negative space between them markedly different each frame; render distinct sole/heel views on lifted feet, NOT six copies of same stance. Modest body bob only, same scale and face every frame. Final TWO frames (row2 col3 and col4) LIGHT PUNCH REACTION: both feet remain planted in exactly the same balanced guard stance; frame6 tight brief upper-body flinch with chin tucked, shoulders contracted and eyes wincing; frame7 shoulders relaxing back to guard. NO backward step, NO backward leaning, NO raised leg, NO falling, NO knockback. Entire body visible in every cell. Match thin outlines and grey hair from reference.

## Vérification

Tests réels de coups légers en campagne et en arène : position constante, aucun recul, libération après cinq ticks ; test existant du troisième coup qui sépare les combattants. Contrôle des poses légères, des six appuis, de la durée d’atterrissage et des dimensions de rendu à +6 %. Galerie animée et séquences de combat dans Chrome, puis suite complète et génération du jeu.

Aperçu : `/src/presentation/melenchon-actions-preview.html?v=fighter-walk-1`.


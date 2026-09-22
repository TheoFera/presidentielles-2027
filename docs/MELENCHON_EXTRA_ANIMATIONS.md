# Mélenchon — mouvements et actions supplémentaires

Prototype pour le costume de base et le style Universaliste. Le sprite original reste utilisé au repos ; les autres candidats et costumes ne changent pas.

Mise à jour après essai : la marche hors combat réutilise désormais le rendu droit d’origine. Les anciennes poses de marche en garde et d’interaction sont remplacées par les petits pas de boxeur et la signature debout décrits dans [les ajustements de gameplay](GAMEPLAY_ADJUSTMENTS.md). Les anciennes cases restent dans les planches, mais ne sont plus utilisées.

## Essayer

Ouvrir `/src/presentation/melenchon-actions-preview.html` : treize scènes animées montrent le repos original, la marche, la marche en garde, le dash, les réactions aux coups légers et forts, le recul, l’étourdissement, la chute KO, l’atterrissage, la persuasion, l’interaction maintenue et le déclenchement d’ultime. Le bouton permet de mettre les animations en pause.

Ces poses sont aussi branchées sur les états réels du jeu. La marche en garde est déclenchée par la proximité d’un ennemi ; les réactions aux dégâts vérifient que Mélenchon est bien la victime du dernier impact. Le KO suit son horodatage. L’atterrissage utilise une mémoire visuelle de six ticks, sans imposer de récupération à la simulation : une commande, une attaque ou un déplacement reste prioritaire. Cette mémoire est effacée lors de la réinitialisation de la caméra ou d’un retour en arrière du temps.

L’interaction maintenue sert bien aux **achats et captures de bâtiments** : le système d’économie utilise `purchase_hold`, avec notamment `kind: CAPTURE`, et avance sa progression jusqu’au terme requis. La pose sert aussi au choix de style maintenu au QG. Elle n’accélère ni ne ralentit ces actions.

## Images

- `assets/generated/animations/melenchon-movement-v1.png` : seize poses de déplacement, dash, réaction et atterrissage.
- `assets/generated/animations/melenchon-actions-v1.png` : seize poses de marche, persuasion, interaction, chute et ultime. Les deux propositions de repos de cette planche restent inutilisées pour conserver le sprite initial choisi par l’utilisateur.
- Deux PNG RGBA de 1254 × 1254, produits avec **ImageGen intégré**, copiés sans retouche logicielle. Masques rectangulaires et points d’ancrage mesurés dans `melenchon-extra-atlases.js`.
- Les poses supplémentaires utilisent une référence de 360 pixels, calibrée sur leur silhouette source, puis les mêmes corrections générales hauteur/largeur que le combat. Les cadres accroupis et couchés ne sont pas agrandis pour remplir leur case.
- Limites : cycles courts de poses clés, pas encore d’intervalles dessinés pour chaque instant du mouvement. Le déclenchement d’ultime concerne le costume de base/Universaliste ; les autres costumes et transformations gardent leurs animations précédentes.

## Prompts exacts

Référence 1 : `melenchon-base-combat-v4.png` (style et proportions approuvés). Référence 2 : `characters/melenchon.png` (identité d’origine).

### Déplacements et réactions

Create a transparent RGBA sprite atlas exact 4 columns x4 rows, 1254x1254. First reference is APPROVED Mélenchon combat art: match EXACT face, head/body proportions, black suit, red scarf, grey swept hair, rectangular glasses, thin French comic ink outlines and detailed shading. Second reference original for identity only. Each whole character stands about 285 pixels tall in a cell when upright, same anatomical scale in all poses; crouches naturally shorter. Generous transparent gutters, no neighboring sprites touching, no clipping. All face RIGHT. No background, no shadows, no effects, no text, no border. Distinct coherent drawn poses, not puppet/cutouts. This sheet is movement and reactions. Exact row-major 16 poses: row1 FOUR phases of combat guard walk cycle, fists always raised: left foot forward stride; passing feet; right foot forward stride; passing opposite feet. Row2: dash preparation leaning low; dash burst horizontal forward lean with trailing leg; dash brake planted forward foot; light hit reaction flinching shoulders back face wincing. Row3: second light hit reaction regaining balance; heavy hit reaction large backward torso recoil arms spreading; second heavy hit reaction deeper recoil with one foot raised; knockback sliding backward off balance facing right. Row4: stunned slumped stance head dazed knees soft; alternate stunned stance slight sway; landing deep knee bend feet planted hands balanced; landing recovery half standing fists up. Maintain same head size in all 16 cells.

### Actions et KO

Create a transparent RGBA sprite atlas exact 4 columns x4 rows, 1254x1254. First reference is APPROVED Mélenchon combat art: match EXACT face, head/body proportions, black suit, red scarf, grey swept hair, rectangular glasses, thin French comic ink outlines and detailed shading. Second reference original for identity only. Each whole character stands about 285 pixels tall in a cell when upright, same anatomical scale in all poses; crouches naturally shorter. Generous transparent gutters, no neighboring sprites touching, no clipping. All face RIGHT. No background, no shadows, no effects, no text, no border. Distinct coherent drawn poses, not puppet/cutouts. This sheet is noncombat actions and KO. Exact row-major poses: row1: relaxed idle standing arms down; alternate relaxed idle small breath; normal walking left foot forward hands naturally swinging; normal walking passing feet. Row2: normal walking right foot forward opposite arms; normal walking passing opposite feet; persuasion open palm conversational gesture; persuasion second gesture one hand explaining. Row3: sustained building interaction arms forward at waist palms together working patiently with NO props; alternate sustained interaction gesture one hand out at waist; KO fall first phase staggering backwards knees buckling; KO fall second phase collapsing sideways toward ground. Row4: KO fall third phase body near ground supported on elbow; KO ground completely lying on back head left feet right; ultimate activation winding up both hands near chest determined expression; ultimate activation release both arms out commanding gesture. KO poses retain same anatomical size, no enlargement to fill cell, fit sideways whole body with generous margins. Same head size every pose. No props, no blood, no symbols.

## Vérifications

182 tests réussis, dont des vérifications des découpes, priorités, impacts reçus, KO, interactions et mémoire d’atterrissage. Le script `scripts/validate-melenchon-actions-browser.mjs` vérifie treize scènes à plusieurs instants, détecte les images absentes et les animations figées, et produit les captures `artifacts/melenchon-actions-*.png`.

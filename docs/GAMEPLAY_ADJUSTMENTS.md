# Ajustements après essai — Mélenchon et combat

## Première proposition d’animations

La marche en garde de cette proposition a été refusée après essai. Elle est remplacée par les six appuis décrits dans [la révision des animations](MELENCHON_ANIMATION_REFINEMENTS.md), qui corrige aussi les réactions, l’atterrissage et certaines tailles.

- Marche hors combat : retour au sprite droit et à l’animation d’origine.
- Marche en garde : quatre poses dessinées de petits pas de boxeur, pied avant puis pied arrière, sans grand enjambement. Lecture inversée en reculant.
- Achat, capture et interaction maintenue : quatre poses debout avec une feuille et un petit geste de signature/validation.
- Les hologrammes de Mélenchon utilisent ses poses de garde, déplacement et coups de poing, avec leur transparence bleutée. Leur apparition et leurs règles de dégâts restent celles du pouvoir.
- La persuasion ne fonctionne que lorsque l’acteur est immobile. Déplacement ou recul annulent les cibles et l’animation.

Aperçu : `/src/presentation/melenchon-actions-preview.html`. Ces poses utilisent le même sélecteur et le même rendu qu’en partie. Les animations restent des cycles courts de poses clés ; leur naturel doit encore être apprécié en jeu.

## Réglages

| Réglage | Avant | Après |
|---|---:|---:|
| Portée des poings | 2 | 1,1 |
| Portée du pied final et du coup chargé | 2,4 | 1,5 |
| Distance de dash | 2 | 2,3 (+15 %) |
| Distance de tir des militants | 5 | 3,5 |
| Distance préférée des militants | 3,5 | 2,5 |
| Trajet maximal de leur projectile | 6,5 | 4,5 |
| Tirs de Zemmour par seconde | 2 | 0,8 |

Les portées horizontales sont en unités du monde. La mêlée conserve le rayon de cible de 0,35 unité. Les poings touchent donc jusqu’à 1,45 unité entre les centres et le pied jusqu’à 1,85. Les dégâts restent inchangés.

La bulle de Zemmour occupe la bande de hauteur 0,62–0,76 personnage, mesure visuellement 0,8 unité de large et utilise un rayon horizontal de collision de 0,22. Son dessin et son test de hauteur utilisent les mêmes paramètres. Les temps de tir sont arrondis à la mise à jour suivante de la simulation à 30 Hz.

Au retour après démobilisation, chaque PNJ vise un point aléatoire autour de son point social d’origine, dans la marge de réapparition configurée et borné à sa zone. Le tirage a lieu une seule fois avec le générateur aléatoire sauvegardé ; sa destination utilise le champ sauvegardé `roam_target_x`.

## IA

Les occasions d’attaque sont moins fréquentes : intervalles facile/normal/difficile de 0,80/0,35/0,18 seconde, avec une probabilité déterministe de 75/85/93 % à chaque occasion. Le comportement reste reproductible après sauvegarde.

Les améliorations de bâtiments sont davantage prioritaires et peuvent justifier un détour de dix unités autour d’un bâtiment allié. Les sites ennemis pèsent un peu plus dans le choix du territoire. L’IA poursuit moins les candidats éloignés, termine une transaction si la menace reste loin et cherche les partisans qui défendent un site adverse avant les neutres. Les coûts et conditions d’achat restent appliqués.

Les réglages changent l’empreinte de configuration : les anciennes sauvegardes sont refusées explicitement par le contrôle existant. Démarrer une nouvelle partie pour ces essais.

## Image générée

Outil : **ImageGen intégré**, PNG RGBA copié sans retouche logicielle dans `assets/generated/animations/melenchon-shuffle-signature-v1.png` (1774 × 887). Découpes et ancrages dans `src/presentation/melenchon-extra-atlases.js`, référence de hauteur 510 pixels avant les corrections générales approuvées. Les autres nouvelles planches et leurs prompts sont documentés dans [Mélenchon — mouvements et actions supplémentaires](MELENCHON_EXTRA_ANIMATIONS.md).

Références : `assets/generated/animations/melenchon-base-combat-v4.png` et `assets/generated/characters/melenchon.png`.

### Prompt exact

Use case stylized-concept. Exact 4 columns x2 rows sprite sheet, transparent RGBA. Reference1 is approved Mélenchon combat identity and ink style. Reference2 is original upright standing character, preserve its older dignified slightly stiff bearing. Same exact face, grey hair, glasses, black suit, red scarf, fine contours. Eight complete independent drawn poses, all facing RIGHT, same head/body scale, ample transparent gutters. NOT exaggerated action walking, NO giant strides, NO crossed legs. Row1 exactly FOUR successive phases of a BOXING SHUFFLE with fists in guard, fairly upright body slight knee flex, feet always close about one shoe length apart: frame1 left/front foot planted ahead and right/back foot behind; frame2 ONLY front foot steps a HALF SHOE length forward, rear foot still planted unchanged; frame3 rear foot slides the SAME half shoe length to catch up, feet never cross or swap which is forward; frame4 stable compact stance again with very subtle knee bounce. Four visibly different small foot positions, no big hip sway, tiny steps like a cautious older boxer, no running. Row2 four frames of UPRIGHT BUILDING PURCHASE/CAPTURE VALIDATION: frame1 straight dignified standing same as base, small paper document held in left hand at waist, right hand brings pen; frame2 right hand signs with a small pen stroke, remain standing straight; frame3 pen finishing small signature movement; frame4 lifts pen slightly in small confirmation gesture while still holding paper. No crouching, no leaning body forward, no theatrical waving, no gibberish legible text on document. Preserve reference proportions and anatomy. No backdrop, no floor shadow, no captions, no grid lines.

## Vérifications

Tests de persuasion immobile, destinations aléatoires conservées après sauvegarde, portée réelle des coups et projectiles, cadence et collision verticale de la bulle, rendu des hologrammes, décisions répétables de l’IA et détour pour améliorer un bâtiment. Les tests existants couvrent également le combat, les entrées et le multijoueur.

Les scripts `validate-melenchon-actions-browser.mjs` et `validate-melenchon-animation-browser.mjs` contrôlent l’affichage et les actions réelles dans Chrome. Captures conservées sous `artifacts/`.

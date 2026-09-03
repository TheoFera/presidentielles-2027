# PACK CODEX — Prototype gameplay V0.3 sans graphismes finaux

Ce dossier est la **source de vérité** pour construire la greybox jouable du jeu.

## Objectif

Tester le gameplay avant la production graphique : déplacement, caméra, recrutement par proximité,
implantation locale, bâtiments, unités autonomes, combat, influence électorale, premier tour,
arène médiatique et sprint final.

## Changements majeurs V0.3

- composition écran clarifiée avec références **Kingdom / Mario / Smash Bros. / Fiscal Combat** ;
- aucun bandeau HUD en haut ;
- en exploration, seul l'argent est affiché en permanence en haut à gauche, au format `k €` ;
- plus de pièces contextuelles ni de clic pour acheter ;
- un **billet avec le prix** apparaît lorsqu'une dépense est disponible ;
- rester quelques secondes devant l'élément déclenche automatiquement l'achat si les fonds sont suffisants ;
- l'Imprimerie est un **service neutre préexistant**, elle ne peut pas appartenir à un parti ;
- on paie à chaque impression de tract ;
- architecture du code imposée pour permettre plus tard un mode multijoueur 2–3 joueurs,
  tout en développant d'abord la V0 en solo + IA.

## Règles d'or

1. Aucun argent n'est donné directement à un PNJ.
2. Neutre → Sympathisant par présence/proximité automatique.
3. L'argent sert aux infrastructures, équipements et services.
4. Les PNJ visibles et l'électorat abstrait sont deux systèmes séparés.
5. `Sympathisant` est le terme officiel ; si le concepteur dit « partisan », comprendre `Sympathisant`.
6. L'interface normale doit être quasi invisible.
7. Aucun sprite final : silhouettes humaines pixelisées primitives.
8. La simulation gameplay doit être indépendante de l'affichage et du contrôleur afin de rester multiplayer-ready.

## Fichiers à lire dans cet ordre

1. `README_CODEX.md`
2. `PROTOTYPE_GAMEPLAY_SPEC.md`
3. `VISUAL_COMPOSITION_SPEC.md`
4. `MULTIPLAYER_READINESS_SPEC.md`
5. `PROTOTYPE_ACCEPTANCE_TESTS.md`
6. `IMPLEMENTATION_TASKS.md`
7. `game_balance.json`
8. `world_layout.json`
9. `building_catalog.json`
10. `CODEX_START_PROMPT.txt`

## Références visuelles incluses

- `references/GREYBOX_COMPOSITION_V0.3.png` : composition cible, proportions et interactions.
- `references/FISCAL_COMBAT_REFERENCE_USER.png` : référence fournie par le concepteur pour l'échelle des personnages et la lisibilité latérale.

Les références commerciales servent uniquement à décrire cadrage, échelle, rythme ou lisibilité.
Ne pas copier leurs assets, interfaces, niveaux ou direction artistique.

## Architecture

Réutiliser le moteur/framework déjà présent dans le dépôt. Ne pas introduire un nouveau framework majeur.
Toute hypothèse gameplay non définie doit être configurable et documentée.

Le jeu est une fiction satirique ; les mécaniques ne constituent pas des affirmations factuelles
sur les personnes réelles représentées.

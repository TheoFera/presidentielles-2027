# Pack de refonte visuelle — jeu électoral

Ce dossier est conçu pour être déposé **à la racine du dépôt du jeu**, puis donné à Codex avec `CODEX_MASTER_PROMPT.md`.

## But

Passer du greybox actuel à une direction artistique finale cohérente, en conservant la logique du jeu et la caméra :

- illustration 2D caricaturale française, dessinée/BD ;
- personnages lisibles sur téléphone ;
- bâtiments déjà présents dans le monde puis **transformés visuellement** lorsqu'ils sont capturés ;
- 6 biomes × 3 sous-zones ;
- transitions continues entre les biomes, y compris la fermeture de la boucle Riches → Bobo ;
- saisons sur une année de campagne ;
- sprites de personnages et animations ;
- bâtiments, services neutres, props, arbres, UI, événements, FX ;
- intégration complète dans le rendu existant.

## Références

- `visual_codex/references/STYLE_TARGET.png` : **référence artistique principale**.
- `visual_codex/references/GREYBOX_01.png` et `GREYBOX_02.png` : **références de composition, caméra, proportions et lisibilité du gameplay**.

La priorité est :

1. conserver la composition/caméra du greybox ;
2. appliquer la DA de `STYLE_TARGET.png` ;
3. ne pas agrandir les personnages ou bâtiments au point de réduire la lecture du terrain.

## Utilisation

Commence par lire `visual_codex/docs/00_EXECUTION_GUIDE.md` : il explique exactement comment déposer le pack et lancer le run dans Codex.


1. Copie tout le contenu de ce pack à la racine du dépôt.
2. Ne remplace pas un éventuel `AGENTS.md` existant.
3. Si tu veux aider la découverte du skill, copie le bloc de `visual_codex/AGENTS_VISUAL_SNIPPET.md` dans ton `AGENTS.md`.
4. Ouvre le dépôt dans Codex.
5. Colle intégralement `CODEX_MASTER_PROMPT.md` dans Codex.
6. Laisse Codex travailler jusqu'au rapport final : le prompt lui demande de ne pas s'arrêter après une simple démonstration.

## Fichiers à lire par Codex

- `visual_codex/docs/00_EXECUTION_GUIDE.md`
- `visual_codex/docs/01_ART_DIRECTION.md`
- `visual_codex/docs/02_CAMERA_AND_COMPOSITION.md`
- `visual_codex/docs/03_CHARACTERS_AND_ANIMATIONS.md`
- `visual_codex/docs/04_BUILDINGS_AND_SITES.md`
- `visual_codex/docs/05_BIOMES.md`
- `visual_codex/docs/06_BIOME_TRANSITIONS.md`
- `visual_codex/docs/07_SEASONS.md`
- `visual_codex/docs/08_UI_AND_EVENTS.md`
- `visual_codex/docs/09_FX_AND_COMBAT.md`
- `visual_codex/docs/10_ASSET_GENERATION_PIPELINE.md`
- `visual_codex/docs/11_RUNTIME_IMPLEMENTATION.md`
- `visual_codex/docs/12_QA_AND_ACCEPTANCE.md`
- `visual_codex/docs/13_PROMPT_TEMPLATES.md`
- `visual_codex/docs/14_BUILDING_BIOME_VARIANTS.md`
- `visual_codex/config/building_biome_matrix.json`
- `visual_codex/config/*.json`

## Important

Ce pack ne suppose pas un moteur précis. Codex doit inspecter le dépôt et adapter les chemins, atlas, loaders et formats au framework réellement utilisé.

Il ne doit pas réécrire le gameplay. Les hitboxes, la simulation, les IDs de sites, le contrôle territorial, les événements, le système de KO, etc. restent autoritaires. La couche visuelle se branche dessus.

## Règle ajoutée en V2 — bâtiments par biome

Chaque type de bâtiment possède une **base architecturale distincte dans chacun des 6 biomes**, tout en gardant le même gabarit de gameplay, la même ancre au sol et le même point d’interaction. Une simple recoloration d’un sprite unique est interdite. Voir `visual_codex/docs/14_BUILDING_BIOME_VARIANTS.md`.

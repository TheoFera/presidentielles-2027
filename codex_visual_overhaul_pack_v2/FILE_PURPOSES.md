# But de chaque fichier du pack

## À lire / utiliser directement

- `CODEX_MASTER_PROMPT.md` — **le prompt principal à exécuter dans Codex**. Il ordonne l'inspection du dépôt, la génération, l'intégration, les tests et les corrections.
- `README_FIRST.md` — vue d'ensemble du pack et règles fondamentales.
- `visual_codex/docs/00_EXECUTION_GUIDE.md` — mode d'emploi pas-à-pas pour installer le pack et lancer Codex.

## Skill Codex

- `.agents/skills/election-game-art/SKILL.md` — donne à Codex une procédure spécialisée de refonte visuelle de ce jeu. Il rappelle l'ordre de travail et les contraintes non négociables.
- `visual_codex/AGENTS_VISUAL_SNIPPET.md` — petit bloc facultatif à ajouter à un `AGENTS.md` existant pour aider Codex à découvrir le skill.

## Références visuelles

- `visual_codex/references/STYLE_TARGET.png` — **direction artistique cible** : le style cartoon/BD retenu.
- `visual_codex/references/GREYBOX_01.png` / `GREYBOX_02.png` — références de caméra, échelle, quantité de monde visible et composition.
- `visual_codex/references/README.md` — explique comment prioriser ces références.

## Spécifications visuelles

- `01_ART_DIRECTION.md` — style, trait, couleurs, lisibilité, choses à éviter.
- `02_CAMERA_AND_COMPOSITION.md` — proportions de la caméra, hauteur du sol, taille des personnages/bâtiments.
- `03_CHARACTERS_AND_ANIMATIONS.md` — candidats, PNJ, rôles, animations et cohérence des sprites.
- `04_BUILDINGS_AND_SITES.md` — fonctionnement visuel des sites neutres/capturés/niveaux/fermeture.
- `05_BIOMES.md` — identité visuelle des 6 biomes et 18 sous-zones.
- `06_BIOME_TRANSITIONS.md` — règles précises pour les 6 raccords entre biomes et la boucle complète.
- `07_SEASONS.md` — été/automne/hiver/printemps, ciel et végétation.
- `08_UI_AND_EVENTS.md` — HUD minimal, cartes d'événements et overlays.
- `09_FX_AND_COMBAT.md` — impacts, KO, projectiles, ultis et effets.
- `10_ASSET_GENERATION_PIPELINE.md` — méthode de génération par masters/lots, découpe, transparence, naming.
- `11_RUNTIME_IMPLEMENTATION.md` — comment brancher les assets au runtime sans modifier le gameplay.
- `12_QA_AND_ACCEPTANCE.md` — tests à effectuer avant de considérer la refonte finie.
- `13_PROMPT_TEMPLATES.md` — modèles de prompts d'image pour personnages, bâtiments, transitions, arbres, UI et FX.
- `14_BUILDING_BIOME_VARIANTS.md` — **nouvelle règle V2** : 6 variantes architecturales par type de site, avec matrice détaillée.

## Configurations JSON

- `visual_pipeline_config.json` — résolutions, proportions, formats, préchargement, règles globales de génération.
- `asset_manifest.json` — inventaire des lots d'assets à produire ; impose désormais au moins 42 bases architecturales de bâtiments.
- `biome_transition_map.json` — contrats de transition entre chaque paire de biomes.
- `character_animation_manifest.json` — animations attendues pour les personnages.
- `building_visual_states.json` — états visuels des sites : neutral, owned, closing, financement actif, meeting, etc.
- `building_biome_matrix.json` — **matrice bâtiment × biome** et description architecturale attendue pour les 42 bases.
- `ui_asset_manifest.json` — éléments d'interface et événements à produire.

## Registre / scripts

- `generated_asset_registry.json` — registre que Codex doit compléter au fur et à mesure de la génération/intégration.
- `scripts/inventory_assets.py` — inventorie les assets présents.
- `scripts/validate_pack.py` — vérifie que le pack est complet, que les JSON sont valides et que la matrice contient bien 7 × 6 variantes.
- `PACK_FILE_LIST.txt` — liste de contrôle de tous les fichiers du pack.

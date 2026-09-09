---
name: election-game-art
description: Generate, integrate and QA the complete 2D visual overhaul for the French electoral side-scrolling game, including characters, strategic sites, six biomes, seamless biome transitions, seasons, UI, event cards, combat FX and mobile optimization.
---

# Election Game Art Pipeline

Use this skill for any visual production or integration task in this repository.

## Required references

Read:
- `README_FIRST.md`
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

Use:
- `visual_codex/references/STYLE_TARGET.png` as art-style reference.
- `GREYBOX_01.png` and `GREYBOX_02.png` as gameplay/camera references.

## Autonomy

Continue until the requested visual task is actually implemented and tested. Do not stop after drafting prompts or generating isolated assets.

## Core constraints

1. Gameplay logic is authoritative and must remain unchanged unless a rendering integration requires a non-behavioral refactor.
2. Strategic sites must exist visually before capture. Capture changes state/overlays; it must not visually spawn the building.
3. Every site type requires a distinct architectural base in each of the six biomes. Recolor-only reuse is forbidden; gameplay footprint/anchors stay stable.
4. The world is a seamless six-biome loop. Transitions must be visually blended and preloaded.
5. Essential UI text is runtime text, not baked into images.
6. Generate coherent masters first, then derive animations/variants.
7. Use the image-generation capability available in Codex; do not silently substitute unrelated stock art.
8. Validate in the running game using screenshots and correct inconsistencies.
9. Preserve mobile readability and performance.

## Work order

- inspect repository;
- baseline screenshots;
- runtime asset pipeline;
- golden sample;
- characters;
- buildings;
- 18 subzones;
- biome transition pairs;
- seasons;
- UI/events;
- FX;
- performance;
- full QA.

Keep `visual_codex/generated_asset_registry.json` and reports current.

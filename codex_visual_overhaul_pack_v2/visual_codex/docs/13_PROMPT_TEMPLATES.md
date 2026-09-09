# 13 — Templates de prompts image

Toujours utiliser `STYLE_TARGET.png` comme référence principale.

Ces textes sont des templates, pas des prompts à copier aveuglément si le skill a sa propre syntaxe.

## A. Master candidat

> Create a production-ready 2D game character master for [CHARACTER], recognizable but deliberately caricatural rather than photorealistic. Match the exact visual language of the supplied style reference: contemporary French comic/cartoon illustration, clean dark ink outlines, lightly textured flat colors, warm readable lighting. Side-view gameplay character with a slight 3/4 readability, compact silhouette, slightly oversized head, full body, feet visible, transparent background, no text, no UI, no scenery. Keep proportions suitable for a mobile side-scroller where the character occupies about 15% of the screen height.

## B. Animation candidat

> Using the supplied character master as the identity reference and the supplied style image as the art reference, create [N] consistent animation frames for [ANIMATION]. The character must remain the same person, same clothes, same proportions and same outline thickness in every frame. Side-view game sprite, facing right, identical foot anchor and scale across frames, transparent background, no text, no scene.

## C. PNJ biome

> Create a neutral recruitable NPC for the [BIOME] biome in the same French comic/cartoon art direction. The biome identity should be expressed through plausible clothing/accessories only, not ethnicity. Keep the character generic and reusable, full body, side-view, mobile-readable, transparent background, no political colors, no text.

## D. Bâtiment neutre — variante par biome

> Create a front-facing small French neighborhood [BUILDING_TYPE] facade specifically designed for the [BIOME] biome for a 2D side-scrolling mobile game. Match the supplied comic/cartoon reference. The building is a pre-existing neutral site: grey/cream restrained palette, blank sign panel reserved for runtime text, no political logo, no baked text, ground-aligned, transparent background around the building. Keep the footprint compact and do not make it taller than about half the gameplay viewport. This must be a genuinely different architectural variant from the same building type in other biomes, while preserving the same gameplay footprint, ground anchor, interaction point, sign slot and family recognizability. Do not solve biome variation by recoloring only.

## E. Overlay faction bâtiment

> Create only the transparent political ownership overlay for the supplied neutral building: [FACTION] visual accents using the game's faction color, sign band, small flags/posters/lights, but do not change the architecture or footprint. Transparent background. No essential text. Must align pixel-perfectly with the supplied neutral base.

## F. Overlay niveau

> Create a transparent level-[LEVEL] upgrade overlay for the supplied building. Add clear but modest physical signs of development (extra flag/poster/antenna/equipment) without changing the footprint or hiding the facade. Match the supplied art style. No text.

## G. Background sous-zone

> Create the [LAYER] environment layer for the [SUBZONE] sub-zone of a continuous French side-scrolling world. Match the supplied comic/cartoon reference. Keep the horizon and ground contract from the supplied neighboring reference. No playable characters, no UI, no interactive buildings, no baked labels. Landscape composition, visually rich but low enough contrast behind gameplay.

## H. Transition A → B

> Create a seamless visual bridge from [BIOME_A] to [BIOME_B] for a continuous horizontal side-scrolling game. The left edge must still read as [BIOME_A]; the right edge must clearly begin to read as [BIOME_B]. Preserve identical horizon, sidewalk height, perspective and season. Blend architecture, vegetation, street furniture and density progressively. No hard cut, no characters, no UI, no text.

## I. Arbre saisonnier

> Create the [SEASON] variant of the supplied tree master. Keep trunk, silhouette footprint, anchor and art style identical; modify foliage and small seasonal details only. Transparent background.

## J. Icône event

> Create a small, bold, mobile-readable 2D icon for the event family [EVENT_FAMILY], matching the French comic/cartoon UI style. Thick dark outline, simple silhouette, transparent background, no text.

## K. FX

> Create a compact transparent 2D cartoon FX sprite for [FX_NAME], designed for a side-scrolling mobile game. Match the supplied style, readable over both light and dark backgrounds, no text, no photorealism, no excessive particles.

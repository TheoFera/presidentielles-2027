# Décor v3 — prompts ChatGPT (généré automatiquement)

> Ne pas modifier à la main : ce fichier est produit par `node scripts/world-v3-export.mjs` à partir de `src/presentation/world-v3/spec.js`.

## Mode d’emploi

1. Pour chaque image ci-dessous, ouvrir une nouvelle conversation ChatGPT (mode image).
2. Joindre **la maquette** (`docs/production/decor-v3/maquettes/<nom>-maquette.png`) puis les **références de style** indiquées.
3. Coller le prompt tel quel. Refaire si une enseigne crème a bougé, si du texte apparaît ou si le fond n’est pas transparent ou magenta.
4. Enregistrer le résultat sous le nom indiqué dans `assets/generated/world-v3/` (écraser l’ancien fichier).
5. Lancer `node scripts/world-v3-calibrate.mjs` : le script retire le fond magenta et le halo, mesure la ligne de sol et les enseignes, cale les portes du jeu et signale les images à refaire.
6. Un biome passe automatiquement au nouveau décor dès que ses 3 rues sont validées. Aperçu à tout moment : `http://localhost:2027/?decor=maquette`.

Ordre conseillé : les 18 rues, puis les 6 plans intermédiaires, puis les 6 lointains (30 images).

## street-paris_a.png — Paris 19e — café et boutique de créateurs, sur la butte

- Maquette : `docs/production/decor-v3/maquettes/street-paris_a-maquette.png` (légende : `street-paris_a-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-paris_a.png`

```text
Transform the attached flat-colour BLOCKOUT (street-paris_a-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Upper Paris 19th arrondissement on a gentle hill (Buttes-Chaumont feeling): cream Haussmann stone buildings with zinc mansard roofs, a trendy chain-style coffee shop and a designer concept store. Bobo, cosy, plants everywhere.
ELEMENTS, from left to right:
- x 0–90: low garden wall with black iron railing, continues past the left edge (low, 110 px high).
- x 90–440: Haussmann corner building, ornate balconies, zinc mansard roof with chimneys (height 860 px above the ground line).
- x 105–425: trendy take-away coffee shop: big windows, green-grey awning, bistro terrace chairs outside, no logo (height 290 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- x 450–560: stone stairway climbing between the buildings toward a hilltop park, black lamp post (330 px high).
- x ≈ 505: leave room for a tree of about 230 px drawn by the game (do not paint it).
- x 570–970: Haussmann building, wrought-iron balconies with flower boxes (height 900 px above the ground line).
- door centred on x = 768 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence) in the ground floor: navy-blue wooden shopfront, glass double door, posters inside. Directly above the door, ONE BLANK CREAM SIGN exactly at x 653–883, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x ≈ 1035: leave room for a tree of about 250 px drawn by the game (do not paint it).
- x 1100–1430: lower Haussmann building with climbing ivy (height 700 px above the ground line).
- x 1115–1415: designer concept store: pale green frame, minimalist lamps and vases in the window, a vintage bicycle leaning in front (height 280 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- x 1450–1536: wooden planters with lavender, continue past the right edge (low, 120 px high).
```

## street-paris_b.png — Paris 19e — place du marché bio et garage à vélo

- Maquette : `docs/production/decor-v3/maquettes/street-paris_b-maquette.png` (légende : `street-paris_b-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-paris_b.png`

```text
Transform the attached flat-colour BLOCKOUT (street-paris_b-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Lively bobo neighbourhood square in Paris: Haussmann buildings, an organic market, a bicycle repair garage. The square in the middle stays open for political meetings. Sacré-Cœur is visible far away through the open square (distant layer, do not paint it).
ELEMENTS, from left to right:
- x 0–90: wooden planters with herbs (low, 120 px high).
- x 90–600: Haussmann building with zinc roof (height 880 px above the ground line).
- door centred on x = 368 (door 230 × 260 px, bottom on the ground line): BICYCLE GARAGE: wide open workshop door, bikes hanging on the walls, wheels and tools, two bikes parked outside. Directly above the door, ONE BLANK CREAM SIGN exactly at x 238–498, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 600–940: open paved neighbourhood square with a few black bollards at its edges; empty in the middle. Keep this area EMPTY above the ground (the game draws the meeting stage in its centre).
- x 930–1280: lower old Parisian building behind the stalls (height 640 px above the ground line).
- x 940–1270: organic market stalls with striped green and cream awnings, crates of vegetables and fruit (270 px high).
- x ≈ 1110: leave room for a tree of about 240 px drawn by the game (do not paint it).
- x 1270–1466: Haussmann building (height 800 px above the ground line).
- x 1280–1460: organic grocery shop with a painted leaf pictogram (no text) (height 250 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- x 1466–1536: wooden planters, continue past the right edge (low, 120 px high).
```

## street-paris_c.png — Canal Saint-Martin — quartier mixte vers la banlieue

- Maquette : `docs/production/decor-v3/maquettes/street-paris_c-maquette.png` (légende : `street-paris_c-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-paris_c.png`

```text
Transform the attached flat-colour BLOCKOUT (street-paris_c-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Canal Saint-Martin in Paris: stone quay, a lock with black gates, the iconic green iron arched footbridge. Mixed modest buildings (brick and stone, fewer ornaments than Haussmann), a polling institute in a converted canal-side workshop. On the right, a wide open green towpath marks a breathing space before the suburbs.
ELEMENTS, from left to right:
- x 0–480: low black canal railing along the quay (low, 90 px high).
- x 70–430: green iron arched footbridge over the canal lock, stairs on both sides, canal water visible between the quay stones (380 px high).
- x ≈ 490: leave room for a tree of about 260 px drawn by the game (do not paint it).
- x 560–980: modest mixed Parisian building, brick and pale stone, 3 floors (height 760 px above the ground line).
- door centred on x = 768 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence): green-blue shopfront, glass door, leaflets in the window. Directly above the door, ONE BLANK CREAM SIGN exactly at x 653–883, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 990–1290: old brick workshop by the canal, converted into offices with big metal-framed windows (height 520 px above the ground line).
- door centred on x = 1140 (door 150 × 250 px, bottom on the ground line): POLLING INSTITUTE office in the converted workshop: glass door, bar-chart posters in the window. Directly above the door, ONE BLANK CREAM SIGN exactly at x 1030–1250, y 650–706 (colour #F3E4C5, thin dark border, completely empty).
- x 1300–1536: wide empty grassy towpath with a low wooden fence and a bench: breathing space before the suburbs (low, 100 px high).
- x ≈ 1400: leave room for a tree of about 230 px drawn by the game (do not paint it).
```

## street-banlieue_a.png — Banlieue — tours de cité géantes et média associatif

- Maquette : `docs/production/decor-v3/maquettes/street-banlieue_a-maquette.png` (légende : `street-banlieue_a-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-banlieue_a.png`

```text
Transform the attached flat-colour BLOCKOUT (street-banlieue_a-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere. The two towers deliberately leave the canvas through the top edge: in the top 120 px, draw only the repeating tower floors (the game repeats this band upward).
SCENE: French suburban housing estate (cité): TWO gigantic concrete tower blocks in the foreground, so tall they leave the top of the image; balconies, satellite dishes, laundry. An associative newsroom (Bondy Blog style) at the foot of the left tower, a late-night grocery at the foot of the right one. Absolutely no Haussmann.
ELEMENTS, from left to right:
- x 0–80: grassy mound with concrete bollards (low, 100 px high).
- x 80–620: LEFT concrete tower block, cream and grey panels, 16+ floors, leaves the top edge of the image.
- door centred on x = 350 (door 170 × 260 px, bottom on the ground line): ASSOCIATIVE NEWSROOM (local media): wide glass storefront, microphones and laptops inside, colourful mural around the door. Directly above the door, ONE BLANK CREAM SIGN exactly at x 225–475, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 640–890: small fenced multisport pitch (city stadium) with a basketball hoop, benches (210 px high).
- x ≈ 760: leave room for a tree of about 230 px drawn by the game (do not paint it).
- x 900–1400: RIGHT concrete tower block, different colour (pale ochre), leaves the top edge of the image.
- x 1010–1280: late-night grocery at the foot of the right tower: fruit crates outside, painted pictogram sign (height 260 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- x 1400–1536: low concrete wall with bike racks (low, 110 px high).
```

## street-banlieue_b.png — Banlieue — marché populaire, boulangerie, basilique au fond

- Maquette : `docs/production/decor-v3/maquettes/street-banlieue_b-maquette.png` (légende : `street-banlieue_b-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-banlieue_b.png`

```text
Transform the attached flat-colour BLOCKOUT (street-banlieue_b-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Central popular market of a suburb like Saint-Denis: plain post-war 3- and 4-storey housing blocks with balconies, a warm bakery, colourful market stalls. The open square in the middle is kept free for meetings; the Saint-Denis basilica is seen far behind (other layer).
ELEMENTS, from left to right:
- x 0–90: concrete planters (low, 110 px high).
- x 90–600: plain post-war 4-storey housing block, flat roof, balconies with plants and a flag (height 820 px above the ground line).
- x 105–275: warm bakery: golden bread and croissants in the window, red awning, painted wheat pictogram (height 260 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- door centred on x = 368 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence) in the block ground floor: simple blue frame, glass door. Directly above the door, ONE BLANK CREAM SIGN exactly at x 253–483, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 600–940: open market square, worn paving, empty in the middle. Keep this area EMPTY above the ground (the game draws the meeting stage in its centre).
- x 940–1320: 3-storey block behind the stalls (height 650 px above the ground line).
- x 950–1310: popular market stalls: fruit, spices, clothes, colourful umbrellas and awnings (280 px high).
- x 1320–1470: 3-storey corner block, phone repair shop (pictogram) (height 700 px above the ground line).
- x 1470–1536: low concrete wall (low, 110 px high).
```

## street-banlieue_c.png — Banlieue — pavillons pauvres, local SO, vers le camp de voyageurs

- Maquette : `docs/production/decor-v3/maquettes/street-banlieue_c-maquette.png` (légende : `street-banlieue_c-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-banlieue_c.png`

```text
Transform the attached flat-colour BLOCKOUT (street-banlieue_c-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Poor outer suburb: small worn detached houses, cracked render, cheap extensions, overcrowded (many letterboxes, mattress, satellite dishes). A real two-storey security service building. On the right, an open gate toward a travellers camp with a caravan.
ELEMENTS, from left to right:
- x 0–100: low cracked wall (low, 110 px high).
- x 100–320: small worn detached house, cracked render, satellite dish (height 520 px above the ground line).
- x 330–550: worn house with a cheap corrugated extension (height 470 px above the ground line).
- x 560–980: solid two-storey SECURITY SERVICE premises (local SO): wide metal garage door on the left, entrance door, barred upstairs windows, a French flag (height 620 px above the ground line).
- door centred on x = 768 (door 140 × 250 px, bottom on the ground line): entrance door of the security service premises. Directly above the door, ONE BLANK CREAM SIGN exactly at x 648–888, y 648–706 (colour #F3E4C5, thin dark border, completely empty).
- x 990–1290: worn house with too many letterboxes, laundry hanging (height 460 px above the ground line).
- x 1300–1536: open metal gate and low wire fence (low, 100 px high).
- x 1330–1470: white caravan with a red stripe parked on gravel behind an open metal gate (220 px high).
```

## street-periurbain_a.png — Périurbain — usine et maisons « French Dream » identiques

- Maquette : `docs/production/decor-v3/maquettes/street-periurbain_a-maquette.png` (légende : `street-periurbain_a-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-periurbain_a.png`

```text
Transform the attached flat-colour BLOCKOUT (street-periurbain_a-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Edge of a French small-town industrial area: a brick factory with sawtooth roof and a tall chimney, then a row of identical recent modest houses (French Dream: beige render, grey roller shutters, tiny lawns). Absolutely no Haussmann.
ELEMENTS, from left to right:
- x 0–80: low hedge (low, 100 px high).
- x 80–550: brick factory workshop with sawtooth roof, loading door, factory gate (height 540 px above the ground line).
- x 420–490: tall brick factory chimney (900 px high).
- x 575–965: modest single-storey building by the factory gate (height 420 px above the ground line).
- door centred on x = 768 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence) in this modest building: glass door, posters. Directly above the door, ONE BLANK CREAM SIGN exactly at x 653–883, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 980–1536: identical low white fences (low, 90 px high).
- x 990–1140: recent identical French Dream house #1, grey roller shutters, small lawn (height 440 px above the ground line).
- x 1150–1300: identical house #2 (height 440 px above the ground line).
- x 1310–1460: identical house #3 (height 440 px above the ground line).
```

## street-periurbain_b.png — Périurbain — zone artisanale et rond-point au premier plan

- Maquette : `docs/production/decor-v3/maquettes/street-periurbain_b-maquette.png` (légende : `street-periurbain_b-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-periurbain_b.png`

```text
Transform the attached flat-colour BLOCKOUT (street-periurbain_b-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: French commercial/craft zone: red-brick scooter garage, a warehouse, a red-brick house. In the very FOREGROUND, the ROUNDABOUT: a flattened oval island with low stone curb, flowers and a kitsch local sculpture (giant metal tractor wheel), directly on the playing street, NOT far behind. The island centre stays free for meetings.
ELEMENTS, from left to right:
- x 0–80: grass verge with a blue road direction sign (low, 110 px high).
- x 80–600: red-brick workshop (height 460 px above the ground line).
- door centred on x = 368 (door 240 × 260 px, bottom on the ground line): SCOOTER GARAGE: roller door open, scooters inside and two parked outside, oil stains. Directly above the door, ONE BLANK CREAM SIGN exactly at x 238–498, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 600–940: ROUNDABOUT island in the foreground: low stone curb, flower bed, very flat (90 px high).
- x 770–920: kitsch roundabout sculpture (giant rusty tractor wheel on a pedestal) standing at the BACK of the island (380 px high).
- x 950–1310: corrugated metal warehouse with loading bay, empty car park (height 420 px above the ground line).
- x 1320–1470: red-brick house (height 480 px above the ground line).
- x 1470–1536: hedge (low, 110 px high).
```

## street-periurbain_c.png — Périurbain — sortie vers les champs, Mont-Blanc au fond

- Maquette : `docs/production/decor-v3/maquettes/street-periurbain_c-maquette.png` (légende : `street-periurbain_c-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-periurbain_c.png`

```text
Transform the attached flat-colour BLOCKOUT (street-periurbain_c-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Exit of the industrial zone toward the fields: a farm shed and silo, a rural stone house with the campaign office, then open cattle pasture. Keep everything LOW on the right so the giant snowy mountain of the distant layer is visible. No Haussmann.
ELEMENTS, from left to right:
- x 0–120: end of industrial fence, stacked pallets (low, 100 px high).
- x 120–450: low agricultural shed (height 360 px above the ground line).
- x 390–480: metal grain silo (640 px high).
- x 560–980: low rural stone house with wooden shutters (keeps the mountain visible behind) (height 430 px above the ground line).
- door centred on x = 768 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence) in the ground floor of the stone house. Directly above the door, ONE BLANK CREAM SIGN exactly at x 653–883, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 990–1536: wooden pasture fence, open meadow (low, 110 px high).
- x 1080–1240: round hay bales (110 px high).
- x 1290–1470: one grazing Montbéliarde cow behind the fence, water trough (150 px high).
```

## street-campagne_a.png — Campagne — ferme maraîchère et ses serres

- Maquette : `docs/production/decor-v3/maquettes/street-campagne_a-maquette.png` (légende : `street-campagne_a-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-campagne_a.png`

```text
Transform the attached flat-colour BLOCKOUT (street-campagne_a-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Market-gardening farm: glass and plastic greenhouses, neat vegetable rows. The ONLY solid building is the farm barn, whose big door houses a scooter garage. No other houses.
ELEMENTS, from left to right:
- x 0–100: field hedge (low, 100 px high).
- x 100–540: two glass greenhouses with vegetable rows in front (300 px high).
- x 560–980: farm barn, stone base and wooden boards (height 560 px above the ground line).
- door centred on x = 768 (door 230 × 270 px, bottom on the ground line): SCOOTER GARAGE in the barn: big open wooden door, farm scooters and a quad inside. Directly above the door, ONE BLANK CREAM SIGN exactly at x 643–893, y 628–686 (colour #F3E4C5, thin dark border, completely empty).
- x 990–1390: plastic tunnel greenhouse, crates of vegetables, wheelbarrow, water tank (300 px high).
- x 1400–1536: field hedge (low, 100 px high).
```

## street-campagne_b.png — Campagne — le village : mairie, clocher, place

- Maquette : `docs/production/decor-v3/maquettes/street-campagne_b-maquette.png` (légende : `street-campagne_b-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-campagne_b.png`

```text
Transform the attached flat-colour BLOCKOUT (street-campagne_b-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Authentic French village: stone houses with shutters, a café-tabac (red diamond pictogram), the village square with a small war memorial and a pétanque ground, the town hall (mairie) with tricolour flag and clock, and the little church bell tower behind it. Rural scale, red tiles.
ELEMENTS, from left to right:
- x 0–90: low dry-stone wall (low, 100 px high).
- x 90–600: two joined village stone houses, painted shutters (height 560 px above the ground line).
- x 100–270: café-tabac with red diamond pictogram, two terrace chairs (height 250 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- door centred on x = 368 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence) in a village house ground floor, wooden door and window. Directly above the door, ONE BLANK CREAM SIGN exactly at x 253–483, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 600–940: village square with a gravel pétanque ground, empty in the middle. Keep this area EMPTY above the ground (the game draws the meeting stage in its centre).
- x 610–670: small war memorial obelisk at the left edge of the square (330 px high).
- x 950–1330: TOWN HALL (mairie): symmetrical, clock on the pediment, tricolour flag, steps (height 600 px above the ground line).
- x 1260–1370: little church bell tower rising behind the town hall (960 px high).
- x 1340–1470: small village house (height 460 px above the ground line).
- x 1470–1536: low dry-stone wall (low, 100 px high).
```

## street-campagne_c.png — Campagne — champs de blé et local SO dans un corps de ferme

- Maquette : `docs/production/decor-v3/maquettes/street-campagne_c-maquette.png` (légende : `street-campagne_c-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-campagne_c.png`

```text
Transform the attached flat-colour BLOCKOUT (street-campagne_c-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Open wheat fields leading to the retirees area. The only building is a solid two-storey converted farmhouse used as security service premises. Wind turbines and a village steeple are far away (other layers).
ELEMENTS, from left to right:
- x 0–120: hedge (low, 100 px high).
- x 120–560: golden wheat field edge with poppies (low, 110 px high).
- x 270–460: old red tractor parked at the field edge (200 px high).
- x 560–980: solid two-storey converted farmhouse = SECURITY SERVICE premises: wide garage door, entrance door, flag (height 560 px above the ground line).
- door centred on x = 768 (door 140 × 250 px, bottom on the ground line): entrance door of the security service farmhouse. Directly above the door, ONE BLANK CREAM SIGN exactly at x 648–888, y 648–706 (colour #F3E4C5, thin dark border, completely empty).
- x 990–1536: wheat field (low, 110 px high).
- x 1150–1310: hay bales (110 px high).
- x 1400–1536: hedge toward the retirees houses (low, 120 px high).
```

## street-retraites_a.png — Retraités — pavillons impeccables et garagiste

- Maquette : `docs/production/decor-v3/maquettes/street-retraites_a-maquette.png` (légende : `street-retraites_a-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-retraites_a.png`

```text
Transform the attached flat-colour BLOCKOUT (street-retraites_a-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Very tidy middle-class detached houses in the south of France: perfectly clipped hedges and lawns, garden gnomes, terracotta roofs, plus a family car-repair garage. No Haussmann.
ELEMENTS, from left to right:
- x 0–100: perfectly clipped hedge (low, 130 px high).
- x 100–520: family CAR REPAIR GARAGE: two bays, a car on a lift, stacked tyres, spanner pictogram (height 420 px above the ground line).
- x 560–980: neat bungalow with wooden shutters (height 480 px above the ground line).
- door centred on x = 768 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence) in the bungalow: glass door, neat lawn, garden gnome. Directly above the door, ONE BLANK CREAM SIGN exactly at x 653–883, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 980–1536: perfectly clipped low hedges (low, 120 px high).
- x 990–1250: neat bungalow, roller shutters, sprinkler on the lawn (height 440 px above the ground line).
- x 1270–1470: neat bungalow with a small palm (height 440 px above the ground line).
```

## street-retraites_b.png — Retraités — centre de station balnéaire, la mer au fond

- Maquette : `docs/production/decor-v3/maquettes/street-retraites_b-maquette.png` (légende : `street-retraites_b-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-retraites_b.png`

```text
Transform the attached flat-colour BLOCKOUT (street-retraites_b-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Centre of a French seaside resort: low white stucco buildings, terracotta roofs, blue shutters, deep awnings, a beach-goods shop (buoys, inflatable crocodile, beach balls), a pharmacy with a green cross, an open seafront plaza in the middle through which the SEA is visible (distant layers). Absolutely no Haussmann.
ELEMENTS, from left to right:
- x 0–90: low white wall with blue railing (low, 110 px high).
- x 90–600: white stucco seaside building, blue shutters, balcony (height 560 px above the ground line).
- x 100–270: beach shop: inflatable crocodile, buoys, beach balls, postcards (height 260 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- door centred on x = 368 (door 150 × 260 px, bottom on the ground line): CONSERVATIVE LOCAL NEWSPAPER office: dark green frame, newspapers in the window. Directly above the door, ONE BLANK CREAM SIGN exactly at x 248–488, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 600–940: open seafront plaza with a low balustrade at the back, empty in the middle. Keep this area EMPTY above the ground (the game draws the meeting stage in its centre).
- x 940–1410: seaside building with a pharmacy (glowing green cross) and an office (height 540 px above the ground line).
- x 950–1100: pharmacy shopfront with green cross (height 250 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- door centred on x = 1198 (door 140 × 250 px, bottom on the ground line): POLLING INSTITUTE office: sober door, charts in the window. Directly above the door, ONE BLANK CREAM SIGN exactly at x 1093–1303, y 650–706 (colour #F3E4C5, thin dark border, completely empty).
- x 1410–1536: agave planters (low, 110 px high).
```

## street-retraites_c.png — Retraités — banlieue bourgeoise type Neuilly

- Maquette : `docs/production/decor-v3/maquettes/street-retraites_c-maquette.png` (légende : `street-retraites_c-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-retraites_c.png`

```text
Transform the attached flat-colour BLOCKOUT (street-retraites_c-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Wealthy bourgeois suburb like Neuilly-sur-Seine: large 19th-century villas in millstone and brick, slate roofs, wrought-iron gates, gravel paths, topiaries. Wealthier as we approach the rich Paris districts. Detached villas, not a continuous Haussmann facade.
ELEMENTS, from left to right:
- x 0–100: tall clipped hedge (low, 130 px high).
- x 100–530: large millstone bourgeois villa, slate roof, bow window (height 640 px above the ground line).
- x 560–980: villa side wing (height 560 px above the ground line).
- door centred on x = 768 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence) in the villa side wing: elegant double door, topiaries. Directly above the door, ONE BLANK CREAM SIGN exactly at x 653–883, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 980–1130: tall wrought-iron gate between stone pillars (low, 260 px high).
- x 1130–1470: grand brick-and-stone villa behind a front garden (height 680 px above the ground line).
- x 1470–1536: tall clipped hedge (low, 130 px high).
```

## street-riches_a.png — Quartiers riches — 16e, rédaction nationale et beau parc

- Maquette : `docs/production/decor-v3/maquettes/street-riches_a-maquette.png` (légende : `street-riches_a-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-riches_a.png`

```text
Transform the attached flat-colour BLOCKOUT (street-riches_a-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Paris 16th arrondissement: grand Haussmann buildings, calm and wealthy. A national mainstream newsroom (TV/radio) inserted in a refined ground floor. On the right, the gilded gates of a beautiful park.
ELEMENTS, from left to right:
- x 0–90: clipped box hedge (low, 120 px high).
- x 90–560: grand Haussmann building, carved stone, continuous balcony (height 940 px above the ground line).
- x 560–980: Haussmann building with satellite dishes on the roof (height 900 px above the ground line).
- door centred on x = 768 (door 180 × 270 px, bottom on the ground line): NATIONAL NEWSROOM (mainstream TV/radio): wide glass entrance, screens and studio lights inside. Directly above the door, ONE BLANK CREAM SIGN exactly at x 638–898, y 626–686 (colour #F3E4C5, thin dark border, completely empty).
- x 990–1470: gilded wrought-iron park gates between stone pillars; park paths behind (low, 300 px high).
- x ≈ 1150: leave room for a tree of about 280 px drawn by the game (do not paint it).
- x ≈ 1400: leave room for a tree of about 260 px drawn by the game (do not paint it).
- x 1470–1536: clipped box hedge (low, 120 px high).
```

## street-riches_b.png — Quartiers riches — avenue touristique, vue sur la tour Eiffel

- Maquette : `docs/production/decor-v3/maquettes/street-riches_b-maquette.png` (légende : `street-riches_b-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-riches_b.png`

```text
Transform the attached flat-colour BLOCKOUT (street-riches_b-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Elegant tourist avenue: Haussmann buildings with luxury boutiques, a green Parisian newspaper kiosk, café terrace. The square in the middle opens the view to the Eiffel Tower (distant layer, do not paint it).
ELEMENTS, from left to right:
- x 0–90: stone planters (low, 120 px high).
- x 90–600: Haussmann building, gilded details (height 940 px above the ground line).
- x 100–270: luxury boutique window with a handbag pictogram (height 260 px). Its shop sign is a painted pictogram only, never a blank cream sign.
- door centred on x = 368 (door 150 × 260 px, bottom on the ground line): CAMPAIGN OFFICE (permanence): dark blue elegant frame, brass handles. Directly above the door, ONE BLANK CREAM SIGN exactly at x 253–483, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 600–940: elegant square with a stone balustrade at the back, empty in the middle. Keep this area EMPTY above the ground (the game draws the meeting stage in its centre).
- x 950–1060: green Parisian newspaper kiosk (300 px high).
- x 1060–1470: Haussmann building with luxury boutiques (height 920 px above the ground line).
- x 1470–1536: stone planters (low, 120 px high).
```

## street-riches_c.png — Quartiers riches — quartier d’affaires, La Défense au fond

- Maquette : `docs/production/decor-v3/maquettes/street-riches_c-maquette.png` (légende : `street-riches_c-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/npc-v2/npc-banlieue-0.png`, `assets/generated/biomes/street-retraites.png`
- Fichier final : `assets/generated/world-v3/street-riches_c.png`

```text
Transform the attached flat-colour BLOCKOUT (street-riches_c-maquette.png) into a finished 2D side-scrolling game street foreground for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 990 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
SCALE: a standing adult character of the game is 200 px tall; doors are about 260 px tall. Strict side view (orthographic), all ground contacts and door thresholds on the horizontal ground line y = 990.
EDGES: whatever touches the left edge (x = 0) or right edge (x = 1536) is low (under 140 px) and simply continues to the edge; the game hides the joint with a tree.
Do not paint big deciduous trees (the game draws seasonal trees); potted evergreen shrubs are fine. No people. Keep every door clear.
ONLY the cream rectangles of the blockout are blank signs; do not add any other blank sign anywhere.
SCENE: Business district edge: Haussmann buildings mixed with restrained contemporary glass entrances; a private bank, an administrative cabinet, a polling institute. La Défense towers are in the distant layer. Toward the right, a garden passage back to Paris 19e.
ELEMENTS, from left to right:
- x 0–90: clipped hedge (low, 120 px high).
- x 90–510: Haussmann building with a private bank (pictogram) on the ground floor (height 900 px above the ground line).
- x ≈ 540: leave room for a tree of about 240 px drawn by the game (do not paint it).
- x 580–960: Haussmann building with a modern glass ground floor (height 860 px above the ground line).
- door centred on x = 768 (door 150 × 260 px, bottom on the ground line): ADMINISTRATIVE CABINET office: glass revolving door, brass plaque, marble. Directly above the door, ONE BLANK CREAM SIGN exactly at x 653–883, y 638–696 (colour #F3E4C5, thin dark border, completely empty).
- x 1000–1390: restrained contemporary office building (height 820 px above the ground line).
- door centred on x = 1183 (door 150 × 250 px, bottom on the ground line): POLLING INSTITUTE office in the office building ground floor. Directly above the door, ONE BLANK CREAM SIGN exactly at x 1073–1293, y 650–706 (colour #F3E4C5, thin dark border, completely empty).
- x 1400–1536: low garden railing leading to a small urban garden (low, 110 px high).
```

## middle-bobo.png — Paris 19e — butte, toits de zinc, canal

- Maquette : `docs/production/decor-v3/maquettes/middle-bobo-maquette.png` (légende : `middle-bobo-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/biomes/landscape-retraites.png`
- Fichier final : `assets/generated/world-v3/middle-bobo.png`

```text
Transform the attached flat-colour BLOCKOUT (middle-bobo-maquette.png) into a finished 2D side-scrolling game middle-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.45 × the camera speed, behind the playable street. Slightly softer colours and thinner outlines than the street. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Paris 19e — butte, toits de zinc, canal
ELEMENTS, from left to right:
- x 70–500: Haussmann rooftops stepping up the hill (up to 330 px high).
- green hill park with paths and terraces (Buttes-Chaumont) (shape given by the blockout).
- x 540–1010: zinc roofs, chimney pots and market awnings (up to 300 px high).
- x 1060–1440: Canal Saint-Martin with lock gates and a second green footbridge (about 180 px high).
- wide open green canal bank with low walls: breathing space before the suburbs (shape given by the blockout).
```

## middle-banlieue.png — Banlieue — barres, basilique, cités basses

- Maquette : `docs/production/decor-v3/maquettes/middle-banlieue-maquette.png` (légende : `middle-banlieue-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/biomes/landscape-retraites.png`
- Fichier final : `assets/generated/world-v3/middle-banlieue.png`

```text
Transform the attached flat-colour BLOCKOUT (middle-banlieue-maquette.png) into a finished 2D side-scrolling game middle-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.45 × the camera speed, behind the playable street. Slightly softer colours and thinner outlines than the street. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Banlieue — barres, basilique, cités basses
ELEMENTS, from left to right:
- x 60–490: more concrete tower blocks and long housing bars (up to 480 px high).
- x 520–1000: plain 4-storey housing blocks (up to 260 px high).
- x 610–930: Gothic basilica of Saint-Denis (one bell tower) above the rooftops (about 470 px high).
- x 1040–1440: LOWER and WIDER housing estates (up to 240 px high).
- x 1320–1470: small travellers camp: caravans, washing line (about 90 px high).
```

## middle-periurbain.png — Périurbain — hangars, jardins ouvriers, prés

- Maquette : `docs/production/decor-v3/maquettes/middle-periurbain-maquette.png` (légende : `middle-periurbain-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/biomes/landscape-retraites.png`
- Fichier final : `assets/generated/world-v3/middle-periurbain.png`

```text
Transform the attached flat-colour BLOCKOUT (middle-periurbain-maquette.png) into a finished 2D side-scrolling game middle-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.45 × the camera speed, behind the playable street. Slightly softer colours and thinner outlines than the street. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Périurbain — hangars, jardins ouvriers, prés
ELEMENTS, from left to right:
- x 60–500: factory halls, sawtooth roofs, a second chimney, grassy embankments (up to 300 px high).
- x 70–440: allotment gardens with small sheds (about 70 px high).
- x 530–1000: craft-zone sheds, warehouses, an electricity pylon (up to 240 px high).
- meadows rising toward the mountains, first cattle farms (shape given by the blockout).
- x 1180–1420: farmhouse and barn (up to 180 px high).
```

## middle-campagne.png — Campagne — bocage, toits du village, éoliennes

- Maquette : `docs/production/decor-v3/maquettes/middle-campagne-maquette.png` (légende : `middle-campagne-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/biomes/landscape-retraites.png`
- Fichier final : `assets/generated/world-v3/middle-campagne.png`

```text
Transform the attached flat-colour BLOCKOUT (middle-campagne-maquette.png) into a finished 2D side-scrolling game middle-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.45 × the camera speed, behind the playable street. Slightly softer colours and thinner outlines than the street. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Campagne — bocage, toits du village, éoliennes
ELEMENTS, from left to right:
- patchwork of fields and hedgerows (bocage) (shape given by the blockout).
- x 120–420: distant farm with barns (about 180 px high).
- x 560–980: village roofs with red tiles (up to 220 px high).
- x 1080–1480: a row of wind turbines on the hill (the wind farm) (about 500 px high).
```

## middle-retraites.png — Retraités — vergers, promenade de bord de mer, villas

- Maquette : `docs/production/decor-v3/maquettes/middle-retraites-maquette.png` (légende : `middle-retraites-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/biomes/landscape-retraites.png`
- Fichier final : `assets/generated/world-v3/middle-retraites.png`

```text
Transform the attached flat-colour BLOCKOUT (middle-retraites-maquette.png) into a finished 2D side-scrolling game middle-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.45 × the camera speed, behind the playable street. Slightly softer colours and thinner outlines than the street. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Retraités — vergers, promenade de bord de mer, villas
ELEMENTS, from left to right:
- x 70–480: small terracotta-roof bungalows among trees (up to 200 px high).
- wooded hills and orchards (vergers) (shape given by the blockout).
- x 560–1000: seafront promenade with striped beach huts, sand and a strip of blue sea; keep it LOW so the sea horizon behind is visible (about 150 px high).
- x 1040–1480: bourgeois villas among big trees (up to 320 px high).
```

## middle-riches.png — Quartiers riches — grand parc, Seine et Trocadéro, bureaux

- Maquette : `docs/production/decor-v3/maquettes/middle-riches-maquette.png` (légende : `middle-riches-legende.png`)
- Références de style : `assets/generated/characters/character-philippe.png`, `assets/generated/biomes/landscape-retraites.png`
- Fichier final : `assets/generated/world-v3/middle-riches.png`

```text
Transform the attached flat-colour BLOCKOUT (middle-riches-maquette.png) into a finished 2D side-scrolling game middle-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.45 × the camera speed, behind the playable street. Slightly softer colours and thinner outlines than the street. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Quartiers riches — grand parc, Seine et Trocadéro, bureaux
ELEMENTS, from left to right:
- x 70–500: grand Haussmann rooftops (up to 340 px high).
- big park with tall trees (Bois de Boulogne feeling) (shape given by the blockout).
- x 560–980: Trocadéro-like terraces and the Seine with a stone bridge (about 200 px high).
- x 1040–1480: office buildings getting taller toward the business district (up to 420 px high).
```

## far-bobo.png — Paris — Montmartre et le Sacré-Cœur

- Maquette : `docs/production/decor-v3/maquettes/far-bobo-maquette.png` (légende : `far-bobo-legende.png`)
- Références de style : `assets/generated/biomes/distant-bobo.png`, `assets/generated/biomes/distant-retraites.png`
- Fichier final : `assets/generated/world-v3/far-bobo.png`

```text
Transform the attached flat-colour BLOCKOUT (far-bobo-maquette.png) into a finished 2D side-scrolling game far-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.2 × the camera speed, behind the playable street. Use lighter, bluish, low-contrast atmospheric colours and thinner outlines. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Paris — Montmartre et le Sacré-Cœur
ELEMENTS, from left to right:
- Montmartre hill covered with tiny Paris roofs (shape given by the blockout).
- x 640–900: Sacré-Cœur basilica on top of Montmartre, white domes (about 400 px high).
```

## far-banlieue.png — Banlieue — Stade de France et grues

- Maquette : `docs/production/decor-v3/maquettes/far-banlieue-maquette.png` (légende : `far-banlieue-legende.png`)
- Références de style : `assets/generated/biomes/distant-bobo.png`, `assets/generated/biomes/distant-retraites.png`
- Fichier final : `assets/generated/world-v3/far-banlieue.png`

```text
Transform the attached flat-colour BLOCKOUT (far-banlieue-maquette.png) into a finished 2D side-scrolling game far-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.2 × the camera speed, behind the playable street. Use lighter, bluish, low-contrast atmospheric colours and thinner outlines. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Banlieue — Stade de France et grues
ELEMENTS, from left to right:
- flat suburban skyline haze (shape given by the blockout).
- x 150–510: Stade de France (big white ring roof) (about 150 px high).
- x 560–1060: distant tower blocks (up to 330 px high).
- x 1150–1450: construction cranes (Grand Paris works) (about 420 px high).
```

## far-periurbain.png — Périurbain — vallée industrielle et Mont-Blanc

- Maquette : `docs/production/decor-v3/maquettes/far-periurbain-maquette.png` (légende : `far-periurbain-legende.png`)
- Références de style : `assets/generated/biomes/distant-bobo.png`, `assets/generated/biomes/distant-retraites.png`
- Fichier final : `assets/generated/world-v3/far-periurbain.png`

```text
Transform the attached flat-colour BLOCKOUT (far-periurbain-maquette.png) into a finished 2D side-scrolling game far-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.2 × the camera speed, behind the playable street. Use lighter, bluish, low-contrast atmospheric colours and thinner outlines. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Périurbain — vallée industrielle et Mont-Blanc
ELEMENTS, from left to right:
- x 150–410: distant factory chimneys with thin smoke (about 300 px high).
- foothills rising to the RIGHT into the highest snowy peak of the whole game (Mont-Blanc like), sloping back down before the right edge (shape given by the blockout).
- x 1080–1410: snow cap and glaciers on the summit (about 910 px high).
```

## far-campagne.png — Campagne — collines et village au clocher

- Maquette : `docs/production/decor-v3/maquettes/far-campagne-maquette.png` (légende : `far-campagne-legende.png`)
- Références de style : `assets/generated/biomes/distant-bobo.png`, `assets/generated/biomes/distant-retraites.png`
- Fichier final : `assets/generated/world-v3/far-campagne.png`

```text
Transform the attached flat-colour BLOCKOUT (far-campagne-maquette.png) into a finished 2D side-scrolling game far-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.2 × the camera speed, behind the playable street. Use lighter, bluish, low-contrast atmospheric colours and thinner outlines. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Campagne — collines et village au clocher
ELEMENTS, from left to right:
- gentle rolling hills, patchwork fields, NOT mountains (shape given by the blockout).
- x 760–1020: a few thin wind turbines (about 330 px high).
- x 1120–1360: tiny distant village with a church steeple (about 300 px high).
```

## far-retraites.png — Retraités — la mer à l’horizon

- Maquette : `docs/production/decor-v3/maquettes/far-retraites-maquette.png` (légende : `far-retraites-legende.png`)
- Références de style : `assets/generated/biomes/distant-bobo.png`, `assets/generated/biomes/distant-retraites.png`
- Fichier final : `assets/generated/world-v3/far-retraites.png`

```text
Transform the attached flat-colour BLOCKOUT (far-retraites-maquette.png) into a finished 2D side-scrolling game far-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.2 × the camera speed, behind the playable street. Use lighter, bluish, low-contrast atmospheric colours and thinner outlines. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Retraités — la mer à l’horizon
ELEMENTS, from left to right:
- wooded headland with orchards on the left (shape given by the blockout).
- x 440–1100: OPEN SEA: flat blue band up to the horizon, sailboats, a lighthouse on a rock; both ends hidden behind the coasts (about 120 px high).
- coastline and green cape on the right (shape given by the blockout).
```

## far-riches.png — Quartiers riches — Invalides, tour Eiffel, La Défense

- Maquette : `docs/production/decor-v3/maquettes/far-riches-maquette.png` (légende : `far-riches-legende.png`)
- Références de style : `assets/generated/biomes/distant-bobo.png`, `assets/generated/biomes/distant-retraites.png`
- Fichier final : `assets/generated/world-v3/far-riches.png`

```text
Transform the attached flat-colour BLOCKOUT (far-riches-maquette.png) into a finished 2D side-scrolling game far-distance background layer for a satirical French presidential campaign game. Keep every shape of the blockout at EXACTLY the same position, size and proportion; only replace the flat shapes by fully illustrated elements.
STYLE: the same hand-inked French political cartoon style as the attached character references: bold clean dark ink outlines, simplified and slightly caricatural shapes, flat warm colours with light watercolour/gouache texture, paper grain, cheerful and readable. Consistent light from the upper left. NOT pixel art, NOT photorealistic, NOT 3D, NOT blurry.
OUTPUT: exactly 1536 × 1024 px, TRANSPARENT background (alpha). If transparency is impossible, use a perfectly flat pure magenta #FF00FF background with no gradient, no shadow and no halo on it. Nothing at all below y = 1000 (the game draws the ground there). No sky, no clouds, no text, no letters, no logos, no watermark, no frame.
DEPTH: this layer scrolls at 0.2 × the camera speed, behind the playable street. Use lighter, bluish, low-contrast atmospheric colours and thinner outlines. Everything stands on the ground line y = 1000; below it, nothing (the game draws a continuous ground strip).
The image is split in three equal thirds matching sub-zones A, B and C of the biome: keep each landmark inside its third as in the blockout.
EDGES: every hill, relief and skyline slopes gently DOWN to the ground line before reaching the left and right edges; the first and last 40 px of the image are fully transparent. No vertical cut anywhere (no cliff or wall cut by the frame), so neighbouring biomes join seamlessly.
SCENE: Quartiers riches — Invalides, tour Eiffel, La Défense
ELEMENTS, from left to right:
- low Paris roofs haze (shape given by the blockout).
- x 180–380: golden dome of Les Invalides (about 330 px high).
- x 690–850: the Eiffel Tower, central landmark (about 820 px high).
- x 1080–1480: La Défense towers and the Grande Arche (about 560 px high).
```

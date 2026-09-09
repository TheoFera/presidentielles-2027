#!/usr/bin/env python3
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[2]
required = [
    "README_FIRST.md",
    "visual_codex/docs/00_EXECUTION_GUIDE.md",
    "visual_codex/docs/14_BUILDING_BIOME_VARIANTS.md",
    "CODEX_MASTER_PROMPT.md",
    "visual_codex/references/STYLE_TARGET.png",
    "visual_codex/references/GREYBOX_01.png",
    "visual_codex/references/GREYBOX_02.png",
    "visual_codex/config/visual_pipeline_config.json",
    "visual_codex/config/asset_manifest.json",
    "visual_codex/config/biome_transition_map.json",
    "visual_codex/config/character_animation_manifest.json",
    "visual_codex/config/building_visual_states.json",
    "visual_codex/config/ui_asset_manifest.json",
    "visual_codex/config/building_biome_matrix.json",
]
missing = [p for p in required if not (ROOT / p).exists()]
if missing:
    print("MISSING:")
    for p in missing:
        print(" -", p)
    sys.exit(1)

for p in (ROOT / "visual_codex/config").glob("*.json"):
    with p.open("r", encoding="utf-8") as f:
        json.load(f)
    print("OK JSON", p.relative_to(ROOT))

print("Pack OK.")

# Semantic checks for V2 building/biome matrix
matrix_path = ROOT / "visual_codex/config/building_biome_matrix.json"
with matrix_path.open("r", encoding="utf-8") as f:
    matrix = json.load(f)
biomes = matrix.get("biomes", [])
sites = matrix.get("site_types", [])
variants = matrix.get("variants", {})
if len(biomes) != 6:
    print("ERROR: expected 6 biomes in building_biome_matrix.json")
    sys.exit(1)
if len(sites) != 7:
    print("ERROR: expected 7 site types in building_biome_matrix.json")
    sys.exit(1)
for site in sites:
    missing_biomes = [b for b in biomes if b not in variants.get(site, {})]
    if missing_biomes:
        print("ERROR:", site, "missing biome variants", missing_biomes)
        sys.exit(1)
print("Building biome matrix OK: 42 architectural bases specified.")

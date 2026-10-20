"""Assembler les huit retouches ImageGen avec les dix symboles v1 inchangés.

Usage : python scripts/outils-images/pack-map-wheel-icons.py planche-huit.png parasol.png
Pillow sert uniquement au cadrage, à la mise à l'échelle et au rangement dans l'atlas.
Les dessins sont produits par ImageGen, pas reconstruits par ce script.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / 'src/presentation/interface/map-wheel-icons.js'
ASSETS = ROOT / 'assets/images/interface'
TARGET = ASSETS / 'roue-quartiers-verticale-v2.png'
REPLACED = ['retraites_c', 'retraites_a', 'retraites_b', 'campagne_a',
            'campagne_b', 'banlieue_c', 'paris_b', 'paris_a']
BASE_CROPS = {
    'paris_c': [59, 708, 188, 261], 'banlieue_a': [317, 46, 165, 282],
    'banlieue_b': [304, 355, 182, 278], 'periurbain_a': [555, 48, 171, 260],
    'periurbain_b': [559, 380, 163, 266], 'periurbain_c': [555, 704, 178, 269],
    'campagne_c': [799, 676, 187, 299], 'riches_a': [1307, 54, 172, 274],
    'riches_b': [1296, 358, 190, 285], 'riches_c': [1285, 677, 204, 298],
}


def tight_crop(image):
    bounds = image.getchannel('A').point(lambda value: 255 if value > 160 else 0).getbbox()
    if bounds is None:
        raise ValueError('Un symbole est vide.')
    x, y, r, b = bounds
    return image.crop((max(0, x - 2), max(0, y - 2),
                       min(image.width, r + 2), min(image.height, b + 2)))


def widths(image):
    alpha = image.getchannel('A')
    result = []
    for band in range(5):
        extent = 0
        for y in range(image.height * band // 5, image.height * (band + 1) // 5):
            for x in range(image.width):
                if alpha.getpixel((x, y)) > 32:
                    extent = max(extent, abs(x + .5 - image.width / 2))
        result.append(extent + .5)
    return result


source = MODULE.read_text(encoding='utf-8')
sections = source.split('export const mapWheelIcon')
crops = {key: json.loads(values) for key, values in
         re.findall(r'  (\w+): (\[[\d., ]+\])', sections[1])}
old_widths = {key: json.loads(values) for key, values in
              re.findall(r'  (\w+): (\[[\d., ]+\])', sections[2])}
original = Image.open(ASSETS / 'roue-quartiers-verticale-v1.png').convert('RGBA')
generated = Image.open(sys.argv[1]).convert('RGBA')
if generated.size != (1536, 1024):
    raise ValueError('La planche des huit retouches doit mesurer 1536 × 1024 pixels.')
parasol = tight_crop(Image.open(sys.argv[2]).convert('RGBA'))
sprites = {}
edges = [0, 410, 790, 1160, 1536]
for i, key in enumerate(REPLACED):
    row, col = divmod(i, 4)
    tile = generated.crop((edges[col], row * 520, edges[col + 1], min(1024, (row + 1) * 520)))
    sprite = parasol.copy() if key == 'retraites_b' else tight_crop(tile)
    sprite.thumbnail((224, 306), Image.Resampling.LANCZOS)
    sprites[key] = sprite

# L'ordre des cellules est identique à celui de la planche initiale.
biomes = ['paris', 'banlieue', 'periurbain', 'campagne', 'retraites', 'riches']
atlas = Image.new('RGBA', original.size)
new_crops, new_widths = {}, {}
for key, (x, y, w, h) in crops.items():
    if key in sprites:
        sprite = sprites[key]
    else:
        x, y, w, h = BASE_CROPS[key]
        old = original.crop((x, y, x + w, y + h))
        sprite = old
    biome, suffix = key.rsplit('_', 1)
    col, row = biomes.index(biome), 'abc'.index(suffix)
    left = col * 256 + (256 - sprite.width) // 2
    top = round(row * 1024 / 3) + (341 - sprite.height) // 2
    atlas.paste(sprite, (left, top))  # copie RGBA exacte, sans recomposition alpha
    new_crops[key] = [left, top, sprite.width, sprite.height]
    new_widths[key] = widths(sprite) if key in sprites else old_widths[key]
    if key not in sprites:
        assert atlas.crop((left, top, left + w, top + h)).tobytes() == old.tobytes(), key

atlas.save(TARGET, optimize=True)


def replace_entries(section, values):
    return re.sub(r'  (\w+): \[[\d., ]+\]',
                  lambda match: '  ' + match[1] + ': ' + json.dumps(values[match[1]]), section)


sections[0] = sections[0].replace('roue-quartiers-verticale-v1.png', TARGET.name)
sections[1] = replace_entries(sections[1], new_crops)
sections[2] = replace_entries(sections[2], new_widths)
MODULE.write_text('export const mapWheelIcon'.join(sections), encoding='utf-8')
print(json.dumps({'image': TARGET.name, 'dimensions': atlas.size, 'octets': TARGET.stat().st_size,
                  'dessins_refaits': REPLACED, 'dessins_conserves_pixel_par_pixel': 10}, ensure_ascii=False))

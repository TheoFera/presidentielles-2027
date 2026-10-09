from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

root = Path(__file__).resolve().parents[3]
s = root / 'docs/retouches-carte/sources'
names = ['tuile-08-periurbain-b.png', 'tuile-09-periurbain-c.png', 'tuile-13-retraites-a.png', 'tuile-14-retraites-b.png', 'tuile-15-retraites-c.png', 'tuile-17-riches-b.png']
tiles = {name: Image.open(s / ('jonctions-' + name)).convert('RGB') for name in names}

def vertical_cut(old, new, start, end, top, bottom):
    cost = np.abs(old[top:bottom, start:end].astype(float) - new[top:bottom, start:end]).mean(axis=2)
    parents = np.zeros(cost.shape, dtype=np.int16)
    cumulative = cost[0].copy()
    for y in range(1, len(cost)):
        options = np.stack([np.r_[np.inf, cumulative[:-1]], cumulative, np.r_[cumulative[1:], np.inf]])
        choice = np.argmin(options, axis=0)
        parents[y] = np.arange(end-start) + choice - 1
        cumulative = cost[y] + options.min(axis=0)
    path = np.empty(len(cost), dtype=int)
    path[-1] = np.argmin(cumulative)
    for y in range(len(cost)-1, 0, -1):
        path[y-1] = parents[y, path[y]]
    return path + start

def retouch(key, regions, polygon=None):
    original_image = Image.open(s / (key + '-avant.png')).convert('RGB')
    old = np.array(original_image)
    new = np.array(Image.open(s / (key + '-source.png')).convert('RGB').resize(original_image.size, Image.Resampling.LANCZOS))
    mask = np.zeros(old.shape[:2], dtype=bool)
    xx = np.arange(old.shape[1])[None, :]
    for top, bottom, left, right in regions:
        l = vertical_cut(old, new, *left, top, bottom)
        r = vertical_cut(old, new, *right, top, bottom)
        mask[top:bottom] |= (xx >= l[:, None]) & (xx <= r[:, None])
    if polygon:
        area = Image.new('L', original_image.size)
        ImageDraw.Draw(area).polygon(polygon, fill=255)
        mask |= np.array(area) > 0
    result = old.copy()
    result[mask] = new[mask]
    assert np.array_equal(result[~mask], old[~mask])
    Image.fromarray(mask.astype('uint8')*255).save(s / (key + '-masque.png'))
    image = Image.fromarray(result)
    image.save(root / 'docs/retouches-carte' / (key + '-apercu.png'))
    return image

key = 'periurbain-b-bordure-gauche'
im = retouch(key, [(340, 400, (20, 55), (835, 890))])
tiles[names[0]].paste(im, (0, 680))

key = 'periurbain-bc-bordure'
im = retouch(key, [(280, 360, (310, 340), (840, 890))])
tiles[names[0]].paste(im.crop((0, 0, 480, 360)), (1440, 720))
tiles[names[1]].paste(im.crop((480, 0, 900, 360)), (0, 720))

key = 'retraites-a-bordure'
im = retouch(key, [(250, 320, (140, 175), (540, 575))])
tiles[names[2]].paste(im, (100, 760))

key = 'retraites-bc-bordure'
im = retouch(key, [(250, 320, (70, 100), (530, 610))])
fin = retouch('retraites-bc-bordure-raccord-fin', [(110, 170, (65, 95), (250, 285))])
im.paste(fin, (400, 150))
im.save(root / 'docs/retouches-carte' / (key + '-apercu.png'))
tiles[names[3]].paste(im.crop((0, 0, 360, 320)), (1560, 760))
tiles[names[4]].paste(im.crop((360, 0, 780, 320)), (0, 760))

key = 'retraites-c-panneau'
im = retouch(key, [(91, 154, (110, 126), (425, 431))])
tiles[names[4]].paste(im, (1000, 660))

key = 'riches-b-vitrine'
im = retouch(key, [(0, 222, (3, 12), (190, 208)), (385, 445, (52, 63), (181, 197))])
tiles[names[5]].paste(im, (510, 560))

for name, image in tiles.items():
    assert image.mode == 'RGB' and image.size == (1920, 1080)
    before = np.array(Image.open(s / ('jonctions-' + name)).convert('RGB'))
    after = np.array(image)
    changed = np.any(before != after, axis=2)
    Image.fromarray(changed.astype('uint8') * 255).save(s / ('jonctions-masque-' + name))
    target = root / 'assets/images/carte' / name
    temporary = target.with_name(target.stem + '-retouche.tmp.png')
    image.save(temporary)
    temporary.replace(target)
print('Six retouches intégrées avec des masques opaques ; pixels extérieurs conservés.')

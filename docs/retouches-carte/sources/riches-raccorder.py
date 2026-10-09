from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

root = Path(__file__).resolve().parents[3]
sources = root / 'docs/retouches-carte/sources'
names = ['tuile-15-retraites-c.png', 'tuile-16-riches-a.png', 'tuile-17-riches-b.png', 'tuile-18-riches-c.png', 'tuile-01-paris-a.png']

def cut(original, painted, start, end, height=1030):
    cost = np.abs(original[:height, start:end].astype(float) - painted[:height, start:end]).mean(axis=2)
    parents = np.zeros(cost.shape, np.int16)
    cumulative = cost[0].copy()
    for y in range(1, height):
        options = np.stack([np.r_[np.inf, cumulative[:-1]], cumulative, np.r_[cumulative[1:], np.inf]])
        choice = np.argmin(options, axis=0)
        parents[y] = np.arange(end-start) + choice - 1
        cumulative = cost[y] + np.min(options, axis=0)
    path = np.empty(height, np.int32)
    path[-1] = np.argmin(cumulative)
    for y in range(height-1, 0, -1):
        path[y-1] = parents[y, path[y]]
    return path + start

for n, key in enumerate(['15a', 'ab', 'bc', 'c01']):
    left_tile = Image.open(root / 'assets/images/carte' / names[n]).convert('RGB')
    right_tile = Image.open(root / 'assets/images/carte' / names[n+1]).convert('RGB')
    context = Image.new('RGB', (1280, 1080))
    context.paste(left_tile.crop((1280, 0, 1920, 1080)), (0, 0))
    context.paste(right_tile.crop((0, 0, 640, 1080)), (640, 0))
    original = np.array(context)
    painted = np.array(Image.open(sources / f'riches-raccord-{key}-source.png').convert('RGB'))
    assert painted.shape == original.shape == (1080, 1280, 3)
    if key != '15a':
        r, g, b = [painted[..., channel].astype(int) for channel in range(3)]
        eligible = (b > r+28) & (g > r+18) & (b > g+10) & (r > 55)
        eligible[650:] = False
        sky_image = Image.fromarray(eligible.astype('uint8')*255).filter(ImageFilter.MinFilter(9)).copy()
        for x in range(0, 1280, 8):
            if sky_image.getpixel((x, 0)) == 255:
                ImageDraw.floodfill(sky_image, (x, 0), 127)
        sky = np.array(Image.fromarray((np.array(sky_image)==127).astype('uint8')*255).filter(ImageFilter.MaxFilter(9)))>0
        sky &= eligible
        colors = np.median(original[:50], axis=0).astype('uint8') if key == 'c01' else np.tile([159, 207, 238], (1280, 1)).astype('uint8')
        painted[sky] = np.broadcast_to(colors[None, :, :], painted.shape)[sky]
    mask = np.zeros((1080, 1280), bool)
    xx = np.arange(1280)[None, :]
    if key == '15a':
        mask[580:1008, 838:963] = True
    elif key == 'ab':
        l, r = cut(original, painted, 530, 600), cut(original, painted, 755, 795)
        mask[:1030] = (xx >= l[:, None]) & (xx <= r[:, None])
    elif key == 'bc':
        l, r = cut(original, painted, 500, 570, 610), cut(original, painted, 870, 930, 610)
        mask[:610] = (xx >= l[:, None]) & (xx <= r[:, None])
        area = Image.new('L', (1280, 1080))
        ImageDraw.Draw(area).polygon([(620, 580), (850, 580), (850, 930), (875, 1005), (845, 1029), (585, 1029), (610, 930)], fill=255)
        mask |= np.array(area)>0
    else:
        l, r = cut(original, painted, 0, 45), cut(original, painted, 560, 640)
        mask[:1030] = (xx >= l[:, None]) & (xx <= r[:, None])
        mask[:, 640:] = False
    mask[1030:] = False
    result = original.copy()
    result[mask] = painted[mask]
    assert np.array_equal(result[~mask], original[~mask])
    if key == '15a':
        assert not mask[:, :640].any()
    if key == 'c01':
        assert not mask[:, 640:].any()
    Image.fromarray(mask.astype('uint8')*255).save(sources / f'riches-raccord-{key}-masque.png')
    Image.fromarray(result).save(sources / f'riches-raccord-{key}-integre.png')
    left_tile.paste(Image.fromarray(result[:, :640]), (1280, 0))
    right_tile.paste(Image.fromarray(result[:, 640:]), (0, 0))
    if mask[:, :640].any():
        left_tile.save(root / 'assets/images/carte' / names[n])
    if mask[:, 640:].any():
        right_tile.save(root / 'assets/images/carte' / names[n+1])
    print(key, 'pixels retouchés :', int(mask.sum()))

images = [Image.open(root / 'assets/images/carte' / name).convert('RGB') for name in names]
panorama = Image.new('RGB', (6272, 1080))
panorama.paste(images[0].crop((1664, 0, 1920, 1080)), (0, 0))
for n, image in enumerate(images[1:4]):
    panorama.paste(image, (256 + 1920*n, 0))
panorama.paste(images[-1].crop((0, 0, 256, 1080)), (6016, 0))
panorama.save(sources / 'riches-abc-contexte-integre.png')
panorama.resize((3136, 540)).save(root / 'docs/retouches-carte/riches-abc-integre-apercu.png')

from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

root = Path(__file__).resolve().parents[3]
sources = root / 'docs/retouches-carte/sources'

def seam(original, painted, left, right):
    cost = np.abs(original[:1030, left:right].astype(float) - painted[:1030, left:right]).mean(axis=2)
    # Les coupes suivent le meilleur accord entre les peintures, sans fondu.
    parents = np.empty(cost.shape, np.int16)
    cumulative = cost[0].copy()
    for y in range(1, len(cost)):
        options = np.stack([np.r_[np.inf, cumulative[:-1]], cumulative, np.r_[cumulative[1:], np.inf]])
        choice = np.argmin(options, axis=0)
        parents[y] = np.arange(right-left) + choice - 1
        cumulative = cost[y] + np.min(options, axis=0)
    path = np.empty(len(cost), np.int32)
    path[-1] = np.argmin(cumulative)
    for y in range(len(cost)-1, 0, -1):
        path[y-1] = parents[y, path[y]]
    return path + left

for i, zone in enumerate('abc', 16):
    original = np.array(Image.open(sources / f'riches-{zone}-contexte-avant.png').convert('RGB'))
    painted = np.array(Image.open(sources / f'riches-{zone}-production-v1.png').convert('RGB'))
    assert painted.shape == original.shape == (1080, 2432, 3)
    # Le ciel bleu connecté à l'extérieur reprend les vrais pixels de ciel de la fresque.
    r, g, b = painted[..., 0].astype(int), painted[..., 1].astype(int), painted[..., 2].astype(int)
    eligible = (b > r + 28) & (g > r + 18) & (b > g + 10) & (r > 55)
    eligible[700:] = False
    eligible_image = Image.fromarray(np.where(eligible, 255, 0).astype('uint8')).filter(ImageFilter.MinFilter(9)).copy()
    from PIL.ImageDraw import floodfill
    for x in range(0, 2432, 8):
        if eligible_image.getpixel((x, 0)) == 255:
            floodfill(eligible_image, (x, 0), 127)
    sky = np.array(Image.fromarray((np.array(eligible_image) == 127).astype('uint8')*255).filter(ImageFilter.MaxFilter(9))) > 0
    sky &= eligible
    sky_colors = np.median(original[:50], axis=0).astype('uint8')
    painted[sky] = np.broadcast_to(sky_colors[None, :, :], painted.shape)[sky]
    Image.fromarray(painted).save(sources / f'riches-{zone}-production-ciel.png')
    left = seam(original, painted, 256, 310)
    right = seam(original, painted, 2122, 2176)
    yy, xx = np.indices((1080, 2432))
    mask = np.zeros((1080, 2432), bool)
    mask[:1030] = (xx[:1030] >= left[:, None]) & (xx[:1030] <= right[:, None])
    result = original.copy()
    result[mask] = painted[mask]
    if zone == 'a':
        # Le bord du parc conserve sa couronne et son ciel existants.
        result[:64, 256:512] = original[:64, 256:512]
        mask[:64, 256:512] = False
    assert np.array_equal(result[~mask], original[~mask])
    assert np.array_equal(result[1030:], original[1030:])
    Image.fromarray(mask.astype('uint8')*255).save(sources / f'riches-{zone}-integration-masque.png')
    Image.fromarray(result).save(sources / f'riches-{zone}-contexte-integre.png')
    tile = Image.fromarray(result[:, 256:2176])
    assert tile.size == (1920, 1080)
    tile.save(root / f'assets/images/carte/tuile-{i:02d}-riches-{zone}.png')
    print(zone, 'pixels remplacés :', int(mask.sum()))

order = [(15, 'retraites-c'), (16, 'riches-a'), (17, 'riches-b'), (18, 'riches-c'), (1, 'paris-a')]
images = [Image.open(root / f'assets/images/carte/tuile-{n:02d}-{name}.png').convert('RGB') for n, name in order]
panorama = Image.new('RGB', (6272, 1080))
panorama.paste(images[0].crop((1664, 0, 1920, 1080)), (0, 0))
for n, image in enumerate(images[1:4]):
    panorama.paste(image, (256 + 1920*n, 0))
panorama.paste(images[-1].crop((0, 0, 256, 1080)), (6016, 0))
panorama.save(sources / 'riches-abc-contexte-integre.png')
panorama.resize((3136, 540)).save(root / 'docs/retouches-carte/riches-abc-integre-apercu.png')

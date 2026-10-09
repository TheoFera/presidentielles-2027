from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

root = Path(__file__).resolve().parents[3]
sources = root / 'docs/retouches-carte/sources'
old = np.concatenate([np.array(Image.open(sources / f'riches-{z}-avant-integration.png').convert('RGB')) for z in 'abc'], axis=1)
palette = np.empty((1080, 3), np.uint8)
previous = np.array([159, 207, 238], np.uint8)
for y in range(650):
    row = old[y].astype(int)
    eligible = (row[:, 0]>140) & (row[:, 1]>190) & (row[:, 2]>220) & (row[:, 1]>row[:, 0]+18) & (row[:, 2]>row[:, 1]+12)
    colors, counts = np.unique(row[eligible], axis=0, return_counts=True)
    if len(counts) and counts.max()>=30:
        previous = colors[counts.argmax()].astype('uint8')
    palette[y] = previous
palette[650:] = previous

for i, z in enumerate('abc', 16):
    target = root / f'assets/images/carte/tuile-{i:02d}-riches-{z}.png'
    original = np.array(Image.open(target).convert('RGB'))
    r, g, b = [original[..., channel].astype(int) for channel in range(3)]
    eligible = (b>r+28) & (g>r+18) & (b>g+10) & (r>95) & (g>180)
    eligible[650:] = False
    image = Image.fromarray(eligible.astype('uint8')*255).filter(ImageFilter.MinFilter(9)).copy()
    for x in range(0, 1920, 8):
        if image.getpixel((x, 0)) == 255:
            ImageDraw.floodfill(image, (x, 0), 127)
    mask = np.array(Image.fromarray((np.array(image)==127).astype('uint8')*255).filter(ImageFilter.MaxFilter(9)))>0
    mask &= eligible
    result = original.copy()
    # Réemploi opaque de la couleur réelle du ciel d'origine pour chaque ligne.
    result[mask] = np.broadcast_to(palette[:, None, :], result.shape)[mask]
    assert np.array_equal(result[~mask], original[~mask])
    Image.fromarray(mask.astype('uint8')*255).save(sources / f'riches-{z}-ciel-masque.png')
    Image.fromarray(result).save(target)
    print(z, 'ciel harmonisé :', int(mask.sum()))

names = ['tuile-15-retraites-c.png', 'tuile-16-riches-a.png', 'tuile-17-riches-b.png', 'tuile-18-riches-c.png', 'tuile-01-paris-a.png']
images = [Image.open(root / 'assets/images/carte' / name).convert('RGB') for name in names]
panorama = Image.new('RGB', (6272, 1080))
panorama.paste(images[0].crop((1664, 0, 1920, 1080)), (0, 0))
for n, image in enumerate(images[1:4]):
    panorama.paste(image, (256 + 1920*n, 0))
panorama.paste(images[-1].crop((0, 0, 256, 1080)), (6016, 0))
panorama.save(sources / 'riches-abc-contexte-integre.png')
panorama.resize((3136, 540)).save(root / 'docs/retouches-carte/riches-abc-integre-apercu.png')

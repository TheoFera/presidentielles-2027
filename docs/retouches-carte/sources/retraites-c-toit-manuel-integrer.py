from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
sources = root / 'docs/retouches-carte/sources'
archive = (root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule/docs/production/decor-v3/carte-plate').resolve()
name = 'tuile-15-retraites-c.png'
before = np.array(Image.open(sources / 'retraites-c-toit-manuel-avant-tuile.png').convert('RGB'))
selected = np.array(Image.open(sources / 'retraites-c-toit-manuel-source-tuile.png').convert('RGB'))
changed = np.any(before != selected, axis=2)
ys, xs = np.where(changed)
assert len(xs) == 254 and (xs.min(), ys.min(), xs.max(), ys.max()) == (1100, 325, 1110, 361)
Image.fromarray(changed.astype('uint8') * 255).save(sources / 'retraites-c-toit-manuel-masque.png')
targets = [root / 'assets/images/carte' / name, archive / 'tuiles' / name, archive / 'production/tuiles' / name, archive / 'production/fresque-en-cours.png']
for target in targets:
    target = target.resolve()
    assert target.is_file() and (target.is_relative_to(root) or target.is_relative_to(archive))
    image = Image.open(target).convert('RGB')
    offset = 14 * 1920 if image.width > 1920 else 0
    part = np.array(image.crop((offset, 0, offset + 1920, 1080)))
    outside = part[~changed].copy()
    part[changed] = selected[changed]
    assert np.array_equal(part[~changed], outside)
    image.paste(Image.fromarray(part), (offset, 0))
    image.save(target)
master = Image.open(archive / 'fresque-plate-maitre.png').convert('RGB')
files = sorted((root / 'assets/images/carte').glob('tuile-*.png'))
assert len(files) == 18
for index, file in enumerate(files):
    assert np.array_equal(np.array(Image.open(file).convert('RGB')), np.array(master.crop((index * 1920, 0, (index + 1) * 1920, 1080))))
print('254 pixels reportés ; les 18 tuiles du jeu correspondent à la fresque maître manuelle.')

from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
sources = root / 'docs/retouches-carte/sources'
name = 'tuile-15-retraites-c.png'
current = np.array(Image.open(root / 'assets/images/carte' / name).convert('RGB'))
before = np.array(Image.open(sources / 'retraites-c-facade-avant-tuile.png').convert('RGB'))
changed = np.any(current != before, axis=2)
assert np.array_equal(changed, np.array(Image.open(sources / 'retraites-c-facade-masque-tuile.png')) > 0)
# Reporter aussi les pixels précédemment retouchés qui retrouvent leur couleur initiale.
previous_path = sources / 'retraites-c-pavillon-avant-tuile.png'
if previous_path.is_file():
    previous = np.array(Image.open(previous_path).convert('RGB'))
    changed |= np.any(previous != before, axis=2)
discarded_path = sources / 'retraites-c-manoir-ecartee-tuile.png'
if discarded_path.is_file():
    discarded = np.array(Image.open(discarded_path).convert('RGB'))
    changed |= np.any(discarded != before, axis=2)
archive = (root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule/docs/production/decor-v3/carte-plate').resolve()
for relative in ['fresque-plate-maitre.png', 'production/fresque-en-cours.png', 'tuiles/' + name, 'production/tuiles/' + name]:
    target = (archive / relative).resolve()
    assert target.is_relative_to(archive) and target.is_file()
    image = Image.open(target).convert('RGB')
    master = image.width > 1920
    offset = 14 * 1920 if master else 0
    part = np.array(image.crop((offset, 0, offset + 1920, 1080)))
    outside = part[~changed].copy()
    part[changed] = current[changed]
    assert np.array_equal(part[~changed], outside)
    image.paste(Image.fromarray(part), (offset, 0))
    image.save(target)
master = Image.open(archive / 'fresque-plate-maitre.png').convert('RGB')
files = sorted((root / 'assets/images/carte').glob('tuile-*.png'))
assert len(files) == 18
for index, file in enumerate(files):
    assert np.array_equal(np.array(Image.open(file).convert('RGB')), np.array(master.crop((index * 1920, 0, (index + 1) * 1920, 1080))))
print('Les 18 tuiles de la fresque maître correspondent au jeu.')

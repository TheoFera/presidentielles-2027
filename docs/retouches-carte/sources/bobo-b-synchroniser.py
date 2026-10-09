from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
archive = root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule' / 'docs/production/decor-v3/carte-plate'
before = np.array(Image.open(root / 'docs/retouches-carte/sources/bobo-b-avant-recomposition.png').convert('RGB'))
after = np.array(Image.open(root / 'assets/images/carte/tuile-02-paris-b.png').convert('RGB'))
changed = np.any(before != after, axis=2)
assert after.shape == (1080, 1920, 3)
assert not changed[1030:].any()
for relative in ['fresque-plate-maitre.png', 'production/fresque-en-cours.png']:
    target = (archive / relative).resolve()
    assert target.is_relative_to(archive.resolve()) and target.is_file()
    image = Image.open(target).convert('RGB')
    assert image.size == (34560, 1080)
    part = np.array(image.crop((1920, 0, 3840, 1080)))
    outside = part[~changed].copy()
    part[changed] = after[changed]
    assert np.array_equal(part[~changed], outside)
    image.paste(Image.fromarray(part), (1920, 0))
    image.save(target)
    print('Synchronisé :', target)
for relative in ['tuiles/tuile-02-paris-b.png', 'production/tuiles/tuile-02-paris-b.png']:
    target = (archive / relative).resolve()
    assert target.is_relative_to(archive.resolve()) and target.is_file()
    image = np.array(Image.open(target).convert('RGB'))
    image[changed] = after[changed]
    Image.fromarray(image).save(target)
    print('Synchronisé :', target)

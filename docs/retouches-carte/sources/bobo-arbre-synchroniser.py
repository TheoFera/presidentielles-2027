from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
archive = root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule' / 'docs/production/decor-v3/carte-plate'
parts = []
for index, name, baseline in [(0, 'tuile-01-paris-a.png', 'bobo-a-avant-racines.png'), (1, 'tuile-02-paris-b.png', 'bobo-b-avant-racines.png')]:
    before = np.array(Image.open(root / 'docs/retouches-carte/sources' / baseline).convert('RGB'))
    after = np.array(Image.open(root / 'assets/images/carte' / name).convert('RGB'))
    changed = np.any(before != after, axis=2)
    assert not changed[:890].any() and not changed[1006:].any()
    parts.append((index, name, after, changed))
for relative in ['fresque-plate-maitre.png', 'production/fresque-en-cours.png']:
    target = (archive / relative).resolve()
    assert target.is_relative_to(archive.resolve()) and target.is_file()
    image = Image.open(target).convert('RGB')
    assert image.size == (34560, 1080)
    for index, name, after, changed in parts:
        part = np.array(image.crop((index * 1920, 0, (index + 1) * 1920, 1080)))
        part[changed] = after[changed]
        image.paste(Image.fromarray(part), (index * 1920, 0))
    image.save(target)
for index, name, after, changed in parts:
    for directory in ['tuiles', 'production/tuiles']:
        target = (archive / directory / name).resolve()
        assert target.is_relative_to(archive.resolve()) and target.is_file()
        image = np.array(Image.open(target).convert('RGB'))
        image[changed] = after[changed]
        Image.fromarray(image).save(target)
print('Racines synchronisées dans A et B, uniquement pour les pixels de la retouche.')

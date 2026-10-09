from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
archive = (root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule' / 'docs/production/decor-v3/carte-plate').resolve()
master = Image.open(archive / 'fresque-plate-maitre.png').convert('RGB')
patches = []
for number, name, expected in [(5, 'tuile-05-banlieue-b.png', 8), (14, 'tuile-14-retraites-b.png', 23)]:
    box = ((number-1)*1920, 0, number*1920, 1080)
    current = np.array(Image.open(root / 'assets/images/carte' / name).convert('RGB'))
    changed = np.any(current != np.array(master.crop(box)), axis=2)
    assert int(changed.sum()) in (0, expected)
    patches.append((box, name, current, changed))

for relative in ['fresque-plate-maitre.png', 'production/fresque-en-cours.png']:
    target = (archive / relative).resolve()
    assert target.is_relative_to(archive) and target.is_file()
    image = Image.open(target).convert('RGB')
    for box, name, current, changed in patches:
        part = np.array(image.crop(box))
        outside = part[~changed].copy()
        part[changed] = current[changed]
        assert np.array_equal(part[~changed], outside)
        image.paste(Image.fromarray(part), box[:2])
    image.save(target)

for directory in ['tuiles', 'production/tuiles']:
    for box, name, current, changed in patches:
        target = (archive / directory / name).resolve()
        assert target.is_relative_to(archive) and target.is_file()
        part = np.array(Image.open(target).convert('RGB'))
        outside = part[~changed].copy()
        part[changed] = current[changed]
        assert np.array_equal(part[~changed], outside)
        Image.fromarray(part).save(target)

verified = Image.open(archive / 'fresque-plate-maitre.png').convert('RGB')
files = sorted((root / 'assets/images/carte').glob('tuile-*.png'))
assert len(files) == 18 and verified.size == (34560, 1080)
for index, file in enumerate(files):
    source = np.array(Image.open(file).convert('RGB'))
    assert np.array_equal(source, np.array(verified.crop((index*1920, 0, (index+1)*1920, 1080))))
print('Fresque maitre : 18 tuiles identiques pixel par pixel au jeu.')

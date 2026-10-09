from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
archive = (root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule' / 'docs/production/decor-v3/carte-plate').resolve()
master_path = (archive / 'fresque-plate-maitre.png').resolve()
assert master_path.is_relative_to(archive) and master_path.is_file()
master = Image.open(master_path).convert('RGB')
assert master.size == (34560, 1080)
sources = root / 'docs/retouches-carte/sources'
patches = []
for number, zone in [(11, 'b'), (12, 'c')]:
    name = f'tuile-{number:02d}-campagne-{zone}.png'
    box = ((number-1)*1920, 0, number*1920, 1080)
    before = np.array(master.crop(box))
    current = np.array(Image.open(root / 'assets/images/carte' / name).convert('RGB'))
    changed = np.any(before != current, axis=2)
    # Le report reste limité à la retouche existante du raccord B → C.
    assert not changed[:455].any() and not changed[1026:].any()
    if zone == 'b':
        assert not changed[:, :1839].any()
    else:
        assert not changed[:, 440:].any()
    outside = before[~changed].copy()
    before[changed] = current[changed]
    assert np.array_equal(before[~changed], outside)
    master.paste(Image.fromarray(before), box[:2])
    patches.append((box, name, current, changed))
master.save(master_path)

for directory in ['tuiles', 'production/tuiles']:
    for box, name, current, changed in patches:
        target = (archive / directory / name).resolve()
        assert target.is_relative_to(archive) and target.is_file()
        original = np.array(Image.open(target).convert('RGB'))
        outside = original[~changed].copy()
        original[changed] = current[changed]
        assert np.array_equal(original[~changed], outside)
        assert np.array_equal(original, current)
        Image.fromarray(original).save(target)

check = Image.open(master_path).convert('RGB')
for box, name, current, changed in patches:
    assert np.array_equal(np.array(check.crop(box)), current)
check.crop((10*1920+1280, 0, 11*1920+640, 1080)).save(sources / 'campagne-bc-maitre-controle.png')
print('Raccord Campagne B vers C : maître et tuiles archivées identiques au jeu.')

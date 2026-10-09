from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
s = root / 'docs/retouches-carte/sources'
archive = (root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule/docs/production/decor-v3/carte-plate').resolve()
names = ['tuile-08-periurbain-b.png', 'tuile-09-periurbain-c.png', 'tuile-13-retraites-a.png', 'tuile-14-retraites-b.png', 'tuile-15-retraites-c.png', 'tuile-17-riches-b.png']
patches = []
for name in names:
    current = np.array(Image.open(root / 'assets/images/carte' / name).convert('RGB'))
    before = np.array(Image.open(s / ('jonctions-' + name)).convert('RGB'))
    changed = np.any(current != before, axis=2)
    saved_mask = np.array(Image.open(s / ('jonctions-masque-' + name))) > 0
    assert np.array_equal(changed, saved_mask)
    index = int(name.split('-')[1]) - 1
    patches.append((index, name, current, changed))
for relative in ['fresque-plate-maitre.png', 'production/fresque-en-cours.png']:
    target = (archive / relative).resolve()
    assert target.is_relative_to(archive) and target.is_file()
    image = Image.open(target).convert('RGB')
    for index, name, current, changed in patches:
        part = np.array(image.crop((index*1920, 0, (index+1)*1920, 1080)))
        outside = part[~changed].copy()
        part[changed] = current[changed]
        assert np.array_equal(part[~changed], outside)
        image.paste(Image.fromarray(part), (index*1920, 0))
    image.save(target)
for directory in ['tuiles', 'production/tuiles']:
    for index, name, current, changed in patches:
        target = (archive / directory / name).resolve()
        assert target.is_relative_to(archive) and target.is_file()
        part = np.array(Image.open(target).convert('RGB'))
        outside = part[~changed].copy()
        part[changed] = current[changed]
        assert np.array_equal(part[~changed], outside)
        Image.fromarray(part).save(target)
master = Image.open(archive / 'fresque-plate-maitre.png').convert('RGB')
files = sorted((root / 'assets/images/carte').glob('tuile-*.png'))
assert len(files) == 18
for index, file in enumerate(files):
    assert np.array_equal(np.array(Image.open(file).convert('RGB')), np.array(master.crop((index*1920,0,(index+1)*1920,1080))))
print('Fresque maitre : les 18 tuiles sont identiques au jeu ; archives synchronisees localement.')

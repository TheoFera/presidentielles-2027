from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[3]
archive = (root.parent / 'Presidentielles 2027 - fichiers retirés' / '2026-10-09 carte plate seule' / 'docs/production/decor-v3/carte-plate').resolve()
patches = []
for number, zone, backup in [(8, 'b', 'periurbain-b-avant.png'), (9, 'c', 'periurbain-c-avant-raccord.png')]:
    name = f'tuile-{number:02d}-periurbain-{zone}.png'
    before = np.array(Image.open(root / 'docs/retouches-carte/sources' / backup).convert('RGB'))
    after = np.array(Image.open(root / 'assets/images/carte' / name).convert('RGB'))
    assert before.shape == after.shape == (1080, 1920, 3)
    changed = np.any(before != after, axis=2)
    Image.fromarray(changed.astype('uint8') * 255).save(root / f'docs/retouches-carte/sources/periurbain-{zone}-pixels-modifies.png')
    patches.append((number - 1, name, after, changed))

for relative in ['fresque-plate-maitre.png', 'production/fresque-en-cours.png']:
    target = (archive / relative).resolve()
    assert target.is_relative_to(archive) and target.is_file()
    image = Image.open(target).convert('RGB')
    assert image.size == (34560, 1080)
    for index, name, after, changed in patches:
        part = np.array(image.crop((1920*index, 0, 1920*(index+1), 1080)))
        outside = part[~changed].copy()
        part[changed] = after[changed]
        assert np.array_equal(part[~changed], outside)
        image.paste(Image.fromarray(part), (1920*index, 0))
    image.save(target)
    print('Synchronisé :', target)

for directory in ['tuiles', 'production/tuiles']:
    for index, name, after, changed in patches:
        target = (archive / directory / name).resolve()
        assert target.is_relative_to(archive) and target.is_file()
        part = np.array(Image.open(target).convert('RGB'))
        assert part.shape == after.shape
        outside = part[~changed].copy()
        part[changed] = after[changed]
        assert np.array_equal(part[~changed], outside)
        Image.fromarray(part).save(target)
        print('Synchronisé :', target)
